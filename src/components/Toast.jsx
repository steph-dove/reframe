import { useEffect } from 'react';
import './Toast.css';

export default function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onDone(), 3000);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  if (!message) return null;

  return <div className="toast">{message}</div>;
}
