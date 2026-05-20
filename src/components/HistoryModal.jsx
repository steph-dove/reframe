import { useEffect, useState, useCallback } from 'react';
import {
  getConversations,
  deleteConversation,
  clearAllConversations,
  formatRelativeDate,
} from '../utils/conversations';
import './HistoryModal.css';

export default function HistoryModal({
  isOpen,
  onClose,
  onLoadConversation,
  activeConversationId,
  onToast,
}) {
  const [conversations, setConversations] = useState([]);

  const refresh = useCallback(() => {
    const list = getConversations().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    setConversations(list);
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    const ok = deleteConversation(id);
    if (ok === false) {
      onToast('Could not delete — storage unavailable');
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    onToast('Conversation deleted');
  };

  const handleClearAll = () => {
    if (window.confirm('Delete all saved conversations?')) {
      clearAllConversations();
      setConversations([]);
      onToast('All conversations cleared');
    }
  };

  const handleLoad = (id) => {
    onLoadConversation(id);
    onClose();
  };

  const handleKeyDown = (id) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLoad(id);
    }
  };

  return (
    <div
      className={`modal-overlay ${isOpen ? 'active' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-handle" />
        <h2>Conversations</h2>

        {conversations.length === 0 ? (
          <div className="history-empty">No saved conversations yet</div>
        ) : (
          <>
            <div className="history-list">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`history-item ${conv.id === activeConversationId ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleLoad(conv.id)}
                  onKeyDown={handleKeyDown(conv.id)}
                >
                  <div className="history-item-info">
                    <div className="history-item-title">{conv.title}</div>
                    <div className="history-item-meta">
                      <span>{formatRelativeDate(conv.updatedAt)}</span>
                      <span>
                        {conv.history.length} reframe{conv.history.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    className="history-item-delete"
                    onClick={(e) => handleDelete(conv.id, e)}
                    aria-label="Delete conversation"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button className="clear-all-btn" onClick={handleClearAll}>
              Clear All
            </button>
          </>
        )}
      </div>
    </div>
  );
}
