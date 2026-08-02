use crate::crd::S3Viewer;
use kube::api::{Patch, PatchParams};
use kube::{Api, Client, Error};
use serde_json::{json, Value};

pub async fn add(client: Client, name: &str, namespace: &str) -> Result<S3Viewer, Error> {
    let api: Api<S3Viewer> = Api::namespaced(client, namespace);
    let patch: Patch<&Value> = Patch::Merge(&json!({
        "metadata": {
            "finalizers": ["s3viewers.s3viewer.dev/finalizer"]
        }
    }));
    api.patch(name, &PatchParams::default(), &patch).await
}

pub async fn delete(client: Client, name: &str, namespace: &str) -> Result<S3Viewer, Error> {
    let api: Api<S3Viewer> = Api::namespaced(client, namespace);
    let patch: Patch<&Value> = Patch::Merge(&json!({
        "metadata": {
            "finalizers": null
        }
    }));
    api.patch(name, &PatchParams::default(), &patch).await
}
