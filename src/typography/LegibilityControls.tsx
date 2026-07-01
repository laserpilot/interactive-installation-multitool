import { useState } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import type { Units } from '../store/useConfigStore';
import type { LegibilityClass, SampleReport, TypeSample } from './legibility';
import { CalibrationModal } from '../ui/CalibrationModal';
import { TrueScalePreview } from './TrueScalePreview';

const CLASS_LABEL: Record<LegibilityClass, string> = {
  illegible: 'unreadable',
  marginal: 'marginal',
  legible: 'legible',
  comfortable: 'comfortable',
};

/** Small-length label: mm in metric, inches in US. */
function fmtSmall(inches: number, units: Units): string {
  return units === 'metric' ? `${(inches * 25.4).toFixed(1)} mm` : `${inches.toFixed(2)}"`;
}

function SampleRow({
  sample,
  report,
  units,
  onChange,
  onRemove,
}: {
  sample: TypeSample;
  report: SampleReport | undefined;
  units: Units;
  onChange: (next: TypeSample) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`legi-row legi-${report?.level ?? 'good'}`}>
      <div className="legi-row-inputs">
        <input
          className="legi-label"
          type="text"
          value={sample.label}
          onChange={(e) => onChange({ ...sample, label: e.target.value })}
        />
        <input
          className="num-sm"
          type="number"
          min={1}
          value={sample.fontPx}
          onChange={(e) => onChange({ ...sample, fontPx: Math.max(1, Number(e.target.value)) })}
        />
        <span className="legi-unit">px</span>
        <button className="legi-x" onClick={onRemove} title="Remove">
          ×
        </button>
      </div>
      {report && (
        <div className="legi-verdict">
          <span className="legi-arcmin">{report.capArcmin.toFixed(1)}′ cap</span>
          <span className="legi-phys">{fmtSmall(report.capHeightIn, units)}</span>
          <span className={`legi-badge legi-${report.level}`}>{CLASS_LABEL[report.klass]}</span>
          {report.underResolved && <span className="legi-badge legi-bad">under-res</span>}
        </div>
      )}
    </div>
  );
}

export function LegibilityControls() {
  const s = useConfigStore();
  // Call the method on the already-subscribed store — do NOT wrap in a selector
  // like useConfigStore((st) => st.getLegibility()); that returns a fresh object
  // every render and trips zustand's snapshot cache into an infinite loop.
  const report = s.getLegibility();
  const [calibrating, setCalibrating] = useState(false);
  const [trueScale, setTrueScale] = useState(false);

  const setSamples = (next: TypeSample[]) => s.set('typeSamples', next);
  const updateSample = (i: number, next: TypeSample) =>
    setSamples(s.typeSamples.map((x, j) => (j === i ? next : x)));
  const removeSample = (i: number) => setSamples(s.typeSamples.filter((_, j) => j !== i));
  const addSample = () =>
    setSamples([...s.typeSamples, { label: `Style ${s.typeSamples.length + 1}`, fontPx: 24 }]);

  return (
    <div className="panel">
      <h2>Type &amp; Legibility</h2>
      <p className="hint">
        How big your type actually looks to a viewer at the effective distance. Sizes
        are judged by the angle they subtend — the eye resolves ~1′ per stroke, so a
        cap height under ~5′ is unreadable, ~16′+ is comfortable body copy.
      </p>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Artboard width (px maps across the screen)</span>
          <input
            className="num-sm"
            type="number"
            min={1}
            value={s.typeArtboardPx}
            onChange={(e) => s.set('typeArtboardPx', Math.max(1, Number(e.target.value)))}
          />
        </div>
        <p className="hint">
          The px width of the design that fills this screen. A 1920px comp on a 110″
          wall → every 1920px maps across the full width.
        </p>
      </div>

      <div className="field">
        <span className="row-label">Type sizes (artboard px)</span>
        <div className="legi-rows">
          {s.typeSamples.map((sample, i) => (
            <SampleRow
              key={i}
              sample={sample}
              report={report.samples[i]}
              units={s.units}
              onChange={(next) => updateSample(i, next)}
              onRemove={() => removeSample(i)}
            />
          ))}
        </div>
        <button className="ghost" onClick={addSample}>
          + Add a size
        </button>
      </div>

      <p className="legi-min">
        At this distance, aim for ≥ <strong>{Math.round(report.minComfortableFontPx)}px</strong>{' '}
        for comfortable body copy ({Math.round(report.minLegibleFontPx)}px is the readable floor).
      </p>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Sample text</span>
        </div>
        <input
          type="text"
          value={s.typeSampleText}
          onChange={(e) => s.set('typeSampleText', e.target.value)}
        />
      </div>

      <h2>See it two ways</h2>

      <div className="legi-mode">
        <div className="legi-mode-head">
          <strong>1 · How it reads (perceptual)</strong>
        </div>
        <p className="hint">
          Puts the type on the 3D screen so you can view it <em>from the viewer's
          eyes</em> at the real distance — the true test of legibility.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={s.typeShowSpecimen}
            onChange={(e) => s.set('typeShowSpecimen', e.target.checked)}
          />
          Show type specimen on the screen
        </label>
        {s.typeShowSpecimen && s.cameraView !== 'first-person' && (
          <button className="ghost" onClick={() => s.set('cameraView', 'first-person')}>
            👁 View from their eyes →
          </button>
        )}
      </div>

      <div className="legi-mode">
        <div className="legi-mode-head">
          <strong>2 · Actual size (physical)</strong>
        </div>
        <p className="hint">
          Draws the type at its real physical size <em>on your own monitor</em> — hold
          a ruler to it. Needs a one-time calibration so we know your screen's pixel
          density.
        </p>
        {s.screenPpi ? (
          <>
            <button className="ghost" onClick={() => setTrueScale(true)}>
              Open true-scale preview
            </button>
            <p className="hint">
              Calibrated at {Math.round(s.screenPpi)} PPI ·{' '}
              <button className="linklike" onClick={() => setCalibrating(true)}>
                re-calibrate
              </button>
            </p>
          </>
        ) : (
          <button className="ghost" onClick={() => setCalibrating(true)}>
            Calibrate my display to enable
          </button>
        )}
      </div>

      {calibrating && <CalibrationModal onClose={() => setCalibrating(false)} />}
      {trueScale && (
        <TrueScalePreview
          onClose={() => setTrueScale(false)}
          onCalibrate={() => {
            setTrueScale(false);
            setCalibrating(true);
          }}
        />
      )}
    </div>
  );
}
