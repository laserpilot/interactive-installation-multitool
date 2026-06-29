import { useRef } from 'react';
import {
  ADA_OBSTRUCTED_DEEP_DEPTH,
  ADA_OBSTRUCTED_SHALLOW_DEPTH,
  KNEE_CLEARANCE_HEIGHT,
  PERSONAS,
  REACH_ARM_FRACTION,
  SEATED_LEAN_ALLOWANCE,
  STANDING_LEAN_ALLOWANCE,
  TOE_CLEARANCE_HEIGHT,
} from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { tableVerdict } from '../ergonomics/tableEngine';
import { useConfigStore } from '../store/useConfigStore';
import { fmtLen } from '../ui/units';

const DARK = '#1d2733';
const ACCENT = '#2f6df0';
const EYE = '#c77d11';
const GREEN = '#19a05a';
const AMBER = '#b8860b';
const RED = '#c0392b';
const BODY = '#3f4a57';
const SKIN = '#d9b08c';

/**
 * 2D side elevation for the horizontal TABLE touchscreen. The user stands/sits at
 * the near (left) edge and the surface extends away to the right; reach is read
 * ACROSS the surface. All geometry is in INCHES inside the SVG viewBox, driven by
 * the table engine so the drawing stays in sync with the verdict.
 */
