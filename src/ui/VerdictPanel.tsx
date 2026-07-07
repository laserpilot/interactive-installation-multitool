import { useMemo } from 'react';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist, fmtLen } from './units';

const LEVEL_LABEL = { good: 'Good', caution: 'Caution', bad: 'Reconsider' } as const;
const REASON_ICON = { good: '✓', caution: '!', bad: '✕' } as const;

export function VerdictPanel() {
  // Select only primitives (stable snapshots), then derive the verdict in a
  // memo — returning a fresh object from a zustand selector triggers an
  // infinite getSnapshot loop.
  const units = useConfigStore((s) => s.units);
  const diagonal = useConfigStore((s) => s.diagonal);
  const aspectW = useConfigStore((s) => s.aspectW);
  const aspectH = useConfigStore((s) => s.aspectH);
  const mountBottom = useConfigStore((s) => s.mountBottom);
  const mode = useConfigStore((s) => s.mode);
  const viewingDistance = useConfigStore((s) => s.viewingDistance);
  const personaId = useConfigStore((s) => s.personaId);
  const resMode = useConfigStore((s) => s.resMode);
  const horizontalPixels = useConfigStore((s) => s.horizontalPixels);
  const pitchMm = useConfigStore((s) => s.pitchMm);
  const strictness = useConfigStore((s) => s.strictness);
  const set = useConfigStore((s) => s.set);
  const getVerdict = useConfigStore((s) => s.getVerdict);

  const v = useMemo(
    () => getVerdict(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      diagonal, aspectW, aspectH, mountBottom, mode, viewingDistance,
      personaId, resMode, horizontalPixels, pitchMm, strictness, getVerdict,
    ],
  );

  const screen = sizeFromDiagonal(diagonal, aspectW, aspectH);

  return (
    <div className="verdict-readout">
      <div className="verdict-head">
        <div className={`verdict-badge ${v.level}`}>
          <span className="verdict-dot" />
          {LEVEL_LABEL[v.level]}
        </div>
        <span className="seg sm" title="How forgiving the judgments are">
          <button
            className={strictness === 'realistic' ? 'on' : ''}
            onClick={() => set('strictness', 'realistic')}
          >
            Realistic
          </button>
          <button
            className={strictness === 'strict' ? 'on' : ''}
            onClick={() => set('strictness', 'strict')}
          >
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
        <Metric
          label="Screen (W × H)"
          value={`${fmtLen(screen.width, units)} × ${fmtLen(screen.height, units)}`}
        />
        <Metric
          label="Screen fills (of your view)"
          value={`${v.horizontalAngle.toFixed(0)}°`}
        />
        <Metric label="Viewing distance" value={fmtDist(v.effectiveDistance, units)} />
        <Metric
          label="Reachable (ADA band)"
          value={`${Math.round(v.adaReach.reachableFraction * 100)}%`}
        />
        <Metric
          label="Recommended mount (bottom)"
          value={fmtLen(v.recommendedMountBottom, units)}
        />
        <Metric label="Comfortable view distance" value={fmtDist(v.comfortableStandoff, units)} />
        {v.pixels.pitchMm > 0 && (
          <>
            <Metric label="Pixel pitch" value={`${v.pixels.pitchMm.toFixed(2)} mm`} />
            <Metric
              label="Sharpness"
              value={`${v.pixels.ppd === Infinity ? '∞' : v.pixels.ppd.toFixed(0)} px/°`}
            />
          </>
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
