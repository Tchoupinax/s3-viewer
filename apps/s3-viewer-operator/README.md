# S3 Viewer operator

Kubernetes operator that deploys [s3-viewer](https://github.com/tchoupinax/s3-viewer) from a declarative `S3Viewer` custom resource.

Based on [rust-kubernetes-operator-example](https://github.com/Pscheidl/rust-kubernetes-operator-example) (kube-rs).

## What it does

When you create a `S3Viewer` custom resource, the operator reconciles:

- a `Secret` per watched `S3ViewerConfig` in that config's namespace (owned by the `S3ViewerConfig`, named `{config-name}-accounts`)
- when the `S3Viewer` runs in another namespace, a mount copy of that secret is created in the viewer namespace using the same `{config-name}-accounts` name (owned by the `S3Viewer`)
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

## Metrics (Victoria Metrics / Prometheus)

The operator exposes **Prometheus text exposition format** at `GET /metrics` (default bind: `0.0.0.0:8080`). Victoria Metrics and vmagent scrape this format natively.

Metrics:

- `s3_viewer_operator_reconcile_total{result="success|error"}`
- `s3_viewer_operator_reconcile_duration_seconds{result="success|error"}`
- `s3_viewer_operator_viewers_managed`

Environment variables:

- `METRICS_BIND` — listen address (default `0.0.0.0:8080`)
- `METRICS_ENABLED` — set to `false` to disable the metrics server

Helm: enable scraping with:

```yaml
operator:
  serviceMonitor:
    enabled: true
```

Plain stdout logs remain human-readable text; use `/metrics` for time-series, not logs.

## Logging

Logs are written to stdout/stderr with RFC3339 timestamps and levels:

```text
[2026-08-07T06:53:40.251947995+00:00] INFO s3-viewer-operator started (Kubernetes API: ...)
[2026-08-07T06:53:40.251947995+00:00] DEBUG deploying workload s3-viewer/main-s3-viewer (replicas: 1, ingress: ...)
```

Set `LOG_LEVEL` to control verbosity (`error`, `warn`, `info`, `debug`, `trace`). Default: `info`.

At `info`, you see lifecycle events (created/updated/deleted). Reconcile details (provisioning, secrets, workload apply) are `debug`.

Helm:

```yaml
operator:
  logLevel: debug
```

## Delete an instance

```bash
kubectl delete s3viewer home
```

The operator removes its finalizer; owned resources are deleted by Kubernetes.
