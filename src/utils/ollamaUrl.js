// IPv6 loopback is deliberately excluded: the CSP has no [::1] entry, so an
// IPv6 URL would validate here and then fail every request at the CSP layer.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

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
