import './ReframePanel.css';

export default function ReframePanel({ original, say, why, time }) {
  return (
    <div className="panel reframe-panel">
      <div className="panel-header">
        <span>&#10022; Say This Instead</span>
        <span className="reframe-time">{time}</span>
      </div>
      <div className="panel-body">
        <div className="original-thought">&ldquo;{original}&rdquo;</div>
        <div className="reframe-say">{say}</div>
        {why && <div className="reframe-explanation">{why}</div>}
      </div>
    </div>
  );
}
