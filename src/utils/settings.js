import { PROVIDERS } from './providers';
import { normalizeOllamaUrl } from './ollamaUrl';

const STORAGE_KEY = 'reframe_settings';

const defaults = {
  provider: 'anthropic',
  apiKey: '',
  model: PROVIDERS.anthropic.defaultModel,
  ollamaUrl: 'http://localhost:11434',
  wakePhrase: "here's the thing",
  silenceTimeout: 3,
  style: 'diplomatic',
  customInstructions: '',
};

export const DEFAULT_WAKE_PHRASE = defaults.wakePhrase;
export const DEFAULT_SILENCE_TIMEOUT = defaults.silenceTimeout;

// Validation runs on save, but older versions could persist values the current
// rules reject (empty wake phrase, non-loopback Ollama URL) — sanitize on read
// so stale localStorage can't bypass them.
function sanitize(settings) {
  const next = { ...settings };
  if (typeof next.wakePhrase !== 'string' || !next.wakePhrase.trim()) {
    next.wakePhrase = defaults.wakePhrase;
  }
  const ollama = normalizeOllamaUrl(next.ollamaUrl);
  next.ollamaUrl = ollama.error ? defaults.ollamaUrl : ollama.value;
  return next;
}

export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return sanitize({ ...defaults, ...saved });
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.warn('Failed to write settings:', err);
    return false;
  }
}
