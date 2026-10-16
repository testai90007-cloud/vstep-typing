'use client';

// Speaking Part 3 mind-map diagram, styled after the reference image:
// topic title on top, central node + 4 satellite nodes (top/left/right/bottom,
// the 4th being "[your own ideas]") connected by thin lines, then numbered
// follow-up questions with blue circle numbers.

export default function SpeakingMindmap({
  topic,
  points,
  followUps,
}: {
  topic: string;
  points: string[];
  followUps: string[];
}) {
  // Diagram shows the first 3 content points + "[your own ideas]" on the right,
  // like the reference image. Any extra points render as a list below — never
  // silently dropped (the AI prompt already sees ALL points, so the UI must too).
  const diagramPts = points.slice(0, 3);
  const extraPts = points.slice(3);
  const [top, left, bottom] = [diagramPts[0], diagramPts[1], diagramPts[2]];
  const right = '[your own ideas]';

  return (
    <div className="mm-wrap">
      <p className="mm-topic">{topic}</p>
      <div className="mm-diagram" role="img" aria-label={`Mind map: ${topic}`}>
        <svg className="mm-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="50" y1="50" x2="50" y2="13" />
          <line x1="50" y1="50" x2="17" y2="50" />
          <line x1="50" y1="50" x2="83" y2="50" />
          <line x1="50" y1="50" x2="50" y2="87" />
        </svg>
        <div className="mm-node mm-c">{topic}</div>
        <div className="mm-node mm-t">{top}</div>
        <div className="mm-node mm-l">{left}</div>
        <div className="mm-node mm-r">{right}</div>
        <div className="mm-node mm-b">{bottom}</div>
      </div>
      {extraPts.length > 0 && (
        <>
          <p className="mm-fu-head">Điểm bổ sung:</p>
          <ul className="mm-fu">
            {extraPts.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}
      <p className="mm-fu-head">Follow-up Questions:</p>
      <ol className="mm-fu">
        {followUps.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
    </div>
  );
}
