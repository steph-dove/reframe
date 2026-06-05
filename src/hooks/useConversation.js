import { useCallback, useEffect, useRef, useState } from 'react';
import { randomId } from '../utils/ids';

const MAX_MEETING_CONTEXT_ENTRIES = 50;

export function useConversation({ onToast } = {}) {
  const [meetingContext, setMeetingContext] = useState([]);
  const [history, setHistory] = useState([]);

  const meetingContextRef = useRef(meetingContext);
  const historyRef = useRef(history);

  useEffect(() => {
    meetingContextRef.current = meetingContext;
  }, [meetingContext]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const addMeetingContext = useCallback((text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMeetingContext((prev) =>
      [...prev, { id: randomId('mc'), text, time }].slice(-MAX_MEETING_CONTEXT_ENTRIES)
    );
  }, []);

  const appendEntry = useCallback((entry) => {
    setHistory((prev) => [...prev, entry]);
  }, []);

  const buildEntry = useCallback((fields) => ({ id: randomId('entry'), ...fields }), []);

  const getMeetingContextSnapshot = useCallback(() => meetingContextRef.current, []);

  return {
    meetingContext,
    history,
    addMeetingContext,
    appendEntry,
    buildEntry,
    getMeetingContextSnapshot,
  };
}
