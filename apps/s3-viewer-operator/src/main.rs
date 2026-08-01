use std::sync::Arc;

use chrono::Utc;
use futures::stream::StreamExt;
use kube::api::{Patch, PatchParams};
use kube::runtime::controller::Action;
use kube::runtime::controller::Error as ControllerError;
use kube::runtime::reflector::ObjectRef;
use kube::runtime::watcher::Config as WatchConfig;
use kube::runtime::watcher::Error as WatchError;
use kube::runtime::Controller;
use kube::{Api, Client, Config, Resource, ResourceExt};
use serde_json::json;
use s3_viewer_operator::crd::{S3Viewer, S3ViewerConfig, S3ViewerStatus};
use s3_viewer_operator::resources::{
    build_secret, deploy_s3viewer, ingress_url, resource_base_name, service_url,
};
use s3_viewer_operator::secrets::build_account_env_data;
use s3_viewer_operator::spec::{
    describe_sourced_accounts, resolve_effective_spec, watched_config_namespaces,
};
use s3_viewer_operator::viewer_index::{register_viewer, unregister_viewer, ViewerIndex};
use s3_viewer_operator::Error;
use tokio::time::Duration;

#[tokio::main]
async fn main() {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("failed to install rustls ring crypto provider");

    let mut kube_config = Config::infer()
        .await
        .expect("Expected a valid KUBECONFIG environment variable.");
    kube_config.read_timeout = None;
    let cluster_url = kube_config.cluster_url.to_string();

    let kubernetes_client = Client::try_from(kube_config)
        .expect("Failed to create Kubernetes client.");

    let viewer_api: Api<S3Viewer> = Api::all(kubernetes_client.clone());
    let config_api: Api<S3ViewerConfig> = Api::all(kubernetes_client.clone());
    let context = Arc::new(ContextData {
        client: kubernetes_client,
        cluster_url: cluster_url.clone(),
        viewer_index: ViewerIndex::new(),
    });

    log_info(&format!(
        "s3-viewer-operator started (Kubernetes API: {cluster_url})"
    ));

    let watch_config = WatchConfig::default().timeout(280);
    let context_for_watches = context.clone();

    Controller::new(viewer_api, watch_config.clone())
        .watches(
            config_api,
            watch_config,
            move |config: S3ViewerConfig| {
                let config_namespace = config.namespace().unwrap_or_default();
                context_for_watches
                    .viewer_index
                    .viewers_for_namespace(&config_namespace)
            },
        )
        .run(reconcile, on_error, context)
        .for_each(|result| {
            let cluster_url = cluster_url.clone();
            async move {
                if let Err(err) = result {
                    log_controller_error(&cluster_url, &err);
                }
            }
        })
        .await;
}

fn log_info(message: &str) {
    println!("[{}] {}", Utc::now().to_rfc3339(), message);
}

fn log_error(message: &str) {
    eprintln!("[{}] ERROR {}", Utc::now().to_rfc3339(), message);
}

fn format_reconcile_target(namespace: &str, name: &str) -> String {
    format!("{namespace}/{name}")
}

fn log_reconcile_error(namespace: &str, name: &str, error: &Error) {
    log_error(&format!(
        "reconcile failed for s3viewer {}: {}",
        format_reconcile_target(namespace, name),
        error
    ));
}

async fn publish_error_status(
    client: &Client,
    name: &str,
    namespace: &str,
    error: &Error,
) -> Result<(), Error> {
    let status = S3ViewerStatus {
        ready: false,
        last_sync_time: Some(Utc::now().to_rfc3339()),
        message: Some(error.to_string()),
        url: None,
    };
    update_status(client, name, namespace, status).await
}

fn is_not_found(err: &kube::Error) -> bool {
    matches!(err, kube::Error::Api(response) if response.code == 404)
}

fn error_is_object_gone(err: &Error) -> bool {
    matches!(err, Error::KubeError { source } if is_not_found(source))
}

