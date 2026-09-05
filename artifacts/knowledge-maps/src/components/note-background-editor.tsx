import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import {
  deleteNoteBackground,
  getNoteBackground,
  setNoteBackground,
  type StoredNoteBackground,
} from '@/lib/node-image-storage';

export type NoteBackgroundSettings = {
  opacity: number;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  fit: 'cover' | 'contain' | 'stretch';
  overlay: 'light' | 'dark';
};

type Props = {
  mapId: string;
  nodeId: string;
  value: string;
  settings?: NoteBackgroundSettings;
  onChange: (value: string) => void;
  onSettingsChange: (settings?: NoteBackgroundSettings) => void;
  onMediaChange: () => void;
};

const defaults: NoteBackgroundSettings = {
  opacity: 70,
  position: 'center',
  fit: 'cover',
  overlay: 'dark',
};

async function detectOverlay(file: File): Promise<'light' | 'dark'> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) return 'dark';
  context.drawImage(bitmap, 0, 0, 32, 32);
  bitmap.close();
  const pixels = context.getImageData(0, 0, 32, 32).data;
  let luminance = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    luminance +=
      pixels[index] * 0.2126 +
      pixels[index + 1] * 0.7152 +
      pixels[index + 2] * 0.0722;
  }
  return luminance / (pixels.length / 4) > 145 ? 'dark' : 'light';
}

export function NoteBackgroundEditor({
  mapId,
  nodeId,
  value,
  settings,
  onChange,
  onSettingsChange,
  onMediaChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [background, setBackground] = useState<StoredNoteBackground>();
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const activeSettings = settings ?? defaults;

  useEffect(() => {
    void getNoteBackground(mapId, nodeId).then(setBackground);
  }, [mapId, nodeId]);

  useEffect(() => {
    if (!background) {
      setSource('');
      return;
    }
    const url = URL.createObjectURL(background.blob);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [background]);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    setError('');
    try {
      const overlay = await detectOverlay(file);
      const stored = await setNoteBackground(mapId, nodeId, file);
      setBackground(stored);
      onSettingsChange({ ...activeSettings, overlay });
      onMediaChange();
    } catch {
      setError('This image could not be read. Choose another JPG, PNG, or WebP.');
    }
  };

  const remove = async () => {
    await deleteNoteBackground(mapId, nodeId);
    setBackground(undefined);
    onSettingsChange(undefined);
    onMediaChange();
  };

  const imageSize =
    activeSettings.fit === 'stretch' ? '100% 100%' : activeSettings.fit;

  return (
    <div className="node-details-field note-background-section">
      <div className="note-background-heading">
        <label htmlFor="node-details-notes">Notes</label>
        <button type="button" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={14} aria-hidden="true" />
          Set Background Image
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={(event) => void upload(event.target.files?.[0])}
          hidden
          data-testid="input-note-background"
        />
      </div>
      <div
        className={`note-background-canvas overlay-${activeSettings.overlay}`}
      >
        {source ? (
          <div
            className="note-background-image"
            style={{
              backgroundImage: `url(${source})`,
              backgroundPosition: activeSettings.position,
              backgroundSize: imageSize,
              opacity: activeSettings.opacity / 100,
            }}
          />
        ) : null}
        {source ? <div className="note-background-overlay" /> : null}
        <textarea
          id="node-details-notes"
          rows={6}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-testid="input-node-details-notes"
        />
      </div>
      {error ? <p className="node-details-error">{error}</p> : null}
      {source ? (
        <div className="note-background-controls">
          <label>
            Opacity
            <input
              type="range"
              min="10"
              max="100"
              value={activeSettings.opacity}
              onChange={(event) =>
                onSettingsChange({
                  ...activeSettings,
                  opacity: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Position
            <select
              value={activeSettings.position}
              onChange={(event) =>
                onSettingsChange({
                  ...activeSettings,
                  position: event.target.value as NoteBackgroundSettings['position'],
                })
              }
            >
              {['center', 'top', 'bottom', 'left', 'right'].map((position) => (
                <option key={position} value={position}>{position[0].toUpperCase() + position.slice(1)}</option>
              ))}
            </select>
          </label>
          <label>
            Fit
            <select
              value={activeSettings.fit}
              onChange={(event) =>
                onSettingsChange({
                  ...activeSettings,
                  fit: event.target.value as NoteBackgroundSettings['fit'],
                })
              }
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="stretch">Stretch</option>
            </select>
          </label>
          <button type="button" className="note-background-remove" onClick={() => void remove()}>
            <Trash2 size={14} aria-hidden="true" />
            Remove background image
          </button>
        </div>
      ) : null}
    </div>
  );
}
