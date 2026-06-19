import { useState, useEffect } from 'react';
import { PROVIDERS } from '../utils/providers';
import { DEFAULT_SILENCE_TIMEOUT, DEFAULT_WAKE_PHRASE } from '../utils/settings';
import { normalizeOllamaUrl } from '../utils/ollamaUrl';

const MIN_SILENCE_TIMEOUT = 1;
const MAX_SILENCE_TIMEOUT = 10;

export default function SettingsModal({ isOpen, onClose, onToast, settings, onSave }) {
  const [form, setForm] = useState(settings);

  useEffect(() => {
    if (isOpen) setForm(settings);
  }, [isOpen, settings]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = () => {
    const parsed = parseInt(form.silenceTimeout, 10);
    const wakePhrase = (form.wakePhrase || '').toLowerCase().trim() || DEFAULT_WAKE_PHRASE;

    let ollamaUrl = (form.ollamaUrl || '').trim();
    if (form.provider === 'ollama') {
      const result = normalizeOllamaUrl(form.ollamaUrl);
      if (result.error) {
        onToast(result.error);
        return;
      }
      ollamaUrl = result.value;
    }

    const next = {
      ...form,
      apiKey: form.apiKey.trim(),
      ollamaUrl,
      wakePhrase,
      silenceTimeout: Math.min(
        MAX_SILENCE_TIMEOUT,
        Math.max(MIN_SILENCE_TIMEOUT, Number.isFinite(parsed) ? parsed : DEFAULT_SILENCE_TIMEOUT)
      ),
    };
    const saved = onSave(next);
    if (saved === false) {
      onToast('Could not save settings — storage unavailable');
      return;
    }
    onClose();
    onToast('Settings saved');
  };

  const provider = PROVIDERS[form.provider] || PROVIDERS.anthropic;

  return (
    <div
      className={`modal-overlay ${isOpen ? 'active' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-handle" />
        <h2>Settings</h2>

        <div className="field">
          <label>LLM Provider</label>
          <select value={form.provider} onChange={update('provider')}>
            {Object.entries(PROVIDERS).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>API Key</label>
          <input
            type="password"
            value={form.apiKey}
            onChange={update('apiKey')}
            placeholder={provider.keyPlaceholder}
          />
          <div className="hint">{provider.keyHint}</div>
        </div>

        <div className="field">
          <label>Model</label>
          <input
            type="text"
            value={form.model}
            onChange={update('model')}
            placeholder={provider.defaultModel}
          />
        </div>

        {form.provider === 'ollama' && (
          <div className="field">
            <label>Ollama URL</label>
            <input
              type="text"
              value={form.ollamaUrl}
              onChange={update('ollamaUrl')}
              placeholder="http://localhost:11434"
            />
            <div className="hint">Must point to localhost or 127.0.0.1.</div>
          </div>
        )}

        <div className="field">
          <label>Wake Phrase</label>
          <input
            type="text"
            value={form.wakePhrase}
            onChange={update('wakePhrase')}
            placeholder="here's the thing"
          />
          <div className="hint">Say this before your real thoughts. Case insensitive.</div>
        </div>

        <div className="field">
          <label>Silence Timeout (seconds)</label>
          <input
            type="number"
            value={form.silenceTimeout}
            onChange={update('silenceTimeout')}
            min={MIN_SILENCE_TIMEOUT}
            max={MAX_SILENCE_TIMEOUT}
          />
          <div className="hint">How long to wait after you stop speaking to process your input</div>
        </div>

        <div className="field">
          <label>Reframing Style</label>
          <select value={form.style} onChange={update('style')}>
            <option value="diplomatic">Diplomatic — Professional & constructive</option>
            <option value="manager">Manager — Frame in terms of team impact</option>
            <option value="client">Client-facing — Extra polished & warm</option>
            <option value="direct">Direct — Honest but kind</option>
          </select>
        </div>

        <div className="field">
          <label>Custom Instructions (optional)</label>
          <textarea
            value={form.customInstructions}
            onChange={update('customInstructions')}
            placeholder="e.g. I'm a senior engineer talking to my team lead. Keep it casual but professional."
          />
        </div>

        <button className="save-btn" onClick={handleSave}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
