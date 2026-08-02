use std::collections::BTreeMap;

use k8s_openapi::api::apps::v1::{Deployment, DeploymentSpec};
use k8s_openapi::api::core::v1::{
    Container, ContainerPort, EnvVar, PodSpec, PodTemplateSpec, ProjectedVolumeSource,
    Secret, SecretProjection, SecretVolumeSource, Service, ServicePort, ServiceSpec, Volume,
    VolumeMount, VolumeProjection,
};
use k8s_openapi::api::networking::v1::{
    HTTPIngressPath, HTTPIngressRuleValue, Ingress, IngressBackend, IngressRule,
    IngressServiceBackend, IngressSpec, IngressTLS, ServiceBackendPort,
};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::{LabelSelector, ObjectMeta, OwnerReference};
use k8s_openapi::ByteString;
use kube::api::{ListParams, Patch, PatchParams, PostParams};
use kube::{Api, Client, Resource, ResourceExt};

use crate::crd::{IngressSpec as ViewerIngressSpec, S3Viewer, S3ViewerConfig, ServiceSpec as ViewerServiceSpec};
use crate::secrets::build_account_env_data;
use crate::spec::{EffectiveSpec, ResolvedConfig};
use crate::Error;

const MANAGED_BY: &str = "s3-viewer-operator";
const APP_NAME: &str = "s3-viewer";
const DEFAULT_IMAGE: &str = "ghcr.io/tchoupinax/s3-viewer:latest";
const ACCOUNTS_VOLUME_NAME: &str = "account-config";
const ACCOUNTS_MOUNT_PATH: &str = "/etc/s3-viewer/accounts";

pub fn resource_base_name(viewer: &S3Viewer) -> String {
    format!("{}-s3-viewer", viewer.name_any())
}

pub fn default_image(effective: &EffectiveSpec) -> String {
    effective
        .image
        .as_ref()
        .map(|image| image.trim().to_owned())
        .filter(|image| !image.is_empty())
        .or_else(|| {
            std::env::var("S3_VIEWER_DEFAULT_IMAGE")
                .ok()
                .map(|image| image.trim().to_owned())
                .filter(|image| !image.is_empty())
        })
        .unwrap_or_else(|| DEFAULT_IMAGE.to_owned())
}

fn service_spec(effective: &EffectiveSpec) -> ViewerServiceSpec {
    effective
        .service
        .clone()
        .unwrap_or(crate::crd::ServiceSpec {
            port: 3000,
            r#type: "ClusterIP".to_owned(),
        })
}

fn labels(viewer: &S3Viewer) -> BTreeMap<String, String> {
    let mut labels = BTreeMap::new();
    labels.insert("app.kubernetes.io/name".to_owned(), APP_NAME.to_owned());
    labels.insert(
        "app.kubernetes.io/instance".to_owned(),
        viewer.name_any(),
    );
    labels.insert("app.kubernetes.io/managed-by".to_owned(), MANAGED_BY.to_owned());
    labels
}

fn owner_reference(viewer: &S3Viewer) -> OwnerReference {
    OwnerReference {
        api_version: S3Viewer::api_version(&()).to_string(),
        kind: S3Viewer::kind(&()).to_string(),
        name: viewer.name_any(),
        uid: viewer.meta().uid.clone().unwrap_or_default(),
        controller: Some(true),
        block_owner_deletion: Some(true),
    }
}

fn object_meta(viewer: &S3Viewer, name: &str) -> ObjectMeta {
    ObjectMeta {
        name: Some(name.to_owned()),
        namespace: viewer.namespace(),
        labels: Some(labels(viewer)),
        owner_references: Some(vec![owner_reference(viewer)]),
        ..Default::default()
    }
}

