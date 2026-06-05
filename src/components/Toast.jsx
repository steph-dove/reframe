import { useEffect, useRef } from 'react';
import './Toast.css';

const TOAST_DURATION_MS = 4000;

export default function Toast({ toast, onDone }) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const toastId = toast ? toast.id : null;

  useEffect(() => {
    if (toastId === null) return;
    const timer = setTimeout(() => onDoneRef.current(), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastId]);

  if (!toast) return null;

  return <div className="toast">{toast.message}</div>;
}
