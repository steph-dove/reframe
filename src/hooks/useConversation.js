import { useCallback, useEffect, useRef, useState } from 'react';
import { randomId } from '../utils/ids';

const MAX_MEETING_CONTEXT_ENTRIES = 50;
// The app may listen for hours; cap rendered history like meeting context so
// DOM size doesn't grow without bound.
const MAX_HISTORY_ENTRIES = 50;

export function useConversation() {
  const [meetingContext, setMeetingContext] = useState([]);
  const [history, setHistory] = useState([]);

  const meetingContextRef = useRef(meetingContext);

  useEffect(() => {
    meetingContextRef.current = meetingContext;
  }, [meetingContext]);

  const addMeetingContext = useCallback((text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMeetingContext((prev) =>
      [...prev, { id: randomId('mc'), text, time }].slice(-MAX_MEETING_CONTEXT_ENTRIES)
    );
  }, []);

  const addEntry = useCallback((fields) => {
    setHistory((prev) =>
      [...prev, { id: randomId('entry'), ...fields }].slice(-MAX_HISTORY_ENTRIES)
    );
  }, []);

  const getRecentContextText = useCallback(
    (limit) =>
      meetingContextRef.current
        .slice(-limit)
        .map((c) => c.text)
        .join(' '),
    []
  );

  return {
    meetingContext,
    history,
    addMeetingContext,
    addEntry,
    getRecentContextText,
  };
}
