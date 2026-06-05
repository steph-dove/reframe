import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callLLM, LLMError, parseReframe, REQUEST_TIMEOUT_MS } from './llm';

describe('parseReframe', () => {
  it('extracts SAY and WHY sections', () => {
    const result = parseReframe('SAY: Hello there.\nWHY: Friendlier opener.');
    expect(result.say).toBe('Hello there.');
    expect(result.why).toBe('Friendlier opener.');
  });

  it('handles missing WHY', () => {
    const result = parseReframe('SAY: Just this.');
    expect(result.say).toBe('Just this.');
    expect(result.why).toBe('');
  });

  it('falls back to raw text when SAY is absent', () => {
    const result = parseReframe('No structure at all.');
    expect(result.say).toBe('No structure at all.');
    expect(result.why).toBe('');
  });

  it('is case-insensitive on section markers', () => {
    const result = parseReframe('say: lowercase.\nwhy: also lowercase.');
    expect(result.say).toBe('lowercase.');
    expect(result.why).toBe('also lowercase.');
  });

  it('preserves multi-line SAY content', () => {
    const result = parseReframe('SAY: line one.\nline two.\nWHY: because.');
    expect(result.say).toBe('line one.\nline two.');
    expect(result.why).toBe('because.');
  });

  it('returns empty fields on empty input', () => {
    const result = parseReframe('');
    expect(result.say).toBe('');
    expect(result.why).toBe('');
    expect(result.raw).toBe('');
  });
});

describe('callLLM', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const anthropicResponse = (text) => ({
    ok: true,
    json: () => Promise.resolve({ content: [{ text }] }),
  });
  const openaiResponse = (text) => ({
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content: text } }] }),
  });
  const ollamaResponse = (text) => ({
    ok: true,
    json: () => Promise.resolve({ message: { content: text } }),
  });

  it('dispatches to anthropic and parses SAY/WHY', async () => {
    fetch.mockResolvedValueOnce(anthropicResponse('SAY: Hi.\nWHY: Friendly.'));
    const result = await callLLM('thought', 'context', {
      provider: 'anthropic',
      apiKey: 'k',
      style: 'diplomatic',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.say).toBe('Hi.');
    expect(result.why).toBe('Friendly.');
  });

  it('dispatches to openai', async () => {
    fetch.mockResolvedValueOnce(openaiResponse('SAY: Ok.'));
    const result = await callLLM('thought', '', {
      provider: 'openai',
      apiKey: 'k',
      style: 'diplomatic',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.say).toBe('Ok.');
  });

  it('dispatches to ollama using configured URL', async () => {
    fetch.mockResolvedValueOnce(ollamaResponse('SAY: Yo.'));
    const result = await callLLM('thought', '', {
      provider: 'ollama',
      ollamaUrl: 'http://localhost:11434',
      style: 'diplomatic',
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.say).toBe('Yo.');
  });

  it.each([
    ['anthropic', 401, 'authentication'],
    ['openai', 429, 'rate limit'],
    ['ollama', 503, 'trouble'],
  ])('maps %s %i to a friendly error', async (provider, status, fragment) => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: () => Promise.resolve({}),
    });
    await expect(
      callLLM('t', '', { provider, apiKey: 'k', ollamaUrl: 'http://localhost:11434' })
    ).rejects.toMatchObject({
      name: 'LLMError',
      message: expect.stringContaining(fragment),
    });
  });

  it('throws LLMError for unknown provider', async () => {
    await expect(callLLM('t', '', { provider: 'bogus' })).rejects.toBeInstanceOf(LLMError);
  });

  it('passes the abort signal through to fetch and propagates abort', async () => {
    const controller = new AbortController();
    fetch.mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const promise = callLLM(
      't',
      '',
      { provider: 'anthropic', apiKey: 'k' },
      { signal: controller.signal }
    );
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('aborts with a timeout when fetch never resolves', async () => {
    let captured;
    fetch.mockImplementationOnce((_url, init) => {
      captured = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('timed out');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const promise = callLLM('t', '', { provider: 'anthropic', apiKey: 'k' });
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    expect(captured.aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws an "Empty response" LLMError when content is missing', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: [] }),
    });
    await expect(callLLM('t', '', { provider: 'anthropic', apiKey: 'k' })).rejects.toMatchObject({
      name: 'LLMError',
      message: expect.stringContaining('Empty response'),
    });
  });
});
