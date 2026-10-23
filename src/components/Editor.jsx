import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { isHtmlEmpty, sanitizeHtml } from '../utils/html.js';

const MAX_DIMENSION = 1600;
const MAX_SOURCE_BYTES = 1_200_000;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read image'));
    image.src = src;
  });
}

async function imageToDataUrl(file) {
  const original = await readAsDataUrl(file);
  if (file.type === 'image/gif' && file.size <= MAX_SOURCE_BYTES) {
    return original;
  }

  const image = await loadImage(original);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  if (scale === 1 && file.size <= MAX_SOURCE_BYTES) return original;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp')
    ? webp
    : canvas.toDataURL('image/jpeg', 0.85);
}

function getClipboardImage(clipboardData) {
  const items = Array.from(clipboardData?.items || []);
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return (
    Array.from(clipboardData?.files || []).find((file) =>
      file.type.startsWith('image/')
    ) || null
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="9"
        cy="10"
        r="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m21 15.5-4.5-4.5L8 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const Editor = forwardRef(function Editor({ fileId, value, onChange }, ref) {
  const editorRef = useRef(null);
  const inputRef = useRef(null);
  const savedRange = useRef(null);
  const fileIdRef = useRef(fileId);
  const valueRef = useRef(value);
  const scrollTopRef = useRef(0);
  const widthRef = useRef(0);
  const [isEmpty, setIsEmpty] = useState(() => isHtmlEmpty(value));
  const [busy, setBusy] = useState(false);

  valueRef.current = value;
  fileIdRef.current = fileId;

  useImperativeHandle(ref, () => editorRef.current, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const clean = sanitizeHtml(valueRef.current);
    editor.innerHTML = clean;
    setIsEmpty(isHtmlEmpty(clean));
    savedRange.current = null;
  }, [fileId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    function syncScrollbar() {
      const scrollbar = editor.offsetWidth - editor.clientWidth;
      editor.style.setProperty('--editor-scrollbar', `${scrollbar}px`);
    }

    scrollTopRef.current = editor.scrollTop;
    widthRef.current = editor.clientWidth;
    syncScrollbar();

    function handleScroll() {
      scrollTopRef.current = editor.scrollTop;
    }

    const observer = new ResizeObserver(() => {
      const width = editor.clientWidth;
      if (width === widthRef.current) return;
      editor.scrollTop = scrollTopRef.current;
      widthRef.current = width;
      syncScrollbar();
    });

    editor.addEventListener('scroll', handleScroll, { passive: true });
    observer.observe(editor);

    return () => {
      observer.disconnect();
      editor.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    function rememberRange() {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }

    document.addEventListener('selectionchange', rememberRange);
    return () => document.removeEventListener('selectionchange', rememberRange);
  }, []);

  function rememberRange() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  }

  function currentRange() {
    const editor = editorRef.current;
    const range = savedRange.current;
    if (editor && range && editor.contains(range.commonAncestorContainer)) {
      return range;
    }
    if (!editor) return null;
    const fallback = document.createRange();
    fallback.selectNodeContents(editor);
    fallback.collapse(false);
    return fallback;
  }

  function handleInput() {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeHtml(editor.innerHTML);
    setIsEmpty(isHtmlEmpty(html));
    onChange(html);
    rememberRange();
  }

  function insertImage(dataUrl, alt) {
    const editor = editorRef.current;
    const range = currentRange();
    if (!editor || !range) return;

    editor.focus();
    range.deleteContents();

    const wrapper = document.createElement('div');
    const image = document.createElement('img');
    image.src = dataUrl;
    image.alt = alt || 'Image';
    wrapper.appendChild(image);

    const paragraph = document.createElement('p');
    paragraph.appendChild(document.createElement('br'));

    range.insertNode(wrapper);
    wrapper.after(paragraph);

    const caret = document.createRange();
    caret.setStart(paragraph, 0);
    caret.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(caret);
    savedRange.current = caret.cloneRange();

    handleInput();
    paragraph.scrollIntoView({ block: 'nearest' });
  }

  async function addImages(fileList) {
    const file = Array.from(fileList || []).find((item) =>
      item.type.startsWith('image/')
    );
    if (!file) return;

    const targetFile = fileIdRef.current;
    setBusy(true);
    try {
      const dataUrl = await imageToDataUrl(file);
      if (fileIdRef.current !== targetFile || !editorRef.current) return;
      insertImage(dataUrl, file.name);
    } catch {
      window.alert('That image could not be added.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
      setBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  }

  function handlePaste(e) {
    const image = getClipboardImage(e.clipboardData);

    if (image) {
      e.preventDefault();
      rememberRange();
      addImages([image]);
      return;
    }

    const text = e.clipboardData?.getData('text/plain') || '';
    e.preventDefault();
    if (text) document.execCommand('insertText', false, text);
  }

  function handleDrop(e) {
    e.preventDefault();
    const image = Array.from(e.dataTransfer?.files || []).find((file) =>
      file.type.startsWith('image/')
    );
    if (image) {
      addImages([image]);
      return;
    }

    const text = e.dataTransfer?.getData('text/plain') || '';
    if (text) {
      editorRef.current?.focus();
      document.execCommand('insertText', false, text);
    }
  }

  return (
    <div id="editor-shell">
      <div
        id="editor"
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck="true"
        role="textbox"
        aria-multiline="true"
        aria-label="Writing area"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onBlur={rememberRange}
      />

      {isEmpty && (
        <div id="editor-placeholder" aria-hidden="true">
          Start writing…
        </div>
      )}

      <div className="editor-toolbar">
        <button
          type="button"
          className="toolbar-button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          title="Insert image"
          aria-label="Insert image"
          disabled={busy}
        >
          <ImageIcon />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => addImages(e.target.files)}
        />
      </div>
    </div>
  );
});

export default Editor;
