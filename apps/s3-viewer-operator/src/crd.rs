use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(CustomResource, Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[kube(
    group = "s3viewer.dev",
    version = "v1",
    kind = "S3Viewer",
    plural = "s3viewers",
    derive = "PartialEq",
    namespaced,
    status = "S3ViewerStatus",
    printcolumn = r#"{"name":"Ready", "type":"boolean", "jsonPath":".status.ready"}"#,
    printcolumn = r#"{"name":"Image", "type":"string", "jsonPath":".spec.image"}"#,
    printcolumn = r#"{"name":"Message", "type":"string", "jsonPath":".status.message"}"#
)]
pub struct S3ViewerSpec {
    /// Container image for the s3-viewer app. Defaults to S3_VIEWER_DEFAULT_IMAGE or ghcr.io/tchoupinax/s3-viewer:latest.
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default = "default_replicas")]
    pub replicas: i32,
    #[serde(default)]
    pub accounts: Vec<S3AccountSpec>,
    #[serde(default)]
    pub service: Option<ServiceSpec>,
    #[serde(default)]
    pub ingress: Option<IngressSpec>,
    /// Optional shared defaults from an S3ViewerConfig in the same namespace.
    #[serde(default)]
    pub config_ref: Option<ConfigRef>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConfigRef {
    pub name: String,
}

#[derive(CustomResource, Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[kube(
    group = "s3viewer.dev",
    version = "v1",
    kind = "S3ViewerConfig",
    plural = "s3viewerconfigs",
    derive = "PartialEq",
    namespaced,
    status = "S3ViewerConfigStatus",
    printcolumn = r#"{"name":"Image", "type":"string", "jsonPath":".spec.image"}"#,
    printcolumn = r#"{"name":"Accounts", "type":"integer", "jsonPath":".spec.accounts.length"}"#,
    printcolumn = r#"{"name":"Message", "type":"string", "jsonPath":".status.message"}"#
)]
pub struct S3ViewerConfigSpec {
    /// Default container image for S3Viewer instances referencing this config.
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub accounts: Vec<S3AccountSpec>,
    #[serde(default)]
    pub service: Option<ServiceSpec>,
    #[serde(default)]
    pub ingress: Option<IngressSpec>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct S3ViewerConfigStatus {
    pub observed_generation: Option<i64>,
    pub message: Option<String>,
}

fn default_replicas() -> i32 {
    1
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct S3AccountSpec {
    /// Env prefix key (e.g. BACKUPS -> S3_VIEWER_ACCOUNT_BACKUPS_*).
    pub account_key: String,
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub region: String,
    #[serde(default)]
    pub read_only: bool,
    pub credentials_secret_ref: CredentialsSecretRef,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CredentialsSecretRef {
    pub name: String,
    pub access_key_key: String,
    pub secret_key_key: String,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ServiceSpec {
    #[serde(default = "default_service_port")]
    pub port: i32,
    #[serde(default = "default_service_type")]
    pub r#type: String,
}

fn default_service_port() -> i32 {
    3000
}

fn default_service_type() -> String {
    "ClusterIP".to_owned()
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngressSpec {
    pub host: String,
    #[serde(default)]
    pub class_name: Option<String>,
    #[serde(default)]
    pub tls_secret_name: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct S3ViewerStatus {
    pub ready: bool,
    pub last_sync_time: Option<String>,
    pub message: Option<String>,
    pub url: Option<String>,
}
