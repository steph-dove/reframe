import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';

function makeMockRecognizer() {
  const handlers = {};
  const rec = {
    continuous: false,
    interimResults: false,
    lang: '',
    maxAlternatives: 0,
    start: vi.fn(),
    stop: vi.fn(),
    set onresult(fn) {
      handlers.onresult = fn;
    },
    get onresult() {
      return handlers.onresult;
    },
    set onerror(fn) {
      handlers.onerror = fn;
    },
    get onerror() {
      return handlers.onerror;
    },
    set onend(fn) {
      handlers.onend = fn;
    },
    get onend() {
      return handlers.onend;
    },
    _emit(name, payload) {
      const fn = handlers[name];
      if (fn) fn(payload);
    },
  };
  return rec;
}

function resultsEvent(items, resultIndex = 0) {
  const results = items.map(({ transcript, isFinal }) => {
    const entry = [{ transcript }];
    entry.isFinal = isFinal;
    return entry;
  });
  return { resultIndex, results };
}

let mockRecognizer;

beforeEach(() => {
  mockRecognizer = makeMockRecognizer();
  vi.stubGlobal(
    'SpeechRecognition',
    vi.fn(() => mockRecognizer)
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSpeechRecognition', () => {
  it('routes non-wake final transcripts to onMeetingContext', () => {
    const onMeetingContext = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({
        wakePhrase: "here's the thing",
        silenceTimeout: 3,
        onMeetingContext,
        onUserInput: vi.fn(),
        onWakeDetected: vi.fn(),
        onProcessInput: vi.fn(),
        onError: vi.fn(),
      })
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      mockRecognizer._emit(
        'onresult',
        resultsEvent([{ transcript: 'just regular talk', isFinal: true }])
      );
    });
    expect(onMeetingContext).toHaveBeenCalledWith('just regular talk');
  });

  it('triggers wake detection and routes user input after the wake phrase', () => {
    const onWakeDetected = vi.fn();
    const onUserInput = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({
        wakePhrase: "here's the thing",
        silenceTimeout: 3,
        onMeetingContext: vi.fn(),
        onUserInput,
        onWakeDetected,
        onProcessInput: vi.fn(),
        onError: vi.fn(),
      })
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      mockRecognizer._emit(
        'onresult',
        resultsEvent([{ transcript: "here's the thing this is dumb", isFinal: true }])
      );
    });
    expect(onWakeDetected).toHaveBeenCalledTimes(1);
    expect(onUserInput).toHaveBeenCalledWith('this is dumb');
  });

  it('fires onProcessInput after the silence timer elapses', () => {
    vi.useFakeTimers();
    try {
      const onProcessInput = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({
          wakePhrase: "here's the thing",
          silenceTimeout: 1,
          onMeetingContext: vi.fn(),
          onUserInput: vi.fn(),
          onWakeDetected: vi.fn(),
          onProcessInput,
          onError: vi.fn(),
        })
      );
      act(() => {
        result.current.start();
      });
      act(() => {
        mockRecognizer._emit(
          'onresult',
          resultsEvent([{ transcript: "here's the thing this is dumb", isFinal: true }])
        );
      });
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(onProcessInput).toHaveBeenCalledWith('this is dumb');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not re-append a final result re-emitted with the same index', () => {
    const onUserInput = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({
        wakePhrase: 'go',
        silenceTimeout: 3,
        onMeetingContext: vi.fn(),
        onUserInput,
        onWakeDetected: vi.fn(),
        onProcessInput: vi.fn(),
        onError: vi.fn(),
      })
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      mockRecognizer._emit('onresult', resultsEvent([{ transcript: 'go first part', isFinal: true }]));
    });
    act(() => {
      // Same index re-emitted (some engines do this after restart)
      mockRecognizer._emit('onresult', resultsEvent([{ transcript: 'go first part', isFinal: true }]));
    });
    // first call from wake-detection, no second append from the duplicate final
    const passedValues = onUserInput.mock.calls.map((c) => c[0]);
    expect(passedValues.filter((v) => v === 'first part').length).toBe(1);
  });
});
