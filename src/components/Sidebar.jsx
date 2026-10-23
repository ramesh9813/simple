import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import PanelIcon from './PanelIcon.jsx';
import { htmlToText } from '../utils/html.js';

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilePlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M13 3v5h5M18 14v6M15 17h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2M3 9v9a2 2 0 0 0 2 2h6M18 15v6M15 18h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m20 20-4.35-4.35"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function highlightMatches(text, term) {
  if (!term) return text;
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const parts = [];
  let cursor = 0;
  let index = lowerText.indexOf(lowerTerm);

  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <mark key={`${index}-${cursor}`}>
        {text.slice(index, index + lowerTerm.length)}
      </mark>
    );
    cursor = index + lowerTerm.length;
    index = lowerText.indexOf(lowerTerm, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export default function Sidebar({
  folders,
  files,
  activeId,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onToggleFolder,
  onRenameFile,
  onRenameFolder,
  onDeleteFile,
  onDeleteFolder,
  onRevealFolder,
  onCollapse,
}) {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const cancelled = useRef(false);
  const searchInputRef = useRef(null);

  const normalizedQuery = query.trim().toLowerCase();
  const textQuery = normalizedQuery.replace(/\s+/g, ' ');
  const isSearching = normalizedQuery.length > 0;

  const searchableTexts = useMemo(() => {
    if (!isSearching) return null;
    const texts = new Map();
    for (const file of files) {
      texts.set(
        file.id,
        htmlToText(file.content).replace(/\s+/g, ' ').trim()
      );
    }
    return texts;
  }, [isSearching, files]);

  const results = useMemo(() => {
    if (!isSearching) return null;

    const folderMap = new Map(folders.map((folder) => [folder.id, folder]));

    function folderPath(folderId) {
      const names = [];
      const seen = new Set();
      let current = folderId ? folderMap.get(folderId) : null;
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        names.unshift(current.name);
        current = current.parentId ? folderMap.get(current.parentId) : null;
      }
      return names.join(' / ');
    }

    const folderMatches = folders
      .filter((folder) => folder.name.toLowerCase().includes(normalizedQuery))
      .map((folder) => ({ folder, path: folderPath(folder.id) }));

    const fileMatches = [];

    for (const file of files) {
      const nameMatch = file.name.toLowerCase().includes(normalizedQuery);
      const text = searchableTexts?.get(file.id) || '';
      const textIndex = text.toLowerCase().indexOf(textQuery);
      const textMatch = textIndex !== -1;

      if (!nameMatch && !textMatch) continue;

      let snippet = null;
      if (textMatch) {
        const start = Math.max(0, textIndex - 50);
        const end = Math.min(text.length, textIndex + textQuery.length + 70);
        snippet = `${start > 0 ? '…' : ''}${text.slice(start, end)}${
          end < text.length ? '…' : ''
        }`;
      }

      fileMatches.push({
        file,
        path: folderPath(file.folderId) || 'Workspace',
        snippet,
      });
    }

    return {
      folders: folderMatches,
      files: fileMatches,
      total: folderMatches.length + fileMatches.length,
    };
  }, [
    isSearching,
    normalizedQuery,
    textQuery,
    folders,
    files,
    searchableTexts,
  ]);

  useEffect(() => {
    function handleSearchShortcut(e) {
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        e.key.toLowerCase() === 'f'
      ) {
        e.preventDefault();
        const input = searchInputRef.current;
        if (input) {
          input.focus();
          input.select();
        }
      }
    }

    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  function clearSearch() {
    setQuery('');
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      const firstFile = results?.files[0];
      if (firstFile) {
        e.preventDefault();
        onSelectFile(firstFile.file.id);
        clearSearch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearSearch();
      searchInputRef.current?.blur();
    }
  }

  function handleFolderResult(folderId) {
    onRevealFolder?.(folderId);
    clearSearch();
  }

  function handleFileResult(fileId) {
    onSelectFile(fileId);
    clearSearch();
  }

  function startRename(type, item) {
    cancelled.current = false;
    setEditing({ type, id: item.id, draft: item.name });
  }

  function commitRename() {
    if (!editing) return;
    if (!cancelled.current && editing.draft.trim()) {
      if (editing.type === 'folder') {
        onRenameFolder(editing.id, editing.draft);
      } else {
        onRenameFile(editing.id, editing.draft);
      }
    }
    cancelled.current = false;
    setEditing(null);
  }

  function handleRenameKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelled.current = true;
      setEditing(null);
    }
  }

  function renameInput() {
    return (
      <input
        className="file-rename"
        value={editing.draft}
        autoFocus
        spellCheck="false"
        aria-label="Name"
        onChange={(e) =>
          setEditing({ ...editing, draft: e.target.value })
        }
        onBlur={commitRename}
        onKeyDown={handleRenameKey}
      />
    );
  }

  function renderFile(file, depth) {
    const isActive = file.id === activeId;
    const isEditing = editing?.type === 'file' && editing.id === file.id;
    const plainText = htmlToText(file.content).trim();
    const words = plainText ? plainText.split(/\s+/).length : 0;

    return (
      <div
        key={file.id}
        className={`tree-row file-row${isActive ? ' active' : ''}`}
        style={{ '--depth': depth }}
      >
        <span className="node-spacer" aria-hidden="true" />
        {isEditing ? (
          renameInput()
        ) : (
          <button
            type="button"
            className="node-main"
            onClick={() => onSelectFile(file.id)}
            onDoubleClick={() => startRename('file', file)}
            title="Click to open · double-click to rename"
            aria-current={isActive ? 'true' : undefined}
          >
            <span className="node-name">{file.name}</span>
            <span className="node-meta">
              {words ? `${words} word${words === 1 ? '' : 's'}` : 'empty'}
            </span>
          </button>
        )}

        {!isEditing && (
          <div className="node-actions">
            <button
              type="button"
              className="node-action danger"
              onClick={() => onDeleteFile(file.id)}
              title={`Delete ${file.name}`}
              aria-label={`Delete ${file.name}`}
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderFolder(folder, depth) {
    const isEditing = editing?.type === 'folder' && editing.id === folder.id;
    const childFolders = folders.filter(
      (item) => item.parentId === folder.id
    );
    const childFiles = files.filter((item) => item.folderId === folder.id);
    const count = childFolders.length + childFiles.length;
    const summary = count
      ? `${count} item${count === 1 ? '' : 's'}`
      : 'empty';

    return (
      <Fragment key={folder.id}>
        <div
          className="tree-row folder-row"
          style={{ '--depth': depth }}
        >
          <button
            type="button"
            className={`node-toggle${folder.expanded ? ' expanded' : ''}`}
            onClick={() => onToggleFolder(folder.id)}
            aria-expanded={folder.expanded}
            aria-label={`${folder.expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
          >
            <ChevronIcon />
          </button>

          {isEditing ? (
            renameInput()
          ) : (
            <button
              type="button"
              className="node-main"
              onClick={() => onToggleFolder(folder.id)}
              onDoubleClick={() => startRename('folder', folder)}
              title="Click to expand · double-click to rename"
            >
              <span className="node-name">{folder.name}</span>
              <span className="node-meta">{summary}</span>
            </button>
          )}

          {!isEditing && (
            <div className="node-actions">
              <button
                type="button"
                className="node-action"
                onClick={() => onCreateFile(folder.id)}
                title="New file inside"
                aria-label={`New file in ${folder.name}`}
              >
                <FilePlusIcon />
              </button>
              <button
                type="button"
                className="node-action"
                onClick={() => onCreateFolder(folder.id)}
                title="New folder inside"
                aria-label={`New folder in ${folder.name}`}
              >
                <FolderPlusIcon />
              </button>
              <button
                type="button"
                className="node-action danger"
                onClick={() => onDeleteFolder(folder.id)}
                title={`Delete ${folder.name}`}
                aria-label={`Delete ${folder.name}`}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {folder.expanded && (
          <>
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {childFiles.map((file) => renderFile(file, depth + 1))}
          </>
        )}
      </Fragment>
    );
  }

  const rootFolders = folders.filter((folder) => !folder.parentId);
  const rootFiles = files.filter((file) => !file.folderId);

  return (
    <aside id="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">Workspace</span>
        <div className="sidebar-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => onCreateFile(null)}
            title="New file"
            aria-label="New file"
          >
            <FilePlusIcon />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => onCreateFolder(null)}
            title="New folder"
            aria-label="New folder"
          >
            <FolderPlusIcon />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onCollapse}
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            <PanelIcon />
          </button>
        </div>
      </div>

      <nav className="file-list" aria-label="Files and folders">
        {isSearching && results ? (
          <div className="search-results">
            <div className="search-summary">
              {results.total} match{results.total === 1 ? '' : 'es'}
            </div>

            {results.folders.length > 0 && (
              <div className="search-section">
                <div className="search-heading">Folders</div>
                {results.folders.map(({ folder, path }) => (
                  <button
                    key={folder.id}
                    type="button"
                    className="search-result"
                    onClick={() => handleFolderResult(folder.id)}
                  >
                    <span className="search-result-name">
                      {highlightMatches(folder.name, normalizedQuery)}
                    </span>
                    <span className="search-result-meta">{path}</span>
                  </button>
                ))}
              </div>
            )}

            {results.files.length > 0 && (
              <div className="search-section">
                <div className="search-heading">Files</div>
                {results.files.map(({ file, path, snippet }) => (
                  <button
                    key={file.id}
                    type="button"
                    className={`search-result${
                      file.id === activeId ? ' active' : ''
                    }`}
                    onClick={() => handleFileResult(file.id)}
                  >
                    <span className="search-result-name">
                      {highlightMatches(file.name, normalizedQuery)}
                    </span>
                    <span className="search-result-meta">
                      {snippet
                        ? highlightMatches(snippet, textQuery)
                        : path}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {results.total === 0 && (
              <div className="search-empty">No matches found.</div>
            )}
          </div>
        ) : (
          <>
            {rootFolders.map((folder) => renderFolder(folder, 0))}
            {rootFiles.map((file) => renderFile(file, 0))}
          </>
        )}
      </nav>

      <div className="sidebar-search">
        <SearchIcon />
        <input
          ref={searchInputRef}
          type="search"
          className="search-input"
          value={query}
          placeholder="Search files, folders, text…"
          aria-label="Search files, folders, and text"
          spellCheck="false"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              clearSearch();
              searchInputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="sidebar-foot">
        {isSearching && results
          ? `${results.total} match${results.total === 1 ? '' : 'es'}`
          : `${files.length} file${files.length === 1 ? '' : 's'} · ${
              folders.length
            } folder${folders.length === 1 ? '' : 's'}`}
      </div>
    </aside>
  );
}
