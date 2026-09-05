import { useEffect, useMemo, useState } from 'react';
import { X, Images, AlertCircle } from 'lucide-react';
import { listNodeImages, type StoredNodeImage } from '@/lib/node-image-storage';
import { BlobImage, ImageViewer } from '@/components/node-images-section';
import type { MapGraph, MapNode, NodeDetails } from '@/App';

export function DifferentialView({
  mapId,
  sourceNode,
  graph,
  onClose,
}: {
  mapId: string;
  sourceNode: MapNode;
  graph: MapGraph;
  onClose: () => void;
}) {
  const [imagesMap, setImagesMap] = useState<Record<string, StoredNodeImage[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [viewerImage, setViewerImage] = useState<StoredNodeImage | null>(null);

  const outgoingNodes = useMemo(() => {
    const outgoingNodeIds = new Set(
      graph.edges
        .filter((edge) => edge.from === sourceNode.id)
        .map((edge) => edge.to),
    );
    return graph.nodes.filter((node) => outgoingNodeIds.has(node.id));
  }, [graph, sourceNode.id]);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);

    const loadAllImages = async () => {
      const results: Record<string, StoredNodeImage[]> = {};
      await Promise.all(
        outgoingNodes.map(async (node) => {
          try {
            const images = await listNodeImages(mapId, node.id);
            if (isActive) {
              results[node.id] = images;
            }
          } catch {
            if (isActive) {
              results[node.id] = [];
            }
          }
        }),
      );
      if (isActive) {
        setImagesMap(results);
        setIsLoading(false);
      }
    };

    loadAllImages();

    return () => {
      isActive = false;
    };
  }, [mapId, outgoingNodes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !viewerImage) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, viewerImage]);

  return (
    <div className="differential-view-overlay" role="dialog" aria-modal="true">
      <div className="differential-view-container">
        <header className="differential-view-header">
          <div className="differential-view-title-block">
            <span className="differential-kicker">Differential View</span>
            <h2>{sourceNode.text}</h2>
          </div>
          <button
            type="button"
            className="differential-close"
            onClick={onClose}
            aria-label="Close Differential View"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <div className="differential-view-content">
          {outgoingNodes.length === 0 ? (
            <div className="differential-empty-state">
              <AlertCircle size={32} strokeWidth={1.5} className="empty-icon" />
              <h3>No connected diagnoses</h3>
              <p>
                To compare diagnoses, draw connections from "{sourceNode.text}"
                to other nodes.
              </p>
            </div>
          ) : (
            <div className="differential-grid">
              {outgoingNodes.map((node) => {
                const details = (node.details || {}) as Partial<NodeDetails>;
                const images = imagesMap[node.id] || [];

                return (
                  <article key={node.id} className="differential-card">
                    <header className="diff-card-header">
                      <h3>{node.text}</h3>
                    </header>

                    <div className="diff-card-body">
                      <section className="diff-section">
                        <h4>Key features</h4>
                        {details.keyDiagnosticFeatures ? (
                          <p className="diff-text">
                            {details.keyDiagnosticFeatures}
                          </p>
                        ) : (
                          <p className="diff-empty">No key features noted</p>
                        )}
                      </section>

                      <section className="diff-section diff-images-section">
                        <h4>
                          <Images size={14} className="inline-icon" /> Important
                          images
                          {images.length > 0 ? ` (${images.length})` : ''}
                        </h4>
                        {isLoading ? (
                          <p className="diff-empty">Loading images...</p>
                        ) : images.length > 0 ? (
                          <div className="diff-images-grid">
                            {images.map((image) => (
                              <button
                                key={image.id}
                                type="button"
                                className="diff-image-btn"
                                onClick={() => setViewerImage(image)}
                                aria-label={`View image ${image.caption || image.name}`}
                              >
                                <BlobImage
                                  image={image}
                                  className="diff-image-thumb"
                                />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="diff-empty">No images attached</p>
                        )}
                      </section>

                      <section className="diff-section">
                        <h4>Immunohistochemistry</h4>
                        {details.immunohistochemistry ? (
                          <p className="diff-text">
                            {details.immunohistochemistry}
                          </p>
                        ) : (
                          <p className="diff-empty">No IHC noted</p>
                        )}
                      </section>

                      <section className="diff-section diff-highlight">
                        <h4>Distinguishing features</h4>
                        {details.distinguishingFeatures ? (
                          <p className="diff-text">
                            {details.distinguishingFeatures}
                          </p>
                        ) : (
                          <p className="diff-empty">
                            No distinguishing features noted
                          </p>
                        )}
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {viewerImage && (
        <ImageViewer
          image={viewerImage}
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  );
}