fn viewer_annotations(viewer: &S3Viewer, effective: &EffectiveSpec) -> BTreeMap<String, String> {
    let service = service_spec(effective);
    let mut annotations = BTreeMap::new();
    annotations.insert(
        "s3viewer.dev/service-name".to_owned(),
        resource_base_name(viewer),
    );
    annotations.insert(
        "s3viewer.dev/service-port".to_owned(),
        service.port.to_string(),
    );
    annotations.insert("s3viewer.dev/service-type".to_owned(), service.r#type.clone());

    if let Some(ingress) = &effective.ingress {
        annotations.insert("s3viewer.dev/ingress-host".to_owned(), ingress.host.clone());
        if let Some(class_name) = ingress.class_name.as_ref().filter(|v| !v.is_empty()) {
            annotations.insert("s3viewer.dev/ingress-class".to_owned(), class_name.clone());
        }
        if let Some(tls_secret) = ingress.tls_secret_name.as_ref().filter(|v| !v.is_empty()) {
            annotations.insert("s3viewer.dev/ingress-tls-secret".to_owned(), tls_secret.clone());
        }
    }

    annotations.insert(
        "s3viewer.dev/accounts-digest".to_owned(),
        crate::spec::accounts_digest(&effective.accounts),
    );

    annotations
}

fn pod_template_annotations(
    effective: &EffectiveSpec,
    secret_data: &BTreeMap<String, ByteString>,
) -> BTreeMap<String, String> {
    let mut annotations = BTreeMap::new();
    annotations.insert(
        "s3viewer.dev/accounts-digest".to_owned(),
        crate::spec::accounts_digest(&effective.accounts),
    );
    annotations.insert(
        "s3viewer.dev/secret-digest".to_owned(),
        secret_data_digest(secret_data),
    );
    annotations
}

fn secret_data_digest(data: &BTreeMap<String, ByteString>) -> String {
    let mut parts = data
        .iter()
        .map(|(key, value)| format!("{}={}", key, String::from_utf8_lossy(&value.0)))
        .collect::<Vec<_>>();
    parts.sort();
    parts.join("|")
}

pub struct AccountSecretMounts {
    pub merged_secret_data: std::collections::BTreeMap<String, ByteString>,
    pub mount_secret_names: Vec<String>,
}

pub fn config_account_secret_name(config: &S3ViewerConfig) -> String {
    format!("{}-accounts", config.name_any())
}

fn viewer_mount_secret_name(viewer: &S3Viewer, config: &ResolvedConfig) -> String {
    format!(
        "{}-{}-{}-accounts",
        resource_base_name(viewer),
        config.namespace,
        config.config.name_any()
    )
}

fn config_owner_reference(config: &S3ViewerConfig) -> OwnerReference {
    OwnerReference {
        api_version: S3ViewerConfig::api_version(&()).to_string(),
        kind: S3ViewerConfig::kind(&()).to_string(),
        name: config.name_any(),
        uid: config.meta().uid.clone().unwrap_or_default(),
        controller: Some(true),
        block_owner_deletion: Some(true),
    }
}

fn config_secret_labels(config: &ResolvedConfig) -> BTreeMap<String, String> {
    let mut labels = BTreeMap::new();
    labels.insert("app.kubernetes.io/managed-by".to_owned(), MANAGED_BY.to_owned());
    labels.insert(
        "s3viewer.dev/config-namespace".to_owned(),
        config.namespace.clone(),
    );
    labels.insert(
        "s3viewer.dev/config-name".to_owned(),
        config.config.name_any(),
    );
    labels
}

fn viewer_mount_secret_labels(viewer: &S3Viewer, config: &ResolvedConfig) -> BTreeMap<String, String> {
    let mut labels = config_secret_labels(config);
    labels.insert(
        "app.kubernetes.io/instance".to_owned(),
        viewer.name_any(),
    );
    labels.insert(
        "s3viewer.dev/viewer-instance".to_owned(),
        viewer.name_any(),
    );
    labels
}

pub fn build_config_account_secret(
    config: &ResolvedConfig,
    data: BTreeMap<String, ByteString>,
) -> Secret {
    Secret {
        metadata: ObjectMeta {
            name: Some(config_account_secret_name(&config.config)),
            namespace: Some(config.namespace.clone()),
            labels: Some(config_secret_labels(config)),
            owner_references: Some(vec![config_owner_reference(&config.config)]),
            ..Default::default()
        },
        type_: Some("Opaque".to_owned()),
        data: Some(data),
        string_data: None,
        ..Default::default()
    }
}

fn build_viewer_mount_secret(
    viewer: &S3Viewer,
    viewer_namespace: &str,
    config: &ResolvedConfig,
    data: BTreeMap<String, ByteString>,
) -> Secret {
    Secret {
        metadata: ObjectMeta {
            name: Some(viewer_mount_secret_name(viewer, config)),
            namespace: Some(viewer_namespace.to_owned()),
            labels: Some(viewer_mount_secret_labels(viewer, config)),
            owner_references: Some(vec![owner_reference(viewer)]),
            ..Default::default()
        },
        type_: Some("Opaque".to_owned()),
        data: Some(data),
        string_data: None,
        ..Default::default()
    }
}

pub async fn sync_config_account_secrets(
    client: &Client,
    viewer: &S3Viewer,
    viewer_namespace: &str,
    configs: &[ResolvedConfig],
) -> Result<AccountSecretMounts, Error> {
    let mut merged_secret_data = BTreeMap::new();
    let mut mount_secret_names = Vec::new();

    for config in configs {
        if config.config.spec.accounts.is_empty() {
            continue;
        }

        let sourced_accounts = config.sourced_accounts();
        let secret_data = build_account_env_data(client, &sourced_accounts).await?;
        let key_count = secret_data.len();

        let config_secret = build_config_account_secret(config, secret_data.clone());
        ensure_secret(client, &config.namespace, &config_secret).await?;
        crate::logging::info(&format!(
            "secret {}/{} updated ({} env keys, owner: S3ViewerConfig/{})",
            config.namespace,
            config_account_secret_name(&config.config),
            key_count,
            config.config.name_any()
        ));

        let mount_name = if config.namespace == viewer_namespace {
            config_account_secret_name(&config.config)
        } else {
            let mount_secret =
                build_viewer_mount_secret(viewer, viewer_namespace, config, secret_data.clone());
            let mount_name = mount_secret
                .metadata
                .name
                .clone()
                .unwrap_or_default();
            ensure_secret(client, viewer_namespace, &mount_secret).await?;
            crate::logging::info(&format!(
                "secret {viewer_namespace}/{mount_name} updated ({} env keys, mount replica for S3ViewerConfig {}/{})",
                key_count,
                config.namespace,
                config.config.name_any()
            ));
            mount_name
        };

        mount_secret_names.push(mount_name);
        merged_secret_data.extend(secret_data);
    }

    cleanup_viewer_account_mount_secrets(client, viewer_namespace, viewer, &mount_secret_names)
        .await?;
    delete_secret_if_present(client, viewer_namespace, &resource_base_name(viewer)).await?;

    Ok(AccountSecretMounts {
        merged_secret_data,
        mount_secret_names,
    })
}

pub async fn cleanup_viewer_account_mount_secrets(
    client: &Client,
    viewer_namespace: &str,
    viewer: &S3Viewer,
    active_mount_names: &[String],
) -> Result<(), Error> {
    let api: Api<Secret> = Api::namespaced(client.clone(), viewer_namespace);
    let label_selector = format!(
        "app.kubernetes.io/managed-by={},s3viewer.dev/viewer-instance={}",
        MANAGED_BY,
        viewer.name_any()
    );
    let list = api
        .list(&ListParams::default().labels(&label_selector))
        .await?;
    let active_names: std::collections::HashSet<&str> =
        active_mount_names.iter().map(String::as_str).collect();

    for secret in list.items {
        let name = secret.name_any();
        if !active_names.contains(name.as_str()) {
            delete_secret_if_present(client, viewer_namespace, &name).await?;
        }
    }

    Ok(())
}

fn build_accounts_volume(secret_names: &[String]) -> Option<Volume> {
    if secret_names.is_empty() {
        return None;
    }

    if secret_names.len() == 1 {
        return Some(Volume {
            name: ACCOUNTS_VOLUME_NAME.to_owned(),
            secret: Some(SecretVolumeSource {
                secret_name: Some(secret_names[0].clone()),
                optional: Some(true),
                ..Default::default()
            }),
            ..Default::default()
        });
    }

    Some(Volume {
        name: ACCOUNTS_VOLUME_NAME.to_owned(),
        projected: Some(ProjectedVolumeSource {
            sources: Some(
                secret_names
                    .iter()
                    .map(|name| VolumeProjection {
                        secret: Some(SecretProjection {
                            name: name.clone(),
                            ..Default::default()
                        }),
                        ..Default::default()
                    })
                    .collect(),
            ),
            ..Default::default()
        }),
        ..Default::default()
    })
}

fn build_container_env(service_port: i32, mount_accounts: bool) -> Vec<EnvVar> {
    let mut env = vec![
        EnvVar {
            name: "HOST".to_owned(),
            value: Some("0.0.0.0".to_owned()),
            ..Default::default()
        },
        EnvVar {
            name: "PORT".to_owned(),
            value: Some(service_port.to_string()),
            ..Default::default()
        },
        EnvVar {
            name: "NODE_ENV".to_owned(),
            value: Some("production".to_owned()),
            ..Default::default()
        },
    ];

    if mount_accounts {
        env.push(EnvVar {
            name: "S3_VIEWER_ACCOUNTS_DIR".to_owned(),
            value: Some(ACCOUNTS_MOUNT_PATH.to_owned()),
            ..Default::default()
        });
    }

    env
}

pub fn build_deployment(
    viewer: &S3Viewer,
    effective: &EffectiveSpec,
    mount_secret_names: &[String],
    secret_data: &BTreeMap<String, ByteString>,
) -> Deployment {
    let service = service_spec(effective);
    let image = default_image(effective);
    let selector_labels = labels(viewer);
    let mut metadata = object_meta(viewer, &resource_base_name(viewer));
    metadata.annotations = Some(viewer_annotations(viewer, effective));

    let accounts_volume_mount = VolumeMount {
        name: ACCOUNTS_VOLUME_NAME.to_owned(),
        mount_path: ACCOUNTS_MOUNT_PATH.to_owned(),
        read_only: Some(true),
        ..Default::default()
    };

    let mount_accounts = !mount_secret_names.is_empty();
    let (volumes, volume_mounts) = if let Some(volume) = build_accounts_volume(mount_secret_names) {
        (
            Some(vec![volume]),
            Some(vec![accounts_volume_mount]),
        )
    } else {
        (None, None)
    };

    Deployment {
        metadata,
        spec: Some(DeploymentSpec {
            replicas: Some(viewer.spec.replicas),
            selector: LabelSelector {
                match_labels: Some(selector_labels.clone()),
                ..Default::default()
            },
            template: PodTemplateSpec {
                metadata: Some(ObjectMeta {
                    labels: Some(selector_labels),
                    annotations: Some(pod_template_annotations(effective, secret_data)),
                    ..Default::default()
                }),
                spec: Some(PodSpec {
                    containers: vec![Container {
                        name: APP_NAME.to_owned(),
                        image: Some(image),
                        ports: Some(vec![ContainerPort {
                            container_port: service.port,
                            ..Default::default()
                        }]),
                        env: Some(build_container_env(service.port, mount_accounts)),
                        volume_mounts,
                        ..Default::default()
                    }],
                    volumes,
                    ..Default::default()
                }),
            },
            ..Default::default()
        }),
        ..Default::default()
    }
}

pub fn build_service(viewer: &S3Viewer, effective: &EffectiveSpec) -> Service {
    let service = service_spec(effective);
    let selector_labels = labels(viewer);
    let mut metadata = object_meta(viewer, &resource_base_name(viewer));
    metadata.annotations = Some(viewer_annotations(viewer, effective));

    Service {
        metadata,
        spec: Some(ServiceSpec {
            type_: Some(service.r#type),
            selector: Some(selector_labels),
            ports: Some(vec![ServicePort {
                port: service.port,
                target_port: Some(k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(
                    service.port,
                )),
                ..Default::default()
            }]),
            ..Default::default()
        }),
        ..Default::default()
    }
}

pub fn build_ingress(viewer: &S3Viewer, effective: &EffectiveSpec, ingress: &ViewerIngressSpec) -> Ingress {
    let service = service_spec(effective);
    let name = format!("{}-s3-viewer", viewer.name_any());

    let mut metadata = object_meta(viewer, &name);
    if let Some(class_name) = ingress.class_name.as_ref().filter(|v| !v.is_empty()) {
        let mut annotations = BTreeMap::new();
        annotations.insert(
            "kubernetes.io/ingress.class".to_owned(),
            class_name.clone(),
        );
        metadata.annotations = Some(annotations);
    }

    let tls = ingress.tls_secret_name.as_ref().map(|secret_name| {
        vec![IngressTLS {
            hosts: Some(vec![ingress.host.clone()]),
            secret_name: Some(secret_name.clone()),
        }]
    });

    Ingress {
        metadata,
        spec: Some(IngressSpec {
            ingress_class_name: ingress.class_name.clone(),
            tls,
            rules: Some(vec![IngressRule {
                host: Some(ingress.host.clone()),
                http: Some(HTTPIngressRuleValue {
                    paths: vec![HTTPIngressPath {
                        path: Some("/".to_owned()),
                        path_type: "Prefix".to_owned(),
                        backend: IngressBackend {
                            service: Some(IngressServiceBackend {
                                name: resource_base_name(viewer),
                                port: Some(ServiceBackendPort {
                                    number: Some(service.port),
                                    ..Default::default()
                                }),
                            }),
                            ..Default::default()
                        },
                    }],
                }),
            }]),
            ..Default::default()
        }),
        ..Default::default()
    }
}

pub async fn deploy_s3viewer(
    client: &Client,
    namespace: &str,
    viewer: &S3Viewer,
    effective: &EffectiveSpec,
    mount_secret_names: &[String],
    secret_data: &BTreeMap<String, ByteString>,
) -> Result<(), Error> {
    let deployment = build_deployment(viewer, effective, mount_secret_names, secret_data);
    let service = build_service(viewer, effective);

    ensure_deployment(client, namespace, &deployment).await?;
    ensure_service(client, namespace, &service).await?;

    if let Some(ingress_spec) = &effective.ingress {
        let ingress = build_ingress(viewer, effective, ingress_spec);
        ensure_ingress(client, namespace, &ingress).await?;
    } else {
        delete_ingress_if_present(client, namespace, &resource_base_name(viewer)).await?;
    }

    Ok(())
}

async fn apply_resource<T>(api: &Api<T>, name: &str, resource: &T) -> Result<(), Error>
where
    T: kube::Resource
        + Clone
        + std::fmt::Debug
        + serde::Serialize
        + serde::de::DeserializeOwned,
{
    let patch_params = PatchParams::apply("s3-viewer-operator").force();
    match api.get(name).await {
        Ok(_) => {
            api.patch(name, &patch_params, &Patch::Apply(resource))
                .await?;
        }
        Err(kube::Error::Api(response)) if response.code == 404 => {
            api.create(&PostParams::default(), resource).await?;
        }
        Err(source) => return Err(Error::KubeError { source }),
    }

    Ok(())
}

pub async fn ensure_secret(client: &Client, namespace: &str, secret: &Secret) -> Result<usize, Error> {
    let name = secret
        .metadata
        .name
        .clone()
        .ok_or_else(|| Error::UserInputError("secret name is required".to_owned()))?;
    let key_count = secret.data.as_ref().map(|data| data.len()).unwrap_or(0);
    let api: Api<Secret> = Api::namespaced(client.clone(), namespace);
    match api.get(&name).await {
        Ok(existing) => {
            let mut replacement = secret.clone();
            replacement.metadata.resource_version = existing.metadata.resource_version;
            api.replace(&name, &PostParams::default(), &replacement).await?;
        }
        Err(kube::Error::Api(response)) if response.code == 404 => {
            api.create(&PostParams::default(), secret).await?;
        }
        Err(source) => return Err(Error::KubeError { source }),
    }

    Ok(key_count)
}

pub async fn cleanup_legacy_per_config_account_secrets(
    client: &Client,
    viewer_namespace: &str,
    viewer: &S3Viewer,
) -> Result<(), Error> {
    let api: Api<Secret> = Api::namespaced(client.clone(), viewer_namespace);
    let label_selector = format!(
        "app.kubernetes.io/managed-by={},app.kubernetes.io/instance={}",
        MANAGED_BY,
        viewer.name_any()
    );
    let list = api
        .list(&ListParams::default().labels(&label_selector))
        .await?;
    let active_name = resource_base_name(viewer);
    let legacy_prefix = format!("{}-", active_name);

    for secret in list.items {
        let name = secret.name_any();
        if name == active_name
            || (name.starts_with(&legacy_prefix) && name.ends_with("-accounts"))
        {
            delete_secret_if_present(client, viewer_namespace, &name).await?;
        }
    }

    Ok(())
}

pub async fn delete_secret_if_present(
    client: &Client,
    namespace: &str,
    name: &str,
) -> Result<(), Error> {
    let api: Api<Secret> = Api::namespaced(client.clone(), namespace);
    match api.delete(name, &Default::default()).await {
        Ok(_) => Ok(()),
        Err(kube::Error::Api(response)) if response.code == 404 => Ok(()),
        Err(source) => Err(Error::KubeError { source }),
    }
}

pub async fn ensure_deployment(
    client: &Client,
    namespace: &str,
    deployment: &Deployment,
) -> Result<(), Error> {
    let name = deployment
        .metadata
        .name
        .clone()
        .ok_or_else(|| Error::UserInputError("deployment name is required".to_owned()))?;
    let api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
    apply_resource(&api, &name, deployment).await
}

pub async fn ensure_service(client: &Client, namespace: &str, service: &Service) -> Result<(), Error> {
    let name = service
        .metadata
        .name
        .clone()
        .ok_or_else(|| Error::UserInputError("service name is required".to_owned()))?;
    let api: Api<Service> = Api::namespaced(client.clone(), namespace);
    apply_resource(&api, &name, service).await
}

pub async fn ensure_ingress(
    client: &Client,
    namespace: &str,
    ingress: &Ingress,
) -> Result<(), Error> {
    let name = ingress
        .metadata
        .name
        .clone()
        .ok_or_else(|| Error::UserInputError("ingress name is required".to_owned()))?;
    let api: Api<Ingress> = Api::namespaced(client.clone(), namespace);
    apply_resource(&api, &name, ingress).await
}

pub async fn delete_ingress_if_present(
    client: &Client,
    namespace: &str,
    name: &str,
) -> Result<(), Error> {
    let api: Api<Ingress> = Api::namespaced(client.clone(), namespace);
    match api.delete(name, &Default::default()).await {
        Ok(_) => Ok(()),
        Err(kube::Error::Api(response)) if response.code == 404 => Ok(()),
        Err(source) => Err(Error::KubeError { source }),
    }
}

pub async fn deployment_ready(
    client: &Client,
    namespace: &str,
    name: &str,
) -> Result<bool, Error> {
    let api: Api<Deployment> = Api::namespaced(client.clone(), namespace);
    let deployment = api.get(name).await?;
    let status = deployment.status.unwrap_or_default();
    let desired = deployment.spec.and_then(|spec| spec.replicas).unwrap_or(1);
    let ready = status.ready_replicas.unwrap_or(0);
    Ok(ready >= desired && desired > 0)
}

pub fn service_url(namespace: &str, viewer: &S3Viewer, effective: &EffectiveSpec) -> String {
    let service = service_spec(effective);
    format!(
        "http://{}.{}.svc.cluster.local:{}",
        resource_base_name(viewer),
        namespace,
        service.port
    )
}

pub fn ingress_url(ingress: &ViewerIngressSpec) -> String {
    format!("https://{}", ingress.host)
}
