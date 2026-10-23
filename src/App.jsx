import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from './components/Editor.jsx';
import PanelIcon from './components/PanelIcon.jsx';
import Sidebar from './components/Sidebar.jsx';
import StatusBar from './components/StatusBar.jsx';
import useFiles from './hooks/useFiles.js';
import { escapeHtml, htmlToText, isHtmlEmpty } from './utils/html.js';
import { clearShareUrl, consumeSharedContent } from './utils/share.js';

const SIDEBAR_KEY = 'simple-editor-sidebar-open';
const MOBILE_QUERY = '(max-width: 860px)';

export default function App() {
  const {
    folders,
    files,
    activeFile,
    selectFile,
    setContent,
    createFile,
    createFolder,
    importShared,
    toggleFolder,
    renameFile,
    renameFolder,
    deleteFile,
    deleteFolder,
    revealFolder,
  } = useFiles();
  const editorRef = useRef(null);
  const sharedImportStarted = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      if (saved !== null) return saved !== 'false';
      return !window.matchMedia(MOBILE_QUERY).matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
    } catch {
      console.error('Could not save sidebar state');
    }
  }, [sidebarOpen]);

  useEffect(() => {
    if (sharedImportStarted.current) return;
    sharedImportStarted.current = true;

    async function runSharedImport() {
      let payload = null;
      try {
        payload = await consumeSharedContent();
      } catch (error) {
        console.error('Could not read shared content', error);
      }

      clearShareUrl();

      if (!payload) return;

      try {
        importShared(payload);
        setSidebarOpen(!window.matchMedia(MOBILE_QUERY).matches);
      } catch (error) {
        console.error('Could not import shared content', error);
      }
    }

    runSharedImport();
  }, []);

  useEffect(() => {
    editorRef.current?.focus();
  }, [activeFile.id]);

  useEffect(() => {
    if (!sidebarOpen) return;

    function handleEscape(e) {
      if (e.key === 'Escape' && window.matchMedia(MOBILE_QUERY).matches) {
        setSidebarOpen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  const plainText = useMemo(() => htmlToText(activeFile.content), [activeFile.content]);

  const download = useCallback(() => {
    const documentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(activeFile.name)}</title>
<style>
body {
  margin: 0;
  padding: 3rem 1.25rem;
  background: #faf7f0;
  color: #2b2620;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 18px;
  line-height: 1.7;
}
main {
  max-width: 72ch;
  margin: 0 auto;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
}
</style>
</head>
<body>
<main>${activeFile.content}</main>
</body>
</html>`;
    const blob = new Blob([documentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = activeFile.name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'note';
    a.href = url;
    a.download = `${base.replace(/\.html?$/i, '')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [activeFile]);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        download();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [download]);

  function handleSelectFile(id) {
    selectFile(id);
    if (window.matchMedia(MOBILE_QUERY).matches) setSidebarOpen(false);
  }

  function handleDeleteFile(id) {
    const file = files.find((item) => item.id === id);
    if (!file) return;
    if (
      !isHtmlEmpty(file.content) &&
      !window.confirm(`Delete "${file.name}"? This cannot be undone.`)
    ) {
      return;
    }
    deleteFile(id);
  }

  function handleDeleteFolder(id) {
    const folder = folders.find((item) => item.id === id);
    if (!folder) return;
    if (
      !window.confirm(
        `Delete "${folder.name}" and everything inside it? This cannot be undone.`
      )
    ) {
      return;
    }
    deleteFolder(id);
  }

  return (
    <div className={`app-shell${sidebarOpen ? '' : ' is-collapsed'}`}>
      {sidebarOpen && (
        <Sidebar
          folders={folders}
          files={files}
          activeId={activeFile.id}
          onSelectFile={handleSelectFile}
          onCreateFile={createFile}
          onCreateFolder={createFolder}
          onToggleFolder={toggleFolder}
          onRenameFile={renameFile}
          onRenameFolder={renameFolder}
          onDeleteFile={handleDeleteFile}
          onDeleteFolder={handleDeleteFolder}
          onRevealFolder={revealFolder}
          onCollapse={() => setSidebarOpen(false)}
        />
      )}
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          tabIndex={-1}
        />
      )}
      <main id="main">
        {!sidebarOpen && (
          <button
            type="button"
            className="sidebar-open"
            onClick={() => setSidebarOpen(true)}
            title="Show sidebar"
            aria-label="Show sidebar"
          >
            <PanelIcon />
          </button>
        )}
        <Editor
          ref={editorRef}
          fileId={activeFile.id}
          value={activeFile.content}
          onChange={setContent}
        />
        <StatusBar text={plainText} onDownload={download} />
      </main>
    </div>
  );
}
