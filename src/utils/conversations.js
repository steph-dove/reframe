const STORAGE_KEY = 'reframe_conversations';
const MAX_CONVERSATIONS = 100;

function getData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('Failed to write to localStorage:', err);
    return false;
  }
}

export function getConversations() {
  const data = getData();
  return data.conversations || [];
}

export function generateConversationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `conv_${crypto.randomUUID()}`;
  }
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateTitle(history) {
  if (!history || history.length === 0) return 'New Conversation';
  const first = history[0].original || '';
  return first.length > 50 ? first.substring(0, 50) + '...' : first;
}

export function saveCurrentConversation(activeId, meetingContext, history) {
  if (!activeId) return true;
  if (meetingContext.length === 0 && history.length === 0) return true;

  const data = getData();
  const conversations = data.conversations || [];
  const idx = conversations.findIndex((c) => c.id === activeId);
  const now = new Date().toISOString();

  const record = {
    id: activeId,
    title: generateTitle(history),
    createdAt: idx >= 0 ? conversations[idx].createdAt : now,
    updatedAt: now,
    meetingContext: [...meetingContext],
    history: [...history],
  };

  if (idx >= 0) {
    conversations[idx] = record;
  } else {
    conversations.push(record);
  }

  // Evict oldest by updatedAt if over cap
  if (conversations.length > MAX_CONVERSATIONS) {
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    conversations.length = MAX_CONVERSATIONS;
  }

  return setData({ conversations });
}

export function loadConversation(id) {
  const conversations = getConversations();
  return conversations.find((c) => c.id === id) || null;
}

export function deleteConversation(id) {
  const data = getData();
  const conversations = (data.conversations || []).filter((c) => c.id !== id);
  return setData({ conversations });
}

export function clearAllConversations() {
  return setData({ conversations: [] });
}

export function formatRelativeDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - dateDay) / (1000 * 60 * 60 * 24));

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
