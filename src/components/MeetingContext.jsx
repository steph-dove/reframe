import { useEffect, useRef } from 'react';

export default function MeetingContext({ meetingContext }) {
  const bodyRef = useRef(null);
  const isEmpty = meetingContext.length === 0;

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [meetingContext]);

  const wordCount = meetingContext.reduce((n, c) => n + c.text.split(/\s+/).length, 0);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Meeting Context</span>
        {!isEmpty && <span>{wordCount} words</span>}
      </div>
      <div className={`panel-body ${isEmpty ? 'empty' : ''}`} ref={bodyRef}>
        {isEmpty
          ? 'Listening for meeting audio...'
          : meetingContext.map((c, i) => (
              <div key={i}>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{c.time}</span>{' '}
                {c.text}
              </div>
            ))}
      </div>
    </div>
  );
}
