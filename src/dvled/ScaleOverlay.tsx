// A 2D scale reference drawn over the dvLED preview: a to-scale human figure
// standing at the foot of the wall, plus an auto-ranged scale bar. Both use the
// same inches→pixels mapping the shader does, so they read true at any distance.

export interface ScaleOverlayProps {
  cssW: number;
  cssH: number;
  /** Physical width of wall visible across the frame (in). */
  viewSpanWidthIn: number;
  /** Wall width ÷ visible span — vertical position of the wall in the frame. */
  wallFillFraction: number;
  /** Standing/seated height of the reference body (in). */
  statureIn: number;
  /** Eye height of that body (in) — drawn as a sight line. */
  eyeHeightIn: number;
  figureLabel: string;
  seated: boolean;
  metric: boolean;
}

/** Pick a round bar length (≈30% of the span) in the active unit system. */
function niceBar(spanIn: number, metric: boolean): { lenIn: number; label: string } {
  if (metric) {
    const spanM = spanIn / 39.3701;
    const target = spanM * 0.3;
    const cands = [0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 20, 50];
    const m = [...cands].reverse().find((c) => c <= target) ?? cands[0];
    return { lenIn: m * 39.3701, label: m >= 1 ? `${m} m` : `${m * 100} cm` };
  }
  const spanFt = spanIn / 12;
  const target = spanFt * 0.3;
  const cands = [1, 2, 3, 5, 10, 20, 30, 50, 100];
  const ft = [...cands].reverse().find((c) => c <= target) ?? cands[0];
  return { lenIn: ft * 12, label: `${ft} ft` };
}

export function ScaleOverlay(props: ScaleOverlayProps) {
  const { cssW, cssH, viewSpanWidthIn, wallFillFraction, statureIn } = props;
  if (cssW <= 0 || viewSpanWidthIn <= 0) return null;

  const pxPerIn = cssW / viewSpanWidthIn;

  // Wall bottom on the canvas (the wall is centred; it may overflow when zoomed
  // in). Stand the figure on it, clamped into the frame.
  const wallBottomY = (cssH * (1 + wallFillFraction)) / 2;
  const footY = Math.min(cssH, wallBottomY);
  const wallLeftX = (cssW * (1 - Math.min(1, wallFillFraction))) / 2;

  const h = statureIn * pxPerIn;
  const w = h * 0.27; // shoulder-ish width
  // Stand the figure in the surround, just left of the wall — never over it.
  // When zoomed in close enough that there's no surround to hold the figure,
  // we drop it (a person beside an off-frame wall edge says nothing about scale).
  const gap = 10;
  const cx = wallLeftX - gap - w / 2;
  const hasRoom = cx - w / 2 >= 2;
  const yAt = (f: number) => footY - f * h;

  // Proportions as a fraction of stature, measured up from the feet.
  const headR = h * 0.062;
  const hipF = props.seated ? 0.0 : 0.47;
  const shoulderF = props.seated ? 0.62 : 0.82;
  const headCY = yAt(props.seated ? 0.86 : 0.93);
  const eyeY = yAt(props.eyeHeightIn / statureIn);

  const legW = w * 0.34;
  const torso = `M ${cx - w / 2} ${yAt(shoulderF)}
    L ${cx + w / 2} ${yAt(shoulderF)}
    L ${cx + w * 0.36} ${yAt(hipF)}
    L ${cx - w * 0.36} ${yAt(hipF)} Z`;

  const bar = niceBar(viewSpanWidthIn, props.metric);
  const barPx = bar.lenIn * pxPerIn;
  const barY = cssH - 26;
  const barX1 = cssW - 24 - barPx;
  const barX2 = cssW - 24;

  const figFill = 'rgba(78,161,255,0.30)';
  const figStroke = 'rgba(225,238,255,0.75)';

  return (
    <svg className="dvled-overlay-svg" width={cssW} height={cssH} viewBox={`0 0 ${cssW} ${cssH}`}>
      {hasRoom && (
        <>
          <g style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))' }}>
            {/* legs */}
            {!props.seated && (
              <>
                <rect x={cx - legW - w * 0.02} y={yAt(hipF)} width={legW} height={hipF * h} rx={legW * 0.4} fill={figFill} stroke={figStroke} strokeWidth={1} />
                <rect x={cx + w * 0.02} y={yAt(hipF)} width={legW} height={hipF * h} rx={legW * 0.4} fill={figFill} stroke={figStroke} strokeWidth={1} />
              </>
            )}
            {props.seated && (
              /* simple seated base: thighs forward + chair line */
              <rect x={cx - w * 0.5} y={yAt(0.02)} width={w} height={h * 0.16} rx={6} fill={figFill} stroke={figStroke} strokeWidth={1} />
            )}
            {/* torso */}
            <path d={torso} fill={figFill} stroke={figStroke} strokeWidth={1} strokeLinejoin="round" />
            {/* head */}
            <circle cx={cx} cy={headCY} r={headR} fill={figFill} stroke={figStroke} strokeWidth={1} />
          </g>

          {/* eye sight line across the frame */}
          <line x1={0} y1={eyeY} x2={cssW} y2={eyeY} stroke="rgba(78,161,255,0.45)" strokeWidth={1} strokeDasharray="6 6" />
          <text x={cx + w * 0.7} y={eyeY - 5} className="dvled-overlay-label">eye line</text>

          {/* figure height label */}
          <text x={cx} y={yAt(1) - 8} textAnchor="middle" className="dvled-overlay-label">
            {props.figureLabel}
          </text>
        </>
      )}

      {/* scale bar */}
      <g>
        <line x1={barX1} y1={barY} x2={barX2} y2={barY} stroke="#fff" strokeWidth={2} />
        <line x1={barX1} y1={barY - 5} x2={barX1} y2={barY + 5} stroke="#fff" strokeWidth={2} />
        <line x1={barX2} y1={barY - 5} x2={barX2} y2={barY + 5} stroke="#fff" strokeWidth={2} />
        <text x={(barX1 + barX2) / 2} y={barY - 9} textAnchor="middle" className="dvled-overlay-label strong">
          {bar.label}
        </text>
      </g>
    </svg>
  );
}
