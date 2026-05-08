const STORAGE_KEY = 'reframe_settings';

const defaults = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  ollamaUrl: 'http://localhost:11434',
  wakePhrase: "here's the thing",
  silenceTimeout: 3,
  style: 'diplomatic',
  customInstructions: '',
};

export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
