import { useRef } from 'react';
import { PERSONAS } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { screenGeometry } from '../ergonomics/screenGeometry';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist, fmtLen } from '../ui/units';

const DARK = '#1d2733';
const ACCENT = '#2f6df0';
const EYE = '#c77d11';
const GREEN = '#19a05a';
const BODY = '#3f4a57';
const SKIN = '#d9b08c';

/**
 * 2D side elevation (the classic AV mounting drawing): wall on the left, floor
 * along the bottom, the screen edge-on at its mount height, and the viewer in
 * profile reaching toward it. All geometry is drawn in INCHES inside the SVG
 * viewBox; the engine + store drive every number, so it stays in sync with 3D.
 */
export function SideElevation() {
  const s = useConfigStore();
  const persona = PERSONAS[s.personaId];
  const size = sizeFromDiagonal(s.diagonal, s.aspectW, s.aspectH);
  const units = s.units;
  const svgRef = useRef<SVGSVGElement>(null);

  const distance = s.mode === 'touch' ? persona.touchDistance : s.viewingDistance;
  const mountBottom = s.mountBottom;
  const screenTop = mountBottom + size.height;
  const geom = screenGeometry({ mountBottom, height: size.height, tiltDeg: s.tiltDeg });
  // Screen edges in side-view (depth = z, height = y).
  const screenBot = { d: geom.pivot[2], y: geom.pivot[1] };
  const screenTopPt = { d: geom.top[2], y: geom.top[1] };

  const eyeH = persona.eyeHeight;
  const shoulderH = persona.shoulderHeight;
  const hipH = persona.seated ? 19 : 0.52 * persona.statureHeight;
  const armLen = 0.42 * persona.statureHeight;

  // touch target + reach (mirrors avatarLayout): target sits on the tilted plane.
  const lo = Math.max(mountBottom, persona.reachLow);
  const hi = Math.min(screenTop, persona.reachHigh);
  const targetY = lo <= hi ? (lo + hi) / 2 : persona.reachHigh;
  // The screen is pushed forward off the wall by frontOffset; the viewer stands
  // `distance` in front of it, so their depth from the wall includes both.
  const personDepth = distance + geom.frontOffset;
  const tp = geom.pointAtHeight(targetY); // [0, y, depth]
  const reachLen = Math.hypot(personDepth - tp[2], shoulderH - tp[1]);
  const t = Math.min(1, armLen / reachLen);
  const handDepth = personDepth + (tp[2] - personDepth) * t;
  const handHeight = shoulderH + (tp[1] - shoulderH) * t;
  const touches = reachLen <= armLen;
  const v = s.getVerdict();

  // viewBox layout (inches). PANEL is a dedicated right-hand column for the spec
  // block so it never overlaps the drawing.
  const mL = 30;
  const mR = 12;
  const mT = 14;
  const mB = 30;
  const PANEL = 86;
  const Hc = Math.max(screenTop, eyeH + 6, persona.statureHeight, 84) + 4;
  const Dc = personDepth + 30;
  const VBW = mL + Dc + PANEL + mR;
  const VBH = mT + Hc + mB;
  const wallX = mL;
  const groundY = mT + Hc;
  const X = (depth: number) => wallX + depth;
  const Y = (h: number) => groundY - h;

  const px = X(personDepth); // person depth from the wall
  const sw = { major: 0.7, thin: 0.35, hair: 0.18 };
  const FS = 4.6;

  function exportSvg() {
    const el = svgRef.current;
    if (!el) return;
    const xml = new XMLSerializer().serializeToString(el);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screen-elevation-${Math.round(s.diagonal)}in.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const gridLines = [];
  for (let h = 12; h < Hc; h += 12) gridLines.push(h);

  return (
    <div className="twod-wrap">
      <button className="export-btn" onClick={exportSvg}>
        ⤓ Export SVG
      </button>
      <svg
        ref={svgRef}
        className="elevation"
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x={0} y={0} width={VBW} height={VBH} fill="#eef1f5" />

        {/* 12" height gridlines */}
        {gridLines.map((h) => (
          <line
            key={h}
            x1={wallX}
            y1={Y(h)}
            x2={wallX + Dc}
            y2={Y(h)}
            stroke="#c4ccd5"
            strokeWidth={sw.hair}
          />
        ))}

        {/* ADA reach band */}
        <rect x={wallX} y={Y(48)} width={Dc} height={48 - 15} fill={GREEN} opacity={0.12} />
        {[15, 48].map((h) => (
          <line
            key={h}
            x1={wallX}
            y1={Y(h)}
            x2={wallX + Dc}
            y2={Y(h)}
            stroke={GREEN}
            strokeWidth={sw.thin}
            strokeDasharray="2 1.5"
            opacity={0.7}
          />
        ))}
        <text x={wallX + Dc - 1} y={Y(48) - 1.5} fontSize={FS * 0.8} fill={GREEN} textAnchor="end">
          ADA reach 15–48"
        </text>

        {/* floor + wall */}
        <line x1={0} y1={groundY} x2={VBW} y2={groundY} stroke={DARK} strokeWidth={sw.major} />
        <line x1={wallX} y1={groundY} x2={wallX} y2={Y(Hc)} stroke={DARK} strokeWidth={sw.major} />

        {/* stand / podium under the screen bottom edge */}
        {s.mountType === 'stand' && mountBottom > 1 && (
          <rect
            x={wallX}
            y={Y(mountBottom)}
            width={16}
            height={mountBottom}
            fill="#5a6470"
            opacity={0.45}
            stroke="#3a444f"
            strokeWidth={sw.thin}
          />
        )}
        {/* screen, edge-on (angled when tilted) */}
        <line
          x1={X(screenBot.d)}
          y1={Y(screenBot.y)}
          x2={X(screenTopPt.d)}
          y2={Y(screenTopPt.y)}
          stroke={ACCENT}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <text
          x={X(screenTopPt.d) + 5}
          y={Y(screenTopPt.y) - 2}
          fontSize={FS}
          fill={ACCENT}
          style={haloStyle}
        >
          {`${Math.round(s.diagonal)}" screen`}
        </text>
        {/* screen-height dimension (vertical screens only; spec block has W×H) */}
        {s.tiltDeg < 0.5 && (
          <g stroke={ACCENT} strokeWidth={sw.thin}>
            <line x1={wallX + 5} y1={Y(screenTop)} x2={wallX + 5} y2={Y(mountBottom)} />
            <line x1={wallX + 3} y1={Y(screenTop)} x2={wallX + 7} y2={Y(screenTop)} />
            <line x1={wallX + 3} y1={Y(mountBottom)} x2={wallX + 7} y2={Y(mountBottom)} />
            <text
              x={wallX + 9}
              y={Y(screenTop) + size.height / 2}
              fontSize={FS * 0.85}
              fill={ACCENT}
              dominantBaseline="middle"
              stroke="none"
            >
              {`H ${fmtLen(size.height, units)}`}
            </text>
          </g>
        )}

        {/* eye level */}
        <line
          x1={wallX}
          y1={Y(eyeH)}
          x2={px + 24}
          y2={Y(eyeH)}
          stroke={EYE}
          strokeWidth={sw.thin}
          strokeDasharray="3 2"
        />
        <text x={px + 25} y={Y(eyeH)} fontSize={FS * 0.85} fill={EYE} dominantBaseline="middle">
          {`eye ${fmtLen(eyeH, units)}`}
        </text>

        {/* reach envelope arcs (max + comfortable) */}
        <circle
          cx={px}
          cy={Y(shoulderH)}
          r={armLen}
          fill="none"
          stroke={ACCENT}
          strokeWidth={sw.thin}
          strokeDasharray="2 2"
          opacity={0.4}
        />
        <circle
          cx={px}
          cy={Y(shoulderH)}
          r={armLen * 0.5}
          fill="none"
          stroke={ACCENT}
          strokeWidth={sw.hair}
          strokeDasharray="2 2"
          opacity={0.35}
        />

        <Person
          px={px}
          Y={Y}
          seated={persona.seated}
          eyeH={eyeH}
          shoulderH={shoulderH}
          hipH={hipH}
        />

        {/* reaching arm */}
        <line
          x1={px}
          y1={Y(shoulderH)}
          x2={X(handDepth)}
          y2={Y(handHeight)}
          stroke={BODY}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={X(handDepth)} cy={Y(handHeight)} r={3} fill={touches ? GREEN : '#e06c6c'} />

        {/* dimensions */}
        <VDim x={wallX - 9} y0={groundY} y1={Y(mountBottom)} label={fmtLen(mountBottom, units)} fs={FS} />
        <VDim x={wallX - 19} y0={groundY} y1={Y(screenTop)} label={fmtLen(screenTop, units)} fs={FS} />
        <HDim
          y={groundY + 13}
          x0={X(geom.frontOffset)}
          x1={px}
          label={`${fmtDist(distance, units)} ${s.mode === 'touch' ? '(touch)' : ''}`}
          fs={FS}
        />

        <SpecBlock
          x={mL + Dc + 4}
          y={mT}
          rows={[
            ['Screen', `${Math.round(s.diagonal)}"  ${s.aspectW}:${s.aspectH}`],
            ['W × H', `${fmtLen(size.width, units)} × ${fmtLen(size.height, units)}`],
            ['Mount', s.mountType === 'stand' ? 'Stand' : 'Wall'],
            ['Tilt', `${Math.round(s.tiltDeg)}°`],
            ['Mount (bottom)', fmtLen(mountBottom, units)],
            ['Top of screen', fmtLen(screenTopPt.y, units)],
            ['Eye level', fmtLen(eyeH, units)],
            ['ADA reach', `15–48"`],
            ['Distance', `${fmtDist(distance, units)} (${s.mode})`],
            ['Viewer', persona.label],
          ]}
          verdict={`${VLEVEL[v.level]} — ${v.horizontalAngle.toFixed(0)}° FOV`}
          verdictColor={VCOLOR[v.level]}
        />
      </svg>
    </div>
  );
}

const haloStyle: React.CSSProperties = {
  paintOrder: 'stroke',
  stroke: '#ffffff',
  strokeWidth: 1.1,
};

const VLEVEL = { good: 'GOOD', caution: 'CAUTION', bad: 'BAD IDEA' } as const;
const VCOLOR = { good: GREEN, caution: '#b8860b', bad: '#c0392b' } as const;

/** Title/spec block — the things a side elevation can't show as a dimension. */
function SpecBlock({
  x,
  y,
  rows,
  verdict,
  verdictColor,
}: {
  x: number;
  y: number;
  rows: [string, string][];
  verdict: string;
  verdictColor: string;
}) {
  const lh = 5.4;
  const w = 78;
  const padX = 3;
  const h = 8 + (rows.length + 1.6) * lh;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="#ffffff" stroke="#c4ccd5" strokeWidth={0.4} />
      {rows.map(([label, val], i) => {
        const ly = y + 6 + i * lh;
        return (
          <g key={label} fontSize={3.4}>
            <text x={x + padX} y={ly} fill="#6b7480">
              {label}
            </text>
            <text x={x + w - padX} y={ly} fill="#10202e" textAnchor="end">
              {val}
            </text>
          </g>
        );
      })}
      <line x1={x + padX} y1={y + 4 + rows.length * lh} x2={x + w - padX} y2={y + 4 + rows.length * lh} stroke="#dde2e8" strokeWidth={0.4} />
      <text x={x + padX} y={y + 6 + (rows.length + 0.9) * lh} fontSize={4.2} fontWeight="bold" fill={verdictColor}>
        {verdict}
      </text>
    </g>
  );
}

