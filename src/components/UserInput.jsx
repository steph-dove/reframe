import './UserInput.css';

export default function UserInput({ text }) {
  if (!text) return null;

  return (
    <div className="panel user-input-panel">
      <div className="panel-header">
        <span>Your Real Thoughts</span>
      </div>
      <div className="panel-body">{text}</div>
    </div>
  );
}
