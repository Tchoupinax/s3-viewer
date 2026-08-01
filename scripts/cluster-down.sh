#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="s3-viewer"

if k3d cluster list | awk 'NR>1 {print $1}' | grep -qx "${CLUSTER_NAME}"; then
  k3d cluster delete "${CLUSTER_NAME}"
else
  echo "Cluster ${CLUSTER_NAME} does not exist."
fi
