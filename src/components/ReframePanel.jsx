import './ReframePanel.css';

export default function ReframePanel({ original, say, why, time, animate = true }) {
  return (
    <div className={`panel reframe-panel ${animate ? '' : 'no-animate'}`}>
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