/**
 * Profile mannequin built from filled capsules (round-capped strokes in one
 * body colour) so it reads as a solid figure rather than a ball-and-stick.
 * Limbs overlap at the joints to look continuous.
 */
function Person({
  px,
  Y,
  seated,
  eyeH,
  shoulderH,
  hipH,
}: {
  px: number;
  Y: (h: number) => number;
  seated: boolean;
  eyeH: number;
  shoulderH: number;
  hipH: number;
}) {
  const Cap = (x1: number, h1: number, x2: number, h2: number, w: number) => (
    <line x1={x1} y1={Y(h1)} x2={x2} y2={Y(h2)} stroke={BODY} strokeWidth={w} strokeLinecap="round" />
  );
  return (
    <g>
      {/* back arm (resting), drawn first so the body overlaps the shoulder */}
      {!seated && Cap(px, shoulderH, px + 2, hipH + 4, 5)}
      {/* torso */}
      {Cap(px, hipH, px, shoulderH + 1, 12)}
      {/* neck */}
      {Cap(px, shoulderH, px, eyeH - 1, 5)}
      {/* head (slightly oval profile) */}
      <ellipse cx={px} cy={Y(eyeH + 3)} rx={5} ry={6} fill={SKIN} />
      {seated ? (
        <>
          {Cap(px, hipH, px - 16, hipH, 9)} {/* thigh toward wall */}
          {Cap(px - 16, hipH, px - 16, 2, 7)} {/* shin */}
          {/* simple chair */}
          <circle cx={px} cy={Y(11)} r={11} fill="none" stroke="#1a2026" strokeWidth={1.6} />
          <line x1={px - 16} y1={Y(hipH - 3)} x2={px + 7} y2={Y(hipH - 3)} stroke="#2b3440" strokeWidth={2.4} />
          <line x1={px + 7} y1={Y(hipH - 3)} x2={px + 7} y2={Y(hipH + 18)} stroke="#2b3440" strokeWidth={2.4} />
        </>
      ) : (
        Cap(px, hipH + 2, px, 0, 9) /* leg */
      )}
    </g>
  );
}

