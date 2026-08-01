use kube::Api;

use crate::crd::{
    IngressSpec, S3AccountSpec, S3Viewer, S3ViewerConfig, S3ViewerConfigSpec, ServiceSpec,
};
use crate::Error;

pub struct EffectiveSpec {
    pub image: Option<String>,
    pub accounts: Vec<S3AccountSpec>,
    pub service: Option<ServiceSpec>,
    pub ingress: Option<IngressSpec>,
}

pub async fn resolve_effective_spec(
    client: &kube::Client,
    namespace: &str,
    viewer: &S3Viewer,
) -> Result<EffectiveSpec, Error> {
    let config_spec = load_config_spec(client, namespace, viewer).await?;

    let accounts = if viewer.spec.accounts.is_empty() {
        config_spec.accounts
    } else {
        viewer.spec.accounts.clone()
    };

    Ok(EffectiveSpec {
        image: viewer.spec.image.clone().or(config_spec.image),
        accounts,
        service: viewer.spec.service.clone().or(config_spec.service),
        ingress: viewer.spec.ingress.clone().or(config_spec.ingress),
    })
}

async fn load_config_spec(
    client: &kube::Client,
    namespace: &str,
    viewer: &S3Viewer,
) -> Result<S3ViewerConfigSpec, Error> {
    match &viewer.spec.config_ref {
        None => Ok(empty_config_spec()),
        Some(config_ref) => {
            let api: Api<S3ViewerConfig> = Api::namespaced(client.clone(), namespace);
            let config = api.get(&config_ref.name).await?;
            Ok(config.spec)
        }
    }
}

fn empty_config_spec() -> S3ViewerConfigSpec {
    S3ViewerConfigSpec {
        image: None,
        accounts: vec![],
        service: None,
        ingress: None,
    }
}
