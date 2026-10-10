#!/usr/bin/env bash
# Copy the booking site into the medlab staff app's public/book/ folder, which is served at
# https://app.medlab.noshtek.ai/book/index.html — the domain registered with Razorpay.
# This repo stays the source; run this after every change, then ship the medlab PR.
#   ./sync-to-medlab.sh [path-to-medlab-checkout]   (default ../medlab)
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-$SRC/../medlab}/packages/frontend-staff/public/book"
mkdir -p "$DEST/assets/logo"
cp "$SRC"/{index.html,chat.js,config.js,i18n.js,privacy.html,terms.html} "$DEST/"
cp "$SRC"/assets/qr-patient-app.svg "$DEST/assets/"
cp "$SRC"/assets/logo/* "$DEST/assets/logo/"
echo "synced → $DEST"; ls -R "$DEST" | head -30
