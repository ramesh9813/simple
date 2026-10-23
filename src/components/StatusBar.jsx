export default function StatusBar({ text, onDownload }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div id="status">
      <span>
        {words} word{words === 1 ? '' : 's'} · {text.length} chars
      </span>
      <button type="button" onClick={onDownload} title="Download as .html">
        Download
      </button>
    </div>
  );
}
