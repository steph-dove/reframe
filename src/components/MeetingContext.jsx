import { useEffect, useRef } from 'react';
import './MeetingContext.css';

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
          : meetingContext.map((c) => (
              <div key={c.id}>
                <span className="meeting-context-time">{c.time}</span> {c.text}
              </div>
            ))}
      </div>
    </div>
  );
}
