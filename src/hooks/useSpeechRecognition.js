import { useRef, useCallback, useEffect } from 'react';

const MAX_CONSECUTIVE_FAILURES = 5;
const BACKOFF_BASE_MS = 250;
const BACKOFF_MAX_MS = 4000;

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

  const resetSilenceTimer = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (wakeDetectedRef.current && userInputRef.current.trim()) {
        const input = userInputRef.current.trim();
        wakeDetectedRef.current = false;
        userInputRef.current = '';
        onProcessInput(input);
      } else if (wakeDetectedRef.current) {
        wakeDetectedRef.current = false;
      }
    }, silenceTimeout * 1000);
  }, [silenceTimeout, onProcessInput]);

  const handleResult = useCallback(
    (event) => {
      consecutiveFailuresRef.current = 0;
      const lowerWake = wakePhrase.toLowerCase();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        const isFinal = event.results[i].isFinal;
        const lower = transcript.toLowerCase();

        if (!wakeDetectedRef.current) {
          const wakeIndex = lower.indexOf(lowerWake);
          if (wakeIndex !== -1) {
            wakeDetectedRef.current = true;
            userInputRef.current = '';
            onWakeDetected();

            const afterWake = transcript.substring(wakeIndex + lowerWake.length).trim();
            if (afterWake) {
              userInputRef.current = afterWake;
              onUserInput(afterWake);
            }
            resetSilenceTimer();
          } else if (isFinal && transcript.length > 0) {
            onMeetingContext(transcript);
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
              onUserInput(userInputRef.current + (isFinal ? '' : ' ' + relevantTranscript));
              resetSilenceTimer();
            }
          }
        }
      }
    },
    [wakePhrase, onMeetingContext, onUserInput, onWakeDetected, resetSilenceTimer]
  );

  const stopInternal = useCallback(() => {
    listeningRef.current = false;
    wakeDetectedRef.current = false;
    userInputRef.current = '';
    clearTimeout(silenceTimerRef.current);
    clearTimeout(restartTimerRef.current);
    consecutiveFailuresRef.current = 0;
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
    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          onError('Microphone access denied');
          listeningRef.current = false;
          consecutiveFailuresRef.current = 0;
          return;
        case 'audio-capture':
          onError('No microphone detected or it is in use by another app');
          listeningRef.current = false;
          consecutiveFailuresRef.current = 0;
          return;
        case 'network':
        case 'aborted':
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            onError(
              event.error === 'network'
                ? 'Network error — speech recognition stopped'
                : 'Speech recognition keeps aborting — stopped'
            );
            listeningRef.current = false;
            consecutiveFailuresRef.current = 0;
          }
          return;
        case 'no-speech':
          // benign; onend will restart
          return;
        default:
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            onError(`Speech recognition error: ${event.error}`);
            listeningRef.current = false;
            consecutiveFailuresRef.current = 0;
          }
      }
    };
    recognition.onend = () => {
      if (!listeningRef.current) return;
      const failures = consecutiveFailuresRef.current;
      const delay =
        failures === 0 ? 0 : Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (!listeningRef.current) return;
        try {
          recognition.start();
        } catch (err) {
          if (!isAlreadyStartedError(err)) {
            console.error('Speech start error:', err);
          }
        }
      }, delay);
    };

    listeningRef.current = true;
    consecutiveFailuresRef.current = 0;
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
  }, [handleResult, onError]);

  const stop = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  useEffect(() => {
    if (listeningRef.current && recognitionRef.current) {
      recognitionRef.current.onresult = handleResult;
    }
  }, [handleResult]);

  useEffect(() => {
    return () => {
      stopInternal();
    };
  }, [stopInternal]);

  return { start, stop };
}
