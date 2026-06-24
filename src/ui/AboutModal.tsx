import { useEffect } from 'react';

const TABS: { name: string; blurb: string }[] = [
  {
    name: 'Monitor Placement',
    blurb:
      'Touch reach (ADA), viewing angle, and pixel pitch for a wall-mounted screen — with a "view from their eyes" first-person check.',
  },
  {
    name: 'Table Monitor',
    blurb:
      'Horizontal / table touch surfaces: reach depth across the surface, ADA, and seated access.',
  },
  {
    name: 'dvLED preview',
    blurb:
      'How an LED wall reads from a given viewing distance at a chosen pixel pitch — where it resolves cleanly vs shows its pixels.',
  },
  {
    name: 'Projection',
    blurb:
      'Single-projector throw geometry plus photometrics: image size, foot-candles, ambient contrast, lens shift/tilt, and edge-blended arrays.',
  },
  {
    name: 'Sensor Coverage',
    blurb:
      'Camera / depth-sensor field of view, usable range, and blind zones — and the floor area where a body would actually be tracked.',
  },
  {
    name: 'Speaker SPL',
    blurb:
      'Speaker directivity, inverse-square dropoff, and overlap across the room, with a "loud enough for this room?" dBA verdict and amp power budget.',
  },
];

export function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="About this tool"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <strong>About this tool</strong>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-disclaimer">
            <strong>For illustration and early-stage planning only.</strong> Every
            tab is a <em>simplified</em> model — it leaves out real-world factors
            like room acoustics and reflections, optical surface behaviour, speaker
            frequency response, ambient variation, and mounting tolerances. Numbers
            here may be inaccurate or incomplete.
            <br />
            <br />
            Use it to build intuition and frame conversations — <b>not</b> as
            engineering sign-off. Always do your own math and confirm against
            manufacturer spec sheets and on-site measurement before you specify,
            quote, or install anything.
          </div>

          <h3 className="modal-subhead">What each tab is for</h3>
          <ul className="modal-tabs">
            {TABS.map((t) => (
              <li key={t.name}>
                <span className="modal-tab-name">{t.name}</span>
                <span className="modal-tab-blurb">{t.blurb}</span>
              </li>
            ))}
          </ul>

          <p className="modal-foot">
            No backend — it runs entirely in your browser, and uploaded content never
            leaves it.
          </p>
        </div>
      </div>
    </div>
  );
}
