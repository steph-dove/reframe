const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function normalizeOllamaUrl(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { error: 'Ollama URL is required' };
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: 'Ollama URL is not a valid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Ollama URL must use http or https' };
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    return { error: 'Ollama URL must point to localhost or 127.0.0.1' };
  }
  let normalized = parsed.origin + parsed.pathname.replace(/\/+$/, '');
  if (parsed.pathname === '/' || parsed.pathname === '') normalized = parsed.origin;
  return { value: normalized };
}
