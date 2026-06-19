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

  it('does not re-append a final result re-emitted with the same index within a session', () => {
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
      mockRecognizer._emit(
        'onresult',
        resultsEvent([{ transcript: 'go first part', isFinal: true }])
      );
    });
    act(() => {
      // Same index re-emitted (some engines do this after restart)
      mockRecognizer._emit(
        'onresult',
        resultsEvent([{ transcript: 'go first part', isFinal: true }])
      );
    });
    // first call from wake-detection, no second append from the duplicate final
    const passedValues = onUserInput.mock.calls.map((c) => c[0]);
    expect(passedValues.filter((v) => v === 'first part').length).toBe(1);
  });

  function setup(overrides = {}) {
    const callbacks = {
      wakePhrase: 'zzz-no-wake',
      silenceTimeout: 3,
      onMeetingContext: vi.fn(),
      onUserInput: vi.fn(),
      onWakeDetected: vi.fn(),
      onProcessInput: vi.fn(),
      onError: vi.fn(),
      ...overrides,
    };
    const { result } = renderHook(() => useSpeechRecognition(callbacks));
    return { result, callbacks };
  }

  it('processes a fresh final at index 0 after an auto-restart', () => {
    vi.useFakeTimers();
    try {
      const { result, callbacks } = setup();
      act(() => {
        result.current.start();
      });
      act(() => {
        mockRecognizer._emit(
          'onresult',
          resultsEvent([{ transcript: 'first chunk', isFinal: true }])
        );
      });
      // Session ends and auto-restarts; the new session re-emits a final at index 0.
      act(() => {
        mockRecognizer._emit('onend');
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        mockRecognizer._emit(
          'onresult',
          resultsEvent([{ transcript: 'second chunk', isFinal: true }])
        );
      });
      expect(callbacks.onMeetingContext).toHaveBeenCalledWith('first chunk');
      expect(callbacks.onMeetingContext).toHaveBeenCalledWith('second chunk');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a denied microphone and stops without counting it as a failure', () => {
    const { result, callbacks } = setup();
    act(() => {
      result.current.start();
    });
    act(() => {
      mockRecognizer._emit('onerror', { error: 'not-allowed' });
    });
    expect(callbacks.onError).toHaveBeenCalledWith('Microphone access denied');
  });

  it('reports a missing microphone for audio-capture errors', () => {
    const { result, callbacks } = setup();
    act(() => {
      result.current.start();
    });
    act(() => {
      mockRecognizer._emit('onerror', { error: 'audio-capture' });
    });
    expect(callbacks.onError).toHaveBeenCalledWith(
      'No microphone detected or it is in use by another app'
    );
  });

  it('ignores benign no-speech errors', () => {
    const { result, callbacks } = setup();
    act(() => {
      result.current.start();
    });
    act(() => {
      mockRecognizer._emit('onerror', { error: 'no-speech' });
    });
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('gives up only after repeated network errors hit the cap', () => {
    const { result, callbacks } = setup();
    act(() => {
      result.current.start();
    });
    for (let i = 0; i < 4; i++) {
      act(() => {
        mockRecognizer._emit('onerror', { error: 'network' });
      });
    }
    expect(callbacks.onError).not.toHaveBeenCalled();
    act(() => {
      mockRecognizer._emit('onerror', { error: 'network' });
    });
    expect(callbacks.onError).toHaveBeenCalledWith('Network error — speech recognition stopped');
  });

  it('stops after a tight burst of restarts', () => {
    vi.useFakeTimers();
    try {
      const { result, callbacks } = setup();
      act(() => {
        result.current.start();
      });
      // Rapid restarts with no time advancing simulate a spin loop.
      for (let i = 0; i < 9; i++) {
        act(() => {
          mockRecognizer._emit('onend');
        });
      }
      expect(callbacks.onError).toHaveBeenCalledWith(
        'Speech recognition keeps restarting — stopped'
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps restarting through a long quiet stretch without giving up', () => {
    vi.useFakeTimers();
    try {
      const { result, callbacks } = setup();
      act(() => {
        result.current.start();
      });
      // Sessions end seconds apart (a quiet room), so the streak never trips.
      for (let i = 0; i < 15; i++) {
        act(() => {
          mockRecognizer._emit('onend');
        });
        act(() => {
          vi.advanceTimersByTime(2500);
        });
      }
      expect(callbacks.onError).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
