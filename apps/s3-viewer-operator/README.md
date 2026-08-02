# S3 Viewer operator

Kubernetes operator that deploys [s3-viewer](https://github.com/tchoupinax/s3-viewer) from a declarative `S3Viewer` custom resource.

Based on [rust-kubernetes-operator-example](https://github.com/Pscheidl/rust-kubernetes-operator-example) (kube-rs).

## What it does

When you create a `S3Viewer` custom resource, the operator reconciles:

- a `Secret` per watched `S3ViewerConfig` in that config's namespace (owned by the `S3ViewerConfig`, named `{config-name}-accounts`)
- a `Deployment` running the s3-viewer container image
- a `Service` exposing the app inside the cluster
- an optional `Ingress` when `spec.ingress` is set

Owned resources are garbage-collected when the `S3Viewer` CR is deleted.

## Prerequisites

1. Rust toolchain (`rustup`)
2. Kubernetes cluster with `kubectl` configured
3. Credentials stored in Kubernetes Secrets (see example)

## Install the CRD

```bash
kubectl apply -f crd/s3viewers.s3viewer.dev.yaml
```

## Local Kubernetes (k3d + Tilt)

```bash
pnpm cluster:up
pnpm deploy
```

## Run the operator (outside the cluster)

```bash
export KUBECONFIG=~/.kube/config

pnpm operator
# or: cargo run
```

## Deploy an instance

```bash
kubectl apply -f examples/home.yaml
kubectl get s3viewers
kubectl describe s3viewer home
```

Example spec fields:

| Field | Description |
|-------|-------------|
| `spec.image` | Container image (default `ghcr.io/tchoupinax/s3-viewer:latest`). |
| `spec.replicas` | Deployment replicas (default `1`). |
| `spec.configNamespaces` | Namespaces to scan for `S3ViewerConfig` accounts. Use `"*"` to scan every namespace. |
| `spec.service.port` | Service port (default `3000`). |
| `spec.ingress.host` | Optional ingress hostname. |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_VIEWER_DEFAULT_IMAGE` | `ghcr.io/tchoupinax/s3-viewer:latest` | Image used when `spec.image` is omitted |
| `KUBECONFIG` | `~/.kube/config` | Kubernetes API access |

## Docker

```bash
docker build -f apps/s3-viewer-operator/Dockerfile -t s3-viewer-operator .

docker run --rm \
  -v ~/.kube/config:/kube/config:ro \
  -e KUBECONFIG=/kube/config \
  s3-viewer-operator
```

## Status

The operator writes back:

- `status.ready` — deployment has ready replicas
- `status.lastSyncTime` — RFC3339 timestamp
- `status.message` — human-readable result
- `status.url` — in-cluster service URL or ingress URL

## Delete an instance

```bash
kubectl delete s3viewer home
```

The operator removes its finalizer; owned resources are deleted by Kubernetes.
