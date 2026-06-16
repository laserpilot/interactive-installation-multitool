import { useConfigStore } from '../store/useConfigStore';
import { fmtDist, fmtLen } from './units';

const LEVEL_LABEL = { good: 'Good', caution: 'Caution', bad: 'Bad idea' } as const;
const REASON_ICON = { good: '✓', caution: '!', bad: '✕' } as const;

export function VerdictPanel() {
  const units = useConfigStore((s) => s.units);
  // Recompute on any relevant field change.
  const v = useConfigStore((s) => {
    void s.diagonal, s.aspectW, s.aspectH, s.mountBottom, s.mode, s.viewingDistance;
    void s.personaId, s.resMode, s.horizontalPixels, s.pitchMm;
    return s.getVerdict();
  });

  return (
    <div className="panel verdict">
      <div className={`verdict-badge ${v.level}`}>
        <span className="verdict-dot" />
        {LEVEL_LABEL[v.level]}
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
          label="Horizontal field of view"
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