fn log_controller_error(
    cluster_url: &str,
    err: &ControllerError<Error, WatchError>,
) {
    match err {
        ControllerError::QueueError(source) => {
            log_error(&format!("controller queue error ({cluster_url}): {source:?}"));
        }
        ControllerError::ObjectNotFound(_) => {}
        ControllerError::ReconcilerFailed(source, object) if error_is_object_gone(source) => {}
        ControllerError::ReconcilerFailed(source, object) => {
            log_error(&format!(
                "reconciliation error for {object:?} ({cluster_url}): {source}"
            ));
        }
        other => {
            log_error(&format!("controller error ({cluster_url}): {other:?}"));
        }
    }
}

struct ContextData {
    client: Client,
    cluster_url: String,
    viewer_index: ViewerIndex,
}

enum ViewerAction {
    Register,
    Unregister,
    NoOp,
}

async fn reconcile(viewer: Arc<S3Viewer>, context: Arc<ContextData>) -> Result<Action, Error> {
    let namespace = viewer.namespace().ok_or_else(|| {
        Error::UserInputError("Expected S3Viewer resource to be namespaced.".to_owned())
    })?;
    let name = viewer.name_any();

    let viewer = match fetch_viewer(&context.client, &namespace, &name).await {
        Ok(fresh) => Arc::new(fresh),
        Err(Error::KubeError { source }) if is_not_found(&source) => viewer,
        Err(err) => return Err(err),
    };

    register_viewer(&context.viewer_index, &viewer);

    let action = match determine_action(&viewer) {
        ViewerAction::Register => {
            log_info(&format!(
                "s3viewer created: {namespace}/{name} (generation {})",
                viewer.meta().generation.unwrap_or(0)
            ));
            provision_s3viewer(&context, &namespace, &viewer).await?;
            s3_viewer_operator::finalizer::add(context.client.clone(), &name, &namespace).await?;
            Ok(Action::requeue(Duration::from_secs(30)))
        }
        ViewerAction::Unregister => {
            log_info(&format!("s3viewer deleted: {namespace}/{name}"));
            unregister_viewer(&context.viewer_index, ObjectRef::from(&*viewer));
            s3_viewer_operator::resources::delete_ingress_if_present(
                &context.client,
                &namespace,
                &resource_base_name(&viewer),
            )
            .await?;
            match s3_viewer_operator::finalizer::delete(context.client.clone(), &name, &namespace).await {
                Ok(_) => {}
                Err(err) if is_not_found(&err) => {}
                Err(source) => Err(Error::KubeError { source })?,
            }
            Ok(Action::await_change())
        }
        ViewerAction::NoOp => {
            log_info(&format!(
                "s3viewer updated: {namespace}/{name} (generation {}, configNamespaces: {:?})",
                viewer.meta().generation.unwrap_or(0),
                viewer.spec.config_namespaces
            ));
            provision_s3viewer(&context, &namespace, &viewer).await?;
            Ok(Action::requeue(Duration::from_secs(30)))
        }
    };

    if let Err(error) = &action {
        log_reconcile_error(&namespace, &name, error);
        if let Err(status_err) = publish_error_status(&context.client, &name, &namespace, error).await {
            log_error(&format!(
                "failed to write error status for {}: {}",
                format_reconcile_target(&namespace, &name),
                status_err
            ));
        }
    }

    action
}

async fn fetch_viewer(client: &Client, namespace: &str, name: &str) -> Result<S3Viewer, Error> {
    let api: Api<S3Viewer> = Api::namespaced(client.clone(), namespace);
    match api.get(name).await {
        Ok(viewer) => Ok(viewer),
        Err(source) => Err(Error::KubeError { source }),
    }
}

