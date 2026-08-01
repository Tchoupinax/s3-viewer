#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPERATOR_CRD_DIR="${ROOT_DIR}/apps/s3-viewer-operator/crd"
CHART_CRD_DIR="${ROOT_DIR}/charts/s3-viewer/crds"
MANIFEST="${ROOT_DIR}/apps/s3-viewer-operator/Cargo.toml"

mkdir -p "${OPERATOR_CRD_DIR}" "${CHART_CRD_DIR}"

generate() {
  local kind="$1"
  local filename="$2"
  cargo run --manifest-path "${MANIFEST}" --bin crd-gen --quiet -- "${kind}" \
    > "${OPERATOR_CRD_DIR}/${filename}"
  cp "${OPERATOR_CRD_DIR}/${filename}" "${CHART_CRD_DIR}/${filename}"
  echo "Generated ${CHART_CRD_DIR}/${filename}"
}

echo "Generating CRDs..."
generate s3viewer s3viewers.s3viewer.dev.yaml
generate s3viewerconfig s3viewerconfigs.s3viewer.dev.yaml
