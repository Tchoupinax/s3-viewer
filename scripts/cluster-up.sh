#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="s3-viewer"
SECRET_FILE="${ROOT_DIR}/dev/secret.yaml"
SECRET_EXAMPLE="${ROOT_DIR}/dev/secret.example.yaml"

if [[ ! -f "${SECRET_FILE}" ]]; then
  cp "${SECRET_EXAMPLE}" "${SECRET_FILE}"
  echo "Created ${SECRET_FILE} from template. Update S3 credentials before deploying."
fi

if k3d cluster list | awk 'NR>1 {print $1}' | grep -qx "${CLUSTER_NAME}"; then
  echo "Starting existing k3d cluster ${CLUSTER_NAME}..."
  k3d cluster start "${CLUSTER_NAME}"
else
  echo "Creating k3d cluster ${CLUSTER_NAME}..."
  k3d cluster create --config "${ROOT_DIR}/k3d.yml"
fi

echo "Kube context: k3d-${CLUSTER_NAME}"
echo "Ingress: http://aluminium.127.0.0.1.nip.io"
echo "Run: pnpm deploy"
