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
    pub service: Option<ServiceSpec>,
    #[serde(default)]
    pub ingress: Option<IngressSpec>,
    /// Namespaces to scan for S3ViewerConfig resources. Each config's accounts become buckets in the UI.
    /// Defaults to the S3Viewer's own namespace when unset or empty.
    #[serde(default)]
    pub config_namespaces: Option<Vec<String>>,
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
    printcolumn = r#"{"name":"Accounts", "type":"integer", "jsonPath":".spec.accounts.length"}"#,
    printcolumn = r#"{"name":"Message", "type":"string", "jsonPath":".status.message"}"#
)]
pub struct S3ViewerConfigSpec {
    #[serde(default)]
    pub accounts: Vec<S3AccountSpec>,
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
