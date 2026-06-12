import { describe, expect, it } from 'vitest';
import { normalizeOllamaUrl } from './ollamaUrl';

describe('normalizeOllamaUrl', () => {
  it('accepts the default localhost URL', () => {
    expect(normalizeOllamaUrl('http://localhost:11434')).toEqual({
      value: 'http://localhost:11434',
    });
  });

  it('accepts https on localhost', () => {
    expect(normalizeOllamaUrl('https://localhost:11434')).toEqual({
      value: 'https://localhost:11434',
    });
  });

  it('accepts 127.0.0.1', () => {
    expect(normalizeOllamaUrl('http://127.0.0.1:11434')).toEqual({
      value: 'http://127.0.0.1:11434',
    });
  });

  it('rejects non-loopback hosts', () => {
    const result = normalizeOllamaUrl('http://evil.com:11434');
    expect(result.error).toMatch(/localhost or 127\.0\.0\.1/);
    expect(result.value).toBeUndefined();
  });

  it('rejects hosts that merely start with localhost', () => {
    const result = normalizeOllamaUrl('http://localhost.evil.com:11434');
    expect(result.error).toMatch(/localhost or 127\.0\.0\.1/);
  });

  it('rejects IPv6 loopback (not allowed by the CSP)', () => {
    const result = normalizeOllamaUrl('http://[::1]:11434');
    expect(result.error).toMatch(/localhost or 127\.0\.0\.1/);
  });

  it('rejects non-http(s) schemes', () => {
    expect(normalizeOllamaUrl('ftp://localhost:11434').error).toMatch(/http or https/);
    expect(normalizeOllamaUrl('ws://localhost:11434').error).toMatch(/http or https/);
  });

  it('rejects empty and invalid input', () => {
    expect(normalizeOllamaUrl('').error).toMatch(/required/);
    expect(normalizeOllamaUrl(undefined).error).toMatch(/required/);
    expect(normalizeOllamaUrl('not a url').error).toMatch(/not a valid URL/);
  });

  it('strips trailing slashes', () => {
    expect(normalizeOllamaUrl('http://localhost:11434/')).toEqual({
      value: 'http://localhost:11434',
    });
    expect(normalizeOllamaUrl('http://localhost:11434///')).toEqual({
      value: 'http://localhost:11434',
    });
  });

  it('strips userinfo', () => {
    expect(normalizeOllamaUrl('http://user:pass@localhost:11434')).toEqual({
      value: 'http://localhost:11434',
    });
  });
});
