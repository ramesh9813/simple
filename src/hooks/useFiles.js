import { useEffect, useState } from 'react';
import { sanitizeHtml, textToHtml } from '../utils/html.js';
import { buildSharedNote } from '../utils/share.js';

const WORKSPACE_KEY = 'simple-editor-workspace';
const FILES_KEY = 'simple-editor-files';
const ACTIVE_KEY = 'simple-editor-active';
const LEGACY_KEY = 'simple-editor-text';
const WORKSPACE_VERSION = 2;

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function uniqueName(items, base, excludeId, parentOf, parentId) {
  const names = new Set(
    items
      .filter((item) => item.id !== excludeId && parentOf(item) === parentId)
      .map((item) => item.name)
  );
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

function makeFile(files, folderId, content = '') {
  return {
    id: createId(),
    name: uniqueName(
      files,
      'Untitled',
      null,
      (file) => file.folderId,
      folderId
    ),
    content,
    folderId,
  };
}

function makeFolder(folders, parentId) {
  return {
    id: createId(),
    name: uniqueName(
      folders,
      'New folder',
      null,
      (folder) => folder.parentId,
      parentId
    ),
    parentId,
    expanded: true,
  };
}

function sanitizeWorkspace(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const rawFolders = Array.isArray(raw.folders) ? raw.folders : [];
  const rawFiles = Array.isArray(raw.files) ? raw.files : [];
  const isCurrent = raw.version === WORKSPACE_VERSION;

  const folders = rawFolders
    .filter(
      (folder) =>
        folder &&
        typeof folder.id === 'string' &&
        typeof folder.name === 'string'
    )
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId:
        typeof folder.parentId === 'string' && folder.parentId !== folder.id
          ? folder.parentId
          : null,
      expanded: folder.expanded !== false,
    }));

  const folderIds = new Set(folders.map((folder) => folder.id));
  const cleanFolders = folders.map((folder) => ({
    ...folder,
    parentId:
      folder.parentId && folderIds.has(folder.parentId)
        ? folder.parentId
        : null,
  }));

  const files = rawFiles
    .filter(
      (file) =>
        file &&
        typeof file.id === 'string' &&
        typeof file.name === 'string' &&
        typeof file.content === 'string'
    )
    .map((file) => ({
      id: file.id,
      name: file.name,
      content: isCurrent
        ? sanitizeHtml(file.content)
        : textToHtml(file.content),
      folderId:
        typeof file.folderId === 'string' && folderIds.has(file.folderId)
          ? file.folderId
          : null,
    }));

  if (!cleanFolders.length && !files.length) return null;
  return { folders: cleanFolders, files };
}

function ensureFile(workspace) {
  if (workspace.files.length) return workspace;
  return { ...workspace, files: [makeFile([], null)] };
}

function loadWorkspace() {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (raw) {
      const parsed = sanitizeWorkspace(JSON.parse(raw));
      if (parsed) return ensureFile(parsed);
    }
  } catch {
    localStorage.removeItem(WORKSPACE_KEY);
  }

  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const files = parsed
          .filter(
            (file) =>
              file &&
              typeof file.id === 'string' &&
              typeof file.name === 'string' &&
              typeof file.content === 'string'
          )
          .map((file) => ({
            id: file.id,
            name: file.name,
            content: textToHtml(file.content),
            folderId: null,
          }));
        if (files.length) return { folders: [], files };
      }
    }
  } catch {
    localStorage.removeItem(FILES_KEY);
  }

  const legacy = localStorage.getItem(LEGACY_KEY) || '';
  return {
    folders: [],
    files: [makeFile([], null, textToHtml(legacy))],
  };
}

function loadActiveId(files) {
  const saved = localStorage.getItem(ACTIVE_KEY);
  return files.some((file) => file.id === saved) ? saved : files[0].id;
}

function expandAncestors(folders, folderId) {
  if (!folderId) return folders;

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const expand = new Set();
  let current = byId.get(folderId);
  while (current) {
    expand.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : null;
  }

  return folders.map((folder) =>
    expand.has(folder.id) && !folder.expanded
      ? { ...folder, expanded: true }
      : folder
  );
}

