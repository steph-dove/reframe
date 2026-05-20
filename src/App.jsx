import { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import MeetingContext from './components/MeetingContext';
import UserInput from './components/UserInput';
import ReframePanel from './components/ReframePanel';
import TextInputBar from './components/TextInputBar';
import BottomBar from './components/BottomBar';
import SettingsModal from './components/SettingsModal';
import HistoryModal from './components/HistoryModal';
import Toast from './components/Toast';
import { getSettings, saveSettings } from './utils/settings';
import { callLLM, parseReframe } from './services/llm';
import {
  generateConversationId,
  saveCurrentConversation,
  loadConversation as loadConversationData,
} from './utils/conversations';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

function generateEntryId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hydrateEntry(entry) {
  const withId = entry.id ? entry : { ...entry, id: generateEntryId() };
  if (withId.say !== undefined || withId.why !== undefined) return withId;
  const parsed = parseReframe(withId.reframed || '');
  return { ...withId, say: parsed.say, why: parsed.why };
}

export default function App() {
  const [status, setStatus] = useState({ type: '', text: 'Ready — tap mic to begin' });
  const [meetingContext, setMeetingContext] = useState([]);
  const [userInputText, setUserInputText] = useState('');
  const [history, setHistory] = useState([]);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [textInputActive, setTextInputActive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [loadedConversation, setLoadedConversation] = useState(false);
  const [settings, setSettings] = useState(getSettings);

  const activeConvIdRef = useRef(generateConversationId());
  const meetingContextRef = useRef(meetingContext);
  const historyRef = useRef(history);
  const requestControllerRef = useRef(null);

  useEffect(() => {
    meetingContextRef.current = meetingContext;
  }, [meetingContext]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const showToast = useCallback((msg) => setToast(msg), []);
  const handleToastDone = useCallback(() => setToast(''), []);

  const abortInFlight = useCallback(() => {
    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
      requestControllerRef.current = null;
    }
  }, []);

  const doReframe = useCallback(
    async (userThought) => {
      setProcessing(true);
      setStatus({ type: 'processing', text: 'Reframing your thoughts...' });
      setUserInputText('');

      const contextText = meetingContextRef.current
        .slice(-20)
        .map((c) => c.text)
        .join(' ');

      abortInFlight();
      const controller = new AbortController();
      requestControllerRef.current = controller;

      try {
        const { say, why, raw } = await callLLM(userThought, contextText, settings, {
          signal: controller.signal,
        });
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const entry = {
          id: generateEntryId(),
          original: userThought,
          say,
          why,
          reframed: raw,
          time,
        };
        const next = [...historyRef.current, entry];
        setHistory(next);
        const saved = saveCurrentConversation(
          activeConvIdRef.current,
          meetingContextRef.current,
          next
        );
        if (saved === false) {
          showToast('Could not save conversation — storage unavailable or full');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          showToast('Error: ' + err.message);
        }
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
        setProcessing(false);
        setStatus(
          listening
            ? { type: 'listening', text: 'Listening to meeting...' }
            : { type: '', text: 'Ready — tap mic to begin' }
        );
      }
    },
    [listening, showToast, settings, abortInFlight]
  );

  const handleMeetingContext = useCallback((text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMeetingContext((prev) => [...prev, { text, time }].slice(-50));
  }, []);

  const handleWakeDetected = useCallback(() => {
    setUserInputText('');
    setStatus({ type: 'listening', text: 'Listening to you...' });
    if (navigator.vibrate) navigator.vibrate(100);
  }, []);

  const handleUserInput = useCallback((text) => {
    setUserInputText(text);
  }, []);

  const handleProcessInput = useCallback(
    (text) => {
      doReframe(text);
    },
    [doReframe]
  );

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
    onMeetingContext: handleMeetingContext,
    onUserInput: handleUserInput,
    onWakeDetected: handleWakeDetected,
    onProcessInput: handleProcessInput,
    onError: handleSpeechError,
  });

  useEffect(() => {
    return () => {
      abortInFlight();
    };
  }, [abortInFlight]);

  const toggleListening = useCallback(() => {
    if (!settings.apiKey && settings.provider !== 'ollama') {
      setSettingsOpen(true);
      showToast('Add your API key to get started');
      return;
    }

    if (listening) {
      stopRecognition();
      setListening(false);
      setStatus({ type: '', text: 'Paused' });
    } else {
      const started = startRecognition();
      if (started) {
        setListening(true);
        setStatus({ type: 'listening', text: 'Listening to meeting...' });
      }
    }
  }, [listening, startRecognition, stopRecognition, showToast, settings]);

  const handleTextSubmit = useCallback(
    (text) => {
      if (!settings.apiKey && settings.provider !== 'ollama') {
        setSettingsOpen(true);
        showToast('Add your API key to get started');
        return;
      }
      setTextInputActive(false);
      setUserInputText(text);
      doReframe(text);
    },
    [doReframe, showToast, settings]
  );

  const handleNewConversation = useCallback(() => {
    abortInFlight();
    saveCurrentConversation(activeConvIdRef.current, meetingContextRef.current, historyRef.current);

    activeConvIdRef.current = generateConversationId();
    setMeetingContext([]);
    setHistory([]);
    setUserInputText('');
    setLoadedConversation(false);
    showToast('New conversation');
  }, [showToast, abortInFlight]);

  const handleLoadConversation = useCallback(
    (id) => {
      abortInFlight();
      saveCurrentConversation(
        activeConvIdRef.current,
        meetingContextRef.current,
        historyRef.current
      );

      const conv = loadConversationData(id);
      if (!conv) return;

      activeConvIdRef.current = conv.id;
      setMeetingContext(conv.meetingContext || []);
      setHistory((conv.history || []).map(hydrateEntry));
      setUserInputText('');
      setLoadedConversation(true);
      setHistoryOpen(false);
    },
    [abortInFlight]
  );

  const handleSettingsSave = useCallback((next) => {
    saveSettings(next);
    setSettings(next);
  }, []);

  return (
    <div className="app">
      <Header
        onShowHistory={() => setHistoryOpen(true)}
        onNewConversation={handleNewConversation}
        onShowSettings={() => setSettingsOpen(true)}
      />
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
            animate={!loadedConversation}
          />
        ))}
      </div>

      <TextInputBar isActive={textInputActive} onSubmit={handleTextSubmit} />
      <BottomBar
        listening={listening}
        textInputActive={textInputActive}
        onToggleListening={toggleListening}
        onToggleTextInput={() => setTextInputActive((a) => !a)}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onToast={showToast}
        settings={settings}
        onSave={handleSettingsSave}
      />
      <HistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoadConversation={handleLoadConversation}
        activeConversationId={activeConvIdRef.current}
        onToast={showToast}
      />
      <Toast message={toast} onDone={handleToastDone} />
    </div>
  );
}
