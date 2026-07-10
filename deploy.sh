#!/usr/bin/env bash
set -euo pipefail

REPO="/opt/cloudprint-UI"
WEB_DEST="/var/www/print-ui"
BRANCH="main"

cd "$REPO"

echo "==> Pulling latest code ($BRANCH)..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
git log -1 --oneline

echo "==> Building SPA in Docker..."
docker build \
  --build-arg VITE_API_BASE_URL=https://api.cloudprint.in \
  --build-arg VITE_RAZORPAY_KEY_ID=rzp_test_TAiyy4Iy6Pim6u \
  -t cloudprint-ui .

echo "==> Extracting built SPA..."
CID=$(docker create cloudprint-ui)
rm -rf /tmp/printos-dist
docker cp "$CID":/out /tmp/printos-dist
docker rm "$CID"

echo "==> Publishing to $WEB_DEST..."
mkdir -p "$WEB_DEST"
rsync -a --delete /tmp/printos-dist/ "$WEB_DEST"/
chown -R www-data:www-data "$WEB_DEST"
rm -rf /tmp/printos-dist

docker image prune -f

echo "==> Done → https://app.cloudprint.in"