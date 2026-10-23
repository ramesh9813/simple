const ALLOWED_TAGS = new Set([
  'DIV',
  'P',
  'BR',
  'IMG',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'SPAN',
  'A',
]);

const BLOCK_TAGS = new Set([
  'DIV',
  'P',
  'LI',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'UL',
  'OL',
]);

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function textToHtml(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => `<div>${line ? escapeHtml(line) : '<br>'}</div>`)
    .join('');
}

function cleanNode(parent) {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      continue;
    }

    const tag = node.tagName;
    if (!ALLOWED_TAGS.has(tag)) {
      if (
        [
          'SCRIPT',
          'STYLE',
          'IFRAME',
          'OBJECT',
          'EMBED',
          'LINK',
          'META',
          'BASE',
          'HEAD',
          'TITLE',
        ].includes(tag)
      ) {
        node.remove();
      } else {
        cleanNode(node);
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        node.remove();
      }
      continue;
    }

    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      const keep =
        (tag === 'IMG' && (name === 'src' || name === 'alt')) ||
        (tag === 'A' &&
          (name === 'href' || name === 'target' || name === 'rel'));
      if (!keep) node.removeAttribute(attribute.name);
    }

    if (tag === 'IMG') {
      const src = node.getAttribute('src') || '';
      if (!src.startsWith('data:image/')) {
        node.remove();
        continue;
      }
      if (!node.getAttribute('alt')) node.setAttribute('alt', 'Image');
    }

    if (tag === 'A') {
      const href = node.getAttribute('href');
      let safe = false;
      if (href) {
        try {
          const url = new URL(href, window.location.origin);
          safe = url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          safe = false;
        }
      }
      if (safe) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else {
        node.removeAttribute('href');
        node.removeAttribute('target');
        node.removeAttribute('rel');
      }
    }

    cleanNode(node);
  }
}

export function sanitizeHtml(html) {
  if (!html) return '';
  const container = document.createElement('div');
  container.innerHTML = html;
  cleanNode(container);
  return container.innerHTML;
}

function nodeToText(node) {
  let output = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      output += child.nodeValue;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName;
      if (tag === 'BR') {
        output += '\n';
      } else if (tag !== 'IMG') {
        const text = nodeToText(child);
        output += text;
        if (BLOCK_TAGS.has(tag) && !text.endsWith('\n')) {
          output += '\n';
        }
      }
    }
  }
  return output;
}

export function htmlToText(html) {
  if (!html) return '';
  const container = document.createElement('div');
  container.innerHTML = html;
  return nodeToText(container)
    .replace(/\u00a0/g, ' ')
    .replace(/\n$/, '');
}

export function isHtmlEmpty(html) {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  return !htmlToText(html).trim();
}
