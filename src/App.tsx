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
import { ProjectionControls } from './projection/ProjectionControls';
import { ProjectionScene } from './projection/ProjectionScene';
import { TableControls } from './table/TableControls';
import { TableElevation } from './table/TableElevation';
import { TableScene } from './table/TableScene';
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
  const isProjection = appTab === 'projection';
  const isTable = appTab === 'table';
  const isPlacement = appTab === 'placement';

  const tag = isDvled
    ? 'dvLED viewing-distance preview'
    : isProjection
      ? 'single-projector throw & photometric simulator'
      : isTable
        ? 'horizontal table — reach depth · ADA · seated access'
        : 'touch reach · viewing distance · pixel pitch';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>Installation Screen Multitool</strong>
          <span className="tag">{tag}</span>
        </div>
        <div className="topbar-controls">
          <span className="seg tabs">
            <button
              className={isPlacement ? 'on' : ''}
              onClick={() => set('appTab', 'placement')}
            >
              Monitor Placement
            </button>
            <button
              className={isTable ? 'on' : ''}
              onClick={() => set('appTab', 'table')}
            >
              Table Monitor
            </button>
            <button
              className={isDvled ? 'on' : ''}
              onClick={() => set('appTab', 'dvled')}
            >
              dvLED preview
            </button>
            <button
              className={isProjection ? 'on' : ''}
              onClick={() => set('appTab', 'projection')}
            >
              Projection
            </button>
          </span>
          {(isPlacement || isTable) && (
            <span className="seg">
              <button className={!is2d ? 'on' : ''} onClick={() => set('stageView', '3d')}>
                3D
              </button>
              <button className={is2d ? 'on' : ''} onClick={() => set('stageView', '2d')}>
                2D plan
              </button>
            </span>
          )}
          {isPlacement && !is2d && (
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
          ) : isProjection ? (
            <ProjectionControls />
          ) : isTable ? (
            <TableControls />
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
          ) : isProjection ? (
            <ProjectionScene />
          ) : isTable ? (
            is2d ? <TableElevation /> : <TableScene />
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
