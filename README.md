# Editor

A distraction-free writing editor built with React and Vite. A file tree takes the left 25% of the window, and the remaining 75% is the writing surface.

**Live app:** https://quillry.onrender.com

## Features

- Multi-file workspace with folders and nested folders
- Collapsible sidebar: minimize it to hide the file tree and use the full window for writing
- Sidebar file tree with create, rename, expand/collapse, and delete
- Click a file to open it; double-click a name to rename it
- Per-folder actions to add a file or subfolder inside it
- Sidebar search across file names, folder names, and full text (Ctrl/Cmd+F)
- Inline images from the toolbar button, paste (including copied screenshots with Ctrl/Cmd+V), or drag and drop
- Images are compressed, resized, and stored inline in the document
- Autosave every file to localStorage as you type
- Full-height writing pane; the text column uses 60% of the pane and stays centered while the scrollbar remains at the pane edge
- Live word and character count
- Tab inserts an indent instead of moving focus
- Ctrl/Cmd+S downloads the current file as a self-contained `.html` document with embedded styles and inline images
- Installable PWA: use Chrome's Install app action on Android to launch it standalone
- Android share target: share text or a link from any app and it is saved as one note in the Shared folder, with the source website included
- Light and dark theme
- Responsive layout for smaller screens
- Print-friendly styles

## Quick start

```bash
npm install
npm run dev
npm run build
npm run preview
```

`npm run dev` starts the Vite dev server. `npm run build` writes a production bundle to `dist/`, and `npm run preview` serves it locally.

## Install on Android

Open the app over HTTPS in Chrome (or `localhost` while testing), then use Chrome's menu and choose **Install app** (or **Add to Home screen**). A plain `http://` address on your LAN is not a secure context, so Chrome will not offer installation there.

After installation, sharing text or a link from another Android app lists **Editor** in the share sheet. Each share creates one file in the root **Shared** folder and opens it; shared links are shown as the source website.

## Project structure

```
.
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── components/
    │   ├── Editor.jsx
    │   ├── Sidebar.jsx
    │   └── StatusBar.jsx
    ├── hooks/
    │   └── useFiles.js
    ├── utils/
    │   ├── html.js
    │   └── share.js
    └── index.css
```

## Storage

Folders and files are stored locally in your browser only, under the localStorage keys `simple-editor-workspace` and `simple-editor-active`. Workspace data is version 2 and stores each document as HTML. Nothing is uploaded or sent anywhere. Legacy plain-text documents and the old flat file list are converted to HTML and migrated automatically.
