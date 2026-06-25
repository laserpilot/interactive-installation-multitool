import { useEffect, useState } from 'react';
import { PERSONAS } from './ergonomics/constants';
import { useConfigStore } from './store/useConfigStore';
import { consumeShareHash } from './share/shareUrl';
import { AboutModal } from './ui/AboutModal';
import { ControlPanel } from './ui/ControlPanel';
import { HelpPanel } from './ui/HelpPanel';
import { SaveMenu } from './ui/SaveMenu';
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
import { TableVerdictPanel } from './table/TableVerdictPanel';
import { SensorControls } from './sensor/SensorControls';
import { SensorScene } from './sensor/SensorScene';
import { SpeakerControls } from './speaker/SpeakerControls';
import { SpeakerScene } from './speaker/SpeakerScene';
import './App.css';

export default function App() {
  const cameraView = useConfigStore((s) => s.cameraView);
  const stageView = useConfigStore((s) => s.stageView);
  const appTab = useConfigStore((s) => s.appTab);
  const personaId = useConfigStore((s) => s.personaId);
  const fpFov = useConfigStore((s) => s.fpFov);
  const set = useConfigStore((s) => s.set);
  const [aboutOpen, setAboutOpen] = useState(false);

  // A share link overrides the autosaved state for this visit, then clears the hash.
  useEffect(() => {
    consumeShareHash();
  }, []);
  const fp = cameraView === 'first-person';
  const is2d = stageView === '2d';
  const isDvled = appTab === 'dvled';
  const isProjection = appTab === 'projection';
  const isTable = appTab === 'table';
  const isSensor = appTab === 'sensor';
  const isSpeaker = appTab === 'speaker';
  const isPlacement = appTab === 'placement';

  const tag = isDvled
    ? 'LED Display viewing-distance preview'
    : isProjection
      ? 'single-projector throw & photometric simulator'
      : isTable
        ? 'horizontal table — reach depth · ADA · seated access'
        : isSensor
          ? 'camera / depth-sensor coverage — FOV · range · blind zones'
          : isSpeaker
            ? 'speaker SPL coverage — directivity · dropoff · overlap · dBA verdict'
            : 'touch reach · viewing distance · pixel pitch';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>Interactive Installation Multitool</strong>
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
              LED Display preview
            </button>
            <button
              className={isProjection ? 'on' : ''}
              onClick={() => set('appTab', 'projection')}
            >
              Projection
            </button>
            <button
              className={isSensor ? 'on' : ''}
              onClick={() => set('appTab', 'sensor')}
            >
              Sensor Coverage
            </button>
            <button
              className={isSpeaker ? 'on' : ''}
              onClick={() => set('appTab', 'speaker')}
            >
              Speaker SPL
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
          <SaveMenu />
          <button className="about-btn" onClick={() => setAboutOpen(true)}>
            About
          </button>
        </div>
      </header>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

      <main className="layout">
        <aside className="sidebar">
          {isDvled ? (
            <DvLedControls />
          ) : isProjection ? (
            <ProjectionControls />
          ) : isTable ? (
            <TableControls />
          ) : isSensor ? (
            <SensorControls />
          ) : isSpeaker ? (
            <SpeakerControls />
          ) : (
            <>
              <HelpPanel />
              <ControlPanel />
            </>
          )}
        </aside>
        <section className="stage">
          {isDvled ? (
            <DvLedPreview />
          ) : isProjection ? (
            <ProjectionScene />
          ) : isSensor ? (
            <SensorScene />
          ) : isSpeaker ? (
            <SpeakerScene />
          ) : isTable ? (
            <div className="proj-stage">
              <div className="proj-frame">{is2d ? <TableElevation /> : <TableScene />}</div>
              <TableVerdictPanel />
            </div>
          ) : (
            <div className="proj-stage">
              <div className="proj-frame">
                {is2d ? (
                  <SideElevation />
                ) : (
                  <>
                    <Scene />
                    {fp && (
                      <div className="fp-hint">
                        First-person view at ~{Math.round(fpFov)}° FOV · drag to look around.
                        If the screen spills past the edges, it's too big for this distance.
                      </div>
                    )}
                  </>
                )}
              </div>
              <VerdictPanel />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
