// The Save / Share entry point in the top bar. Autosave to localStorage is
// silent (handled by the store's persist middleware); this menu exposes the
// explicit actions: a share link, a JSON project file, and the spec sheet.

import { useEffect, useRef, useState } from 'react';
import { serialize, validateAndApply } from '../store/snapshot';
import { useConfigStore } from '../store/useConfigStore';
import { buildShareUrl } from '../share/shareUrl';
import { SpecSheetModal } from '../export/specSheet';

type Flash = { text: string; tone: 'ok' | 'err' } | null;

export function SaveMenu() {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [specOpen, setSpecOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const say = (text: string, tone: 'ok' | 'err' = 'ok') => {
    setFlash({ text, tone });
    window.setTimeout(() => setFlash(null), 3500);
  };

  async function copyShareLink() {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(buildShareUrl());
      say('Link copied — uploaded images aren’t included.');
    } catch {
      say('Couldn’t copy to clipboard.', 'err');
    }
  }

  function exportJson() {
    setOpen(false);
    const snap = serialize(useConfigStore.getState(), { includeContent: true });
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'installation-config.iimt.json';
    a.click();
    URL.revokeObjectURL(url);
    say('Config exported.');
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const patch = validateAndApply(JSON.parse(String(reader.result)));
        if (Object.keys(patch).length === 0) {
          say('No recognizable settings in that file.', 'err');
          return;
        }
        useConfigStore.setState(patch);
        say('Config imported.');
      } catch {
        say('Couldn’t read that file as a config.', 'err');
      }
    };
    reader.onerror = () => say('Couldn’t read that file.', 'err');
    reader.readAsText(file);
  }

  return (
    <div className="save-menu" ref={wrapRef}>
      <button className="save-btn" onClick={() => setOpen((o) => !o)}>
        Save / Share ▾
      </button>
      {open && (
        <div className="save-dropdown">
          <button onClick={copyShareLink}>Copy share link</button>
          <button onClick={exportJson}>Export config (JSON)…</button>
          <button onClick={() => { setOpen(false); fileRef.current?.click(); }}>Import config (JSON)…</button>
          <div className="save-sep" />
          <button onClick={() => { setOpen(false); setSpecOpen(true); }}>Export spec sheet…</button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      {flash && <span className={`save-flash ${flash.tone}`}>{flash.text}</span>}
      {specOpen && <SpecSheetModal onClose={() => setSpecOpen(false)} />}
    </div>
  );
}
