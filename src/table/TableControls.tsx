import { useMemo } from 'react';
import { PERSONAS, TABLE_SURFACE_MAX, TABLE_SURFACE_MIN, type PersonaId } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { tableVerdict } from '../ergonomics/tableEngine';
import { useConfigStore } from '../store/useConfigStore';
import { fmtLen, fromInches, lenUnit, toInches } from '../ui/units';

const LEVEL_LABEL = { good: 'Good', caution: 'Caution', bad: 'Bad idea' } as const;
const REASON_ICON = { good: '✓', caution: '!', bad: '✕' } as const;
const PERSONA_IDS: PersonaId[] = ['adult', 'child', 'wheelchair'];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <span className="row-control">{children}</span>
    </label>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function TableControls() {
  // Primitive selectors only, then derive the verdict in a memo (a fresh object
  // from a selector triggers an infinite getSnapshot loop — see VerdictPanel).
  const units = useConfigStore((s) => s.units);
  const diagonal = useConfigStore((s) => s.diagonal);
  const aspectW = useConfigStore((s) => s.aspectW);
  const aspectH = useConfigStore((s) => s.aspectH);
  const tableHeight = useConfigStore((s) => s.tableHeight);
  const tableBezel = useConfigStore((s) => s.tableBezel);
  const tableShowReach = useConfigStore((s) => s.tableShowReach);
  const tableSeats = useConfigStore((s) => s.tableSeats);
  const personaId = useConfigStore((s) => s.personaId);
  const resMode = useConfigStore((s) => s.resMode);
  const horizontalPixels = useConfigStore((s) => s.horizontalPixels);
  const pitchMm = useConfigStore((s) => s.pitchMm);
  const strictness = useConfigStore((s) => s.strictness);
  const set = useConfigStore((s) => s.set);

  const u = lenUnit(units);
  const metric = units === 'metric';

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

  // Border slider bounds in the active unit (0–12" / 0–30 cm).
  const bezVal = round(fromInches(tableBezel, units));

  // Surface-height slider bounds in the active unit (≈26–44" / 66–112 cm).
  const htMin = metric ? 66 : 26;
  const htMax = metric ? 112 : 44;
  const htVal = round(fromInches(tableHeight, units));

  return (
    <>
      <div className="panel">
        <h2>Table surface</h2>
        <p className="hint">
          A flat, face-up touchscreen you stand or sit at. Reach is a depth problem
          here — how far you can touch across the surface — not a wall-height one.
        </p>

        <div className="field">
          <div className="field-head">
            <span className="row-label">Surface height AFF</span>
            <span className="num-readout">{fmtLen(tableHeight, units)}</span>
          </div>
          <input
            className="slider"
            type="range"
            min={htMin}
            max={htMax}
            step={metric ? 1 : 0.5}
            value={htVal}
            onChange={(e) => set('tableHeight', toInches(Number(e.target.value), units))}
          />
          <p className="hint">
            ADA seated-accessible work surface is {TABLE_SURFACE_MIN}–{TABLE_SURFACE_MAX}" — a
            wheelchair can pull under in that range.
          </p>
        </div>

        <div className="field">
          <div className="field-head">
            <span className="row-label">Border / frame</span>
            <span className="num-readout">{fmtLen(tableBezel, units)}</span>
          </div>
          <input
            className="slider"
            type="range"
            min={0}
            max={metric ? 30 : 12}
            step={metric ? 1 : 0.5}
            value={bezVal}
            onChange={(e) => set('tableBezel', toInches(Number(e.target.value), units))}
          />
          <p className="hint">
            Frame around the screen. You stand at its outer edge, so a wide border
            adds to the reach-across distance.
          </p>
        </div>

        <h2>Screen</h2>
        <Row label={`Diagonal (${u})`}>
          <input
            type="number"
            min={1}
            value={round(fromInches(diagonal, units))}
            onChange={(e) => set('diagonal', toInches(Number(e.target.value), units))}
          />
        </Row>
        <Row label="Aspect">
          <span className="aspect">
            <input type="number" min={1} value={aspectW} onChange={(e) => set('aspectW', Number(e.target.value))} />
            <span>:</span>
            <input type="number" min={1} value={aspectH} onChange={(e) => set('aspectH', Number(e.target.value))} />
          </span>
        </Row>
        <p className="hint">
          Laid flat, the screen's shorter dimension lies away from you — that's the{' '}
          <strong>{fmtLen(v.depth, units)}</strong> you reach across. Swap the aspect to
          rotate it.
        </p>

        <Row label="Horizontal pixels">
          <input
            type="number"
            min={0}
            value={resMode === 'pixels' ? horizontalPixels : ''}
            onChange={(e) => {
              set('resMode', 'pixels');
              set('horizontalPixels', Number(e.target.value));
            }}
          />
        </Row>

        <h2>Who's using it</h2>
        <Row label="Viewer">
          <span className="seg">
            {PERSONA_IDS.map((id) => (
              <button
                key={id}
                className={personaId === id ? 'on' : ''}
                onClick={() => set('personaId', id)}
              >
                {PERSONAS[id].label.split(' ')[0]}
              </button>
            ))}
          </span>
        </Row>
        <Row label="People around table">
          <input
            type="number"
            min={1}
            max={6}
            value={tableSeats}
            onChange={(e) => set('tableSeats', Math.max(1, Math.min(6, Math.round(Number(e.target.value)))))}
          />
        </Row>
        <p className="hint">Up to 6 — two per long side, one per short side (3D view).</p>
        <label className="row">
          <span className="row-label">Show reach heatmap</span>
          <span className="row-control">
            <input
              type="checkbox"
              checked={tableShowReach}
              onChange={(e) => set('tableShowReach', e.target.checked)}
            />
          </span>
        </label>
      </div>

      <div className="panel verdict">
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
    </>
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
