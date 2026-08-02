check:
  gitleaks dir -v
  gitleaks git -v

cluster-up:
  bash scripts/cluster-up.sh

cluster-down:
  bash scripts/cluster-down.sh

deploy:
  tilt up

deploy-down:
  tilt down

test-integration:
  bash scripts/ci-integration-test.sh
