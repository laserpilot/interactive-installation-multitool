import { PERSONAS } from './ergonomics/constants';
import { useConfigStore } from './store/useConfigStore';
import { ControlPanel } from './ui/ControlPanel';
import { HelpPanel } from './ui/HelpPanel';
import { UnitToggle } from './ui/UnitToggle';
import { VerdictPanel } from './ui/VerdictPanel';
import { Scene } from './scene/Scene';
import { SideElevation } from './twod/SideElevation';
import { DvLedControls } from './dvled/DvLedControls';
import { DvLedPreview } from './dvled/DvLedPreview';
import './App.css';

export default function App() {
  const cameraView = useConfigStore((s) => s.cameraView);
  const stageView = useConfigStore((s) => s.stageView);
  const appTab = useConfigStore((s) => s.appTab);
  const personaId = useConfigStore((s) => s.personaId);
  const set = useConfigStore((s) => s.set);
  const fp = cameraView === 'first-person';
  const is2d = stageView === '2d';
  const isDvled = appTab === 'dvled';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>Screen Placement Simulator</strong>
          <span className="tag">
            {isDvled
              ? 'dvLED viewing-distance preview'
              : 'touch reach · viewing distance · pixel pitch'}
          </span>
        </div>
        <div className="topbar-controls">
          <span className="seg tabs">
            <button
              className={!isDvled ? 'on' : ''}
              onClick={() => set('appTab', 'placement')}
            >
              Placement
            </button>
            <button
              className={isDvled ? 'on' : ''}
              onClick={() => set('appTab', 'dvled')}
            >
              dvLED preview
            </button>
          </span>
          {!isDvled && (
            <span className="seg">
              <button className={!is2d ? 'on' : ''} onClick={() => set('stageView', '3d')}>
                3D
              </button>
              <button className={is2d ? 'on' : ''} onClick={() => set('stageView', '2d')}>
                2D plan
              </button>
            </span>
          )}
          {!isDvled && !is2d && (
            <button
              className={`view-toggle ${fp ? 'on' : ''}`}
              onClick={() => set('cameraView', fp ? 'orbit' : 'first-person')}
            >
              {fp
                ? '← Back to room view'
                : `👁 View from ${PERSONAS[personaId].label.split(' ')[0]}'s eyes`}
            </button>
          )}
          <UnitToggle />
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          {isDvled ? (
            <DvLedControls />
          ) : (
            <>
              <HelpPanel />
              <ControlPanel />
              <VerdictPanel />
            </>
          )}
        </aside>
        <section className="stage">
          {isDvled ? (
            <DvLedPreview />
          ) : is2d ? (
            <SideElevation />
          ) : (
            <>
              <Scene />
              {fp && (
                <div className="fp-hint">
                  First-person view at ~55° FOV. If the screen spills past the edges,
                  it's too big for this distance.
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
