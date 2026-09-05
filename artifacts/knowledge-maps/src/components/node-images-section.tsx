import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Trash2, X } from 'lucide-react';
import {
  addNodeImage,
  deleteNodeImage,
  listNodeImages,
  type StoredNodeImage,
  updateNodeImageCaption,
} from '../lib/node-image-storage';

export function BlobImage({
  image,
  className,
}: {
  image: StoredNodeImage;
  className: string;
}) {
  const source = useMemo(() => URL.createObjectURL(image.blob), [image.blob]);

  useEffect(() => () => URL.revokeObjectURL(source), [source]);

  return (
    <img
      className={className}
      src={source}
      alt={image.caption || image.name}
    />
  );
}

export function ImageViewer({
  image,
  onClose,
}: {
  image: StoredNodeImage;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="node-image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={image.caption || image.name}
      data-testid="node-image-viewer"
      onClick={onClose}
    >
      <button
        type="button"
        className="node-image-viewer-close"
        onClick={onClose}
        aria-label="Close image viewer"
        data-testid="button-close-image-viewer"
      >
        <X size={20} aria-hidden="true" />
      </button>
      <figure onClick={(event) => event.stopPropagation()}>
        <BlobImage image={image} className="node-image-viewer-image" />
        {image.caption ? <figcaption>{image.caption}</figcaption> : null}
      </figure>
    </div>,
    document.body,
  );
}

export function NodeImagesSection({
  mapId,
  nodeId,
  onChange,
  onMutation,
  onSaveStatusChange,
  refreshToken = 0,
}: {
  mapId: string;
  nodeId: string;
  onChange?: () => void;
  onMutation?: (nodeId: string, previousImages: StoredNodeImage[]) => void;
  onSaveStatusChange?: (status: 'saving' | 'saved') => void;
  refreshToken?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const captionSaveQueueRef = useRef(new Map<string, Promise<void>>());
  const [images, setImages] = useState<StoredNodeImage[]>([]);
  const [viewerImage, setViewerImage] = useState<StoredNodeImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError('');

    listNodeImages(mapId, nodeId)
      .then((storedImages) => {
        if (isActive) setImages(storedImages);
      })
      .catch(() => {
        if (isActive) setError('Images could not be loaded in this browser.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [mapId, nodeId, refreshToken]);

  const handleFiles = async (files: FileList | null) => {
    const imageFiles = Array.from(files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (imageFiles.length === 0) return;

    setIsUploading(true);
    setError('');
    onSaveStatusChange?.('saving');
    try {
      const previousImages = images;
      const addedImages = await Promise.all(
        imageFiles.map((file) => addNodeImage(mapId, nodeId, file)),
      );
      setImages((currentImages) => [...currentImages, ...addedImages]);
      onMutation?.(nodeId, previousImages);
      onChange?.();
    } catch {
      setError('One or more images could not be saved.');
    } finally {
      setIsUploading(false);
      onSaveStatusChange?.('saved');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleCaptionChange = (image: StoredNodeImage, caption: string) => {
    const updatedImage = { ...image, caption };
    setImages((currentImages) =>
      currentImages.map((candidate) =>
        candidate.id === image.id ? updatedImage : candidate,
      ),
    );
    setViewerImage((currentImage) =>
      currentImage?.id === image.id ? updatedImage : currentImage,
    );
    const previousSave =
      captionSaveQueueRef.current.get(image.id) ?? Promise.resolve();
    const nextSave = previousSave
      .catch(() => undefined)
      .then(() => updateNodeImageCaption(updatedImage, caption))
      .then(() => undefined)
      .catch(() => {
        setError('The image caption could not be saved.');
      });
    captionSaveQueueRef.current.set(image.id, nextSave);
    onChange?.();
  };

  const removeImage = async (image: StoredNodeImage) => {
    if (!window.confirm('Remove this image from the node?')) return;

    setError('');
    onSaveStatusChange?.('saving');
    try {
      const previousImages = images;
      await deleteNodeImage(image.id);
      setImages((currentImages) =>
        currentImages.filter((candidate) => candidate.id !== image.id),
      );
      if (viewerImage?.id === image.id) setViewerImage(null);
      onMutation?.(nodeId, previousImages);
      onChange?.();
    } catch {
      setError('The image could not be removed.');
    } finally {
      onSaveStatusChange?.('saved');
    }
  };

  return (
    <section className="node-images-section" aria-labelledby="node-images-title">
      <div className="node-images-heading">
        <div>
          <h3 id="node-images-title">Images</h3>
          <p>Representative cytology, histology, or reference images.</p>
        </div>
        <button
          type="button"
          className="node-images-upload"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          data-testid="button-upload-node-images"
        >
          <ImagePlus size={15} aria-hidden="true" />
          {isUploading ? 'Uploading…' : 'Add Images'}
        </button>
        <input
          ref={inputRef}
          className="node-images-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => handleFiles(event.target.files)}
          data-testid="input-node-images"
        />
      </div>

      {error ? (
        <p className="node-images-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="node-images-empty">Loading images…</p>
      ) : images.length === 0 ? (
        <p className="node-images-empty">
          No images yet. Add one or several images for this node.
        </p>
      ) : (
        <div className="node-images-grid" data-testid="node-images-grid">
          {images.map((image) => (
            <article className="node-image-card" key={image.id}>
              <button
                type="button"
                className="node-image-thumbnail"
                onClick={() => setViewerImage(image)}
                aria-label={`View ${image.caption || image.name}`}
                data-testid={`node-image-thumbnail-${image.id}`}
              >
                <BlobImage image={image} className="node-image-thumbnail-image" />
              </button>
              <input
                type="text"
                value={image.caption}
                placeholder="Optional caption"
                aria-label={`Caption for ${image.name}`}
                onChange={(event) =>
                  handleCaptionChange(image, event.target.value)
                }
                data-testid={`input-node-image-caption-${image.id}`}
              />
              <button
                type="button"
                className="node-image-remove"
                onClick={() => removeImage(image)}
                aria-label={`Remove ${image.caption || image.name}`}
                title="Remove image"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      )}

      {viewerImage ? (
        <ImageViewer image={viewerImage} onClose={() => setViewerImage(null)} />
      ) : null}
    </section>
  );
}
