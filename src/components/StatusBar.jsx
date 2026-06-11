import './StatusBar.css';

export default function StatusBar({ type, text, tokenUsage }) {
  const totalTokens = tokenUsage ? tokenUsage.inputTokens + tokenUsage.outputTokens : 0;

  return (
    <div className="status-bar">
      <div className={`status-dot ${type}`} />
      <span>{text}</span>
      {totalTokens > 0 && (
        <span
          className="token-usage"
          title={`${tokenUsage.inputTokens.toLocaleString()} in / ${tokenUsage.outputTokens.toLocaleString()} out`}
        >
          {totalTokens.toLocaleString()} tokens
        </span>
      )}
    </div>
  );
}
