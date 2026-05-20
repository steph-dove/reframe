import './ReframePanel.css';

export default function ReframePanel({ original, say, why, time, animate = true }) {
  return (
    <div className={`panel reframe-panel ${animate ? '' : 'no-animate'}`}>
      <div className="panel-header">
        <span>&#10022; Say This Instead</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{time}</span>
      </div>
      <div className="panel-body">
        <div className="original-thought">&ldquo;{original}&rdquo;</div>
        {say}
        {why && <div className="reframe-explanation">{why}</div>}
      </div>
    </div>
  );
}
