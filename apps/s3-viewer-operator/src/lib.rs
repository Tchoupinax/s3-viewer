pub mod crd;
pub mod finalizer;
pub mod logging;
pub mod resources;
pub mod secrets;
pub mod spec;
pub mod viewer_index;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Kubernetes reported error: {source}")]
    KubeError {
        #[from]
        source: kube::Error,
    },
    #[error("Invalid S3Viewer CRD: {0}")]
    UserInputError(String),
}
