#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

SERVICES=(
  "api"
  "backend-reporteria"
  "backend-facturacion-electronica"
  "backend-perifericos"
)

for service in "${SERVICES[@]}"; do
  echo "Building binary for ${service}"
  (
    cd "${ROOT_DIR}/${service}"
    npm run build:bin
  )
done

echo "Backend binary builds complete."
