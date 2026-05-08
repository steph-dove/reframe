import { useRef, useCallback } from 'react';
import './TextInputBar.css';

export default function TextInputBar({ isActive, onSubmit }) {
  const textareaRef = useRef(null);

  const handleSubmit = useCallback(() => {
    const text = textareaRef.current?.value.trim();
    if (!text) return;
    onSubmit(text);
    textareaRef.current.value = '';
    textareaRef.current.style.height = 'auto';
  }, [onSubmit]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback((e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }, []);

  return (
    <div className={`text-input-bar ${isActive ? 'active' : ''}`}>
      <textarea
        ref={textareaRef}
        placeholder="Type your real thoughts..."
        rows="1"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
      <button className="send-btn" onClick={handleSubmit} aria-label="Send">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
