#!/bin/bash
# One-shot: download Atlas snapshot → temp local Mongo → copy _id+status to live DB
# Usage:  bash scripts/extract-from-snapshot.sh "<snapshot download url>"
set -e

URL="$1"
if [ -z "$URL" ]; then
  echo "Usage: bash scripts/extract-from-snapshot.sh \"<snapshot download url>\""
  exit 1
fi

WORKDIR="$HOME/snapshot-restore"
mkdir -p "$WORKDIR"

if [ -f "$WORKDIR/snapshot.tar.gz" ]; then
  echo "→ Snapshot already downloaded — skipping download."
else
  echo "→ Downloading snapshot…"
  curl -L -o "$WORKDIR/snapshot.tar.gz" "$URL"
fi

if [ -z "$(find "$WORKDIR" -maxdepth 1 -type d ! -path "$WORKDIR" | head -1)" ]; then
  echo "→ Extracting…"
  tar -xzf "$WORKDIR/snapshot.tar.gz" -C "$WORKDIR"
fi

# The tar extracts into a folder named after the restore id — find it
DATADIR=$(find "$WORKDIR" -maxdepth 1 -type d ! -path "$WORKDIR" | head -1)
echo "→ Data dir: $DATADIR"

MONGO_IMAGE="${MONGO_IMAGE:-mongo:8}"
echo "→ Starting temp MongoDB on port 27018 (Docker, $MONGO_IMAGE)…"
docker rm -f snapshot-mongo 2>/dev/null || true
docker run -d --name snapshot-mongo -p 27018:27017 -v "$DATADIR":/data/db "$MONGO_IMAGE"

echo "→ Waiting for it to come up…"
UP=0
for i in $(seq 1 30); do
  if docker exec snapshot-mongo mongosh --quiet --eval "db.runCommand({ping:1})" >/dev/null 2>&1; then
    UP=1
    break
  fi
  # container died? bail out early
  if [ "$(docker inspect -f '{{.State.Running}}' snapshot-mongo 2>/dev/null)" != "true" ]; then
    break
  fi
  sleep 2
done

if [ "$UP" != "1" ]; then
  echo ""
  echo "✗ MongoDB failed to start. Last 25 log lines:"
  docker logs --tail 25 snapshot-mongo 2>&1
  echo ""
  echo "If the log mentions a WiredTiger/version incompatibility, retry with a different image:"
  echo "  MONGO_IMAGE=mongo:7 bash scripts/extract-from-snapshot.sh already-downloaded"
  exit 1
fi

echo "→ Copying _id + status into live hardwoodDB_pipelineTemp…"
OLD_URI="mongodb://localhost:27018" node --env-file=.env scripts/copy-status-from-backup.mjs

echo "→ Cleaning up temp Mongo…"
docker rm -f snapshot-mongo

echo ""
echo "✓ Done. Now preview the repair:"
echo "  node --env-file=.env scripts/apply-status-from-temp.mjs"
