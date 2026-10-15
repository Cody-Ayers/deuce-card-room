# Running Deuce on your iPhone

The native app is the same game wrapped with [Capacitor](https://capacitorjs.com). It runs fully offline, with fonts and the Supabase library bundled in.

## One-time setup (Mac)

```bash
cd ~/Projects/deuce-card-room
node -v                      # needs 22 or newer (nvm install 22)
npm install
npm install @capacitor/core @capacitor/ios @capacitor/status-bar
npm install -D @capacitor/cli @capacitor/assets
npm run build:www
npx cap add ios --packagemanager SPM
npm run ios:icons
npx cap open ios
```

## Run it on your phone (free, no developer account)

1. Plug your iPhone into your Mac and unlock it.
2. In Xcode, click **App** in the left sidebar, then **Signing & Capabilities**.
   Under **Team**, choose **Add an Account…**, sign in with your Apple ID, and pick your **Personal Team**.
3. At the top of Xcode, choose your iPhone as the run destination and press **▶ Run**.
4. First time only, on the iPhone:
   - **Settings → Privacy & Security → Developer Mode** → on (the phone restarts).
   - **Settings → General → VPN & Device Management** → tap your Apple ID → **Trust**.
5. Run again from Xcode. Deuce opens on your phone.

With a free account the app keeps working for 7 days; plug in and press Run again to renew.
A paid Apple Developer account removes that limit and unlocks TestFlight and the App Store.

## After changing the game

```bash
npm run ios      # rebuilds www/, syncs it into the iOS project, opens Xcode
```
Then press **▶ Run** in Xcode.
