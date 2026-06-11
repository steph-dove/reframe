const styleGuides = {
  diplomatic:
    'Reword this to be professional, constructive, and diplomatic while preserving the core point.',
  manager:
    'Reword this to frame the feedback in terms of team impact, project health, and constructive leadership.',
  client: 'Reword this to be warm, polished, and client-appropriate while still making the point.',
  direct:
    'Reword this to be honest and direct but kind — no sugarcoating, but no hostility either.',
};

function buildPrompts(userThought, meetingContext, settings) {
  const systemPrompt = `You are Reframe, a communication coach. The user is in a meeting and has privately told you their real, unfiltered thoughts. Your job is to help them express this in a way that will be well-received.

${styleGuides[settings.style] || styleGuides.diplomatic}

${settings.customInstructions ? `Additional context from the user: ${settings.customInstructions}` : ''}

Respond with ONLY two sections:
SAY: [The reworded version they should actually say — ready to speak verbatim]
WHY: [One brief sentence explaining what you changed and why]

Keep the SAY section concise and natural-sounding. It should feel like something a real person would say, not a corporate email.`;

  const userMessage = `Meeting context (what others have been saying):
${meetingContext || '(no context captured yet)'}

My real thoughts:
"${userThought}"`;

  return { systemPrompt, userMessage };
}

async function callAnthropic(systemPrompt, userMessage, settings) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model || 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return {
    text: data.content[0].text,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

async function callOpenAI(systemPrompt, userMessage, settings) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o',
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return {
    text: data.choices[0].message.content,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

async function callOllama(systemPrompt, userMessage, settings) {
  const res = await fetch(`${settings.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model || 'llama3.2',
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json();
  return {
    text: data.message.content,
    usage: {
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
    },
  };
}

export async function callLLM(userThought, meetingContext, settings) {
  const { systemPrompt, userMessage } = buildPrompts(userThought, meetingContext, settings);

  if (settings.provider === 'anthropic') {
    return callAnthropic(systemPrompt, userMessage, settings);
  } else if (settings.provider === 'openai') {
    return callOpenAI(systemPrompt, userMessage, settings);
  } else if (settings.provider === 'ollama') {
    return callOllama(systemPrompt, userMessage, settings);
  }
  throw new Error(`Unknown provider: ${settings.provider}`);
}
