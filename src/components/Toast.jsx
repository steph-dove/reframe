import { useEffect, useRef } from 'react';
import './Toast.css';

const TOAST_DURATION_MS = 4000;

export default function Toast({ message, onDone }) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onDoneRef.current(), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return <div className="toast">{message}</div>;
}
