#!/bin/bash
# One-step iOS setup for Deuce Card Room. Run from anywhere:
#   bash ~/Projects/deuce-card-room/scripts/setup-ios.sh
set -e
cd "$(dirname "$0")/.."

# Use nvm's Node 22+ even if an older Homebrew Node comes first on PATH.
export NVM_DIR="$HOME/.nvm"
if [ -d "$NVM_DIR/versions/node" ]; then
  V=$(ls "$NVM_DIR/versions/node" | grep -E '^v(2[2-9]|[3-9][0-9])\.' | sort -V | tail -1)
  [ -n "$V" ] && export PATH="$NVM_DIR/versions/node/$V/bin:$PATH"
fi
MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
if [ "$MAJOR" -lt 22 ]; then
  echo "Node $(node -v) is too old. Run: source ~/.nvm/nvm.sh && nvm install 22   (or: brew upgrade node)"
  exit 1
fi
echo "Using Node $(node -v)"

npm install
npm install @capacitor/core @capacitor/ios @capacitor/status-bar @capacitor/haptics
npm install -D @capacitor/cli @capacitor/assets
npm run build:www
[ -d ios ] || npx cap add ios --packagemanager SPM
npx cap sync ios
npm run ios:icons
npx cap open ios
echo "Xcode is open. Next: Signing & Capabilities → Team → your Personal Team, pick your iPhone, press Run."
