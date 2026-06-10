#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

BINARIES=(
  "api/dist-bin/api-linux"
  "backend-reporteria/dist-bin/backend-reporteria-linux"
  "backend-facturacion-electronica/dist-bin/backend-facturacion-electronica-linux"
  "backend-perifericos/dist-bin/backend-perifericos-linux"
)

missing=0

for binary in "${BINARIES[@]}"; do
  path="${ROOT_DIR}/${binary}"
  if [[ -f "${path}" ]]; then
    echo "OK ${binary}"
  else
    echo "MISSING ${binary}"
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

echo "All expected Linux backend binaries exist."
