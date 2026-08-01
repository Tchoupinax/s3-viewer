load('ext://helm_resource', 'helm_resource')
load('ext://k8s_attach', 'k8s_attach')

default_registry('localhost:5001')
allow_k8s_contexts('k3d-s3-viewer')
version_settings(constraint='>=0.33.0')

docker_build(
  's3-viewer-operator',
  'apps/s3-viewer-operator',
)

docker_build(
  's3-viewer',
  '.',
  dockerfile='apps/s3-viewer/Dockerfile.tilt',
  only=[
    'apps/s3-viewer',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'turbo.json',
  ],
)

helm_resource(
  's3-viewer-operator',
  'charts/s3-viewer',
  deps=['charts/s3-viewer'],
  image_deps=['s3-viewer-operator', 's3-viewer'],
  image_keys=[
    ('operator.image.repository', 'operator.image.tag'),
    'operator.defaultAppImage',
  ],
  resource_deps=['s3-viewer'],
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
  'dev/iron.yaml',
])

k8s_resource(
  objects=['visionn32:s3viewer:aluminium'],
  new_name='aluminium',
  labels=['app'],
  links=['http://aluminium.127.0.0.1.nip.io'],
  resource_deps=['minio-backups', 'minio-logs', 'minio-archive', 's3-viewer'],
)

k8s_resource(
  objects=['demo:s3viewer:copper', 'default:s3viewerconfig:copper'],
  new_name='copper',
  labels=['app'],
  links=['http://copper.127.0.0.1.nip.io'],
  resource_deps=['minio-media', 's3-viewer'],
)

k8s_resource(
  objects=['main:s3viewer:iron', 'archive:s3viewerconfig:iron'],
  new_name='iron',
  labels=['app'],
  links=['http://iron.127.0.0.1.nip.io'],
  resource_deps=['minio-archive', 'minio-media', 'copper', 'aluminium', 's3-viewer'],
)

k8s_attach(
  'aluminium-app',
  'deployment/visionn32-s3-viewer',
  namespace='aluminium',
  port_forwards='3000:3000',
  labels=['app'],
  resource_deps=['aluminium'],
)

k8s_attach(
  'copper-app',
  'deployment/demo-s3-viewer',
  namespace='copper',
  port_forwards='3001:3000',
  labels=['app'],
  resource_deps=['copper'],
)

k8s_attach(
  'iron-app',
  'deployment/main-s3-viewer',
  namespace='iron',
  port_forwards='3002:3000',
  labels=['app'],
  resource_deps=['iron'],
)
