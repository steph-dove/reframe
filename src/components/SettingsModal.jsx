import { useState, useEffect } from 'react';
import { getSettings, saveSettings as persistSettings } from '../utils/settings';

export default function SettingsModal({ isOpen, onClose, onToast }) {
  const [form, setForm] = useState(getSettings);

  useEffect(() => {
    if (isOpen) setForm(getSettings());
  }, [isOpen]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = () => {
    persistSettings({
      ...form,
      wakePhrase: form.wakePhrase.toLowerCase().trim(),
      silenceTimeout: parseInt(form.silenceTimeout) || 3,
    });
    onClose();
    onToast('Settings saved');
  };

  const providerHints = {
    anthropic: {
      placeholder: 'sk-ant-...',
      model: 'claude-sonnet-4-20250514',
      hint: 'Your key stays on-device',
    },
    openai: { placeholder: 'sk-...', model: 'gpt-4o', hint: 'Your key stays on-device' },
    ollama: {
      placeholder: 'Not needed for local models',
      model: 'llama3.2',
      hint: 'Ollama runs locally — no API key needed',
    },
  };

  const hints = providerHints[form.provider] || providerHints.anthropic;

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
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>

        <div className="field">
          <label>API Key</label>
          <input
            type="password"
            value={form.apiKey}
            onChange={update('apiKey')}
            placeholder={hints.placeholder}
          />
          <div className="hint">{hints.hint}</div>
        </div>

        <div className="field">
          <label>Model</label>
          <input
            type="text"
            value={form.model}
            onChange={update('model')}
            placeholder={hints.model}
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
            min="1"
            max="10"
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
