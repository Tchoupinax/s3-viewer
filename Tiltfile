load('ext://helm_resource', 'helm_resource')
load('ext://k8s_attach', 'k8s_attach')

default_registry('localhost:5001')
allow_k8s_contexts('k3d-s3-viewer')
version_settings(constraint='>=0.33.0')

docker_build(
  's3-viewer-operator',
  'apps/s3-viewer-operator',
)

helm_resource(
  's3-viewer-operator',
  'charts/s3-viewer',
  deps=[
    'charts/s3-viewer',
  ],
  image_deps=['s3-viewer-operator'],
  image_keys=[('operator.image.repository', 'operator.image.tag')],
  labels=['operator'],
)

k8s_yaml('dev/minio.yaml')

k8s_resource(
  'minio-backups',
  labels=['minio'],
  resource_deps=['s3-viewer-operator'],
)

k8s_resource(
  'minio-logs',
  labels=['minio'],
  resource_deps=['s3-viewer-operator'],
)

k8s_resource(
  'minio-archive',
  labels=['minio'],
  resource_deps=['s3-viewer-operator'],
)

k8s_resource(
  'minio-media',
  labels=['minio'],
  resource_deps=['s3-viewer-operator'],
)

k8s_yaml([
  'dev/secret.yaml',
  'dev/aluminium.yaml',
  'dev/copper.yaml',
])

k8s_resource(
  objects=['visionn32:s3viewer:aluminium'],
  new_name='aluminium',
  labels=['app'],
  links=['http://aluminium.127.0.0.1.nip.io'],
  resource_deps=['minio-backups', 'minio-logs', 'minio-archive'],
)

k8s_resource(
  objects=['demo:s3viewer:copper', 'default:s3viewerconfig:copper'],
  new_name='copper',
  labels=['app'],
  links=['http://copper.127.0.0.1.nip.io'],
  resource_deps=['minio-media'],
)
