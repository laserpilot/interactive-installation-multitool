import { useMemo } from 'react';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { tableVerdict } from '../ergonomics/tableEngine';
import { useConfigStore } from '../store/useConfigStore';
import { fmtLen } from '../ui/units';

const LEVEL_LABEL = { good: 'Good', caution: 'Caution', bad: 'Reconsider' } as const;
const REASON_ICON = { good: '✓', caution: '!', bad: '✕' } as const;

/** Verdict readout for the Table Monitor tab, shown under the viewport (matching
 *  the sensor/speaker/projection tabs). Selects primitives then derives the
 *  verdict in a memo — a fresh object from a selector loops getSnapshot. */
export function TableVerdictPanel() {
  const units = useConfigStore((s) => s.units);
  const diagonal = useConfigStore((s) => s.diagonal);
  const aspectW = useConfigStore((s) => s.aspectW);
  const aspectH = useConfigStore((s) => s.aspectH);
  const tableHeight = useConfigStore((s) => s.tableHeight);
  const tableBezel = useConfigStore((s) => s.tableBezel);
  const personaId = useConfigStore((s) => s.personaId);
  const resMode = useConfigStore((s) => s.resMode);
  const horizontalPixels = useConfigStore((s) => s.horizontalPixels);
  const pitchMm = useConfigStore((s) => s.pitchMm);
  const strictness = useConfigStore((s) => s.strictness);
  const set = useConfigStore((s) => s.set);

  const v = useMemo(
    () =>
      tableVerdict({
        size: sizeFromDiagonal(diagonal, aspectW, aspectH),
        tableHeight,
        bezel: tableBezel,
        personaId,
        horizontalPixels: resMode === 'pixels' ? horizontalPixels : undefined,
        pitchMm: resMode === 'pitch' ? pitchMm : undefined,
        strictness,
      }),
    [diagonal, aspectW, aspectH, tableHeight, tableBezel, personaId, resMode, horizontalPixels, pitchMm, strictness],
  );

  return (
    <div className="verdict-readout">
      <div className="verdict-head">
        <div className={`verdict-badge ${v.level}`}>
          <span className="verdict-dot" />
          {LEVEL_LABEL[v.level]}
        </div>
        <span className="seg sm" title="How forgiving the judgments are">
          <button className={strictness === 'realistic' ? 'on' : ''} onClick={() => set('strictness', 'realistic')}>
            Realistic
          </button>
          <button className={strictness === 'strict' ? 'on' : ''} onClick={() => set('strictness', 'strict')}>
            Strict
          </button>
        </span>
      </div>

      <ul className="reasons">
        {v.reasons.map((r, i) => (
          <li key={i} className={r.level}>
            <span className="reason-icon">{REASON_ICON[r.level]}</span>
            {r.text}
          </li>
        ))}
      </ul>

      <dl className="metrics">
        <Metric label="Reach across" value={`${fmtLen(v.depth, units)}${v.bezel >= 0.5 ? ` + ${fmtLen(v.bezel, units)} border` : ''}`} />
        <Metric label="Reachable depth" value={`${Math.round(v.reach.reachableDepthFraction * 100)}%`} />
        <Metric label="Reachable area" value={`${Math.round(v.usable.areaFraction * 100)}% of screen`} />
        {v.usable.pxW != null && v.usable.pxD != null && (
          <Metric label="Usable resolution" value={`~${v.usable.pxW.toLocaleString()} × ${v.usable.pxD.toLocaleString()} px`} />
        )}
        <Metric label="Max reach from edge" value={fmtLen(v.reach.depthMax, units)} />
        <Metric label="ADA forward reach" value={v.ada.level === 'bad' ? 'over limit' : `${v.ada.allowableHigh}" high`} />
        <Metric label="Look-down angle" value={`${v.lookDownAngle.toFixed(0)}°`} />
        {v.pixels.pitchMm > 0 && (
          <Metric label="Sharpness" value={`${v.pixels.ppd === Infinity ? '∞' : v.pixels.ppd.toFixed(0)} px/°`} />
        )}
      </dl>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
