import { useState, useCallback, useRef } from 'react';
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
import { getSettings } from './utils/settings';
import { callLLM } from './services/llm';
import {
  generateConversationId,
  saveCurrentConversation,
  loadConversation as loadConversationData,
} from './utils/conversations';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

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
  const [tokenUsage, setTokenUsage] = useState({ inputTokens: 0, outputTokens: 0 });

  const activeConvIdRef = useRef(generateConversationId());
  const meetingContextRef = useRef(meetingContext);
  const historyRef = useRef(history);

  // Keep refs in sync for use in callbacks
  meetingContextRef.current = meetingContext;
  historyRef.current = history;

  const showToast = useCallback((msg) => setToast(msg), []);

  const doReframe = useCallback(
    async (userThought) => {
      setProcessing(true);
      setStatus({ type: 'processing', text: 'Reframing your thoughts...' });
      setUserInputText('');

      const contextText = meetingContextRef.current
        .slice(-20)
        .map((c) => c.text)
        .join(' ');
      const settings = getSettings();

      try {
        const { text: reframed, usage } = await callLLM(userThought, contextText, settings);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const entry = { original: userThought, reframed, time };

        setTokenUsage((prev) => ({
          inputTokens: prev.inputTokens + usage.inputTokens,
          outputTokens: prev.outputTokens + usage.outputTokens,
        }));

        setHistory((prev) => {
          const next = [...prev, entry];
          // Auto-save after adding the entry
          saveCurrentConversation(activeConvIdRef.current, meetingContextRef.current, next);
          return next;
        });
      } catch (err) {
        showToast('Error: ' + err.message);
      }

      setProcessing(false);
      setStatus(
        listening
          ? { type: 'listening', text: 'Listening to meeting...' }
          : { type: '', text: 'Ready — tap mic to begin' }
      );
    },
    [listening, showToast]
  );

  const handleMeetingContext = useCallback((text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMeetingContext((prev) => {
      const next = [...prev, { text, time }].slice(-50);
      return next;
    });
  }, []);

  const handleWakeDetected = useCallback(() => {
    setUserInputText('');
    setStatus({ type: 'listening', text: 'Listening to you...' });
    // Haptic feedback if available
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

  const settings = getSettings();
  const { start: startRecognition, stop: stopRecognition } = useSpeechRecognition({
    wakePhrase: settings.wakePhrase,
    silenceTimeout: settings.silenceTimeout,
    onMeetingContext: handleMeetingContext,
    onUserInput: handleUserInput,
    onWakeDetected: handleWakeDetected,
    onProcessInput: handleProcessInput,
    onError: handleSpeechError,
  });

  const toggleListening = useCallback(() => {
    const settings = getSettings();
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
  }, [listening, startRecognition, stopRecognition, showToast]);

  const handleTextSubmit = useCallback(
    (text) => {
      const settings = getSettings();
      if (!settings.apiKey && settings.provider !== 'ollama') {
        setSettingsOpen(true);
        showToast('Add your API key to get started');
        return;
      }
      setTextInputActive(false);
      setUserInputText(text);
      doReframe(text);
    },
    [doReframe, showToast]
  );

  const handleNewConversation = useCallback(() => {
    // Save current if it has content
    saveCurrentConversation(activeConvIdRef.current, meetingContextRef.current, historyRef.current);

    // Reset state
    activeConvIdRef.current = generateConversationId();
    setMeetingContext([]);
    setHistory([]);
    setUserInputText('');
    setTokenUsage({ inputTokens: 0, outputTokens: 0 });
    setLoadedConversation(false);
    showToast('New conversation');
  }, [showToast]);

  const handleLoadConversation = useCallback((id) => {
    // Save current first
    saveCurrentConversation(activeConvIdRef.current, meetingContextRef.current, historyRef.current);

    const conv = loadConversationData(id);
    if (!conv) return;

    activeConvIdRef.current = conv.id;
    setMeetingContext(conv.meetingContext || []);
    setHistory(conv.history || []);
    setUserInputText('');
    setTokenUsage({ inputTokens: 0, outputTokens: 0 });
    setLoadedConversation(true);
    setHistoryOpen(false);
  }, []);

  return (
    <div className="app">
      <Header
        onShowHistory={() => setHistoryOpen(true)}
        onNewConversation={handleNewConversation}
        onShowSettings={() => setSettingsOpen(true)}
      />
      <StatusBar type={status.type} text={status.text} tokenUsage={tokenUsage} />

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

        {history.map((entry, i) => (
          <ReframePanel
            key={i}
            original={entry.original}
            reframed={entry.reframed}
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
      />
      <HistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoadConversation={handleLoadConversation}
        activeConversationId={activeConvIdRef.current}
        onToast={showToast}
      />
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  );
}
