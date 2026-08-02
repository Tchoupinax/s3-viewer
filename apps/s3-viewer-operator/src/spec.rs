use std::collections::HashSet;

use kube::Api;
use kube::ResourceExt;

use crate::crd::{IngressSpec, S3AccountSpec, S3Viewer, S3ViewerConfig, ServiceSpec};
use crate::Error;

pub struct EffectiveSpec {
    pub image: Option<String>,
    pub accounts: Vec<SourcedAccount>,
    pub service: Option<ServiceSpec>,
    pub ingress: Option<IngressSpec>,
}

#[derive(Debug, Clone)]
pub struct SourcedAccount {
    pub account: S3AccountSpec,
    pub credentials_namespace: String,
    pub config_name: Option<String>,
}

pub async fn resolve_effective_spec(
    client: &kube::Client,
    namespace: &str,
    viewer: &S3Viewer,
) -> Result<EffectiveSpec, Error> {
    let config_accounts = list_config_accounts(client, viewer, namespace).await?;
    let accounts = dedupe_account_keys(config_accounts)?;

    Ok(EffectiveSpec {
        image: viewer.spec.image.clone(),
        accounts,
        service: viewer.spec.service.clone(),
        ingress: viewer.spec.ingress.clone(),
    })
}

async fn list_config_accounts(
    client: &kube::Client,
    viewer: &S3Viewer,
    viewer_namespace: &str,
) -> Result<Vec<SourcedAccount>, Error> {
    let namespaces = config_namespaces(viewer, viewer_namespace);
    let mut accounts = Vec::new();

    for namespace in namespaces {
        let api: Api<S3ViewerConfig> = Api::namespaced(client.clone(), &namespace);
        let list = api.list(&Default::default()).await?;
        for config in list.items {
            let config_name = config.name_any();
            for account in &config.spec.accounts {
                accounts.push(SourcedAccount {
                    account: account.clone(),
                    credentials_namespace: namespace.clone(),
                    config_name: Some(config_name.clone()),
                });
            }
        }
    }

    Ok(accounts)
}

fn config_namespaces(viewer: &S3Viewer, viewer_namespace: &str) -> Vec<String> {
    match &viewer.spec.config_namespaces {
        Some(namespaces) if !namespaces.is_empty() => namespaces.clone(),
        Some(_) | None => vec![viewer_namespace.to_owned()],
    }
}

fn dedupe_account_keys(accounts: impl IntoIterator<Item = SourcedAccount>) -> Result<Vec<SourcedAccount>, Error> {
    let mut used_keys = HashSet::new();
    let mut resolved = Vec::new();

    for sourced in accounts {
        let mut account = sourced.account.clone();
        let mut key = account.account_key.to_uppercase();

        if !used_keys.insert(key.clone()) {
            if let Some(config_name) = &sourced.config_name {
                account.account_key = format!("{}_{}", config_name, account.account_key);
                key = account.account_key.to_uppercase();
                if !used_keys.insert(key) {
                    return Err(Error::UserInputError(format!(
                        "duplicate accountKey {} after prefixing with config name {}",
                        account.account_key, config_name
                    )));
                }
            } else {
                return Err(Error::UserInputError(format!(
                    "duplicate accountKey {}",
                    account.account_key
                )));
            }
        }

        resolved.push(SourcedAccount {
            account,
            credentials_namespace: sourced.credentials_namespace,
            config_name: sourced.config_name,
        });
    }

    Ok(resolved)
}

pub fn watched_config_namespaces(viewer: &S3Viewer, viewer_namespace: &str) -> Vec<String> {
    config_namespaces(viewer, viewer_namespace)
}

pub fn accounts_digest(accounts: &[SourcedAccount]) -> String {
    let mut parts = accounts
        .iter()
        .map(|sourced| {
            format!(
                "{}:{}:{}",
                sourced.credentials_namespace,
                sourced.config_name.as_deref().unwrap_or("inline"),
                sourced.account.account_key
            )
        })
        .collect::<Vec<_>>();
    parts.sort();
    parts.join("|")
}

pub fn describe_sourced_accounts(accounts: &[SourcedAccount]) -> String {
    accounts
        .iter()
        .map(|sourced| {
            format!(
                "{}@{} (config: {}, id: {})",
                sourced.account.account_key,
                sourced.credentials_namespace,
                sourced.config_name.as_deref().unwrap_or("inline"),
                sourced.account.id
            )
        })
        .collect::<Vec<_>>()
        .join(", ")
}
