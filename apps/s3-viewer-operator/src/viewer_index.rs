use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};

use kube::ResourceExt;
use kube::runtime::reflector::ObjectRef;

use crate::crd::S3Viewer;
use crate::spec::{watched_config_namespaces, ALL_CONFIG_NAMESPACES};

#[derive(Clone, Default)]
pub struct ViewerIndex {
    by_namespace: Arc<RwLock<HashMap<String, HashSet<ObjectRef<S3Viewer>>>>>,
}

impl ViewerIndex {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn viewers_for_namespace(&self, namespace: &str) -> Vec<ObjectRef<S3Viewer>> {
        let Ok(map) = self.by_namespace.read() else {
            return Vec::new();
        };

        let mut viewers = HashSet::new();
        if let Some(set) = map.get(ALL_CONFIG_NAMESPACES) {
            viewers.extend(set.iter().cloned());
        }
        if let Some(set) = map.get(namespace) {
            viewers.extend(set.iter().cloned());
        }

        viewers.into_iter().collect()
    }
}

pub fn register_viewer(index: &ViewerIndex, viewer: &S3Viewer) {
    let viewer_namespace = viewer
        .namespace()
        .unwrap_or_else(|| "default".to_owned());
    let viewer_ref = ObjectRef::from(viewer);
    let watched_namespaces = watched_config_namespaces(viewer, &viewer_namespace);

    if let Ok(mut map) = index.by_namespace.write() {
        for set in map.values_mut() {
            set.remove(&viewer_ref);
        }

        for namespace in watched_namespaces {
            map.entry(namespace).or_default().insert(viewer_ref.clone());
        }
    }
}

pub fn unregister_viewer(index: &ViewerIndex, viewer_ref: ObjectRef<S3Viewer>) {
    if let Ok(mut map) = index.by_namespace.write() {
        for set in map.values_mut() {
            set.remove(&viewer_ref);
        }
    }
}
