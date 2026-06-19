import { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import MeetingContext from './components/MeetingContext';
import UserInput from './components/UserInput';
import ReframePanel from './components/ReframePanel';
import BottomBar from './components/BottomBar';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import { getSettings, saveSettings } from './utils/settings';
import { randomId } from './utils/ids';
import { callLLM } from './services/llm';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useConversation } from './hooks/useConversation';

const READY_STATUS = { type: '', text: 'Ready — tap mic to begin' };
const LISTENING_STATUS = { type: 'listening', text: 'Listening to meeting...' };
// Recent utterances included in the LLM prompt — smaller than the hook's
// 50-entry context cap to keep the prompt's token budget bounded.
const MEETING_CONTEXT_PROMPT_WINDOW = 20;

export default function App() {
  const [status, setStatus] = useState(READY_STATUS);
  const [userInputText, setUserInputText] = useState('');
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(getSettings);

  const showToast = useCallback((msg) => {
    setToast({ id: randomId('toast'), message: msg });
  }, []);
  const handleToastDone = useCallback(() => setToast(null), []);

  const { meetingContext, history, addMeetingContext, addEntry, getRecentContextText } =
    useConversation();

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const requestControllerRef = useRef(null);
  const listeningRef = useRef(listening);
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  const abortInFlight = useCallback(() => {
    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
      requestControllerRef.current = null;
    }
  }, []);

  const ensureConfigured = useCallback(() => {
    const s = settingsRef.current;
    if (!s.apiKey && s.provider !== 'ollama') {
      setSettingsOpen(true);
      showToast('Add your API key to get started');
      return false;
    }
    return true;
  }, [showToast]);

  const doReframe = useCallback(
    async (userThought) => {
      setProcessing(true);
      setStatus({ type: 'processing', text: 'Reframing your thoughts...' });
      setUserInputText('');

      const contextText = getRecentContextText(MEETING_CONTEXT_PROMPT_WINDOW);

      abortInFlight();
      const controller = new AbortController();
      requestControllerRef.current = controller;

      try {
        const { say, why } = await callLLM(userThought, contextText, settingsRef.current, {
          signal: controller.signal,
        });
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        addEntry({ original: userThought, say, why, time });
      } catch (err) {
        if (err.name !== 'AbortError') {
          showToast(err.message || 'Reframe failed');
        }
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
          setProcessing(false);
          // Only replace the processing status; a status set by another actor
          // mid-request (e.g. a speech error) must survive the reframe settling.
          setStatus((prev) =>
            prev.type === 'processing'
              ? listeningRef.current
                ? LISTENING_STATUS
                : READY_STATUS
              : prev
          );
        }
      }
    },
    [abortInFlight, addEntry, getRecentContextText, showToast]
  );

  const handleWakeDetected = useCallback(() => {
    setUserInputText('');
    setStatus({ type: 'listening', text: 'Listening to you...' });
    if (navigator.vibrate) navigator.vibrate(100);
  }, []);

  const handleUserInput = useCallback((text) => {
    setUserInputText(text);
  }, []);

  const handleSpeechError = useCallback(
    (msg) => {
      showToast(msg);
      setListening(false);
      setStatus({ type: 'error', text: msg });
    },
    [showToast]
  );

  const { start: startRecognition, stop: stopRecognition } = useSpeechRecognition({
    wakePhrase: settings.wakePhrase,
    silenceTimeout: settings.silenceTimeout,
    onMeetingContext: addMeetingContext,
    onUserInput: handleUserInput,
    onWakeDetected: handleWakeDetected,
    onProcessInput: doReframe,
    onError: handleSpeechError,
  });

  useEffect(() => {
    return () => {
      abortInFlight();
    };
  }, [abortInFlight]);

  const toggleListening = useCallback(() => {
    if (!ensureConfigured()) return;

    if (listening) {
      stopRecognition();
      setListening(false);
      setStatus({ type: '', text: 'Paused' });
    } else {
      const started = startRecognition();
      if (started) {
        setListening(true);
        setStatus(LISTENING_STATUS);
      }
    }
  }, [listening, startRecognition, stopRecognition, ensureConfigured]);

  const handleSettingsSave = useCallback((next) => {
    const ok = saveSettings(next);
    if (ok === false) return false;
    setSettings(next);
    return true;
  }, []);

  return (
    <div className="app">
      <Header onShowSettings={() => setSettingsOpen(true)} />
      <StatusBar type={status.type} text={status.text} />

      <div className="main">
        <MeetingContext meetingContext={meetingContext} />

        {userInputText && !processing && <UserInput text={userInputText} />}

        {processing && (
          <div className="panel">
            <div className="panel-header">
              <span>Reframing</span>
            </div>
            <div className="panel-body">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        {history.map((entry) => (
          <ReframePanel
            key={entry.id}
            original={entry.original}
            say={entry.say}
            why={entry.why}
            time={entry.time}
          />
        ))}
      </div>

      <BottomBar listening={listening} onToggleListening={toggleListening} />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onToast={showToast}
        settings={settings}
        onSave={handleSettingsSave}
      />
      <Toast toast={toast} onDone={handleToastDone} />
    </div>
  );
}
