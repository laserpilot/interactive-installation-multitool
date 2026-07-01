import { useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';

/**
 * Mode A — "actual size on your display". Using the calibrated PPI of the
 * DESIGNER's own monitor, each sample is drawn at the exact physical size it
 * will have on the deployed screen. The ruler is the proof: it should measure a
 * real inch/cm against a physical ruler, so the type sizes are trustworthy too.
 */
export function TrueScalePreview({
  onClose,
  onCalibrate,
}: {
  onClose: () => void;
  onCalibrate: () => void;
}) {
  const s = useConfigStore();
  const report = s.getLegibility();
  const ppi = s.screenPpi; // CSS px per inch of the designer's display
  const metric = s.units === 'metric';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Ruler: whole inches, or centimetres. One unit = (ppi) or (ppi/2.54) CSS px.
  const pxPerUnit = ppi ? (metric ? ppi / 2.54 : ppi) : 0;
  const unitLabel = metric ? 'cm' : 'in';
  const unitCount = metric ? 15 : 6;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="True-scale preview"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <strong>True-scale preview — actual size on your display</strong>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!ppi ? (
            <div>
              <p>
                Calibrate your display first. Then every line here is drawn at the{' '}
                <strong>real physical size</strong> it will have on the deployed
                screen — hold a ruler to your monitor to confirm.
              </p>
              <button className="primary" onClick={onCalibrate}>
                Calibrate now
              </button>
            </div>
          ) : (
            <>
              <p className="hint">
                Each line is at the exact size it will appear on the screen. Hold a
                physical ruler to your monitor — the bar below should measure a true{' '}
                {unitLabel}.{' '}
                <button className="linklike" onClick={onCalibrate}>
                  Re-calibrate ({Math.round(ppi)} PPI)
                </button>
              </p>

              {/* True-scale ruler */}
              <div
                className="ts-ruler"
                style={{ width: `${pxPerUnit * unitCount}px` }}
              >
                {Array.from({ length: unitCount }, (_, i) => (
                  <span key={i} className="ts-tick" style={{ width: `${pxPerUnit}px` }}>
                    {i + 1}
                  </span>
                ))}
                <span className="ts-ruler-label">{unitLabel}</span>
              </div>

              {/* Samples at true physical size */}
              <div className="ts-samples">
                {s.typeSamples.map((sample, i) => {
                  const r = report.samples[i];
                  if (!r) return null;
                  const emPx = r.physicalHeightIn * ppi; // CSS px = physical em height
                  const physLabel = metric
                    ? `${(r.capHeightIn * 25.4).toFixed(1)} mm cap`
                    : `${r.capHeightIn.toFixed(2)}″ cap`;
                  return (
                    <div key={i} className="ts-sample">
                      <div className="ts-sample-meta">
                        <span className="ts-sample-name">
                          {sample.label} · {Math.round(sample.fontPx)}px
                        </span>
                        <span className="ts-sample-phys">{physLabel}</span>
                        <span className={`legi-badge legi-${r.level}`}>
                          {r.capArcmin.toFixed(0)}′ @ {(s.mode === 'touch' ? "arm's length" : 'set distance')}
                        </span>
                      </div>
                      <div
                        className="ts-sample-text"
                        style={{ fontSize: `${emPx}px`, lineHeight: 1.1 }}
                      >
                        {s.typeSampleText || 'The quick brown fox'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="modal-foot">
                Sizes assume your artboard ({Math.round(s.typeArtboardPx)}px wide) maps
                across the full screen width. Big type may run off the panel — scroll to
                see it. This shows physical size only; for how it <em>reads</em> from a
                distance, use “Show type specimen on screen” and enter first-person.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