export function TableElevation() {
  const s = useConfigStore();
  const persona = PERSONAS[s.personaId];
  const units = s.units;
  const size = sizeFromDiagonal(s.diagonal, s.aspectW, s.aspectH);
  const svgRef = useRef<SVGSVGElement>(null);

  const tableH = s.tableHeight;
  const depth = size.height; // screen dimension lying away from the user
  const bezel = s.tableBezel; // border between the user's edge and the screen
  const reachSpan = bezel + depth; // user's edge → far screen edge
  const outerDepth = depth + 2 * bezel; // full tabletop depth
  const v = s.appTab === 'table'
    ? tableVerdict({
        size,
        tableHeight: tableH,
        bezel,
        personaId: s.personaId,
        horizontalPixels: s.resMode === 'pixels' ? s.horizontalPixels : undefined,
        pitchMm: s.resMode === 'pitch' ? s.pitchMm : undefined,
        strictness: s.strictness,
      })
    : tableVerdict({ size, tableHeight: tableH, bezel, personaId: s.personaId });

  const eyeH = persona.eyeHeight;
  const shoulderH = persona.shoulderHeight;
  const hipH = persona.seated ? 19 : 0.52 * persona.statureHeight;

  // Reach across the surface (mirrors tableReach): horizontal reach from the edge.
  const armLen = REACH_ARM_FRACTION * persona.statureHeight;
  const reach = armLen + (persona.seated ? SEATED_LEAN_ALLOWANCE : STANDING_LEAN_ALLOWANCE);
  // Hand lands on the surface at depthMax from the edge, capped at the far edge.
  const handDepth = Math.min(reachSpan, v.reach.depthMax);
  const touchesFar = reachSpan <= v.reach.depthMax;

  // viewBox layout (inches).
  const leftPad = 40; // room for body / chair / vertical dim
  const rightPad = 16;
  const mT = 16;
  const mB = 32;
  const mR = 12;
  const PANEL = 86;
  const edgeX = leftPad; // outer edge of the table where the user stands (depth 0)
  const Hc = Math.max(tableH, eyeH, persona.statureHeight) + 10;
  const Dc = outerDepth + rightPad;
  const VBW = edgeX + Dc + PANEL + mR;
  const VBH = mT + Hc + mB;
  const groundY = mT + Hc;
  const X = (d: number) => edgeX + d;
  const Y = (h: number) => groundY - h;
  const sw = { major: 0.7, thin: 0.35, hair: 0.18 };
  const FS = 4.6;

  // ADA reach-over-obstruction zones, measured from the user's edge.
  const adaShallow = Math.min(reachSpan, ADA_OBSTRUCTED_SHALLOW_DEPTH);
  const adaDeep = Math.min(reachSpan, ADA_OBSTRUCTED_DEEP_DEPTH);

  function exportSvg() {
    const el = svgRef.current;
    if (!el) return;
    const xml = new XMLSerializer().serializeToString(el);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table-elevation-${Math.round(s.diagonal)}in.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const gridLines = [];
  // Cap the count: a non-finite or absurd Hc must never spin this loop forever.
  for (let h = 12; h < Hc && h < 6000; h += 12) gridLines.push(h);

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
          <line key={h} x1={edgeX} y1={Y(h)} x2={edgeX + Dc} y2={Y(h)} stroke="#c4ccd5" strokeWidth={sw.hair} />
        ))}

        {/* floor */}
        <line x1={0} y1={groundY} x2={VBW} y2={groundY} stroke={DARK} strokeWidth={sw.major} />

        {/* knee + toe clearance the user pulls under (ADA 306) */}
        <rect
          x={X(0)}
          y={Y(KNEE_CLEARANCE_HEIGHT)}
          width={Math.min(depth, ADA_OBSTRUCTED_DEEP_DEPTH)}
          height={KNEE_CLEARANCE_HEIGHT - TOE_CLEARANCE_HEIGHT}
          fill={persona.seated ? GREEN : '#9aa6b2'}
          opacity={0.1}
          stroke={persona.seated ? GREEN : '#9aa6b2'}
          strokeWidth={sw.hair}
          strokeDasharray="2 1.5"
        />
        <text x={X(2)} y={Y(KNEE_CLEARANCE_HEIGHT) - 1.5} fontSize={FS * 0.72} fill={persona.seated ? GREEN : '#7c8794'}>
          knee/toe clearance
        </text>

        {/* table top slab (full width incl. border) + far leg */}
        <rect x={X(outerDepth) - 2.5} y={Y(tableH)} width={2.5} height={tableH} fill="#5a6470" opacity={0.5} stroke="#3a444f" strokeWidth={sw.thin} />
        <rect x={X(0)} y={Y(tableH) - 1.5} width={outerDepth} height={1.6} fill="#7c8794" opacity={0.6} />
        {/* border / frame (the part of the top that isn't screen) */}
        {bezel >= 0.5 && (
          <>
            <rect x={X(0)} y={Y(tableH) - 1.5} width={bezel} height={1.6} fill="#3a4048" />
            <rect x={X(bezel + depth)} y={Y(tableH) - 1.5} width={bezel} height={1.6} fill="#3a4048" />
          </>
        )}

        {/* ADA reach-over-obstruction zones (band above the surface, from the edge) */}
        <rect x={X(0)} y={Y(tableH) - 7} width={adaShallow} height={5} fill={GREEN} opacity={0.16} />
        {adaDeep > adaShallow && (
          <rect x={X(adaShallow)} y={Y(tableH) - 7} width={adaDeep - adaShallow} height={5} fill={AMBER} opacity={0.18} />
        )}
        {reachSpan > adaDeep && (
          <rect x={X(adaDeep)} y={Y(tableH) - 7} width={reachSpan - adaDeep} height={5} fill={RED} opacity={0.16} />
        )}
        {reachSpan > ADA_OBSTRUCTED_SHALLOW_DEPTH && (
          <ADATick x={X(adaShallow)} yTop={Y(tableH) - 7} yBot={Y(tableH)} label={`${ADA_OBSTRUCTED_SHALLOW_DEPTH}"`} fs={FS} />
        )}
        {reachSpan > ADA_OBSTRUCTED_DEEP_DEPTH && (
          <ADATick x={X(adaDeep)} yTop={Y(tableH) - 7} yBot={Y(tableH)} label={`${ADA_OBSTRUCTED_DEEP_DEPTH}" max`} fs={FS} />
        )}

        {/* active screen (edge-on), offset back by the border */}
        <line x1={X(bezel)} y1={Y(tableH)} x2={X(bezel + depth)} y2={Y(tableH)} stroke={ACCENT} strokeWidth={2.6} strokeLinecap="round" />
        <text x={X(outerDepth) + 4} y={Y(tableH) - 2} fontSize={FS} fill={ACCENT} style={haloStyle}>
          {`${Math.round(s.diagonal)}" table`}
        </text>

        {/* line of sight (look-down) from eye to screen center */}
        <line x1={X(0)} y1={Y(eyeH)} x2={X(bezel + depth / 2)} y2={Y(tableH)} stroke={EYE} strokeWidth={sw.thin} strokeDasharray="3 2" />
        <text x={X(bezel + depth / 2) + 1} y={Y(tableH) - 8} fontSize={FS * 0.78} fill={EYE}>
          {`look-down ${v.lookDownAngle.toFixed(0)}°`}
        </text>

        {/* reach envelope from the shoulder */}
        <circle cx={X(0)} cy={Y(shoulderH)} r={reach} fill="none" stroke={ACCENT} strokeWidth={sw.thin} strokeDasharray="2 2" opacity={0.4} />

        <Person px={X(0)} Y={Y} seated={persona.seated} eyeH={eyeH} shoulderH={shoulderH} hipH={hipH} />

        {/* reaching arm: shoulder → where the hand lands on the surface */}
        <line x1={X(0)} y1={Y(shoulderH)} x2={X(handDepth)} y2={Y(tableH)} stroke={BODY} strokeWidth={5} strokeLinecap="round" />
        <circle cx={X(handDepth)} cy={Y(tableH)} r={3} fill={touchesFar ? GREEN : RED} />
        {!touchesFar && (
          <text x={X(handDepth)} y={Y(tableH) + 7} fontSize={FS * 0.78} fill={RED} textAnchor="middle">
            can't reach far edge
          </text>
        )}

        {/* dimensions: surface height (vertical) + screen depth (horizontal) */}
        <VDim x={edgeX - 10} y0={groundY} y1={Y(tableH)} label={fmtLen(tableH, units)} fs={FS} />
        <HDim y={groundY + 14} x0={X(bezel)} x1={X(bezel + depth)} label={fmtLen(depth, units)} fs={FS} />

        <SpecBlock
          x={edgeX + Dc + 4}
          y={mT}
          rows={[
            ['Type', 'Table (flat)'],
            ['Screen', `${Math.round(s.diagonal)}"  ${s.aspectW}:${s.aspectH}`],
            ['Screen depth', fmtLen(depth, units)],
            ['Border', fmtLen(bezel, units)],
            ['Surface height', fmtLen(tableH, units)],
            ['Max reach', fmtLen(v.reach.depthMax, units)],
            ['Reachable', `${Math.round(v.reach.reachableDepthFraction * 100)}%`],
            ['Usable area', `${Math.round(v.usable.areaFraction * 100)}%`],
            ['ADA reach', v.ada.level === 'bad' ? 'over 25" limit' : `${v.ada.allowableHigh}" high`],
            ['Seated access', v.seated.surfaceInAdaRange ? 'yes (28–34")' : 'no'],
            ['Viewer', persona.label],
          ]}
          verdict={`${VLEVEL[v.level]} — ${fmtLen(v.reach.depthMax, units)} reach`}
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

