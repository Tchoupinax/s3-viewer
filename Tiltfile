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

k8s_yaml([
  'dev/secret.yaml',
  'dev/aluminium.yaml',
])

k8s_resource(
  objects=[
    'aluminium:namespace',
    'scaleway-backups-creds:secret',
    'visionn32:s3viewer',
  ],
  new_name='aluminium',
  labels=['app'],
  resource_deps=['s3-viewer-operator'],
)

k8s_attach(
  'aluminium-app',
  'deployment/visionn32-s3-viewer',
  namespace='aluminium',
  port_forwards='3000:3000',
  labels=['app'],
  resource_deps=['aluminium'],
)
