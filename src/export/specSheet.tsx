// The spec-sheet modal: renders the model (see specModel.ts) and offers
// Print / Save-PDF and a Markdown download. The document surface is light so it
// reads as a real handout regardless of the dark app theme.

import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { buildSpecModel, toMarkdown, VLEVEL } from './specModel';

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function SpecSheetModal({ onClose }: { onClose: () => void }) {
  const s = useConfigStore();
  const [allTools, setAllTools] = useState(false);
  const model = useMemo(() => buildSpecModel(s), [s]);

  const visible = allTools ? model.sections : model.sections.filter((sec) => sec.id === s.appTab);
  const shown = { ...model, sections: visible };

  return (
    <div className="spec-overlay" onClick={onClose}>
      <div className="spec-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="spec-actions">
          <label className="spec-toggle">
            <input type="checkbox" checked={allTools} onChange={(e) => setAllTools(e.target.checked)} />
            All tools
          </label>
          <span className="spec-spacer" />
          <button onClick={() => download('installation-spec.md', toMarkdown(shown), 'text/markdown')}>
            ⤓ Markdown
          </button>
          <button onClick={() => window.print()}>🖨 Print / Save PDF</button>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="spec-doc">
          <h1>{model.title}</h1>
          <p className="spec-meta">
            Generated {model.savedAt} · Units: {model.unitsLabel}
          </p>
          {visible.map((sec) => (
            <section key={sec.id} className="spec-section">
              <h2>{sec.title}</h2>
              {sec.verdict && (
                <p className={`spec-verdict tone-${sec.verdict.tone}`}>
                  {VLEVEL[sec.verdict.tone]} — {sec.verdict.text}
                </p>
              )}
              <table>
                <tbody>
                  {sec.rows.map(([label, value]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