function ADATick({ x, yTop, yBot, label, fs }: { x: number; yTop: number; yBot: number; label: string; fs: number }) {
  return (
    <g>
      <line x1={x} y1={yTop} x2={x} y2={yBot} stroke={DARK} strokeWidth={0.35} strokeDasharray="1.5 1.5" />
      <text x={x + 1} y={yTop - 1} fontSize={fs * 0.72} fill={DARK}>
        {label}
      </text>
    </g>
  );
}

/** Profile mannequin at the near edge, reaching across the surface to the right. */
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
      {/* torso (leans slightly toward the surface) */}
      {Cap(px - 3, hipH, px, shoulderH + 1, 12)}
      {/* neck + head */}
      {Cap(px, shoulderH, px - 1, eyeH - 1, 5)}
      <ellipse cx={px - 1} cy={Y(eyeH + 3)} rx={5} ry={6} fill={SKIN} />
      {seated ? (
        <>
          {/* thigh going UNDER the table (toward +x), then shin down */}
          {Cap(px - 3, hipH, px + 14, hipH, 9)}
          {Cap(px + 14, hipH, px + 14, 2, 7)}
          {/* simple wheelchair behind the user */}
          <circle cx={px - 6} cy={Y(11)} r={11} fill="none" stroke="#1a2026" strokeWidth={1.6} />
          <line x1={px - 3} y1={Y(hipH - 3)} x2={px - 16} y2={Y(hipH - 3)} stroke="#2b3440" strokeWidth={2.4} />
          <line x1={px - 16} y1={Y(hipH - 3)} x2={px - 16} y2={Y(hipH + 18)} stroke="#2b3440" strokeWidth={2.4} />
        </>
      ) : (
        <>
          {/* back leg + front leg straddling the near edge */}
          {Cap(px - 5, hipH + 2, px - 5, 0, 9)}
        </>
      )}
    </g>
  );
}

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

function VDim({ x, y0, y1, label, fs }: { x: number; y0: number; y1: number; label: string; fs: number }) {
  return (
    <g stroke={DARK} strokeWidth={0.35}>
      <line x1={x} y1={y0} x2={x} y2={y1} />
      <line x1={x - 2} y1={y0} x2={x + 2} y2={y0} />
      <line x1={x - 2} y1={y1} x2={x + 2} y2={y1} />
      <text x={x - 3} y={(y0 + y1) / 2} fontSize={fs} fill={DARK} textAnchor="end" dominantBaseline="middle" stroke="none">
        {label}
      </text>
    </g>
  );
}

function HDim({ y, x0, x1, label, fs }: { y: number; x0: number; x1: number; label: string; fs: number }) {
  return (
    <g stroke={DARK} strokeWidth={0.35}>
      <line x1={x0} y1={y} x2={x1} y2={y} />
      <line x1={x0} y1={y - 2} x2={x0} y2={y + 2} />
      <line x1={x1} y1={y - 2} x2={x1} y2={y + 2} />
      <text x={(x0 + x1) / 2} y={y + 6} fontSize={fs} fill={DARK} textAnchor="middle" stroke="none">
        {label}
      </text>
    </g>
  );
}
