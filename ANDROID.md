# Android installation and sharing

The app is an installable Progressive Web App (PWA) at **https://quillry.onrender.com**. It is not distributed as an APK.

## Install the app

1. Open https://quillry.onrender.com in **Chrome on Android**.
2. Tap the three-dot menu and choose **Install app**.
3. Open **Editor** once from the home screen or app drawer.

A plain Chrome tab does not appear in the Android share sheet. The app must be installed first. If Chrome only offers **Add to Home screen** instead of **Install app**, it may create a shortcut rather than a WebAPK; that shortcut cannot receive shared content.

## Share text or a link

1. Open any app that supports Android sharing.
2. Tap **Share**.
3. Choose **Editor**. It may appear after tapping **More** or scrolling the app row, depending on the Android version and launcher.
4. The shared content is saved as one note in the **Shared** folder and opened for writing.

Android share sheets often send shared links through the text field rather than the URL field. The app detects a link in the shared text and includes it as the source website.

## Why Editor may not appear

- **The PWA is not installed.** A website open in Chrome cannot register as a share target.
- **The installed copy is outdated.** If Editor was installed before the share-target manifest was fixed, uninstall the old app or shortcut, then reinstall from Chrome.
- **A shortcut was installed instead of the app.** Remove it and use **Install app**, not only **Add to Home screen**.
- **A document file is being shared.** The current share target accepts **text and links only**. Sharing a PDF, DOCX, spreadsheet, or other attachment sends a file type the app does not declare, so Android hides Editor from that share sheet.
- **The source app uses a custom share flow or a non-standard MIME type.**
- **The browser is not Chrome.** Web Share Target registration depends on a compatible browser and an installed WebAPK.
- **Chrome is outdated.** Update Chrome from the Play Store and try again.

## Verify the live share target

The deployed manifest should return `application/json` and include `share_target`:

```bash
curl -s https://quillry.onrender.com/manifest.json
```

If the share entry still does not appear after a manifest change, uninstall Editor and install it again to force Android to create a fresh WebAPK.

## Rebuild after a manifest change

```bash
npm run build
git add public/manifest.json
git commit -m "Update PWA manifest"
git push origin main
```

Render redeploys automatically from the `main` branch. The intended Android install URL remains **https://quillry.onrender.com**.
