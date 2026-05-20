import { describe, it, expect } from 'vitest';
import { parseReframe } from './llm';

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
