#!/bin/sh
# Regenerate src/api/gen/*.ts from Go types in tfr-backend/pkg/types/.
#
# Usage: ./scripts/gen-types.sh [path-to-tfr-backend]
#
# Default backend path: ../tfr-backend (matches local-deployment layout
# where shop-sdk-ui and tfr-backend live as siblings under local-repo/).
#
# Runs tygo inside a Go Docker container so the host needs no Go toolchain.
# The container mounts:
#   tfr-backend  at /backend (working dir; resolves module-relative imports)
#   shop-sdk-ui  at /sdk     (output target; matches tygo.yaml absolute paths)
set -eu

SDK_PATH="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PATH="${1:-$SDK_PATH/../tfr-backend}"
if [ ! -d "$BACKEND_PATH" ]; then
  echo "tfr-backend not found at: $BACKEND_PATH" >&2
  echo "Pass the path as the first argument: $0 /path/to/tfr-backend" >&2
  exit 1
fi
BACKEND_PATH="$(cd "$BACKEND_PATH" && pwd)"

mkdir -p "$SDK_PATH/src/api/gen"

docker run --rm \
  -v "$BACKEND_PATH:/backend" \
  -v "$SDK_PATH:/sdk" \
  -w /backend \
  golang:1.25 \
  sh -c "go install github.com/gzuidhof/tygo@v0.2.21 && tygo --config /sdk/tygo.yaml generate"

echo "Regenerated $SDK_PATH/src/api/gen/*.ts from $BACKEND_PATH"