export default function useFiles() {
  const [workspace, setWorkspace] = useState(() => {
    const loaded = loadWorkspace();
    return { ...loaded, activeId: loadActiveId(loaded.files) };
  });

  const { folders, files, activeId } = workspace;

  useEffect(() => {
    try {
      localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify({ version: WORKSPACE_VERSION, folders, files })
      );
    } catch (error) {
      console.error('Could not save workspace', error);
    }
  }, [folders, files]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  function selectFile(id) {
    setWorkspace((prev) => {
      const file = prev.files.find((item) => item.id === id);
      if (!file) return prev;
      return {
        ...prev,
        folders: expandAncestors(prev.folders, file.folderId),
        activeId: id,
      };
    });
  }

  function setContent(content) {
    setWorkspace((prev) => ({
      ...prev,
      files: prev.files.map((file) =>
        file.id === prev.activeId ? { ...file, content } : file
      ),
    }));
  }

  function createFile(parentId = null) {
    setWorkspace((prev) => {
      const folderId = prev.folders.some((folder) => folder.id === parentId)
        ? parentId
        : null;
      const file = makeFile(prev.files, folderId);
      return {
        ...prev,
        folders: expandAncestors(prev.folders, folderId),
        files: [...prev.files, file],
        activeId: file.id,
      };
    });
  }

  function createFolder(parentId = null) {
    setWorkspace((prev) => {
      const parent = prev.folders.some((folder) => folder.id === parentId)
        ? parentId
        : null;
      const folder = makeFolder(prev.folders, parent);
      return {
        ...prev,
        folders: [...expandAncestors(prev.folders, parent), folder],
      };
    });
  }

  function importShared(payload) {
    const note = buildSharedNote(payload);
    setWorkspace((prev) => {
      let folder = prev.folders.find(
        (item) => !item.parentId && item.name.toLowerCase() === 'shared'
      );
      let folders = prev.folders;

      if (folder) {
        if (!folder.expanded) {
          folders = prev.folders.map((item) =>
            item.id === folder.id ? { ...item, expanded: true } : item
          );
        }
      } else {
        folder = {
          id: createId(),
          name: uniqueName(
            prev.folders,
            'Shared',
            null,
            (item) => item.parentId,
            null
          ),
          parentId: null,
          expanded: true,
        };
        folders = [...prev.folders, folder];
      }

      const file = {
        id: createId(),
        name: uniqueName(
          prev.files,
          note.name,
          null,
          (item) => item.folderId,
          folder.id
        ),
        content: note.content,
        folderId: folder.id,
      };

      return {
        ...prev,
        folders,
        files: [...prev.files, file],
        activeId: file.id,
      };
    });
  }

  function toggleFolder(id) {
    setWorkspace((prev) => ({
      ...prev,
      folders: prev.folders.map((folder) =>
        folder.id === id ? { ...folder, expanded: !folder.expanded } : folder
      ),
    }));
  }

  function revealFolder(id) {
    setWorkspace((prev) => {
      if (!prev.folders.some((folder) => folder.id === id)) return prev;
      return {
        ...prev,
        folders: expandAncestors(prev.folders, id),
      };
    });
  }

  function renameFile(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setWorkspace((prev) => {
      const target = prev.files.find((file) => file.id === id);
      if (!target) return prev;
      const nextName = uniqueName(
        prev.files,
        trimmed,
        id,
        (file) => file.folderId,
        target.folderId
      );
      return {
        ...prev,
        files: prev.files.map((file) =>
          file.id === id ? { ...file, name: nextName } : file
        ),
      };
    });
  }

  function renameFolder(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setWorkspace((prev) => {
      const target = prev.folders.find((folder) => folder.id === id);
      if (!target) return prev;
      const nextName = uniqueName(
        prev.folders,
        trimmed,
        id,
        (folder) => folder.parentId,
        target.parentId
      );
      return {
        ...prev,
        folders: prev.folders.map((folder) =>
          folder.id === id ? { ...folder, name: nextName } : folder
        ),
      };
    });
  }

  function deleteFile(id) {
    setWorkspace((prev) => {
      const index = prev.files.findIndex((file) => file.id === id);
      if (index === -1) return prev;

      const remaining = prev.files.filter((file) => file.id !== id);
      if (!remaining.length) {
        const file = makeFile([], null);
        return { ...prev, files: [file], activeId: file.id };
      }

      if (prev.activeId !== id) {
        return { ...prev, files: remaining };
      }

      const fallback = remaining[Math.min(index, remaining.length - 1)];
      return {
        ...prev,
        folders: expandAncestors(prev.folders, fallback.folderId),
        files: remaining,
        activeId: fallback.id,
      };
    });
  }

  function deleteFolder(id) {
    setWorkspace((prev) => {
      if (!prev.folders.some((folder) => folder.id === id)) return prev;

      const removed = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const folder of prev.folders) {
          if (
            folder.parentId &&
            removed.has(folder.parentId) &&
            !removed.has(folder.id)
          ) {
            removed.add(folder.id);
            changed = true;
          }
        }
      }

      const nextFolders = prev.folders.filter(
        (folder) => !removed.has(folder.id)
      );
      let nextFiles = prev.files.filter(
        (file) => !file.folderId || !removed.has(file.folderId)
      );

      if (!nextFiles.length) {
        const file = makeFile([], null);
        return { folders: nextFolders, files: [file], activeId: file.id };
      }

      if (nextFiles.some((file) => file.id === prev.activeId)) {
        return { ...prev, folders: nextFolders, files: nextFiles };
      }

      const fallback = nextFiles[0];
      return {
        folders: expandAncestors(nextFolders, fallback.folderId),
        files: nextFiles,
        activeId: fallback.id,
      };
    });
  }

  const activeFile =
    files.find((file) => file.id === activeId) || files[0];

  return {
    folders,
    files,
    activeFile,
    selectFile,
    setContent,
    createFile,
    createFolder,
    importShared,
    toggleFolder,
    revealFolder,
    renameFile,
    renameFolder,
    deleteFile,
    deleteFolder,
  };
}
