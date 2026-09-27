#!/usr/bin/env bash
# Download a full snapshot of the production bucket (trees, users, documents)
# into backups/prod-<timestamp>/. Read-only on the bucket side.
#
# To run the app locally on this snapshot:
#   cd api && LOCAL_DATA_DIR=../backups/prod-<timestamp> node server.js
set -euo pipefail

BUCKET="${GCS_BUCKET:-quant-dev-442615-genealogy-data}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/backups/prod-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DEST"
gcloud storage cp -r "gs://$BUCKET/*" "$DEST/"
echo "Snapshot saved to $DEST"
