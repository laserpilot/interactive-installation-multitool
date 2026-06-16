import { useRef } from 'react';
import { useConfigStore } from '../store/useConfigStore';

export function ContentUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const contentUrl = useConfigStore((s) => s.contentUrl);
  const setContent = useConfigStore((s) => s.setContent);
  const set = useConfigStore((s) => s.set);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setContent(url);
    // Auto-fill native horizontal resolution from the image so pixel metrics
    // reflect the real asset.
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        set('resMode', 'pixels');
        set('horizontalPixels', img.naturalWidth);
      }
    };
    img.src = url;
  }

  return (
    <div className="upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        hidden
      />
      <button className="ghost" onClick={() => inputRef.current?.click()}>
        {contentUrl ? 'Replace image' : 'Upload screen content'}
      </button>
      {contentUrl && (
        <button className="ghost" onClick={() => setContent(null)}>
          Clear
        </button>
      )}
      <p className="hint">Stays in your browser — nothing is uploaded.</p>
    </div>
  );
}
