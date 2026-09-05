import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Save, Trash2, X } from 'lucide-react';
import type { MapGraph, MapNode } from '@/App';

export type ComparisonRow = {
  id: string;
  label: string;
  values: Record<string, string>;
};

function collectTags(node: MapNode) {
  return new Set((node.flashcards ?? []).flatMap((card) => card.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean));
}

function createRows(nodes: MapNode[], graph: MapGraph): ComparisonRow[] {
  const childrenByNode = new Map(nodes.map((node) => [
    node.id,
    graph.edges.filter((edge) => edge.from === node.id)
      .map((edge) => graph.nodes.find((child) => child.id === edge.to))
      .filter((child): child is MapNode => Boolean(child)),
  ]));
  const childNames = nodes.map((node) => new Set((childrenByNode.get(node.id) ?? []).map((child) => child.text.trim().toLowerCase())));
  const sharedChildren = childNames[0]
    ? [...childNames[0]].filter((name) => childNames.every((set) => set.has(name)))
    : [];
  const tagSets = nodes.map(collectTags);
  const sharedTags = tagSets[0] ? [...tagSets[0]].filter((tag) => tagSets.every((set) => set.has(tag))) : [];
  const unionCategories = Array.from(new Map(
    nodes.flatMap((node) => childrenByNode.get(node.id) ?? []).map((child) => [child.text.trim().toLowerCase(), child.text]),
  ).values());
  const summary: ComparisonRow[] = [
    {
      id: crypto.randomUUID(),
      label: 'Shared child categories',
      values: Object.fromEntries(nodes.map((node) => [node.id, sharedChildren.join(', ') || 'None identified'])),
    },
    {
      id: crypto.randomUUID(),
      label: 'Unique child categories',
      values: Object.fromEntries(nodes.map((node, index) => [
        node.id,
        [...childNames[index]].filter((name) => !childNames.some((set, other) => other !== index && set.has(name))).join(', ') || 'None identified',
      ])),
    },
    {
      id: crypto.randomUUID(),
      label: 'Overlapping tags',
      values: Object.fromEntries(nodes.map((node) => [node.id, sharedTags.join(', ') || 'None identified'])),
    },
    {
      id: crypto.randomUUID(),
      label: 'Distinguishing information',
      values: Object.fromEntries(nodes.map((node) => [
        node.id,
        node.details?.distinguishingFeatures?.trim()
          || node.details?.keyDiagnosticFeatures.trim()
          || node.details?.notes.trim()
          || 'Add distinguishing information',
      ])),
    },
  ];
  const categoryRows = unionCategories.map<ComparisonRow>((category) => ({
    id: crypto.randomUUID(),
    label: category,
    values: Object.fromEntries(nodes.map((node) => {
      const child = (childrenByNode.get(node.id) ?? []).find((item) => item.text.trim().toLowerCase() === category.toLowerCase());
      return [
        node.id,
        child
          ? child.details?.keyDiagnosticFeatures.trim() || child.details?.notes.trim() || child.text
          : '—',
      ];
    })),
  }));
  return [...summary, ...categoryRows];
}

export function CompareNodesWorkspace({
  nodes,
  graph,
  onClose,
  onSaveAsMap,
}: {
  nodes: MapNode[];
  graph: MapGraph;
  onClose: () => void;
  onSaveAsMap: (title: string, rows: ComparisonRow[]) => void;
}) {
  const [title, setTitle] = useState(`${nodes.map((node) => node.text).join(' vs ')}`);
  const [rows, setRows] = useState(() => createRows(nodes, graph));

  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  const updateRow = (rowId: string, update: (row: ComparisonRow) => ComparisonRow) =>
    setRows((current) => current.map((row) => row.id === rowId ? update(row) : row));

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="comparison-workspace" role="dialog" aria-modal="true" aria-label={`Compare ${nodes.map((node) => node.text).join(', ')}`} data-testid="comparison-workspace">
      <header className="comparison-header">
        <div>
          <p>Comparison workspace</p>
          <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Comparison title" />
        </div>
        <div>
          <button type="button" className="comparison-save" onClick={() => onSaveAsMap(title.trim() || 'Node Comparison', rows)} data-testid="save-comparison-map">
            <Save size={16} /> Save Comparison as Map
          </button>
          <button type="button" onClick={onClose} aria-label="Close comparison"><X size={19} /></button>
        </div>
      </header>
      <main className="comparison-content">
        <p className="comparison-help">The app generated these differences from child nodes, flashcard tags, and node details. Edit any cell before saving.</p>
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Category</th>
                {nodes.map((node) => <th key={node.id}>{node.text}</th>)}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th>
                    <textarea value={row.label} onChange={(event) => updateRow(row.id, (value) => ({ ...value, label: event.target.value }))} aria-label="Comparison category" />
                  </th>
                  {nodes.map((node) => (
                    <td key={node.id}>
                      <textarea value={row.values[node.id] ?? ''} onChange={(event) => updateRow(row.id, (value) => ({ ...value, values: { ...value.values, [node.id]: event.target.value } }))} aria-label={`${row.label} for ${node.text}`} />
                    </td>
                  ))}
                  <td><button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} aria-label={`Delete ${row.label}`}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="comparison-add-row" onClick={() => setRows((current) => [...current, {
          id: crypto.randomUUID(),
          label: 'New category',
          values: Object.fromEntries(nodes.map((node) => [node.id, ''])),
        }])}>
          <Plus size={15} /> Add comparison row
        </button>
      </main>
    </div>,
    document.body,
  );
}
