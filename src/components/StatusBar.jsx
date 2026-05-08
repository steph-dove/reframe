import './StatusBar.css';

export default function StatusBar({ type, text }) {
  return (
    <div className="status-bar">
      <div className={`status-dot ${type}`} />
      <span>{text}</span>
    </div>
  );
}
