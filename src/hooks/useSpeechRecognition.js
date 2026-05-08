import { useRef, useCallback, useEffect } from 'react';

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
      if (event.error === 'not-allowed') {
        onError('Microphone access denied');
        listeningRef.current = false;
      }
    };
    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          // recognition.start() throws if already running; safe to ignore
        }
      }
    };

    listeningRef.current = true;
    try {
      recognition.start();
    } catch {
      // recognition.start() throws if already running; safe to ignore
    }
    return true;
  }, [handleResult, onError]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    wakeDetectedRef.current = false;
    userInputRef.current = '';
    clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop };
}
