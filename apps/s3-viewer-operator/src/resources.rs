use std::collections::BTreeMap;

use k8s_openapi::api::apps::v1::{Deployment, DeploymentSpec};
use k8s_openapi::api::core::v1::{
    Container, ContainerPort, EnvFromSource, EnvVar, PodSpec, PodTemplateSpec, Secret,
    SecretEnvSource, Service, ServicePort, ServiceSpec,
};
use k8s_openapi::api::networking::v1::{
    HTTPIngressPath, HTTPIngressRuleValue, Ingress, IngressBackend, IngressRule,
    IngressServiceBackend, IngressSpec, IngressTLS, ServiceBackendPort,
};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::{LabelSelector, ObjectMeta, OwnerReference};
use k8s_openapi::ByteString;
use kube::api::{Patch, PatchParams, PostParams};
use kube::{Api, Client, Resource, ResourceExt};

use crate::crd::{IngressSpec as ViewerIngressSpec, S3Viewer, ServiceSpec as ViewerServiceSpec};
use crate::Error;

const MANAGED_BY: &str = "s3-viewer-operator";
const APP_NAME: &str = "s3-viewer";
const DEFAULT_IMAGE: &str = "ghcr.io/tchoupinax/s3-viewer:latest";

pub fn resource_base_name(viewer: &S3Viewer) -> String {
    format!("{}-s3-viewer", viewer.name_any())
}

pub fn default_image(viewer: &S3Viewer) -> String {
    viewer
        .spec
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

fn service_spec(viewer: &S3Viewer) -> ViewerServiceSpec {
    viewer.spec.service.clone().unwrap_or(crate::crd::ServiceSpec {
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

fn viewer_annotations(viewer: &S3Viewer) -> BTreeMap<String, String> {
    let service = service_spec(viewer);
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

    if let Some(ingress) = &viewer.spec.ingress {
        annotations.insert("s3viewer.dev/ingress-host".to_owned(), ingress.host.clone());
        if let Some(class_name) = ingress.class_name.as_ref().filter(|v| !v.is_empty()) {
            annotations.insert("s3viewer.dev/ingress-class".to_owned(), class_name.clone());
        }
        if let Some(tls_secret) = ingress.tls_secret_name.as_ref().filter(|v| !v.is_empty()) {
            annotations.insert("s3viewer.dev/ingress-tls-secret".to_owned(), tls_secret.clone());
        }
    }

    annotations
}

pub fn build_secret(viewer: &S3Viewer, data: BTreeMap<String, ByteString>) -> Secret {
    Secret {
        metadata: object_meta(viewer, &resource_base_name(viewer)),
        data: Some(data),
        ..Default::default()
    }
}

pub fn build_deployment(viewer: &S3Viewer, secret_name: &str) -> Deployment {
    let service = service_spec(viewer);
    let image = default_image(viewer);
    let selector_labels = labels(viewer);
    let mut metadata = object_meta(viewer, &resource_base_name(viewer));
    metadata.annotations = Some(viewer_annotations(viewer));

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
                        env: Some(vec![
                            EnvVar {
                                name: "HOST".to_owned(),
                                value: Some("0.0.0.0".to_owned()),
                                ..Default::default()
                            },
                            EnvVar {
                                name: "PORT".to_owned(),
                                value: Some(service.port.to_string()),
                                ..Default::default()
                            },
                            EnvVar {
                                name: "NODE_ENV".to_owned(),
                                value: Some("production".to_owned()),
                                ..Default::default()
                            },
                        ]),
                        env_from: Some(vec![EnvFromSource {
                            secret_ref: Some(SecretEnvSource {
                                name: secret_name.to_owned(),
                                optional: None,
                            }),
                            ..Default::default()
                        }]),
                        ..Default::default()
                    }],
                    ..Default::default()
                }),
            },
            ..Default::default()
        }),
        ..Default::default()
    }
}

pub fn build_service(viewer: &S3Viewer) -> Service {
    let service = service_spec(viewer);
    let selector_labels = labels(viewer);
    let mut metadata = object_meta(viewer, &resource_base_name(viewer));
    metadata.annotations = Some(viewer_annotations(viewer));

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

pub fn build_ingress(viewer: &S3Viewer, ingress: &ViewerIngressSpec) -> Ingress {
    let service = service_spec(viewer);
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
    secret_name: &str,
) -> Result<(), Error> {
    let deployment = build_deployment(viewer, secret_name);
    let service = build_service(viewer);

    ensure_deployment(client, namespace, &deployment).await?;
    ensure_service(client, namespace, &service).await?;

    if let Some(ingress_spec) = &viewer.spec.ingress {
        let ingress = build_ingress(viewer, ingress_spec);
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

pub async fn ensure_secret(client: &Client, namespace: &str, secret: &Secret) -> Result<(), Error> {
    let name = secret
        .metadata
        .name
        .clone()
        .ok_or_else(|| Error::UserInputError("secret name is required".to_owned()))?;
    let api: Api<Secret> = Api::namespaced(client.clone(), namespace);
    apply_resource(&api, &name, secret).await
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

pub fn service_url(namespace: &str, viewer: &S3Viewer) -> String {
    let service = service_spec(viewer);
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
