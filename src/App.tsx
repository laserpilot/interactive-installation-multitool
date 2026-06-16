import { PERSONAS } from './ergonomics/constants';
import { useConfigStore } from './store/useConfigStore';
import { ControlPanel } from './ui/ControlPanel';
import { UnitToggle } from './ui/UnitToggle';
import { VerdictPanel } from './ui/VerdictPanel';
import { Scene } from './scene/Scene';
import './App.css';

export default function App() {
  const cameraView = useConfigStore((s) => s.cameraView);
  const personaId = useConfigStore((s) => s.personaId);
  const set = useConfigStore((s) => s.set);
  const fp = cameraView === 'first-person';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>Screen Placement Simulator</strong>
          <span className="tag">touch reach · viewing distance · pixel pitch</span>
        </div>
        <div className="topbar-controls">
          <button
            className={`view-toggle ${fp ? 'on' : ''}`}
            onClick={() => set('cameraView', fp ? 'orbit' : 'first-person')}
          >
            {fp
              ? '← Back to room view'
              : `👁 View from ${PERSONAS[personaId].label.split(' ')[0]}'s eyes`}
          </button>
          <UnitToggle />
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <ControlPanel />
          <VerdictPanel />
        </aside>
        <section className="stage">
          <Scene />
          {fp && (
            <div className="fp-hint">
              First-person view at ~55° FOV. If the screen spills past the edges,
              it's too big for this distance.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
