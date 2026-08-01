use kube::CustomResourceExt;
use s3_viewer_operator::crd::{S3Viewer, S3ViewerConfig};

fn main() {
    let resource = std::env::args().nth(1).unwrap_or_else(|| "s3viewer".to_owned());
    let yaml = match resource.as_str() {
        "s3viewerconfig" | "s3viewerconfigs" => {
            serde_yaml::to_string(&S3ViewerConfig::crd()).expect("serialize S3ViewerConfig CRD")
        }
        _ => serde_yaml::to_string(&S3Viewer::crd()).expect("serialize S3Viewer CRD"),
    };
    print!("{}", yaml);
}
