import { useRef, useCallback, useEffect } from 'react';

// "Failure" here counts only `network`/`aborted`/unknown `onerror` events.
// Benign cases like `no-speech` and the terminal `not-allowed`/`audio-capture`
// errors do not contribute to this count.
const MAX_CONSECUTIVE_FAILURES = 5;
const BACKOFF_BASE_MS = 250;
const BACKOFF_MAX_MS = 4000;
const RESTART_FLOOR_MS = 50;
const MAX_SILENT_RESTARTS = 8;

function isAlreadyStartedError(err) {
  const msg = err && err.message ? err.message : String(err || '');
  return /already started|already running/i.test(msg) || (err && err.name === 'InvalidStateError');
}

export function useSpeechRecognition({
  wakePhrase,
  silenceTimeout,
  onMeetingContext,
  onUserInput,
  onWakeDetected,
  onProcessInput,
  onError,
}) {
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const wakeDetectedRef = useRef(false);
  const userInputRef = useRef('');
  const silenceTimerRef = useRef(null);
  const consecutiveFailuresRef = useRef(0);
  const restartTimerRef = useRef(null);
  const silentRestartsRef = useRef(0);
  const lastProcessedFinalIndexRef = useRef(-1);

  const onMeetingContextRef = useRef(onMeetingContext);
  const onUserInputRef = useRef(onUserInput);
  const onWakeDetectedRef = useRef(onWakeDetected);
  const onProcessInputRef = useRef(onProcessInput);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onMeetingContextRef.current = onMeetingContext;
    onUserInputRef.current = onUserInput;
    onWakeDetectedRef.current = onWakeDetected;
    onProcessInputRef.current = onProcessInput;
    onErrorRef.current = onError;
  }, [onMeetingContext, onUserInput, onWakeDetected, onProcessInput, onError]);

  // Clears per-utterance state so a force-stop (error, give-up) can't leave a
  // pending silence timer or stale wake/input text behind for the next session.
  const clearUtteranceState = useCallback(() => {
    wakeDetectedRef.current = false;
    userInputRef.current = '';
    clearTimeout(silenceTimerRef.current);
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (wakeDetectedRef.current && userInputRef.current.trim()) {
        const input = userInputRef.current.trim();
        wakeDetectedRef.current = false;
        userInputRef.current = '';
        onProcessInputRef.current(input);
      } else if (wakeDetectedRef.current) {
        wakeDetectedRef.current = false;
      }
    }, silenceTimeout * 1000);
  }, [silenceTimeout]);

  const handleResult = useCallback(
    (event) => {
      consecutiveFailuresRef.current = 0;
      silentRestartsRef.current = 0;
      const lowerWake = wakePhrase.toLowerCase();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        const isFinal = event.results[i].isFinal;
        const lower = transcript.toLowerCase();

        if (isFinal) {
          if (i <= lastProcessedFinalIndexRef.current) continue;
          lastProcessedFinalIndexRef.current = i;
        }

        if (!wakeDetectedRef.current) {
          const wakeIndex = lower.indexOf(lowerWake);
          if (wakeIndex !== -1) {
            wakeDetectedRef.current = true;
            userInputRef.current = '';
            onWakeDetectedRef.current();

            const afterWake = transcript.substring(wakeIndex + lowerWake.length).trim();
            if (afterWake) {
              userInputRef.current = afterWake;
              onUserInputRef.current(afterWake);
            }
            resetSilenceTimer();
          } else if (isFinal && transcript.length > 0) {
            onMeetingContextRef.current(transcript);
          }
        } else {
          if (transcript.length > 0) {
            const wakeIndex = lower.indexOf(lowerWake);
            const relevantTranscript =
              wakeIndex !== -1
                ? transcript.substring(wakeIndex + lowerWake.length).trim()
                : transcript;

            if (relevantTranscript.length > 0) {
              if (isFinal) {
                userInputRef.current += (userInputRef.current ? ' ' : '') + relevantTranscript;
              }
              onUserInputRef.current(
                userInputRef.current + (isFinal ? '' : ' ' + relevantTranscript)
              );
              resetSilenceTimer();
            }
          }
        }
      }
    },
    [wakePhrase, resetSilenceTimer]
  );

  const handleError = useCallback(
    (event) => {
      console.error('Speech error:', event.error);
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          onErrorRef.current('Microphone access denied');
          listeningRef.current = false;
          clearUtteranceState();
          consecutiveFailuresRef.current = 0;
          return;
        case 'audio-capture':
          onErrorRef.current('No microphone detected or it is in use by another app');
          listeningRef.current = false;
          clearUtteranceState();
          consecutiveFailuresRef.current = 0;
          return;
        case 'network':
        case 'aborted':
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            onErrorRef.current(
              event.error === 'network'
                ? 'Network error — speech recognition stopped'
                : 'Speech recognition keeps aborting — stopped'
            );
            listeningRef.current = false;
            clearUtteranceState();
            consecutiveFailuresRef.current = 0;
          }
          return;
        case 'no-speech':
          // benign; onend will restart
          return;
        default:
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            onErrorRef.current(`Speech recognition error: ${event.error}`);
            listeningRef.current = false;
            clearUtteranceState();
            consecutiveFailuresRef.current = 0;
          }
      }
    },
    [clearUtteranceState]
  );

  const handleEnd = useCallback(() => {
    if (!listeningRef.current) return;
    silentRestartsRef.current += 1;
    if (silentRestartsRef.current > MAX_SILENT_RESTARTS) {
      onErrorRef.current('Microphone is quiet — speech recognition stopped');
      listeningRef.current = false;
      clearUtteranceState();
      silentRestartsRef.current = 0;
      return;
    }
    // A restarted session numbers its results from 0 again, so the dedupe
    // index must not survive across sessions.
    lastProcessedFinalIndexRef.current = -1;
    const failures = consecutiveFailuresRef.current;
    const rawDelay =
      failures === 0 ? 0 : Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
    const delay = Math.max(RESTART_FLOOR_MS, rawDelay);
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      if (!listeningRef.current) return;
      try {
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (err) {
        if (isAlreadyStartedError(err)) return;
        console.error('Speech start error:', err);
        consecutiveFailuresRef.current += 1;
        listeningRef.current = false;
        clearUtteranceState();
        onErrorRef.current(`Speech recognition stopped: ${err.message || err}`);
      }
    }, delay);
  }, [clearUtteranceState]);

  const stopInternal = useCallback(() => {
    listeningRef.current = false;
    wakeDetectedRef.current = false;
    userInputRef.current = '';
    clearTimeout(silenceTimerRef.current);
    clearTimeout(restartTimerRef.current);
    consecutiveFailuresRef.current = 0;
    silentRestartsRef.current = 0;
    lastProcessedFinalIndexRef.current = -1;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore: stop on already-stopped recognition
      }
    }
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError('Speech recognition not supported in this browser');
      return false;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
    }

    const recognition = recognitionRef.current;
    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;

    listeningRef.current = true;
    clearUtteranceState();
    consecutiveFailuresRef.current = 0;
    silentRestartsRef.current = 0;
    lastProcessedFinalIndexRef.current = -1;
    try {
      recognition.start();
    } catch (err) {
      if (!isAlreadyStartedError(err)) {
        onError(`Could not start speech recognition: ${err.message || err}`);
        listeningRef.current = false;
        return false;
      }
    }
    return true;
  }, [handleResult, handleError, handleEnd, onError, clearUtteranceState]);

  const stop = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = handleResult;
      recognitionRef.current.onerror = handleError;
      recognitionRef.current.onend = handleEnd;
    }
  }, [handleResult, handleError, handleEnd]);

  useEffect(() => {
    return () => {
      stopInternal();
    };
  }, [stopInternal]);

  return { start, stop };
}
