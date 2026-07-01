import { useEffect, useState } from 'react';
import { useConfigStore } from '../store/useConfigStore';

// A standard ID-1 card (credit/ID/driver's licence) is 85.60 mm wide — ISO/IEC
// 7810. Everyone has one, and it's rigid, so it's the most reliable physical
// ruler for on-screen calibration. Width in inches:
const CARD_WIDTH_IN = 85.6 / 25.4; // ≈ 3.370"
const CARD_ASPECT = 53.98 / 85.6; // ID-1 height/width

/** CSS px per inch implied by rendering the card `cardPx` wide. */
function ppiFromCardPx(cardPx: number): number {
  return cardPx / CARD_WIDTH_IN;
}
function cardPxFromPpi(ppi: number): number {
  return ppi * CARD_WIDTH_IN;
}

export function CalibrationModal({ onClose }: { onClose: () => void }) {
  const s = useConfigStore();
  // Seed the slider from a prior calibration, else a typical laptop ~110 PPI.
  const [cardPx, setCardPx] = useState<number>(() =>
    s.screenPpi ? cardPxFromPpi(s.screenPpi) : cardPxFromPpi(110),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ppi = ppiFromCardPx(cardPx);
  const cardH = cardPx * CARD_ASPECT;

  const save = () => {
    s.set('screenPpi', Math.round(ppi * 10) / 10);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Calibrate your display"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <strong>Calibrate your display</strong>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p>
            Hold a <strong>credit card, ID, or driver's licence</strong> up to the
            screen and drag the slider until the outline matches its real size. This
            teaches the tool your monitor's pixel density so it can show type at true
            physical scale.
          </p>

          <div className="calib-card-wrap">
            <div
              className="calib-card"
              style={{ width: `${cardPx}px`, height: `${cardH}px` }}
            >
              <span className="calib-card-note">85.6 mm</span>
            </div>
          </div>

          <input
            className="slider"
            type="range"
            min={cardPxFromPpi(60)}
            max={cardPxFromPpi(280)}
            step={0.5}
            value={cardPx}
            onChange={(e) => setCardPx(Number(e.target.value))}
          />

          <p className="calib-readout">
            ≈ <strong>{Math.round(ppi)} PPI</strong>{' '}
            <span className="hint">(CSS pixels per inch)</span>
          </p>

          <div className="calib-actions">
            <button className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" onClick={save}>
              This matches — save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
