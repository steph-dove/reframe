import './ReframePanel.css';

export default function ReframePanel({ original, reframed, time, animate = true }) {
  let sayText = reframed;
  let whyText = '';

  const sayMatch = reframed.match(/SAY:\s*([\s\S]*?)(?=WHY:|$)/i);
  const whyMatch = reframed.match(/WHY:\s*([\s\S]*?)$/i);

  if (sayMatch) sayText = sayMatch[1].trim();
  if (whyMatch) whyText = whyMatch[1].trim();

  return (
    <div className={`panel reframe-panel ${animate ? '' : 'no-animate'}`}>
      <div className="panel-header">
        <span>&#10022; Say This Instead</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{time}</span>
      </div>
      <div className="panel-body">
        <div className="original-thought">&ldquo;{original}&rdquo;</div>
        {sayText}
        {whyText && <div className="reframe-explanation">{whyText}</div>}
      </div>
    </div>
  );
}
