import { escapeHtml, textToHtml } from './html.js';

export const SHARE_TARGET_CACHE_NAME = 'editor-share-target-v1';
export const SHARE_TARGET_CACHE_KEY = '__share-target__';

const TRAILING_PUNCTUATION = '.,;:!?，。！？；：、…\'"';

function stripTrailingPunctuation(value) {
  let result = value;
  let changed = true;
  while (changed && result) {
    changed = false;
    const last = result[result.length - 1];
    if (TRAILING_PUNCTUATION.includes(last)) {
      result = result.slice(0, -1);
      changed = true;
      continue;
    }
    const open = last === ')' ? '(' : last === ']' ? '[' : last === '}' ? '{' : '';
    if (open) {
      const closes = result.split(last).length - 1;
      const opens = result.split(open).length - 1;
      if (closes > opens) {
        result = result.slice(0, -1);
        changed = true;
      }
    }
  }
  return result;
}

function asText(value) {
  return typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').trim()
    : '';
}

function safeUrl(value) {
  const raw = asText(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return raw;
    }
  } catch {
    return '';
  }
  return '';
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return '';
  return safeUrl(stripTrailingPunctuation(match[0]));
}

function cleanName(value) {
  return value
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
}

function noteName(title, text, url) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  let hostname = '';
  if (url) {
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = '';
    }
  }

  const candidates = [title, firstLine, hostname, 'Shared note'];
  for (const candidate of candidates) {
    const name = cleanName(candidate || '');
    if (name) return name;
  }
  return 'Shared note';
}

function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const payload = {
    title: asText(raw.title),
    text: asText(raw.text),
    url: asText(raw.url),
  };
  if (!payload.title && !payload.text && !payload.url) return null;
  return payload;
}

function getShareTargetCacheKey() {
  const baseUrl = import.meta.env?.BASE_URL || '/';
  return new URL(
    `${baseUrl}${SHARE_TARGET_CACHE_KEY}`,
    window.location.origin
  ).href;
}

export function buildSharedNote(payload) {
  const title = asText(payload?.title);
  const text = asText(payload?.text);
  const url = safeUrl(payload?.url) || extractUrl(text);

  const parts = [];
  if (title) parts.push(`<h2>${escapeHtml(title)}</h2>`);
  if (url) {
    const href = escapeHtml(url);
    parts.push(
      `<p><a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a></p>`
    );
  }
  if (text) parts.push(textToHtml(text));

  return {
    name: noteName(title, text, url),
    content: parts.length ? parts.join('') : '<p>Shared item</p>',
  };
}

export async function consumeSharedContent() {
  try {
    if (typeof caches !== 'undefined' && typeof caches.open === 'function') {
      const key = getShareTargetCacheKey();
      const cache = await caches.open(SHARE_TARGET_CACHE_NAME);
      const response = await cache.match(key);
      if (response) {
        try {
          await cache.delete(key);
        } catch {}
        const payload = normalizePayload(await response.json());
        if (payload) return payload;
      }
    }
  } catch {}

  const params = new URLSearchParams(window.location.search);
  if (params.get('share-target') !== '1') return null;
  return normalizePayload({
    title: params.get('title') || '',
    text: params.get('text') || '',
    url: params.get('url') || '',
  });
}

export function clearShareUrl() {
  try {
    const current = new URL(window.location.href);
    if (!current.searchParams.has('share-target')) return;
    current.searchParams.delete('share-target');
    current.searchParams.delete('title');
    current.searchParams.delete('text');
    current.searchParams.delete('url');
    window.history.replaceState(
      window.history.state,
      '',
      `${current.pathname}${current.search}${current.hash}`
    );
  } catch {}
}
