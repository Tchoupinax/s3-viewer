use std::collections::BTreeMap;

use k8s_openapi::api::core::v1::Secret;
use k8s_openapi::ByteString;
use kube::Api;

use crate::crd::S3AccountSpec;
use crate::Error;

pub async fn build_account_env_data(
    client: &kube::Client,
    namespace: &str,
    accounts: &[S3AccountSpec],
) -> Result<BTreeMap<String, ByteString>, Error> {
    let mut data = BTreeMap::new();

    for account in accounts {
        validate_account_key(&account.account_key)?;

        let credentials = read_credentials_secret(
            client,
            namespace,
            &account.credentials_secret_ref.name,
            &account.credentials_secret_ref.access_key_key,
            &account.credentials_secret_ref.secret_key_key,
        )
        .await?;

        let prefix = format!("S3_VIEWER_ACCOUNT_{}", account.account_key.to_uppercase());
        data.insert(
            format!("{prefix}_ACCESS_KEY"),
            ByteString(credentials.access_key.into_bytes()),
        );
        data.insert(
            format!("{prefix}_SECRET_KEY"),
            ByteString(credentials.secret_key.into_bytes()),
        );
        data.insert(
            format!("{prefix}_ENDPOINT"),
            ByteString(account.endpoint.as_bytes().to_vec()),
        );
        data.insert(
            format!("{prefix}_ID"),
            ByteString(account.id.as_bytes().to_vec()),
        );
        data.insert(
            format!("{prefix}_NAME"),
            ByteString(account.name.as_bytes().to_vec()),
        );
        data.insert(
            format!("{prefix}_REGION"),
            ByteString(account.region.as_bytes().to_vec()),
        );
        if account.read_only {
            data.insert(
                format!("{prefix}_READ_ONLY"),
                ByteString("true".as_bytes().to_vec()),
            );
        }
    }

    Ok(data)
}

struct Credentials {
    access_key: String,
    secret_key: String,
}

async fn read_credentials_secret(
    client: &kube::Client,
    namespace: &str,
    secret_name: &str,
    access_key_key: &str,
    secret_key_key: &str,
) -> Result<Credentials, Error> {
    let api: Api<Secret> = Api::namespaced(client.clone(), namespace);
    let secret = api.get(secret_name).await?;

    let read_key = |key: &str| -> Result<String, Error> {
        if let Some(data) = secret.data.as_ref().and_then(|d| d.get(key)) {
            return String::from_utf8(data.0.clone()).map_err(|_| {
                Error::UserInputError(format!(
                    "secret {secret_name} key {key} is not valid UTF-8"
                ))
            });
        }

        if let Some(string_data) = secret.string_data.as_ref().and_then(|d| d.get(key)) {
            return Ok(string_data.clone());
        }

        Err(Error::UserInputError(format!(
            "secret {secret_name} missing key {key}"
        )))
    };

    Ok(Credentials {
        access_key: read_key(access_key_key)?,
        secret_key: read_key(secret_key_key)?,
    })
}

fn validate_account_key(account_key: &str) -> Result<(), Error> {
    if account_key.is_empty() {
        return Err(Error::UserInputError(
            "accountKey must not be empty".to_owned(),
        ));
    }

    if !account_key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err(Error::UserInputError(format!(
            "accountKey {account_key} must contain only letters, numbers, and underscores"
        )));
    }

    Ok(())
}
