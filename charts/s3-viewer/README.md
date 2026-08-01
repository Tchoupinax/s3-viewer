# s3-viewer Helm chart

Deploys the s3-viewer Kubernetes operator, CRDs, and optional `S3Viewer` instances.

## Prerequisites

- Kubernetes 1.25+
- Helm 3

## CRD generation

CRDs are generated from the Rust operator types (`kube::CustomResource`):

```bash
pnpm crd:generate
# or
bash scripts/generate-crd.sh
```

Run this after changing `apps/s3-viewer-operator/src/crd.rs` before packaging or committing the chart.

## Install

Operator only:

```bash
helm install s3-viewer ./charts/s3-viewer
```

Operator + one S3Viewer instance:

```bash
helm install s3-viewer ./charts/s3-viewer \
  --set s3viewer.enabled=true \
  --set-file s3viewer.instances[0]=examples/instance.yaml
```

Or use a values file:

```bash
helm install s3-viewer ./charts/s3-viewer -f my-values.yaml
```

See `values.yaml` for the full `s3viewer.instances` schema.

## Upgrade

```bash
helm upgrade s3-viewer ./charts/s3-viewer -f my-values.yaml
```

Helm installs CRDs from `crds/` on first install only. To update a CRD after schema changes, re-run `pnpm crd:generate` and apply manually or use `helm upgrade --force` if your workflow supports it.

## Uninstall

```bash
helm uninstall s3-viewer
```

CRDs are not removed on uninstall (Helm default for `crds/`).
