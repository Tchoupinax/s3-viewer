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

# CRDs must exist before dev S3Viewer / S3ViewerConfig manifests are applied.
k8s_yaml([
  'charts/s3-viewer/crds/s3viewers.s3viewer.dev.yaml',
  'charts/s3-viewer/crds/s3viewerconfigs.s3viewer.dev.yaml',
])

helm_resource(
  's3-viewer-operator',
  'charts/s3-viewer',
  deps=['charts/s3-viewer'],
  image_deps=['s3-viewer-operator', 's3-viewer'],
  image_keys=[
    ('operator.image.repository', 'operator.image.tag'),
    'operator.defaultAppImage',
  ],
  labels=['operator'],
)

k8s_yaml('dev/minio.yaml')

k8s_resource(
  'minio-backups',
  labels=['minio'],
)

k8s_resource(
  'minio-logs',
  labels=['minio'],
)

k8s_resource(
  'minio-archive',
  labels=['minio'],
)

k8s_resource(
  'minio-media',
  labels=['minio'],
)

k8s_yaml('dev/namespaces.yaml')

k8s_resource(
  objects=['aluminium:namespace', 'copper:namespace', 'iron:namespace'],
  new_name='app-namespaces',
)

k8s_yaml('dev/secret.yaml')

k8s_resource(
  objects=[
    'minio-backups-creds:secret:aluminium',
    'minio-logs-creds:secret:aluminium',
    'minio-archive-creds:secret:aluminium',
    'minio-media-creds:secret:copper',
    'minio-archive-creds:secret:iron',
  ],
  new_name='app-secrets',
  resource_deps=['app-namespaces'],
)

k8s_yaml([
  'dev/aluminium.yaml',
  'dev/copper.yaml',
  'dev/iron.yaml',
])

k8s_resource(
  objects=[
    'backups:s3viewer:aluminium',
    'backups:s3viewerconfig:aluminium',
  ],
  new_name='aluminium',
  labels=['app'],
  links=['http://aluminium.127.0.0.1.nip.io'],
  resource_deps=[
    's3-viewer-operator',
    'app-secrets',
    'minio-backups',
    'minio-logs',
    'minio-archive',
  ],
)

k8s_resource(
  objects=['demo:s3viewer:copper', 'media:s3viewerconfig:copper'],
  new_name='copper',
  labels=['app'],
  links=['http://copper.127.0.0.1.nip.io'],
  resource_deps=['s3-viewer-operator', 'app-secrets', 'minio-media'],
)

k8s_resource(
  objects=['main:s3viewer:iron', 'archive:s3viewerconfig:iron'],
  new_name='iron',
  labels=['app'],
  links=['http://iron.127.0.0.1.nip.io'],
  resource_deps=[
    's3-viewer-operator',
    'app-secrets',
    'minio-archive',
    'minio-media',
    'copper',
    'aluminium',
  ],
)