async fn provision_s3viewer(
    context: &ContextData,
    namespace: &str,
    viewer: &S3Viewer,
) -> Result<(), Error> {
    let config_namespaces = watched_config_namespaces(viewer, namespace);
    log_info(&format!(
        "provisioning {}: scanning configNamespaces [{}]",
        format_reconcile_target(namespace, &viewer.name_any()),
        config_namespaces.join(",")
    ));

    let effective = resolve_effective_spec(&context.client, namespace, viewer).await?;

    log_info(&format!(
        "resolved {} account(s) for {}: {}",
        effective.accounts.len(),
        format_reconcile_target(namespace, &viewer.name_any()),
        describe_sourced_accounts(&effective.accounts)
    ));

    let secret_name = resource_base_name(viewer);
    let secret_data = if effective.accounts.is_empty() {
        log_error(&format!(
            "no S3 accounts for {} in configNamespaces [{}]; clearing secret {}",
            format_reconcile_target(namespace, &viewer.name_any()),
            config_namespaces.join(","),
            secret_name
        ));
        std::collections::BTreeMap::new()
    } else {
        build_account_env_data(&context.client, &effective.accounts).await?
    };

    let secret = build_secret(viewer, secret_data.clone());
    let key_count =
        s3_viewer_operator::resources::ensure_secret(&context.client, namespace, &secret).await?;
    log_info(&format!(
        "secret {}/{} updated ({} env keys, digest accounts: {})",
        namespace,
        secret_name,
        key_count,
        s3_viewer_operator::spec::accounts_digest(&effective.accounts)
    ));

    if effective.accounts.is_empty() {
        return Err(Error::UserInputError(
            "no S3 accounts found: add spec.accounts or S3ViewerConfig resources in configNamespaces"
                .to_owned(),
        ));
    }

    deploy_s3viewer(
        &context.client,
        namespace,
        viewer,
        &effective,
        &secret_name,
        &secret_data,
    )
    .await?;

    let mut url = service_url(namespace, viewer, &effective);
    if let Some(ingress_spec) = &effective.ingress {
        url = ingress_url(ingress_spec);
    }

    let ready =
        s3_viewer_operator::resources::deployment_ready(&context.client, namespace, &secret_name)
            .await?;
    let status = S3ViewerStatus {
        ready,
        last_sync_time: Some(Utc::now().to_rfc3339()),
        message: Some(format!(
            "deployed {} (configNamespaces: {}, accounts: {}, ingress: {})",
            resource_base_name(viewer),
            config_namespaces.join(","),
            effective.accounts.len(),
            effective
                .ingress
                .as_ref()
                .map(|i| i.host.clone())
                .unwrap_or_else(|| "none".to_owned()),
        )),
        url: Some(url),
    };

    if status_needs_update(viewer.status.as_ref(), &status) {
        update_status(&context.client, &viewer.name_any(), namespace, status).await?;
    }

    Ok(())
}

fn determine_action(viewer: &S3Viewer) -> ViewerAction {
    if viewer.meta().deletion_timestamp.is_some() {
        return ViewerAction::Unregister;
    }

    if viewer
        .meta()
        .finalizers
        .as_ref()
        .is_none_or(|finalizers| finalizers.is_empty())
    {
        ViewerAction::Register
    } else {
        ViewerAction::NoOp
    }
}

fn status_needs_update(current: Option<&S3ViewerStatus>, desired: &S3ViewerStatus) -> bool {
    match current {
        None => true,
        Some(current) => {
            current.ready != desired.ready
                || current.message != desired.message
                || current.url != desired.url
        }
    }
}

async fn update_status(
    client: &Client,
    name: &str,
    namespace: &str,
    status: S3ViewerStatus,
) -> Result<(), Error> {
    let api: Api<S3Viewer> = Api::namespaced(client.clone(), namespace);
    let patch = json!({ "status": status });
    match api
        .patch_status(name, &PatchParams::default(), &Patch::Merge(&patch))
        .await
    {
        Ok(_) => Ok(()),
        Err(err) if is_not_found(&err) => Ok(()),
        Err(source) => Err(Error::KubeError { source }),
    }
}

fn on_error(viewer: Arc<S3Viewer>, error: &Error, context: Arc<ContextData>) -> Action {
    if error_is_object_gone(error) {
        return Action::await_change();
    }

    let namespace = viewer
        .namespace()
        .unwrap_or_else(|| "unknown".to_owned());
    let name = viewer.name_any();
    log_error(&format!(
        "reconcile retry scheduled for s3viewer {} (Kubernetes API: {}): {}",
        format_reconcile_target(&namespace, &name),
        context.cluster_url,
        error
    ));

    Action::requeue(Duration::from_secs(5))
}
