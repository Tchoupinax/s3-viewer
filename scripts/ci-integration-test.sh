#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="s3-viewer-ci"
APP_IMAGE="s3-viewer:ci"
OPERATOR_IMAGE="s3-viewer-operator:ci"
HELM_RELEASE="s3-viewer-ci"
E2E_BASE_URL="http://aluminium.127.0.0.1.nip.io"

log() {
  echo "[ci] $*"
}

fail() {
  echo "[ci] ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

cleanup_cluster() {
  if k3d cluster list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "${CLUSTER_NAME}"; then
    log "deleting k3d cluster ${CLUSTER_NAME}"
    k3d cluster delete "${CLUSTER_NAME}" >/dev/null 2>&1 || true
  fi
}

setup_cluster() {
  log "creating k3d cluster ${CLUSTER_NAME}"
  k3d cluster create --config "${ROOT_DIR}/k3d.yml"
  export KUBECONFIG="$(k3d kubeconfig write "${CLUSTER_NAME}")"
  log "kubeconfig: ${KUBECONFIG}"
  kubectl cluster-info
}

build_images() {
  log "building ${APP_IMAGE}"
  docker build -t "${APP_IMAGE}" -f "${ROOT_DIR}/apps/s3-viewer/Dockerfile" "${ROOT_DIR}"

  log "building ${OPERATOR_IMAGE}"
  docker build -t "${OPERATOR_IMAGE}" "${ROOT_DIR}/apps/s3-viewer-operator"

  log "importing images into k3d"
  k3d image import "${APP_IMAGE}" "${OPERATOR_IMAGE}" -c "${CLUSTER_NAME}"
}

install_operator() {
  log "installing operator via Helm"
  helm upgrade --install "${HELM_RELEASE}" "${ROOT_DIR}/charts/s3-viewer" \
    --namespace s3-viewer-operator \
    --create-namespace \
    -f "${ROOT_DIR}/ci/helm-values.yaml" \
    --wait \
    --timeout 5m

  kubectl wait --for=condition=available deployment/s3-viewer-operator \
    -n s3-viewer-operator --timeout=300s
}

apply_workloads() {
  log "applying MinIO stack"
  kubectl apply -f "${ROOT_DIR}/dev/minio.yaml"

  for deploy in minio-backups minio-logs minio-archive minio-media; do
    kubectl wait --for=condition=available "deployment/${deploy}" \
      -n minio --timeout=300s
  done

  for job in minio-backups-init minio-logs-init minio-archive-init minio-media-init; do
    kubectl wait --for=condition=complete "job/${job}" \
      -n minio --timeout=300s
  done

  log "applying namespaces, credentials, and S3Viewer resources"
  kubectl apply -f "${ROOT_DIR}/dev/namespaces.yaml"
  kubectl apply -f "${ROOT_DIR}/ci/fixtures/secret.yaml"
  kubectl apply -f "${ROOT_DIR}/dev/aluminium.yaml"
  kubectl apply -f "${ROOT_DIR}/dev/copper.yaml"
}

wait_for_viewers() {
  log "waiting for S3Viewer operator to provision viewers"

  kubectl wait --for=jsonpath='{.status.ready}'=true s3viewer/backups \
    -n aluminium --timeout=300s
  kubectl wait --for=jsonpath='{.status.ready}'=true s3viewer/demo \
    -n copper --timeout=300s

  kubectl wait --for=condition=available deployment/backups-s3-viewer \
    -n aluminium --timeout=300s
  kubectl wait --for=condition=available deployment/demo-s3-viewer \
    -n copper --timeout=300s
}

cluster_curl() {
  local namespace="$1"
  local service="$2"
  local path="$3"

  kubectl run "ci-curl-${RANDOM}" \
    --namespace="${namespace}" \
    --rm -i --restart=Never \
    --image=curlimages/curl:8.12.1 \
    --command -- curl -sf "http://${service}.${namespace}.svc.cluster.local:3000${path}"
}

verify_runtime() {
  log "verifying account secrets"
  local aluminium_keys copper_keys
  aluminium_keys="$(kubectl get secret backups-s3-viewer -n aluminium -o json | jq '.data | keys | length')"
  copper_keys="$(kubectl get secret demo-s3-viewer -n copper -o json | jq '.data | keys | length')"

  if [[ "${aluminium_keys}" -lt 6 ]]; then
    fail "expected at least 6 keys in aluminium account secret, got ${aluminium_keys}"
  fi
  if [[ "${copper_keys}" -lt 6 ]]; then
    fail "expected at least 6 keys in copper account secret, got ${copper_keys}"
  fi

  log "verifying HTTP health endpoints"
  cluster_curl aluminium backups-s3-viewer /api/health
  cluster_curl copper demo-s3-viewer /api/health

  log "verifying buckets API"
  local buckets
  buckets="$(cluster_curl aluminium backups-s3-viewer /api/buckets)"
  echo "${buckets}" | jq -e '.status == "OK" and (.data.buckets | length) >= 1' >/dev/null \
    || fail "aluminium /api/buckets did not return buckets: ${buckets}"

  echo "${buckets}" | jq -e '.data.buckets[] | select(.accountId == "minio-backups")' >/dev/null \
    || fail "aluminium buckets response missing minio-backups account"
}

wait_for_ingress() {
  log "waiting for aluminium ingress at ${E2E_BASE_URL}"

  for _ in $(seq 1 60); do
    if kubectl get ingress backups-s3-viewer -n aluminium >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  kubectl get ingress backups-s3-viewer -n aluminium >/dev/null 2>&1 \
    || fail "ingress backups-s3-viewer not found in aluminium namespace"

  for _ in $(seq 1 60); do
    if curl -sf "${E2E_BASE_URL}/api/health" >/dev/null; then
      return 0
    fi
    sleep 2
  done

  fail "ingress ${E2E_BASE_URL} did not become reachable"
}

run_e2e_tests() {
  log "running Playwright e2e tests against ${E2E_BASE_URL}"
  wait_for_ingress

  export E2E_BASE_URL
  pnpm --filter @s3-viewer/app test:e2e
}

verify_secret_rollout() {
  log "verifying deployment restarts when account secret changes"
  local generation_before generation_after

  generation_before="$(kubectl get deployment backups-s3-viewer -n aluminium \
    -o jsonpath='{.metadata.generation}')"

  kubectl patch s3viewerconfig backups -n aluminium --type=json \
    -p='[{"op":"replace","path":"/spec/accounts/0/name","value":"aluminium-ci-updated"}]'

  for _ in $(seq 1 60); do
    generation_after="$(kubectl get deployment backups-s3-viewer -n aluminium \
      -o jsonpath='{.metadata.generation}')"
    if [[ "${generation_after}" -gt "${generation_before}" ]]; then
      break
    fi
    sleep 5
  done

  generation_after="$(kubectl get deployment backups-s3-viewer -n aluminium \
    -o jsonpath='{.metadata.generation}')"

  if [[ "${generation_after}" -le "${generation_before}" ]]; then
    fail "deployment generation did not increase after S3ViewerConfig update (before=${generation_before}, after=${generation_after})"
  fi

  kubectl rollout status deployment/backups-s3-viewer -n aluminium --timeout=300s

  local account_name
  account_name="$(cluster_curl aluminium backups-s3-viewer /api/buckets \
    | jq -r '.data.buckets[0].organizationOrAccountName')"
  if [[ "${account_name}" != "aluminium-ci-updated" ]]; then
    fail "expected updated account name aluminium-ci-updated, got ${account_name}"
  fi
}

main() {
  require_command docker
  require_command k3d
  require_command kubectl
  require_command helm
  require_command jq
  require_command curl
  require_command pnpm

  cd "${ROOT_DIR}"

  cleanup_cluster
  setup_cluster
  build_images
  install_operator
  apply_workloads
  wait_for_viewers
  verify_runtime
  run_e2e_tests
  verify_secret_rollout

  log "integration tests passed"
  cleanup_cluster
}

main "$@"
