use kube::CustomResourceExt;
use s3_viewer_operator::crd::{S3Viewer, S3ViewerConfig};

fn main() {
    let resource = std::env::args().nth(1).unwrap_or_else(|| "s3viewer".to_owned());
    let crd = match resource.as_str() {
        "s3viewerconfig" | "s3viewerconfigs" => serde_yaml::to_value(S3ViewerConfig::crd())
            .expect("serialize S3ViewerConfig CRD"),
        _ => serde_yaml::to_value(S3Viewer::crd()).expect("serialize S3Viewer CRD"),
    };

    let yaml = serde_yaml::to_string(&strip_empty_crd_name_fields(crd))
        .expect("serialize cleaned CRD");
    print!("{}", yaml);
}

fn strip_empty_crd_name_fields(mut crd: serde_yaml::Value) -> serde_yaml::Value {
    let Some(names) = crd
        .get_mut("spec")
        .and_then(|spec| spec.get_mut("names"))
        .and_then(|names| names.as_mapping_mut())
    else {
        return crd;
    };

    for key in ["categories", "shortNames"] {
        if names.get(key).is_some_and(is_empty_sequence) {
            names.remove(serde_yaml::Value::String(key.to_owned()));
        }
    }

    crd
}

fn is_empty_sequence(value: &serde_yaml::Value) -> bool {
    matches!(value, serde_yaml::Value::Sequence(sequence) if sequence.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_empty_short_names_and_categories() {
        let crd = serde_yaml::from_str(
            r#"
spec:
  names:
    categories: []
    kind: S3Viewer
    plural: s3viewers
    shortNames: []
    singular: s3viewer
"#,
        )
        .expect("parse yaml");

        let cleaned = strip_empty_crd_name_fields(crd);
        let names = cleaned["spec"]["names"].as_mapping().expect("names mapping");

        assert!(!names.contains_key(serde_yaml::Value::String("shortNames".to_owned())));
        assert!(!names.contains_key(serde_yaml::Value::String("categories".to_owned())));
        assert_eq!(names["kind"], serde_yaml::Value::String("S3Viewer".to_owned()));
    }

    #[test]
    fn keeps_non_empty_short_names() {
        let crd = serde_yaml::from_str(
            r#"
spec:
  names:
    kind: S3Viewer
    shortNames: [sv]
"#,
        )
        .expect("parse yaml");

        let cleaned = strip_empty_crd_name_fields(crd);
        let names = cleaned["spec"]["names"].as_mapping().expect("names mapping");

        assert_eq!(
            names["shortNames"],
            serde_yaml::Value::Sequence(vec![serde_yaml::Value::String("sv".to_owned())])
        );
    }
}
