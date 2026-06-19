// Provider catalog shared by the LLM transport (services/llm.js) and the
// settings layer (utils/settings.js, components/SettingsModal.jsx). Kept
// separate so neither side has to import the other just to read provider
// metadata or default models.
export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-20250514',
    keyPlaceholder: 'sk-ant-...',
    keyHint:
      'Stored in this browser and sent directly to Anthropic when reframing. Anyone with access to this device can read it.',
  },
  openai: {
    label: 'OpenAI (GPT)',
    defaultModel: 'gpt-4o',
    keyPlaceholder: 'sk-...',
    keyHint:
      'Stored in this browser and sent directly to OpenAI when reframing. Anyone with access to this device can read it.',
  },
  ollama: {
    label: 'Ollama (Local)',
    defaultModel: 'llama3.2',
    keyPlaceholder: 'Not needed for local models',
    keyHint: 'Ollama runs locally — no API key needed',
  },
};
