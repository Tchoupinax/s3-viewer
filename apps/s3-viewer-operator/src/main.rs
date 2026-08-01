use std::sync::Arc;

use chrono::Utc;
use futures::stream::StreamExt;
use kube::api::{Patch, PatchParams};
use kube::runtime::controller::Action;
use kube::runtime::controller::Error as ControllerError;
use kube::runtime::watcher::Config as WatchConfig;
use kube::runtime::watcher::Error as WatchError;
use kube::runtime::Controller;
use kube::{Api, Client, Config, Resource, ResourceExt};
use serde_json::json;
use s3_viewer_operator::crd::{S3Viewer, S3ViewerStatus};
use s3_viewer_operator::resources::{
    build_secret, deploy_s3viewer, ingress_url, resource_base_name, service_url,
};
use s3_viewer_operator::secrets::build_account_env_data;
use s3_viewer_operator::spec::resolve_effective_spec;
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

    let crd_api: Api<S3Viewer> = Api::all(kubernetes_client.clone());
    let context = Arc::new(ContextData {
        client: kubernetes_client,
        cluster_url: cluster_url.clone(),
    });

    log_info(&format!(
        "s3-viewer-operator started (Kubernetes API: {cluster_url})"
    ));

    let watch_config = WatchConfig::default().timeout(280);

    Controller::new(crd_api, watch_config)
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

    let action = match determine_action(&viewer) {
        ViewerAction::Register => {
            log_info(&format!("s3viewer created: {namespace}/{name}"));
            provision_s3viewer(&context, &namespace, &viewer).await?;
            s3_viewer_operator::finalizer::add(context.client.clone(), &name, &namespace).await?;
            Ok(Action::requeue(Duration::from_secs(30)))
        }
        ViewerAction::Unregister => {
            log_info(&format!("s3viewer deleted: {namespace}/{name}"));
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

async fn provision_s3viewer(
    context: &ContextData,
    namespace: &str,
    viewer: &S3Viewer,
) -> Result<(), Error> {
    let effective = resolve_effective_spec(&context.client, namespace, viewer).await?;

    if effective.accounts.is_empty() {
        return Err(Error::UserInputError(
            "spec.accounts must contain at least one S3 account (directly or via configRef)"
                .to_owned(),
        ));
    }

    let secret_data =
        build_account_env_data(&context.client, namespace, &effective.accounts).await?;
    let secret_name = resource_base_name(viewer);
    let secret = build_secret(viewer, secret_data);

    s3_viewer_operator::resources::ensure_secret(&context.client, namespace, &secret).await?;
    deploy_s3viewer(&context.client, namespace, viewer, &effective, &secret_name).await?;

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
            "deployed {} (service port {}, ingress: {})",
            resource_base_name(viewer),
            effective.service.as_ref().map(|s| s.port).unwrap_or(3000),
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