function VDim({
  x,
  y0,
  y1,
  label,
  fs,
}: {
  x: number;
  y0: number;
  y1: number;
  label: string;
  fs: number;
}) {
  return (
    <g stroke={DARK} strokeWidth={0.35}>
      <line x1={x} y1={y0} x2={x} y2={y1} />
      <line x1={x - 2} y1={y0} x2={x + 2} y2={y0} />
      <line x1={x - 2} y1={y1} x2={x + 2} y2={y1} />
      <text
        x={x - 3}
        y={(y0 + y1) / 2}
        fontSize={fs}
        fill={DARK}
        textAnchor="end"
        dominantBaseline="middle"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

function HDim({
  y,
  x0,
  x1,
  label,
  fs,
}: {
  y: number;
  x0: number;
  x1: number;
  label: string;
  fs: number;
}) {
  return (
    <g stroke={DARK} strokeWidth={0.35}>
      <line x1={x0} y1={y} x2={x1} y2={y} />
      <line x1={x0} y1={y - 2} x2={x0} y2={y + 2} />
      <line x1={x1} y1={y - 2} x2={x1} y2={y + 2} />
      <text
        x={(x0 + x1) / 2}
        y={y + 6}
        fontSize={fs}
        fill={DARK}
        textAnchor="middle"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}
