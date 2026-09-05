import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { NodeImagesSection } from '@/components/node-images-section';
import {
  NoteBackgroundEditor,
  type NoteBackgroundSettings,
} from '@/components/note-background-editor';
import { DifferentialView } from '@/components/differential-view';
import { StudyMap, type StudyRating } from '@/components/study-map';
import { FlashcardStudy } from '@/components/flashcard-study';
import { CompareNodesWorkspace, type ComparisonRow } from '@/components/compare-nodes';
import { AiReviewSidebar } from '@/components/ai-review-sidebar';
import { useAiOperation } from '@/hooks/use-ai-operation';
import {
  deleteMapImages,
  deleteMapNoteBackgrounds,
  deleteCardImage,
  copyCardImageToNodes,
  deleteMapCardImages,
  duplicateMapImages,
  duplicateMapNoteBackgrounds,
  duplicateMapCardImages,
  getCardImage,
  listNodeImages,
  replaceNodeImages,
  setCardImage,
  type StoredCardImage,
  type StoredNodeImage,
  deleteHomePageBackground,
  deleteMapCardBackground,
  duplicateMapCardBackground,
  getHomePageBackground,
  getMapCardBackground,
  setHomePageBackground,
  setMapCardBackground,
  getMapCanvasBackground,
  setMapCanvasBackground,
  deleteMapCanvasBackground,
  duplicateMapCanvasBackground,
  setFloatingMedia,
  listFloatingMedia,
  deleteFloatingMedia,
  duplicateMapFloatingMedia,
  deleteMapFloatingMedia,
  getFlashcardImage,
  setFlashcardImage,
  deleteFlashcardImage,
  duplicateMapFlashcardImages,
  deleteMapFlashcardImages,
} from '@/lib/node-image-storage';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CirclePlus,
  Copy,
  Folder,
  FolderPlus,
  FileDown,
  Eye,
  EyeOff,
  GitBranch,
  GripHorizontal,
  LayoutTemplate,
  Link2,
  Columns,
  Minus,
  MoreHorizontal,
  Move,
  Paintbrush,
  Printer,
  Pencil,
  Eraser,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Image,
  Video,
} from 'lucide-react';
import {
  Link,
  Route,
  Switch,
  useParams,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const MAPS_STORAGE_KEY = 'knowledge-maps.library';
const NODE_POSITIONS_STORAGE_KEY = 'knowledge-maps.node-positions';
const MAP_GRAPHS_STORAGE_KEY = 'knowledge-maps.graphs';
const MAP_VIEW_STATES_STORAGE_KEY = 'knowledge-maps.view-states';
const HOME_BACKGROUND_STYLE_STORAGE_KEY = 'knowledge-maps.home-background-style';
const MAP_FOLDERS_STORAGE_KEY = 'knowledge-maps.folders';
const MAP_BACKGROUND_STYLES_STORAGE_KEY = 'knowledge-maps.canvas-background-styles';

type BackgroundStyle = {
  color: string;
  fit: 'cover' | 'contain' | 'stretch';
  overlay: boolean;
};

const defaultBackgroundStyle: BackgroundStyle = {
  color: '#f4f0e7',
  fit: 'cover',
  overlay: true,
};

function readMapBackgroundStyle(mapId: string): BackgroundStyle {
  if (typeof window === 'undefined') return defaultBackgroundStyle;
  try {
    const all = JSON.parse(window.localStorage.getItem(MAP_BACKGROUND_STYLES_STORAGE_KEY) ?? '{}') as Record<string, Partial<BackgroundStyle>>;
    return { ...defaultBackgroundStyle, ...all[mapId] };
  } catch {
    return defaultBackgroundStyle;
  }
}

function writeMapBackgroundStyle(mapId: string, style: BackgroundStyle) {
  try {
    const all = JSON.parse(window.localStorage.getItem(MAP_BACKGROUND_STYLES_STORAGE_KEY) ?? '{}') as Record<string, BackgroundStyle>;
    window.localStorage.setItem(MAP_BACKGROUND_STYLES_STORAGE_KEY, JSON.stringify({ ...all, [mapId]: style }));
  } catch {
    // Keep the live style even when storage is unavailable.
  }
}

type KnowledgeMap = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  cardBackground?: BackgroundStyle;
  folderId?: string;
};

type MapFolder = {
  id: string;
  name: string;
  createdAt: string;
};

type NodeShape =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'circle'
  | 'oval'
  | 'diamond';

type NodeSize = 'small' | 'medium' | 'large';
type NodeAnimation = 'none' | 'pop' | 'bounce' | 'float' | 'pulse' | 'wiggle' | 'glow';
type NodeAnimationSpeed = 'slow' | 'normal' | 'fast';

export type NodeDetails = {
  notes: string;
  noteBackground?: NoteBackgroundSettings;
  differentialDiagnosis: string;
  keyDiagnosticFeatures: string;
  distinguishingFeatures?: string;
  immunohistochemistry: string;
  molecularFindings: string;
  references: string;
};

type NodeDetailsDraft = NodeDetails & {
  title: string;
};

export type MapNode = {
  id: string;
  text: string;
  x: number;
  y: number;
  shape?: NodeShape;
  size?: NodeSize;
  details?: NodeDetails;
  cardStyle?: CardStyle;
  masteryScore?: number;
  studyEnabled?: boolean;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewSchedule?: ReviewSchedule;
  flashcards?: NodeFlashcard[];
};

export type ReviewSchedule = {
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  difficulty: number;
  mastery: number;
  interval: number;
};

export type NodeFlashcard = {
  id?: string;
  question?: string;
  answer?: string;
  explanation?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  sourceNodeId?: string;
  imageName?: string;
  reviewSchedule?: ReviewSchedule;
};

type MasteryStatus = 'new' | 'learning' | 'improving' | 'mastered';

function clampMasteryScore(score: number | undefined) {
  return Math.round(Math.min(100, Math.max(0, Number.isFinite(score) ? score ?? 0 : 0)));
}

function normalizeReviewSchedule(
  schedule: Partial<ReviewSchedule> | undefined,
  legacy?: Pick<MapNode, 'lastReviewedAt' | 'nextReviewAt' | 'masteryScore'>,
): ReviewSchedule {
  return {
    lastReviewedAt: schedule?.lastReviewedAt ?? legacy?.lastReviewedAt,
    nextReviewAt: schedule?.nextReviewAt ?? legacy?.nextReviewAt,
    reviewCount: Math.max(0, Math.round(schedule?.reviewCount ?? 0)),
    correctCount: Math.max(0, Math.round(schedule?.correctCount ?? 0)),
    incorrectCount: Math.max(0, Math.round(schedule?.incorrectCount ?? 0)),
    difficulty: Math.min(10, Math.max(1, schedule?.difficulty ?? 5)),
    mastery: clampMasteryScore(schedule?.mastery ?? legacy?.masteryScore),
    interval: Math.max(0, schedule?.interval ?? 0),
  };
}

function scheduleStudyReview(
  current: ReviewSchedule,
  rating: StudyRating,
  reviewedAt = new Date(),
): ReviewSchedule {
  const difficultyDelta = rating === 'again' ? 0.8 : rating === 'hard' ? 0.3 : rating === 'good' ? -0.1 : -0.5;
  const difficulty = Math.min(10, Math.max(1, current.difficulty + difficultyDelta));
  const masteryDelta = rating === 'again' ? -8 : rating === 'hard' ? 3 : rating === 'good' ? 10 : 15;
  const interval = rating === 'again'
    ? 0.25
    : current.interval <= 0
      ? rating === 'hard' ? 1 : rating === 'good' ? 3 : 5
      : Math.max(
          rating === 'hard' ? 1 : 2,
          current.interval * (
            rating === 'hard'
              ? 1.35 + (10 - difficulty) * 0.04
              : rating === 'good'
                ? 1.9 + (10 - difficulty) * 0.08
                : 2.65 + (10 - difficulty) * 0.1
          ),
        );
  const isIncorrect = rating === 'again';
  return {
    lastReviewedAt: reviewedAt.toISOString(),
    nextReviewAt: new Date(reviewedAt.getTime() + interval * 24 * 60 * 60 * 1000).toISOString(),
    reviewCount: current.reviewCount + 1,
    correctCount: current.correctCount + (isIncorrect ? 0 : 1),
    incorrectCount: current.incorrectCount + (isIncorrect ? 1 : 0),
    difficulty,
    mastery: clampMasteryScore(current.mastery + masteryDelta),
    interval,
  };
}

function isStudyItemDue(schedule: ReviewSchedule, now = new Date()) {
  return !schedule.nextReviewAt || new Date(schedule.nextReviewAt).getTime() <= now.getTime();
}

function getGraphStudyItems(graph: MapGraph) {
  return graph.nodes
    .filter((node) => node.studyEnabled !== false)
    .flatMap((node) => [
      {
        id: `node:${node.id}`,
        nodeId: node.id,
        schedule: normalizeReviewSchedule(node.reviewSchedule, node),
      },
      ...(node.flashcards ?? [])
        .filter((card) => card.question?.trim() && card.answer?.trim())
        .map((card, index) => ({
          id: `flashcard:${node.id}:${card.id ?? index}`,
          nodeId: node.id,
          schedule: normalizeReviewSchedule(card.reviewSchedule),
        })),
    ]);
}

function getMasteryStatus(score: number | undefined): MasteryStatus {
  const value = clampMasteryScore(score);
  if (value >= 80) return 'mastered';
  if (value >= 50) return 'improving';
  if (value >= 25) return 'learning';
  return 'new';
}

function getMasteryStatusLabel(score: number | undefined) {
  const status = getMasteryStatus(score);
  return status === 'new' ? 'New' : status[0].toUpperCase() + status.slice(1);
}

function getNodeStudyWeight(node: MapNode, graph: MapGraph) {
  const extendedNode = node as MapNode & { flashcards?: unknown[] };
  const extendedGraph = graph as MapGraph & { flashcards?: Array<{ nodeId?: string }> };
  const cardCount = (extendedNode.flashcards?.length ?? 0)
    + (extendedGraph.flashcards ?? []).filter((card) => card.nodeId === node.id).length;
  const hasNotes = Boolean(node.details?.notes.trim());
  return 1 + Math.min(2, cardCount * 0.5) + (hasNotes ? 0.25 : 0);
}

function calculateMapMastery(graph: MapGraph) {
  const studyNodes = graph.nodes.filter((node) => node.studyEnabled !== false);
  if (studyNodes.length === 0) return 0;
  const weighted = studyNodes.reduce((total, node) => {
    const weight = getNodeStudyWeight(node, graph);
    return { score: total.score + clampMasteryScore(node.masteryScore) * weight, weight: total.weight + weight };
  }, { score: 0, weight: 0 });
  return Math.round(weighted.score / weighted.weight);
}

type CardStyle = {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  imageMode?: 'card' | 'background';
  imagePosition?: 'above' | 'below' | 'left' | 'right' | 'center' | 'top' | 'bottom';
  imageSize?: number;
  backgroundOpacity?: number;
  backgroundFit?: 'cover' | 'contain' | 'stretch' | 'original';
  backgroundOverlayOpacity?: number;
  readabilityOverlay?: boolean;
  fontFamily?: 'sans' | 'serif' | 'mono' | 'display';
  fontSize?: number;
  fontWeight?: 'normal' | 'semibold' | 'bold';
  fontItalic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  animation?: NodeAnimation;
  animationSpeed?: NodeAnimationSpeed;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
};

export type MapEdge = {
  id: string;
  from: string;
  to: string;
};

export type MapAnnotation = {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
  fontFamily?: 'sans' | 'serif' | 'mono' | 'display';
  fontSize?: number;
  fontWeight?: 'normal' | 'semibold' | 'bold';
  fontItalic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
};

type DrawingPoint = {
  x: number;
  y: number;
};

const fontFamilyValues = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  mono: 'var(--font-mono)',
  display: 'Georgia, Times New Roman, serif',
} as const;

export type DrawingStroke = {
  id: string;
  color: string;
  width: number;
  points: DrawingPoint[];
};

export type FloatingMediaItem = {
  id: string;
  kind: 'image' | 'video';
  x: number;
  y: number;
  width: number;
  name: string;
};

export type MapGraph = {
  nodes: MapNode[];
  edges: MapEdge[];
  annotations?: MapAnnotation[];
  drawings?: DrawingStroke[];
  media?: FloatingMediaItem[];
};

const HOME_MEDIA_STORAGE_KEY = 'knowledge-maps.home-media';

function isFloatingMediaItem(value: unknown): value is FloatingMediaItem {
  const item = value as FloatingMediaItem;
  return Boolean(value) && typeof value === 'object' &&
    typeof item.id === 'string' && ['image', 'video'].includes(item.kind) &&
    typeof item.name === 'string' && Number.isFinite(item.x) &&
    Number.isFinite(item.y) && Number.isFinite(item.width);
}

function readHomeMedia(): FloatingMediaItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HOME_MEDIA_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isFloatingMediaItem) : [];
  } catch { return []; }
}

function writeHomeMedia(media: FloatingMediaItem[]) {
  window.localStorage.setItem(HOME_MEDIA_STORAGE_KEY, JSON.stringify(media));
}

const seedMaps: KnowledgeMap[] = [
  {
    id: 'breast-lesions',
    name: 'Breast Lesions',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'thyroid-cytology',
    name: 'Thyroid Cytology',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'lung-cytology',
    name: 'Lung Cytology',
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  },
];

function readStoredMaps(): KnowledgeMap[] {
  if (typeof window === 'undefined') return seedMaps;

  try {
    const stored = window.localStorage.getItem(MAPS_STORAGE_KEY);
    if (!stored) return seedMaps;

    const parsed: unknown = JSON.parse(stored);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof (item as KnowledgeMap).id === 'string' &&
          typeof (item as KnowledgeMap).name === 'string' &&
          typeof (item as KnowledgeMap).createdAt === 'string' &&
          (typeof (item as KnowledgeMap).updatedAt === 'string' ||
            (item as KnowledgeMap).updatedAt === undefined),
      )
    ) {
      return parsed as KnowledgeMap[];
    }
  } catch {
    return seedMaps;
  }

  return seedMaps;
}

function readStoredFolders(): MapFolder[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(MAP_FOLDERS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (folder) =>
          folder &&
          typeof folder === 'object' &&
          typeof (folder as MapFolder).id === 'string' &&
          typeof (folder as MapFolder).name === 'string' &&
          typeof (folder as MapFolder).createdAt === 'string',
      )
    ) {
      return parsed as MapFolder[];
    }
  } catch {
    return [];
  }
  return [];
}

function writeStoredFolders(folders: MapFolder[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MAP_FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch {
    // Folder state remains available for the current session.
  }
}

function readHomeBackgroundStyle(): BackgroundStyle {
  if (typeof window === 'undefined') return defaultBackgroundStyle;
  try {
    const stored = window.localStorage.getItem(HOME_BACKGROUND_STYLE_STORAGE_KEY);
    if (!stored) return defaultBackgroundStyle;
    const parsed = JSON.parse(stored) as Partial<BackgroundStyle>;
    return {
      color: typeof parsed.color === 'string' ? parsed.color : defaultBackgroundStyle.color,
      fit: ['cover', 'contain', 'stretch'].includes(parsed.fit ?? '')
        ? parsed.fit as BackgroundStyle['fit']
        : defaultBackgroundStyle.fit,
      overlay: typeof parsed.overlay === 'boolean' ? parsed.overlay : defaultBackgroundStyle.overlay,
    };
  } catch {
    return defaultBackgroundStyle;
  }
}

function writeHomeBackgroundStyle(style: BackgroundStyle) {
  window.localStorage.setItem(HOME_BACKGROUND_STYLE_STORAGE_KEY, JSON.stringify(style));
}

function writeStoredMaps(maps: KnowledgeMap[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(maps));
  } catch {
    // The in-memory list still keeps the current session usable if storage is unavailable.
  }
}

function readStoredNodePositions(): Record<string, CanvasPan> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(NODE_POSITIONS_STORAGE_KEY);
    if (!stored) return {};

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, CanvasPan>>(
      (positions, [mapId, value]) => {
        if (
          value &&
          typeof value === 'object' &&
          Number.isFinite((value as CanvasPan).x) &&
          Number.isFinite((value as CanvasPan).y)
        ) {
          positions[mapId] = {
            x: (value as CanvasPan).x,
            y: (value as CanvasPan).y,
          };
        }
        return positions;
      },
      {},
    );
  } catch {
    return {};
  }
}

function readStoredNodePosition(mapId: string): CanvasPan {
  return readStoredNodePositions()[mapId] ?? { x: 0, y: 0 };
}

function writeStoredNodePosition(mapId: string, position: CanvasPan) {
  if (typeof window === 'undefined') return;
  try {
    const positions = readStoredNodePositions();
    positions[mapId] = position;
    window.localStorage.setItem(
      NODE_POSITIONS_STORAGE_KEY,
      JSON.stringify(positions),
    );
  } catch {
    // The current node position still remains available in the active session.
  }
}

function isCanvasPosition(value: unknown): value is CanvasPan {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as CanvasPan).x === 'number' &&
    typeof (value as CanvasPan).y === 'number' &&
    Number.isFinite((value as CanvasPan).x) &&
    Number.isFinite((value as CanvasPan).y)
  );
}

function isMapNode(value: unknown): value is MapNode {
  const shape = (value as MapNode | null)?.shape;
  const size = (value as MapNode | null)?.size;
  const details = (value as MapNode | null)?.details;
  const cardStyle = (value as MapNode | null)?.cardStyle;
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as MapNode).id === 'string' &&
    typeof (value as MapNode).text === 'string' &&
    ((value as MapNode).masteryScore === undefined ||
      (Number.isFinite((value as MapNode).masteryScore) &&
        (value as MapNode).masteryScore! >= 0 &&
        (value as MapNode).masteryScore! <= 100)) &&
    ((value as MapNode).studyEnabled === undefined || typeof (value as MapNode).studyEnabled === 'boolean') &&
    ((value as MapNode).lastReviewedAt === undefined || typeof (value as MapNode).lastReviewedAt === 'string') &&
    ((value as MapNode).nextReviewAt === undefined || typeof (value as MapNode).nextReviewAt === 'string') &&
    (shape === undefined ||
      shape === 'rectangle' ||
      shape === 'rounded-rectangle' ||
      shape === 'circle' ||
      shape === 'oval' ||
      shape === 'diamond') &&
    (size === undefined ||
      size === 'small' ||
      size === 'medium' ||
      size === 'large') &&
    (cardStyle === undefined ||
      (Boolean(cardStyle) &&
        typeof cardStyle === 'object' &&
        ((cardStyle as CardStyle).borderWidth === undefined || Number.isFinite((cardStyle as CardStyle).borderWidth)) &&
        ((cardStyle as CardStyle).borderStyle === undefined || ['solid', 'dashed', 'dotted'].includes((cardStyle as CardStyle).borderStyle!)) &&
        ((cardStyle as CardStyle).backgroundColor === undefined || typeof (cardStyle as CardStyle).backgroundColor === 'string') &&
        ((cardStyle as CardStyle).textColor === undefined || typeof (cardStyle as CardStyle).textColor === 'string') &&
        ((cardStyle as CardStyle).borderColor === undefined || typeof (cardStyle as CardStyle).borderColor === 'string') &&
        ((cardStyle as CardStyle).imageMode === undefined || ['card', 'background'].includes((cardStyle as CardStyle).imageMode!)) &&
        ((cardStyle as CardStyle).imagePosition === undefined || ['above', 'below', 'left', 'right', 'center', 'top', 'bottom'].includes((cardStyle as CardStyle).imagePosition!)) &&
        ((cardStyle as CardStyle).imageSize === undefined || Number.isFinite((cardStyle as CardStyle).imageSize)) &&
        ((cardStyle as CardStyle).backgroundOpacity === undefined || Number.isFinite((cardStyle as CardStyle).backgroundOpacity)) &&
        ((cardStyle as CardStyle).backgroundFit === undefined || ['cover', 'contain', 'stretch', 'original'].includes((cardStyle as CardStyle).backgroundFit!)) &&
        ((cardStyle as CardStyle).backgroundOverlayOpacity === undefined || Number.isFinite((cardStyle as CardStyle).backgroundOverlayOpacity)) &&
        ((cardStyle as CardStyle).readabilityOverlay === undefined || typeof (cardStyle as CardStyle).readabilityOverlay === 'boolean') &&
        ((cardStyle as CardStyle).fontFamily === undefined || ['sans', 'serif', 'mono', 'display'].includes((cardStyle as CardStyle).fontFamily!)) &&
        ((cardStyle as CardStyle).fontSize === undefined || Number.isFinite((cardStyle as CardStyle).fontSize)) &&
        ((cardStyle as CardStyle).fontWeight === undefined || ['normal', 'semibold', 'bold'].includes((cardStyle as CardStyle).fontWeight!)) &&
        ((cardStyle as CardStyle).animation === undefined || ['none', 'pop', 'bounce', 'float', 'pulse', 'wiggle', 'glow'].includes((cardStyle as CardStyle).animation!)) &&
        ((cardStyle as CardStyle).animationSpeed === undefined || ['slow', 'normal', 'fast'].includes((cardStyle as CardStyle).animationSpeed!)) &&
        ((cardStyle as CardStyle).fontItalic === undefined || typeof (cardStyle as CardStyle).fontItalic === 'boolean') &&
        ((cardStyle as CardStyle).textAlign === undefined || ['left', 'center', 'right'].includes((cardStyle as CardStyle).textAlign!)))) &&
    (details === undefined ||
      (Boolean(details) &&
        typeof details === 'object' &&
        typeof details.notes === 'string' &&
        (details.noteBackground === undefined ||
          (typeof details.noteBackground === 'object' &&
            typeof details.noteBackground.opacity === 'number' &&
            ['center', 'top', 'bottom', 'left', 'right'].includes(
              details.noteBackground.position,
            ) &&
            ['cover', 'contain', 'stretch'].includes(details.noteBackground.fit) &&
            ['light', 'dark'].includes(details.noteBackground.overlay))) &&
        typeof details.differentialDiagnosis === 'string' &&
        typeof details.keyDiagnosticFeatures === 'string' &&
        (typeof details.distinguishingFeatures === 'string' || details.distinguishingFeatures === undefined) &&
        typeof details.immunohistochemistry === 'string' &&
        typeof details.molecularFindings === 'string' &&
        typeof details.references === 'string')) &&
    isCanvasPosition(value)
  );
}

function isMapEdge(value: unknown): value is MapEdge {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as MapEdge).id === 'string' &&
    typeof (value as MapEdge).from === 'string' &&
    typeof (value as MapEdge).to === 'string'
  );
}

function isMapAnnotation(value: unknown): value is MapAnnotation {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as MapAnnotation).id === 'string' &&
    typeof (value as MapAnnotation).text === 'string' &&
    ((value as MapAnnotation).color === undefined || typeof (value as MapAnnotation).color === 'string') &&
    ((value as MapAnnotation).fontFamily === undefined || ['sans', 'serif', 'mono', 'display'].includes((value as MapAnnotation).fontFamily!)) &&
    ((value as MapAnnotation).fontSize === undefined || Number.isFinite((value as MapAnnotation).fontSize)) &&
    ((value as MapAnnotation).fontWeight === undefined || ['normal', 'semibold', 'bold'].includes((value as MapAnnotation).fontWeight!)) &&
    ((value as MapAnnotation).fontItalic === undefined || typeof (value as MapAnnotation).fontItalic === 'boolean') &&
    ((value as MapAnnotation).textAlign === undefined || ['left', 'center', 'right'].includes((value as MapAnnotation).textAlign!)) &&
    isCanvasPosition(value)
  );
}

function isDrawingStroke(value: unknown): value is DrawingStroke {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as DrawingStroke).id === 'string' &&
    typeof (value as DrawingStroke).color === 'string' &&
    typeof (value as DrawingStroke).width === 'number' &&
    Number.isFinite((value as DrawingStroke).width) &&
    Array.isArray((value as DrawingStroke).points) &&
    (value as DrawingStroke).points.every(isCanvasPosition)
  );
}

function readStoredMapGraph(mapId: string, mapName: string): MapGraph {
  const fallbackGraph = (): MapGraph => ({
    nodes: [
      {
        id: `root-${mapId}`,
        text: mapName,
        ...readStoredNodePosition(mapId),
        masteryScore: 0,
        studyEnabled: true,
        reviewSchedule: normalizeReviewSchedule(undefined),
      },
    ],
    edges: [],
    annotations: [],
    drawings: [],
    media: [],
  });

  if (typeof window === 'undefined') return fallbackGraph();

  try {
    const stored = window.localStorage.getItem(MAP_GRAPHS_STORAGE_KEY);
    if (!stored) return fallbackGraph();

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallbackGraph();
    }

    const storedGraph = (parsed as Record<string, unknown>)[mapId];
    if (
      storedGraph &&
      typeof storedGraph === 'object' &&
      Array.isArray((storedGraph as MapGraph).nodes) &&
      Array.isArray((storedGraph as MapGraph).edges)
    ) {
      const nodes = (storedGraph as MapGraph).nodes.filter(isMapNode).map((node) => ({
        ...node,
        masteryScore: clampMasteryScore(node.masteryScore),
        studyEnabled: node.studyEnabled !== false,
        reviewSchedule: normalizeReviewSchedule(node.reviewSchedule, node),
        flashcards: node.flashcards?.map((card) => ({
          ...card,
          reviewSchedule: normalizeReviewSchedule(card.reviewSchedule),
        })),
      }));
      const nodeIds = new Set(nodes.map((node) => node.id));
      const edges = (storedGraph as MapGraph).edges.filter(
        (edge) =>
          isMapEdge(edge) && nodeIds.has(edge.from) && nodeIds.has(edge.to),
      );
      const annotations = Array.isArray((storedGraph as MapGraph).annotations)
        ? (storedGraph as MapGraph).annotations?.filter(isMapAnnotation) ?? []
        : [];
      const drawings = Array.isArray((storedGraph as MapGraph).drawings)
        ? (storedGraph as MapGraph).drawings?.filter(isDrawingStroke) ?? []
        : [];
      const media = Array.isArray((storedGraph as MapGraph).media)
        ? (storedGraph as MapGraph).media?.filter(isFloatingMediaItem) ?? []
        : [];

      if (nodes.length > 0) return { nodes, edges, annotations, drawings, media };
    }
  } catch {
    return fallbackGraph();
  }

  return fallbackGraph();
}

function writeStoredMapGraph(mapId: string, graph: MapGraph) {
  if (typeof window === 'undefined') return;

  try {
    const stored = window.localStorage.getItem(MAP_GRAPHS_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    const graphs =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, MapGraph>)
        : {};
    graphs[mapId] = graph;
    window.localStorage.setItem(MAP_GRAPHS_STORAGE_KEY, JSON.stringify(graphs));
  } catch {
    // The active graph remains available for the current session.
  }
}

function readStoredMapViewState(mapId: string): MapViewState {
  const fallback: MapViewState = {
    layoutMode: 'freeform',
    collapsedNodeIds: [],
  };
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(MAP_VIEW_STATES_STORAGE_KEY);
    if (!stored) return fallback;

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback;
    }

    const state = (parsed as Record<string, unknown>)[mapId];
    if (!state || typeof state !== 'object') return fallback;

    const layoutMode = (state as MapViewState).layoutMode;
    const collapsedNodeIds = (state as MapViewState).collapsedNodeIds;
    const formatPanelPosition = (state as MapViewState).formatPanelPosition;
    const toolbarPosition = (state as MapViewState).toolbarPosition;
    const toolbarVisible = (state as MapViewState).toolbarVisible;
    const branchStyle = (state as MapViewState).branchStyle;
    const showMasteryIndicators = (state as MapViewState).showMasteryIndicators;
    const validLayoutModes: LayoutMode[] = [
      'freeform',
      'left-to-right',
      'top-to-bottom',
      'radial',
      'hierarchical',
    ];

    return {
      layoutMode: validLayoutModes.includes(layoutMode)
        ? layoutMode
        : fallback.layoutMode,
      collapsedNodeIds: Array.isArray(collapsedNodeIds)
        ? collapsedNodeIds.filter((id): id is string => typeof id === 'string')
        : [],
      formatPanelPosition: isCanvasPosition(formatPanelPosition)
        ? formatPanelPosition
        : undefined,
      toolbarPosition: isCanvasPosition(toolbarPosition)
        ? toolbarPosition
        : undefined,
      toolbarVisible: typeof toolbarVisible === 'boolean' ? toolbarVisible : true,
      branchStyle: ['straight', 'curved', 'elbow', 'dotted', 'bold'].includes(branchStyle as BranchStyle)
        ? branchStyle as BranchStyle
        : 'straight',
      showMasteryIndicators: typeof showMasteryIndicators === 'boolean' ? showMasteryIndicators : true,
    };
  } catch {
    return fallback;
  }
}

function writeStoredMapViewState(mapId: string, state: MapViewState) {
  if (typeof window === 'undefined') return;

  try {
    const stored = window.localStorage.getItem(MAP_VIEW_STATES_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    const states =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, MapViewState>)
        : {};
    states[mapId] = state;
    window.localStorage.setItem(
      MAP_VIEW_STATES_STORAGE_KEY,
      JSON.stringify(states),
    );
  } catch {
    // The current view state remains usable for this session.
  }
}

function touchStoredMap(mapId: string) {
  const maps = readStoredMaps();
  const updatedAt = new Date().toISOString();
  const nextMaps = maps.map((map) =>
    map.id === mapId ? { ...map, updatedAt } : map,
  );
  writeStoredMaps(nextMaps);
}

function duplicateStoredMapData(sourceMap: KnowledgeMap, targetMap: KnowledgeMap) {
  const sourceGraph = readStoredMapGraph(sourceMap.id, sourceMap.name);
  const duplicatedGraph: MapGraph = JSON.parse(JSON.stringify(sourceGraph));
  duplicatedGraph.media = (duplicatedGraph.media ?? []).map((item) => ({
    ...item,
    id: item.id.replace(sourceMap.id, targetMap.id),
  }));
  writeStoredMapGraph(
    targetMap.id,
    duplicatedGraph,
  );
  writeStoredMapViewState(
    targetMap.id,
    readStoredMapViewState(sourceMap.id),
  );
  writeStoredNodePosition(
    targetMap.id,
    readStoredNodePosition(sourceMap.id),
  );
  writeMapBackgroundStyle(targetMap.id, readMapBackgroundStyle(sourceMap.id));
}

function deleteStoredMapData(mapId: string) {
  if (typeof window === 'undefined') return;

  [
    MAP_GRAPHS_STORAGE_KEY,
    MAP_VIEW_STATES_STORAGE_KEY,
    NODE_POSITIONS_STORAGE_KEY,
    MAP_BACKGROUND_STYLES_STORAGE_KEY,
  ].forEach((storageKey) => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;

      const entries = parsed as Record<string, unknown>;
      delete entries[mapId];
      window.localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // The library metadata still controls whether the map is visible.
    }
  });
}

function createNodeId(existingNodes: MapNode[]) {
  let id = '';
  do {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `node-${suffix}`;
  } while (existingNodes.some((node) => node.id === id));
  return id;
}

function createAnnotationId(existingAnnotations: MapAnnotation[]) {
  let id = '';
  do {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `annotation-${suffix}`;
  } while (existingAnnotations.some((annotation) => annotation.id === id));
  return id;
}

function createDrawingId(existingDrawings: DrawingStroke[]) {
  let id = '';
  do {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `drawing-${suffix}`;
  } while (existingDrawings.some((drawing) => drawing.id === id));
  return id;
}

function createEdgeId(existingEdges: MapEdge[]) {
  let id = '';
  do {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `edge-${suffix}`;
  } while (existingEdges.some((edge) => edge.id === id));
  return id;
}

function useMapLibrary() {
  const [maps, setMaps] = useState<KnowledgeMap[]>(readStoredMaps);

  useEffect(() => {
    writeStoredMaps(maps);
  }, [maps]);

  return [maps, setMaps] as const;
}

function createMapId(existingMaps: KnowledgeMap[]) {
  let id = '';
  do {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `map-${suffix}`;
  } while (existingMaps.some((map) => map.id === id));
  return id;
}

function formatMapDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function createFolderId(existingFolders: MapFolder[]) {
  let id = '';
  do {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `folder-${suffix}`;
  } while (existingFolders.some((folder) => folder.id === id));
  return id;
}

function Home() {
  const [maps, setMaps] = useMapLibrary();
  const [folders, setFolders] = useState<MapFolder[]>(readStoredFolders);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedMapIds, setSelectedMapIds] = useState<Set<string>>(new Set());
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderNameError, setFolderNameError] = useState('');
  const folderNameInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMap, setEditingMap] = useState<KnowledgeMap | null>(null);
  const [mapName, setMapName] = useState('');
  const [nameError, setNameError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [studyFilter, setStudyFilter] = useState<'due' | 'new' | 'weak' | 'all'>('all');
  const [openMenuMapId, setOpenMenuMapId] = useState<string | null>(null);
  const [pendingDeleteMap, setPendingDeleteMap] =
    useState<KnowledgeMap | null>(null);
  const [backgroundTarget, setBackgroundTarget] =
    useState<'home' | KnowledgeMap | null>(null);
  const [homeBackgroundStyle, setHomeBackgroundStyle] =
    useState<BackgroundStyle>(readHomeBackgroundStyle);
  const [homeBackgroundUrl, setHomeBackgroundUrl] = useState<string | null>(null);
  const [mapCardBackgroundUrls, setMapCardBackgroundUrls] =
    useState<Record<string, string>>({});
  const mapNameInputRef = useRef<HTMLInputElement>(null);
  const homeMediaInputRef = useRef<HTMLInputElement>(null);
  const homeMediaDragRef = useRef<{ id: string; pointerId: number; x: number; y: number } | null>(null);
  const [homeMedia, setHomeMedia] = useState<FloatingMediaItem[]>(readHomeMedia);
  const [homeMediaUrls, setHomeMediaUrls] = useState<Record<string, string>>({});
  const [selectedHomeMediaId, setSelectedHomeMediaId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listFloatingMedia('home').then((records) => {
      if (!active) return;
      const urls: Record<string, string> = {};
      records.forEach((record) => { urls[record.id] = URL.createObjectURL(record.blob); });
      setHomeMediaUrls((current) => {
        Object.values(current).forEach(URL.revokeObjectURL);
        return urls;
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [homeMedia.length]);

  const updateHomeMedia = (next: FloatingMediaItem[]) => {
    setHomeMedia(next);
    writeHomeMedia(next);
  };

  const uploadHomeMedia = async (file?: File) => {
    if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return;
    const id = `home-media-${crypto.randomUUID()}`;
    const item: FloatingMediaItem = {
      id,
      kind: file.type.startsWith('video/') ? 'video' : 'image',
      name: file.name,
      x: Math.max(24, window.innerWidth / 2 - 150 + homeMedia.length * 54),
      y: 150 + homeMedia.length * 72,
      width: 300,
    };
    await setFloatingMedia('home', id, file);
    setHomeMediaUrls((current) => ({ ...current, [id]: URL.createObjectURL(file) }));
    updateHomeMedia([...homeMedia, item]);
    setSelectedHomeMediaId(id);
  };

  const deleteHomeMediaItem = async (id: string) => {
    await deleteFloatingMedia(id);
    setHomeMediaUrls((current) => {
      if (current[id]) URL.revokeObjectURL(current[id]);
      const next = { ...current }; delete next[id]; return next;
    });
    updateHomeMedia(homeMedia.filter((item) => item.id !== id));
    setSelectedHomeMediaId(null);
  };

  const resizeHomeMedia = (id: string, amount: number) =>
    updateHomeMedia(homeMedia.map((item) =>
      item.id === id ? { ...item, width: Math.min(800, Math.max(120, item.width + amount)) } : item,
    ));

  const startHomeMediaDrag = (id: string, event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    setSelectedHomeMediaId(id);
    homeMediaDragRef.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveHomeMedia = (event: PointerEvent<HTMLElement>) => {
    const drag = homeMediaDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    homeMediaDragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setHomeMedia((current) => {
      const next = current.map((media) => media.id === drag.id ? { ...media, x: media.x + dx, y: media.y + dy } : media);
      writeHomeMedia(next);
      return next;
    });
  };

  const stopHomeMediaDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    homeMediaDragRef.current = null;
  };

  useEffect(() => {
    if (!isFolderDialogOpen) return;
    const focusTimer = window.setTimeout(() => folderNameInputRef.current?.focus(), 0);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFolderDialogOpen(false);
        setFolderName('');
        setFolderNameError('');
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isFolderDialogOpen]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getHomePageBackground(),
      ...maps.map((map) => getMapCardBackground(map.id)),
    ]).then(([homeImage, ...cardImages]) => {
      if (!active) return;
      const nextHomeUrl = homeImage ? URL.createObjectURL(homeImage.blob) : null;
      const nextCardUrls: Record<string, string> = {};
      cardImages.forEach((image, index) => {
        if (image) nextCardUrls[maps[index].id] = URL.createObjectURL(image.blob);
      });
      setHomeBackgroundUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextHomeUrl;
      });
      setMapCardBackgroundUrls((current) => {
        Object.values(current).forEach(URL.revokeObjectURL);
        return nextCardUrls;
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [maps]);

  useEffect(() => () => {
    if (homeBackgroundUrl) URL.revokeObjectURL(homeBackgroundUrl);
    Object.values(mapCardBackgroundUrls).forEach(URL.revokeObjectURL);
  }, []);

  const updateBackgroundStyle = (patch: Partial<BackgroundStyle>) => {
    if (backgroundTarget === 'home') {
      const next = { ...homeBackgroundStyle, ...patch };
      setHomeBackgroundStyle(next);
      writeHomeBackgroundStyle(next);
      return;
    }
    if (!backgroundTarget) return;
    const nextMaps = maps.map((map) =>
      map.id === backgroundTarget.id
        ? { ...map, cardBackground: { ...defaultBackgroundStyle, ...map.cardBackground, ...patch } }
        : map,
    );
    setMaps(nextMaps);
    writeStoredMaps(nextMaps);
    setBackgroundTarget(nextMaps.find((map) => map.id === backgroundTarget.id) ?? null);
  };

  const uploadBackgroundImage = async (file: File | undefined) => {
    if (!file || !backgroundTarget || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    if (backgroundTarget === 'home') {
      await setHomePageBackground(file);
      setHomeBackgroundUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      return;
    }
    await setMapCardBackground(backgroundTarget.id, file);
    setMapCardBackgroundUrls((current) => {
      if (current[backgroundTarget.id]) URL.revokeObjectURL(current[backgroundTarget.id]);
      return { ...current, [backgroundTarget.id]: URL.createObjectURL(file) };
    });
  };

  const removeBackgroundImage = async () => {
    if (!backgroundTarget) return;
    if (backgroundTarget === 'home') {
      await deleteHomePageBackground();
      setHomeBackgroundUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      return;
    }
    await deleteMapCardBackground(backgroundTarget.id);
    setMapCardBackgroundUrls((current) => {
      if (current[backgroundTarget.id]) URL.revokeObjectURL(current[backgroundTarget.id]);
      const next = { ...current };
      delete next[backgroundTarget.id];
      return next;
    });
  };

  useEffect(() => {
    if (!isDialogOpen) return;

    const focusTimer = window.setTimeout(() => mapNameInputRef.current?.focus(), 0);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDialogOpen(false);
        setEditingMap(null);
        setMapName('');
        setNameError('');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isDialogOpen]);

  useEffect(() => {
    if (!openMenuMapId) return;
    const closeMenu = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest('[data-map-card-menu]')
      ) {
        setOpenMenuMapId(null);
      }
    };
    window.addEventListener('mousedown', closeMenu);
    return () => window.removeEventListener('mousedown', closeMenu);
  }, [openMenuMapId]);

  useEffect(() => {
    if (!pendingDeleteMap) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingDeleteMap(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [pendingDeleteMap]);

  const openNewMapDialog = () => {
    setEditingMap(null);
    setMapName('');
    setNameError('');
    setIsDialogOpen(true);
  };

  const closeNewMapDialog = () => {
    setIsDialogOpen(false);
    setEditingMap(null);
    setMapName('');
    setNameError('');
  };

  const openRenameDialog = (map: KnowledgeMap) => {
    setEditingMap(map);
    setMapName(map.name);
    setNameError('');
    setIsDialogOpen(true);
  };

  const handleCreateMap = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = mapName.trim();

    if (!trimmedName) {
      setNameError('Give this map a name to continue.');
      mapNameInputRef.current?.focus();
      return;
    }

    if (editingMap) {
      const updatedAt = new Date().toISOString();
      const nextMaps = maps.map((map) =>
        map.id === editingMap.id
          ? { ...map, name: trimmedName, updatedAt }
          : map,
      );
      const graph = readStoredMapGraph(editingMap.id, editingMap.name);
      if (graph.nodes[0]?.text === editingMap.name) {
        writeStoredMapGraph(editingMap.id, {
          ...graph,
          nodes: graph.nodes.map((node, index) =>
            index === 0 ? { ...node, text: trimmedName } : node,
          ),
        });
      }
      setMaps(nextMaps);
      writeStoredMaps(nextMaps);
      closeNewMapDialog();
      return;
    }

    const now = new Date().toISOString();
    const newMap: KnowledgeMap = {
      id: createMapId(maps),
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
      folderId: activeFolderId ?? undefined,
    };
    const nextMaps = [newMap, ...maps];

    setMaps(nextMaps);
    writeStoredMaps(nextMaps);
    closeNewMapDialog();
    setLocation(`/map/${newMap.id}`);
  };

  const duplicateMap = async (map: KnowledgeMap) => {
    const baseName = `${map.name} Copy`;
    let duplicateName = baseName;
    let copyNumber = 2;
    while (
      maps.some(
        (candidate) =>
          candidate.name.toLocaleLowerCase() ===
          duplicateName.toLocaleLowerCase(),
      )
    ) {
      duplicateName = `${baseName} ${copyNumber}`;
      copyNumber += 1;
    }

    const now = new Date().toISOString();
    const duplicate: KnowledgeMap = {
      id: createMapId(maps),
      name: duplicateName,
      createdAt: now,
      updatedAt: now,
      cardBackground: map.cardBackground,
      folderId: map.folderId,
    };

    duplicateStoredMapData(map, duplicate);
    try {
      await duplicateMapImages(map.id, duplicate.id);
      await duplicateMapNoteBackgrounds(map.id, duplicate.id);
      await duplicateMapCardImages(map.id, duplicate.id);
      await duplicateMapFlashcardImages(map.id, duplicate.id);
      await duplicateMapCardBackground(map.id, duplicate.id);
      await duplicateMapCanvasBackground(map.id, duplicate.id);
      await duplicateMapFloatingMedia(map.id, duplicate.id);
    } catch {
      window.alert('The map was duplicated, but some images could not be copied.');
    }
    const nextMaps = [duplicate, ...maps];
    setMaps(nextMaps);
    writeStoredMaps(nextMaps);
  };

  const deleteMap = async (map: KnowledgeMap) => {
    const nextMaps = maps.filter((candidate) => candidate.id !== map.id);
    setMaps(nextMaps);
    writeStoredMaps(nextMaps);
    deleteStoredMapData(map.id);
    try {
      await deleteMapImages(map.id);
      await deleteMapNoteBackgrounds(map.id);
      await deleteMapCardImages(map.id);
      await deleteMapFlashcardImages(map.id);
      await deleteMapCardBackground(map.id);
      await deleteMapCanvasBackground(map.id);
      await deleteMapFloatingMedia(map.id);
    } catch {
      // The deleted map remains removed even if browser media cleanup fails.
    }
    setPendingDeleteMap(null);
    setSelectedMapIds((current) => {
      const next = new Set(current);
      next.delete(map.id);
      return next;
    });
  };

  const updateMaps = (nextMaps: KnowledgeMap[]) => {
    setMaps(nextMaps);
    writeStoredMaps(nextMaps);
  };

  const moveMapToFolder = (mapId: string, folderId?: string) => {
    updateMaps(
      maps.map((map) =>
        map.id === mapId ? { ...map, folderId } : map,
      ),
    );
    setOpenMenuMapId(null);
  };

  const toggleMapSelection = (mapId: string) => {
    setSelectedMapIds((current) => {
      const next = new Set(current);
      if (next.has(mapId)) next.delete(mapId);
      else next.add(mapId);
      return next;
    });
  };

  const openFolderDialog = () => {
    setFolderName('');
    setFolderNameError('');
    setIsFolderDialogOpen(true);
  };

  const closeFolderDialog = () => {
    setIsFolderDialogOpen(false);
    setFolderName('');
    setFolderNameError('');
  };

  const handleCreateFolder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = folderName.trim();
    if (!trimmedName) {
      setFolderNameError('Give this folder a name to continue.');
      folderNameInputRef.current?.focus();
      return;
    }
    if (folders.some((folder) => folder.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
      setFolderNameError('A folder with this name already exists.');
      folderNameInputRef.current?.focus();
      return;
    }
    const folder: MapFolder = {
      id: createFolderId(folders),
      name: trimmedName,
      createdAt: new Date().toISOString(),
    };
    const nextFolders = [...folders, folder];
    setFolders(nextFolders);
    writeStoredFolders(nextFolders);
    if (selectedMapIds.size > 0) {
      updateMaps(
        maps.map((map) =>
          selectedMapIds.has(map.id) ? { ...map, folderId: folder.id } : map,
        ),
      );
      setSelectedMapIds(new Set());
    }
    closeFolderDialog();
  };

  const deleteFolder = (folderId: string) => {
    const nextFolders = folders.filter((folder) => folder.id !== folderId);
    setFolders(nextFolders);
    writeStoredFolders(nextFolders);
    updateMaps(
      maps.map((map) =>
        map.folderId === folderId ? { ...map, folderId: undefined } : map,
      ),
    );
    if (activeFolderId === folderId) setActiveFolderId(null);
  };

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const searchMatchedMaps = normalizedSearch
    ? maps.filter((map) =>
        map.name.toLocaleLowerCase().includes(normalizedSearch),
      )
    : maps;
  const folderFilteredMaps = activeFolderId
    ? searchMatchedMaps.filter((map) => map.folderId === activeFolderId)
    : searchMatchedMaps;
  const mapStudyMetrics = new Map(maps.map((map) => {
    const graph = readStoredMapGraph(map.id, map.name);
    const items = getGraphStudyItems(graph);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const studyWeight = graph.nodes
      .filter((node) => node.studyEnabled !== false)
      .reduce((total, node) => total + getNodeStudyWeight(node, graph), 0);
    return [map.id, {
      score: calculateMapMastery(graph),
      studyWeight,
      due: items.filter((item) => !item.schedule.nextReviewAt || new Date(item.schedule.nextReviewAt) <= endOfToday).length,
      new: items.filter((item) => item.schedule.reviewCount === 0).length,
      weak: items.filter((item) => item.schedule.reviewCount > 0 && item.schedule.mastery < 50).length,
    }] as const;
  }));
  const filteredMaps = studyFilter === 'all'
    ? folderFilteredMaps
    : folderFilteredMaps.filter((map) => (mapStudyMetrics.get(map.id)?.[studyFilter] ?? 0) > 0);
  const conceptsDueToday = Array.from(mapStudyMetrics.values()).reduce((total, metric) => total + metric.due, 0);
  const totalStudyWeight = Array.from(mapStudyMetrics.values())
    .reduce((total, metric) => total + metric.studyWeight, 0);
  const overallMastery = totalStudyWeight > 0
    ? Math.round(Array.from(mapStudyMetrics.values())
        .reduce((total, metric) => total + metric.score * metric.studyWeight, 0) / totalStudyWeight)
    : 0;
  const activeBackgroundStyle =
    backgroundTarget === 'home'
      ? homeBackgroundStyle
      : backgroundTarget?.cardBackground ?? defaultBackgroundStyle;
  const activeBackgroundUrl =
    backgroundTarget === 'home'
      ? homeBackgroundUrl
      : backgroundTarget
        ? mapCardBackgroundUrls[backgroundTarget.id]
        : null;

  return (
    <main
      className={`home-page min-h-[100dvh]${homeBackgroundUrl ? ' has-custom-home-image' : ''}`}
      style={{
        backgroundColor: homeBackgroundStyle.color,
        backgroundImage: homeBackgroundUrl
          ? `${homeBackgroundStyle.overlay ? 'linear-gradient(rgb(244 240 231 / 0.72), rgb(244 240 231 / 0.72)),' : ''} url("${homeBackgroundUrl}")`
          : undefined,
        backgroundSize: homeBackgroundStyle.fit === 'stretch' ? '100% 100%' : homeBackgroundStyle.fit,
        backgroundPosition: 'center',
        backgroundRepeat: homeBackgroundStyle.fit === 'contain' ? 'repeat' : 'no-repeat',
      }}
    >
      <header className="site-header" data-testid="header-home">
        <Link href="/" className="brand-lockup" data-testid="link-home-brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>Knowledge Maps</span>
        </Link>
        <div className="header-home-actions">
          <span className="header-note">A quiet place for clear thinking</span>
          <button
            type="button"
            className="home-customize-button"
            onClick={() => setBackgroundTarget('home')}
            data-testid="button-customize-home"
          >
            <Image size={14} aria-hidden="true" />
            Customize home
          </button>
          <button
            type="button"
            className="home-customize-button"
            onClick={() => homeMediaInputRef.current?.click()}
            data-testid="button-add-home-media"
          >
            <Video size={14} aria-hidden="true" />
            Add media
          </button>
          <input
            ref={homeMediaInputRef}
            className="sr-only"
            type="file"
            accept="image/*,video/*"
            onChange={(event) => {
              void uploadHomeMedia(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </div>
      </header>
      <div className="home-floating-media-layer">
        {homeMedia.map((item) => (
          <div
            key={item.id}
            className={`floating-media-frame${selectedHomeMediaId === item.id ? ' is-selected' : ''}`}
            style={{ left: item.x, top: item.y, width: item.width }}
            onClick={() => setSelectedHomeMediaId(item.id)}
          >
            <div
              className="floating-media-toolbar"
              onPointerDown={(event) => startHomeMediaDrag(item.id, event)}
              onPointerMove={moveHomeMedia}
              onPointerUp={stopHomeMediaDrag}
              onPointerCancel={stopHomeMediaDrag}
              data-testid={`move-home-media-${item.id}`}
            >
              <span><Move size={12} aria-hidden="true" /> Move {item.kind}</span>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => resizeHomeMedia(item.id, -40)} aria-label="Make smaller">−</button>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => resizeHomeMedia(item.id, 40)} aria-label="Make larger">+</button>
              <button
                type="button"
                className="media-delete-button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => void deleteHomeMediaItem(item.id)}
                aria-label={`Delete ${item.kind}`}
                title={`Delete ${item.kind}`}
                data-testid={`button-delete-home-media-frame-${item.id}`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
            {item.kind === 'video' ? (
              <video src={homeMediaUrls[item.id]} controls preload="metadata" />
            ) : (
              <img
                src={homeMediaUrls[item.id]}
                alt={item.name}
                draggable={false}
                onPointerDown={(event) => startHomeMediaDrag(item.id, event)}
                onPointerMove={moveHomeMedia}
                onPointerUp={stopHomeMediaDrag}
                onPointerCancel={stopHomeMediaDrag}
                data-testid={`draggable-home-image-${item.id}`}
              />
            )}
          </div>
        ))}
        {homeMedia.length > 0 ? (
          <aside className="home-media-manager" aria-label="Homepage media">
            <strong>Homepage media</strong>
            {homeMedia.map((item) => (
              <div key={item.id}>
                <span title={item.name}>
                  {item.kind === 'video' ? <Video size={12} aria-hidden="true" /> : <Image size={12} aria-hidden="true" />}
                  {item.name}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteHomeMediaItem(item.id)}
                  aria-label={`Delete ${item.kind} ${item.name}`}
                  title={`Delete ${item.name}`}
                  data-testid={`button-delete-home-media-${item.id}`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </aside>
        ) : null}
      </div>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow" data-testid="text-eyebrow">
            Visual thinking, made spacious
          </p>
          <h1 id="home-title" data-testid="text-product-title">Pathwise</h1>
          <p className="hero-description" data-testid="text-home-description">
            Keep each question on its own sheet. Return to the idea you mean to
            work on, without the noise of everything else.
          </p>
          <button
            type="button"
            className="primary-action"
            onClick={openNewMapDialog}
            data-testid="button-new-map"
          >
            <span>New Map</span>
            <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <div className="map-illustration" aria-label="A simple map of connected ideas">
          <div className="illustration-caption">An open page</div>
          <svg
            className="connection-lines"
            viewBox="0 0 560 470"
            fill="none"
            aria-hidden="true"
          >
            <path d="M280 236 C 210 194, 160 154, 96 112" />
            <path d="M280 236 C 360 195, 400 142, 462 96" />
            <path d="M280 236 C 206 278, 166 322, 102 364" />
            <path d="M280 236 C 353 277, 405 324, 476 370" />
            <path d="M280 236 C 281 174, 280 104, 280 48" />
            <path d="M280 236 C 280 300, 280 372, 280 430" />
          </svg>
          <div className="idea-node idea-node-center">
            <span className="node-label">your idea</span>
          </div>
          <div className="idea-node idea-node-north">notice</div>
          <div className="idea-node idea-node-northwest">question</div>
          <div className="idea-node idea-node-northeast">context</div>
          <div className="idea-node idea-node-southwest">pattern</div>
          <div className="idea-node idea-node-southeast">next</div>
          <div className="idea-node idea-node-south">meaning</div>
          <span className="orbit-dot orbit-dot-one" />
          <span className="orbit-dot orbit-dot-two" />
        </div>
      </section>
      <section className="map-library" aria-labelledby="library-title">
        <div className="library-heading">
          <div>
            <h2 id="library-title" data-testid="text-map-library-title">
              Your maps
            </h2>
            <p data-testid="text-map-library-description">
              Separate sheets for the ideas still taking shape.
            </p>
          </div>
          <div className="home-mastery-summary" title={`Overall mastery: ${overallMastery}%`}>
            <span>Overall mastery</span>
            <strong data-testid="overall-mastery">{overallMastery}%</strong>
            <div aria-hidden="true"><span style={{ width: `${overallMastery}%` }} /></div>
            <p data-testid="concepts-due-today">{conceptsDueToday} {conceptsDueToday === 1 ? 'concept' : 'concepts'} due today</p>
          </div>
          <label className="map-search">
            <Search size={16} strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only">Search maps</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search maps"
              data-testid="input-search-maps"
            />
          </label>
        </div>

        <div className="folder-toolbar" aria-label="Map folders">
          <div className="folder-list">
            <button
              type="button"
              className={`folder-chip${activeFolderId === null ? ' is-active' : ''}`}
              onClick={() => setActiveFolderId(null)}
              data-testid="button-folder-all"
            >
              <Folder size={15} aria-hidden="true" />
              All maps
              <span>{maps.length}</span>
            </button>
            {folders.map((folder) => {
              const folderMapCount = maps.filter((map) => map.folderId === folder.id).length;
              return (
                <div key={folder.id} className="folder-chip-wrap">
                  <button
                    type="button"
                    className={`folder-chip${activeFolderId === folder.id ? ' is-active' : ''}`}
                    onClick={() => setActiveFolderId(folder.id)}
                    data-testid={`button-folder-${folder.id}`}
                  >
                    <Folder size={15} aria-hidden="true" />
                    {folder.name}
                    <span>{folderMapCount}</span>
                  </button>
                  <button
                    type="button"
                    className="folder-delete-button"
                    onClick={() => deleteFolder(folder.id)}
                    aria-label={`Delete folder ${folder.name}`}
                    title="Delete folder and keep its maps"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="folder-create-button"
            onClick={openFolderDialog}
            data-testid="button-create-folder"
          >
            <FolderPlus size={15} aria-hidden="true" />
            {selectedMapIds.size > 0
              ? `Group ${selectedMapIds.size} selected`
              : 'New folder'}
          </button>
        </div>

        <div className="study-filter-bar" role="group" aria-label="Filter maps by study status">
          {([
            ['due', 'Due Today'],
            ['new', 'New'],
            ['weak', 'Weak'],
            ['all', 'All'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={studyFilter === value ? 'is-active' : ''}
              onClick={() => setStudyFilter(value)}
              aria-pressed={studyFilter === value}
              data-testid={`study-filter-${value}`}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredMaps.length > 0 ? (
          <div className="map-library-grid">
            {filteredMaps.map((map) => {
              const mapGraph = readStoredMapGraph(map.id, map.name);
              const nodeCount = mapGraph.nodes.length;
              const mapMastery = mapStudyMetrics.get(map.id)?.score ?? 0;
              const cardStyle = map.cardBackground ?? defaultBackgroundStyle;
              const cardImageUrl = mapCardBackgroundUrls[map.id];
              return (
              <article
                key={map.id}
                className={`map-card${cardImageUrl ? ' has-custom-card-image' : ''}${selectedMapIds.has(map.id) ? ' is-selected' : ''}`}
                data-testid={`card-map-${map.id}`}
                style={{
                  backgroundColor: cardStyle.color,
                  backgroundImage: cardImageUrl
                    ? `${cardStyle.overlay ? 'linear-gradient(rgb(255 255 255 / 0.72), rgb(255 255 255 / 0.72)),' : ''} url("${cardImageUrl}")`
                    : map.cardBackground
                      ? 'none'
                      : undefined,
                  backgroundSize: cardStyle.fit === 'stretch' ? '100% 100%' : cardStyle.fit,
                  backgroundPosition: 'center',
                  backgroundRepeat: cardStyle.fit === 'contain' ? 'repeat' : 'no-repeat',
                }}
              >
                <label className="map-card-select">
                  <input
                    type="checkbox"
                    checked={selectedMapIds.has(map.id)}
                    onChange={() => toggleMapSelection(map.id)}
                    data-testid={`checkbox-select-map-${map.id}`}
                  />
                  <span>Select</span>
                </label>
                <h3 className="map-card-title" data-testid={`text-map-name-${map.id}`}>
                  {map.name}
                </h3>
                {map.folderId ? (
                  <p className="map-card-folder">
                    <Folder size={13} aria-hidden="true" />
                    {folders.find((folder) => folder.id === map.folderId)?.name ?? 'Folder'}
                  </p>
                ) : null}
                <div className="map-card-meta">
                  <span>
                    <CalendarDays size={14} aria-hidden="true" />
                    Edited {formatMapDate(map.updatedAt ?? map.createdAt)}
                  </span>
                  <span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
                </div>
                <div
                  className={`map-card-mastery mastery-${getMasteryStatus(mapMastery)}`}
                  title={`Mastery: ${mapMastery}%`}
                  data-testid={`map-mastery-${map.id}`}
                >
                  <span>{getMasteryStatusLabel(mapMastery)}</span>
                  <strong>{mapMastery}%</strong>
                  <div aria-hidden="true"><span style={{ width: `${mapMastery}%` }} /></div>
                </div>
                <div className="map-card-actions">
                  <Link href={`/map/${map.id}`} className="map-card-open">
                    Open
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                  <div className="map-card-menu-wrap" data-map-card-menu>
                    <button
                      type="button"
                      className="map-card-menu-trigger"
                      onClick={() =>
                        setOpenMenuMapId((currentId) =>
                          currentId === map.id ? null : map.id,
                        )
                      }
                      aria-label={`More options for ${map.name}`}
                      aria-haspopup="menu"
                      aria-expanded={openMenuMapId === map.id}
                      data-testid={`button-map-menu-${map.id}`}
                    >
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </button>
                    {openMenuMapId === map.id ? (
                      <div
                        className="map-card-menu"
                        role="menu"
                        aria-label={`Options for ${map.name}`}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuMapId(null);
                            setBackgroundTarget(map);
                          }}
                        >
                          <Image size={14} aria-hidden="true" />
                          Customize background
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuMapId(null);
                            openRenameDialog(map);
                          }}
                        >
                          <Pencil size={14} aria-hidden="true" />
                          Rename
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuMapId(null);
                            void duplicateMap(map);
                          }}
                        >
                          <Copy size={14} aria-hidden="true" />
                          Duplicate
                        </button>
                        {folders.length > 0 ? (
                          <div className="map-folder-menu-group" role="group" aria-label="Move to folder">
                            <span>Move to folder</span>
                            {folders.map((folder) => (
                              <button
                                key={folder.id}
                                type="button"
                                role="menuitem"
                                disabled={map.folderId === folder.id}
                                onClick={() => moveMapToFolder(map.id, folder.id)}
                              >
                                <Folder size={14} aria-hidden="true" />
                                {folder.name}
                                {map.folderId === folder.id ? <Check size={13} aria-hidden="true" /> : null}
                              </button>
                            ))}
                            {map.folderId ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => moveMapToFolder(map.id)}
                              >
                                <Folder size={14} aria-hidden="true" />
                                Remove from folder
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          className="map-card-delete"
                          onClick={() => {
                            setOpenMenuMapId(null);
                            setPendingDeleteMap(map);
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="library-empty" data-testid="empty-map-library">
            {maps.length === 0
              ? 'Your library is clear. Start with one thought.'
              : activeFolderId
                ? 'This folder is empty. Select maps from All maps, then move them here from each map menu.'
              : `No maps match “${searchQuery.trim()}”.`}
          </div>
        )}
      </section>
      <footer className="home-footer">
        <span>Start with one thought.</span>
        <span className="footer-rule" aria-hidden="true" />
        <span>Let the shape emerge.</span>
      </footer>
      {backgroundTarget ? (
        <div
          className="new-map-dialog"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBackgroundTarget(null);
          }}
        >
          <section
            className="new-map-dialog-panel background-customize-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="background-customize-title"
            data-testid="dialog-customize-background"
          >
            <p className="new-map-dialog-kicker">
              {backgroundTarget === 'home' ? 'Homepage' : 'Map card'}
            </p>
            <h2 className="new-map-dialog-title" id="background-customize-title">
              Customize background
            </h2>
            <p className="new-map-dialog-description">
              {backgroundTarget === 'home'
                ? 'Choose a background for the entire homepage.'
                : `Choose a background for ${backgroundTarget.name}.`}
            </p>
            <div className="background-customize-form">
              <label>
                Background color
                <input
                  type="color"
                  value={activeBackgroundStyle.color}
                  onInput={(event) => updateBackgroundStyle({ color: event.currentTarget.value })}
                  data-testid="input-home-background-color"
                />
              </label>
              <label>
                Background image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    void uploadBackgroundImage(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                  data-testid="input-home-background-image"
                />
              </label>
              <label>
                Image fit
                <select
                  value={activeBackgroundStyle.fit}
                  onChange={(event) => updateBackgroundStyle({ fit: event.target.value as BackgroundStyle['fit'] })}
                  data-testid="select-home-background-fit"
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="stretch">Stretch</option>
                </select>
              </label>
              <label className="background-overlay-control">
                <input
                  type="checkbox"
                  checked={activeBackgroundStyle.overlay}
                  onChange={(event) => updateBackgroundStyle({ overlay: event.target.checked })}
                  data-testid="checkbox-home-background-overlay"
                />
                Readability overlay
              </label>
              {activeBackgroundUrl ? (
                <button
                  type="button"
                  className="background-remove-button"
                  onClick={() => void removeBackgroundImage()}
                  data-testid="button-remove-home-background-image"
                >
                  Remove image
                </button>
              ) : null}
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-action"
                onClick={() => {
                  updateBackgroundStyle(defaultBackgroundStyle);
                  void removeBackgroundImage();
                }}
                data-testid="button-reset-home-background"
              >
                Reset
              </button>
              <button
                type="button"
                className="dialog-action dialog-action-primary"
                onClick={() => setBackgroundTarget(null)}
                data-testid="button-close-home-background"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {pendingDeleteMap ? (
        <div
          className="new-map-dialog"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingDeleteMap(null);
          }}
        >
          <section
            className="new-map-dialog-panel delete-map-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-map-dialog-title"
            aria-describedby="delete-map-dialog-description"
            data-testid="dialog-delete-map"
          >
            <p className="new-map-dialog-kicker">Permanent action</p>
            <h2 className="new-map-dialog-title" id="delete-map-dialog-title">
              Delete map
            </h2>
            <p
              className="new-map-dialog-description"
              id="delete-map-dialog-description"
            >
              Delete this map? This will permanently delete the map and all of
              its nodes, connections, notes, and associated data.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-action"
                onClick={() => setPendingDeleteMap(null)}
                data-testid="button-cancel-delete-map"
              >
                Cancel
              </button>
              <button
                type="button"
                className="dialog-action dialog-action-delete"
                onClick={() => void deleteMap(pendingDeleteMap)}
                data-testid="button-confirm-delete-map"
              >
                Delete
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {isDialogOpen ? (
        <div
          className="new-map-dialog"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeNewMapDialog();
          }}
        >
          <section
            className="new-map-dialog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-map-dialog-title"
            aria-describedby="new-map-dialog-description"
            data-testid="dialog-new-map"
          >
            <p className="new-map-dialog-kicker">
              {editingMap ? 'Edit sheet' : 'New sheet'}
            </p>
            <h2 className="new-map-dialog-title" id="new-map-dialog-title">
              {editingMap ? 'Rename your map' : 'Name your map'}
            </h2>
            <p className="new-map-dialog-description" id="new-map-dialog-description">
              {editingMap
                ? 'Give this map a clear, memorable name.'
                : 'Give this line of thinking a place of its own.'}
            </p>
            <form className="new-map-form" onSubmit={handleCreateMap}>
              <label htmlFor="map-name">Map name</label>
              <input
                ref={mapNameInputRef}
                id="map-name"
                name="map-name"
                type="text"
                value={mapName}
                onChange={(event) => {
                  setMapName(event.target.value);
                  if (nameError) setNameError('');
                }}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'map-name-error' : undefined}
                autoComplete="off"
                data-testid="input-map-name"
              />
              <p className="dialog-error" id="map-name-error" role="alert">
                {nameError}
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="dialog-action"
                  onClick={closeNewMapDialog}
                  data-testid="button-cancel-new-map"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dialog-action dialog-action-primary"
                  data-testid="button-create-map"
                >
                  {editingMap ? 'Save' : 'Create Map'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {isFolderDialogOpen ? (
        <div
          className="new-map-dialog"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeFolderDialog();
          }}
        >
          <section
            className="new-map-dialog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="folder-dialog-title"
            aria-describedby="folder-dialog-description"
            data-testid="dialog-create-folder"
          >
            <p className="new-map-dialog-kicker">Organize maps</p>
            <h2 className="new-map-dialog-title" id="folder-dialog-title">
              Create a folder
            </h2>
            <p className="new-map-dialog-description" id="folder-dialog-description">
              {selectedMapIds.size > 0
                ? `Create a folder and move ${selectedMapIds.size} selected ${selectedMapIds.size === 1 ? 'map' : 'maps'} into it.`
                : 'Create an empty folder, then move maps into it from each map menu.'}
            </p>
            <form className="new-map-form" onSubmit={handleCreateFolder}>
              <label htmlFor="folder-name">Folder name</label>
              <input
                ref={folderNameInputRef}
                id="folder-name"
                name="folder-name"
                type="text"
                value={folderName}
                onChange={(event) => {
                  setFolderName(event.target.value);
                  if (folderNameError) setFolderNameError('');
                }}
                aria-invalid={Boolean(folderNameError)}
                aria-describedby={folderNameError ? 'folder-name-error' : undefined}
                autoComplete="off"
                data-testid="input-folder-name"
              />
              <p className="dialog-error" id="folder-name-error" role="alert">
                {folderNameError}
              </p>
              <div className="dialog-actions">
                <button type="button" className="dialog-action" onClick={closeFolderDialog}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dialog-action dialog-action-primary"
                  data-testid="button-confirm-create-folder"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function MapNotFound() {
  return (
    <main className="route-not-found" data-testid="map-not-found">
      <div className="route-not-found-content">
        <p className="route-not-found-code">Map not found</p>
        <h1>This sheet is not here.</h1>
        <p>
          The map may have been removed, or the address may no longer point to
          a saved sheet.
        </p>
        <Link href="/" className="route-home-link" data-testid="link-map-not-found-home">
          <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Back to Knowledge Maps</span>
        </Link>
      </div>
    </main>
  );
}

type CanvasPan = {
  x: number;
  y: number;
};

type ConnectionDraft = {
  sourceId: string;
  x: number;
  y: number;
};

type LayoutMode =
  | 'freeform'
  | 'left-to-right'
  | 'top-to-bottom'
  | 'radial'
  | 'hierarchical';

type BranchStyle = 'straight' | 'curved' | 'elbow' | 'dotted' | 'bold';

type MapViewState = {
  layoutMode: LayoutMode;
  collapsedNodeIds: string[];
  formatPanelPosition?: CanvasPan;
  toolbarPosition?: CanvasPan;
  toolbarVisible?: boolean;
  branchStyle?: BranchStyle;
  showMasteryIndicators?: boolean;
};

const layoutOptions: Array<{ value: LayoutMode; label: string }> = [
  { value: 'freeform', label: 'Freeform' },
  { value: 'left-to-right', label: 'Left-to-right tree' },
  { value: 'top-to-bottom', label: 'Top-to-bottom tree' },
  { value: 'radial', label: 'Radial' },
  { value: 'hierarchical', label: 'Hierarchical' },
];

const nodeShapeOptions: Array<{ value: NodeShape; label: string }> = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'rounded-rectangle', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: 'oval', label: 'Oval' },
  { value: 'diamond', label: 'Diamond' },
];

const nodeSizeOptions: Array<{ value: NodeSize; label: string }> = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const emptyNodeDetails: NodeDetails = {
  notes: '',
  differentialDiagnosis: '',
  keyDiagnosticFeatures: '',
  distinguishingFeatures: '',
  immunohistochemistry: '',
  molecularFindings: '',
  references: '',
};

function notesAsLines(mapName: string, nodes: MapNode[]) {
  const lines = [`${mapName} — Notes`, ''];
  const sections: Array<[keyof NodeDetails, string]> = [
    ['notes', 'Notes'],
    ['differentialDiagnosis', 'Differential Diagnosis'],
    ['keyDiagnosticFeatures', 'Key Diagnostic Features'],
    ['distinguishingFeatures', 'Distinguishing Features'],
    ['immunohistochemistry', 'Immunohistochemistry'],
    ['molecularFindings', 'Molecular Findings'],
    ['references', 'References'],
  ];
  nodes.forEach((node) => {
    const details = node.details;
    if (!details) return;
    const hasContent = sections.some(([key]) => {
      const value = details[key];
      return typeof value === 'string' && value.trim();
    });
    if (!hasContent) return;
    lines.push(node.text, '');
    sections.forEach(([key, label]) => {
      const value = details[key];
      if (typeof value !== 'string' || !value.trim()) return;
      lines.push(label);
      value.trim().split(/\r?\n/).forEach((line) => {
        const words = line.split(/\s+/);
        let current = '';
        words.forEach((word) => {
          if (`${current} ${word}`.trim().length > 88) {
            lines.push(current);
            current = word;
          } else current = `${current} ${word}`.trim();
        });
        if (current) lines.push(current);
      });
      lines.push('');
    });
    lines.push('------------------------------------------------------------', '');
  });
  if (lines.length === 2) lines.push('No notes have been added to this map.');
  return lines;
}

function createNotesPdf(mapName: string, nodes: MapNode[]) {
  const clean = (value: string) =>
    value.replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const lines = notesAsLines(mapName, nodes);
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 52)) }, (_, index) =>
    lines.slice(index * 52, index * 52 + 52),
  );
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = pageLines.map((line, lineIndex) =>
      `${lineIndex === 0 ? 'BT /F1 11 Tf 50 790 Td' : '0 -14 Td'} (${clean(line)}) Tj`,
    ).join('\n') + '\nET';
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function getSearchableNodeText(node: MapNode, graph: MapGraph) {
  const extendedNode = node as MapNode & {
    tags?: string[];
    flashcards?: Array<{ question?: string; answer?: string; tags?: string[] }>;
  };
  const extendedGraph = graph as MapGraph & {
    flashcards?: Array<{ nodeId?: string; question?: string; answer?: string; tags?: string[] }>;
  };
  const nodeFlashcards = [
    ...(extendedNode.flashcards ?? []),
    ...(extendedGraph.flashcards ?? []).filter((card) => !card.nodeId || card.nodeId === node.id),
  ];
  const detailsText = node.details ? Object.values(node.details).filter((value) => typeof value === 'string') : [];
  return [
    node.text,
    ...detailsText,
    ...(extendedNode.tags ?? []),
    ...nodeFlashcards.flatMap((card) => [card.question ?? '', card.answer ?? '', ...(card.tags ?? [])]),
  ].join(' ').toLocaleLowerCase();
}

const nodeDetailFields: Array<{
  key: Exclude<keyof NodeDetails, 'notes' | 'noteBackground'>;
  label: string;
  rows: number;
}> = [
  {
    key: 'differentialDiagnosis',
    label: 'Differential diagnosis',
    rows: 4,
  },
  {
    key: 'keyDiagnosticFeatures',
    label: 'Key diagnostic features',
    rows: 4,
  },
  {
    key: 'distinguishingFeatures',
    label: 'Distinguishing features',
    rows: 4,
  },
  {
    key: 'immunohistochemistry',
    label: 'Immunohistochemistry',
    rows: 4,
  },
  { key: 'molecularFindings', label: 'Molecular findings', rows: 4 },
  { key: 'references', label: 'References', rows: 5 },
];

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.2;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getGraphLevels(graph: MapGraph) {
  const levels = new Map<string, number>();
  const incomingCounts = new Map(
    graph.nodes.map((node) => [
      node.id,
      graph.edges.filter((edge) => edge.to === node.id).length,
    ]),
  );
  const roots = graph.nodes.filter(
    (node) => (incomingCounts.get(node.id) ?? 0) === 0,
  );
  const queue = (roots.length > 0 ? roots : graph.nodes.slice(0, 1)).map(
    (node) => ({ id: node.id, level: 0 }),
  );

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || levels.has(current.id)) continue;
    levels.set(current.id, current.level);

    graph.edges
      .filter((edge) => edge.from === current.id)
      .forEach((edge) => {
        if (!levels.has(edge.to)) {
          queue.push({ id: edge.to, level: current.level + 1 });
        }
      });
  }

  graph.nodes.forEach((node) => {
    if (!levels.has(node.id)) {
      const connectedLevels = graph.edges
        .filter((edge) => edge.from === node.id || edge.to === node.id)
        .map((edge) =>
          levels.get(edge.from === node.id ? edge.to : edge.from),
        )
        .filter((level): level is number => level !== undefined);
      levels.set(
        node.id,
        connectedLevels.length > 0 ? Math.max(...connectedLevels) + 1 : 0,
      );
    }
  });

  return levels;
}

function arrangeNodes(graph: MapGraph, layout: Exclude<LayoutMode, 'freeform'>) {
  const levels = getGraphLevels(graph);
  const groups = new Map<number, MapNode[]>();

  graph.nodes.forEach((node) => {
    const level = levels.get(node.id) ?? 0;
    groups.set(level, [...(groups.get(level) ?? []), node]);
  });

  const maxLevel = Math.max(0, ...groups.keys());
  const positionById = new Map<string, CanvasPan>();

  if (layout === 'radial') {
    groups.forEach((nodes, level) => {
      if (level === 0 && nodes.length === 1) {
        positionById.set(nodes[0].id, { x: 0, y: 0 });
        return;
      }

      const radius = level === 0 ? 120 : 245 * level;
      nodes.forEach((node, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / nodes.length;
        positionById.set(node.id, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      });
    });
  } else {
    groups.forEach((nodes, level) => {
      const orderedNodes =
        layout === 'hierarchical'
          ? [...nodes].sort((first, second) => {
              const firstDegree = graph.edges.filter(
                (edge) => edge.from === first.id || edge.to === first.id,
              ).length;
              const secondDegree = graph.edges.filter(
                (edge) => edge.from === second.id || edge.to === second.id,
              ).length;
              return secondDegree - firstDegree;
            })
          : nodes;

      orderedNodes.forEach((node, index) => {
        const centeredIndex = index - (orderedNodes.length - 1) / 2;

        if (layout === 'left-to-right') {
          positionById.set(node.id, {
            x: (level - maxLevel / 2) * 330,
            y: centeredIndex * 165,
          });
        } else {
          positionById.set(node.id, {
            x:
              centeredIndex * (layout === 'hierarchical' ? 250 : 285) +
              (layout === 'hierarchical' && level % 2 === 1 ? 70 : 0),
            y:
              (level - maxLevel / 2) *
              (layout === 'hierarchical' ? 205 : 190),
          });
        }
      });
    });
  }

  return graph.nodes.map((node) => ({
    ...node,
    ...(positionById.get(node.id) ?? { x: node.x, y: node.y }),
  }));
}

function getHiddenDescendantIds(
  graph: MapGraph,
  collapsedNodeIds: Set<string>,
) {
  const hiddenNodeIds = new Set<string>();

  collapsedNodeIds.forEach((collapsedNodeId) => {
    const visited = new Set<string>([collapsedNodeId]);
    const queue = graph.edges
      .filter((edge) => edge.from === collapsedNodeId)
      .map((edge) => edge.to);

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || visited.has(nodeId)) continue;

      visited.add(nodeId);
      hiddenNodeIds.add(nodeId);
      graph.edges
        .filter((edge) => edge.from === nodeId)
        .forEach((edge) => queue.push(edge.to));
    }
  });

  return hiddenNodeIds;
}

type SaveStatus = 'saving' | 'saved';
type GraphHistoryEntry = {
  graph: MapGraph;
  cardImages?: Record<string, StoredCardImage | null>;
  nodeImages?: Record<string, StoredNodeImage[]>;
};

function MapCanvas({
  mapId,
  mapName,
  onSaveStatusChange,
  onRenameMap,
  onCreateComparisonMap,
}: {
  mapId: string;
  mapName: string;
  onSaveStatusChange: (status: SaveStatus) => void;
  onRenameMap: (name: string) => void;
  onCreateComparisonMap: (map: KnowledgeMap, graph: MapGraph) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const formatPanelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(
    null,
  );
  const nodeDragRef = useRef<{
    pointerId: number;
    nodeId: string;
    x: number;
    y: number;
    startGraph: MapGraph;
    historyRecorded: boolean;
  } | null>(null);
  const annotationDragRef = useRef<{
    pointerId: number;
    annotationId: string;
    x: number;
    y: number;
    startGraph: MapGraph;
    historyRecorded: boolean;
  } | null>(null);
  const drawingRef = useRef<{
    pointerId: number;
    stroke: DrawingStroke;
  } | null>(null);
  const eraserRef = useRef<{
    pointerId: number;
    startGraph: MapGraph;
    removedIds: Set<string>;
  } | null>(null);
  const mediaDragRef = useRef<{ pointerId: number; id: string; x: number; y: number; startGraph: MapGraph } | null>(null);
  const mapMediaInputRef = useRef<HTMLInputElement>(null);
  const mapBackgroundInputRef = useRef<HTMLInputElement>(null);
  const formatPanelTimerRef = useRef<number | null>(null);
  const formatPanelDragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const connectionDragRef = useRef<{
    pointerId: number;
    sourceId: string;
  } | null>(null);
  const [pan, setPan] = useState<CanvasPan>({ x: 0, y: 0 });
  const [graph, setGraph] = useState<MapGraph>(() =>
    readStoredMapGraph(mapId, mapName),
  );
  const [undoStack, setUndoStack] = useState<GraphHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<GraphHistoryEntry[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#263c6a');
  const [drawingWidth, setDrawingWidth] = useState(3);
  const [activeDrawing, setActiveDrawing] = useState<DrawingStroke | null>(null);
  const [mapMediaUrls, setMapMediaUrls] = useState<Record<string, string>>({});
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false);
  const [isFlashcardMenuOpen, setIsFlashcardMenuOpen] = useState(false);
  const [isContextMoreMenuOpen, setIsContextMoreMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const [mapBackgroundStyle, setMapBackgroundStyle] = useState<BackgroundStyle>(() => readMapBackgroundStyle(mapId));
  const [mapBackgroundUrl, setMapBackgroundUrl] = useState('');
  const [isMapBackgroundPanelOpen, setIsMapBackgroundPanelOpen] = useState(false);
  const [isAnimationPanelOpen, setIsAnimationPanelOpen] = useState(false);
  const [animationReplay, setAnimationReplay] = useState<Record<string, number>>({});
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isConnectionMode, setIsConnectionMode] = useState(false);
  const [connectionDraft, setConnectionDraft] =
    useState<ConnectionDraft | null>(null);
  const [connectionTargetId, setConnectionTargetId] = useState<string | null>(
    null,
  );
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    () => readStoredMapViewState(mapId).layoutMode,
  );
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<CanvasPan | null>(
    () => readStoredMapViewState(mapId).toolbarPosition ?? null,
  );
  const [isToolbarVisible, setIsToolbarVisible] = useState(
    () => readStoredMapViewState(mapId).toolbarVisible !== false,
  );
  const [showMasteryIndicators, setShowMasteryIndicators] = useState(
    () => readStoredMapViewState(mapId).showMasteryIndicators !== false,
  );
  const [branchStyle, setBranchStyle] = useState<BranchStyle>(
    () => readStoredMapViewState(mapId).branchStyle ?? 'straight',
  );
  const [isBranchPanelOpen, setIsBranchPanelOpen] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    () => new Set(readStoredMapViewState(mapId).collapsedNodeIds),
  );
  const [detailsNodeId, setDetailsNodeId] = useState<string | null>(null);
  const [detailsDraft, setDetailsDraft] = useState<NodeDetailsDraft | null>(
    null,
  );
  const [isDifferentialViewOpen, setIsDifferentialViewOpen] = useState(false);
  const [isCompareSelectionMode, setIsCompareSelectionMode] = useState(false);
  const [comparisonNodeIds, setComparisonNodeIds] = useState<string[]>([]);
  const [isComparisonWorkspaceOpen, setIsComparisonWorkspaceOpen] = useState(false);
  const [isStudyModeOpen, setIsStudyModeOpen] = useState(false);
  const [isFlashcardStudyOpen, setIsFlashcardStudyOpen] = useState(false);
  const [flashcardDraft, setFlashcardDraft] = useState<{
    nodeId: string;
    index?: number;
    id: string;
    question: string;
    answer: string;
    explanation: string;
    tags: string;
    difficulty: 'easy' | 'medium' | 'hard';
    imageName?: string;
  } | null>(null);
  const [flashcardImageFile, setFlashcardImageFile] = useState<File | null>(null);
  const [removeFlashcardImage, setRemoveFlashcardImage] = useState(false);
  const [flashcardImageUrls, setFlashcardImageUrls] = useState<Record<string, string>>({});
  type AiActionType = 'explain' | 'expandNode' | 'generateChildren' | 'generateFlashcards' | 'generateQuiz' | 'simplify' | 'addExamples' | 'identifyMissing';
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [activeAiAction, setActiveAiAction] = useState<AiActionType | null>(null);
  const [aiTargetNodeId, setAiTargetNodeId] = useState<string | null>(null);
  const [aiSelectedItems, setAiSelectedItems] = useState<Set<string>>(new Set());
  const aiOperation = useAiOperation();
  const [isFormatPanelReady, setIsFormatPanelReady] = useState(false);
  const [cardImageUrls, setCardImageUrls] = useState<Record<string, string>>({});
  const [nodeImagesRevision, setNodeImagesRevision] = useState(0);
  const cardImageUrlsRef = useRef<Record<string, string>>({});
  const graphRef = useRef(graph);
  const saveTimerRef = useRef<number | null>(null);
  const pendingAsyncWritesRef = useRef(0);
  const isHistoryBusyRef = useRef(false);
  const [formatPanelPosition, setFormatPanelPosition] =
    useState<CanvasPan | null>(
      () => readStoredMapViewState(mapId).formatPanelPosition ?? null,
    );
  const [isChildDialogOpen, setIsChildDialogOpen] = useState(false);
  const [childParentId, setChildParentId] = useState<string | null>(null);
  const [isCreatingSeparateNode, setIsCreatingSeparateNode] = useState(false);
  const [childText, setChildText] = useState('');
  const [childTextError, setChildTextError] = useState('');
  const childTextInputRef = useRef<HTMLInputElement>(null);
  const [isAnnotationDialogOpen, setIsAnnotationDialogOpen] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationTextError, setAnnotationTextError] = useState('');
  const annotationTextInputRef = useRef<HTMLTextAreaElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  const clampFormatPanelPosition = (position: CanvasPan): CanvasPan => {
    const canvas = canvasRef.current;
    const panel = formatPanelRef.current;
    if (!canvas || !panel) return position;
    const margin = 12;
    return {
      x: Math.min(
        Math.max(margin, position.x),
        Math.max(margin, canvas.clientWidth - panel.offsetWidth - margin),
      ),
      y: Math.min(
        Math.max(margin, position.y),
        Math.max(margin, canvas.clientHeight - panel.offsetHeight - margin),
      ),
    };
  };

  useEffect(() => {
    graphRef.current = graph;
    onSaveStatusChange('saving');
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      writeStoredMapGraph(mapId, graphRef.current);
      touchStoredMap(mapId);
      saveTimerRef.current = null;
      onSaveStatusChange('saved');
    }, 400);
  }, [graph, mapId, onSaveStatusChange]);

  useEffect(() => {
    const flushPendingGraphSave = () => {
      if (saveTimerRef.current === null) return;
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      writeStoredMapGraph(mapId, graphRef.current);
      touchStoredMap(mapId);
      onSaveStatusChange('saved');
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingGraphSave();
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      flushPendingGraphSave();
      if (pendingAsyncWritesRef.current > 0) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('pagehide', flushPendingGraphSave);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      flushPendingGraphSave();
      window.removeEventListener('pagehide', flushPendingGraphSave);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mapId, onSaveStatusChange]);

  useEffect(() => {
    writeMapBackgroundStyle(mapId, mapBackgroundStyle);
  }, [mapBackgroundStyle, mapId]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    getMapCanvasBackground(mapId).then((record) => {
      if (!active || !record) return;
      objectUrl = URL.createObjectURL(record.blob);
      setMapBackgroundUrl(objectUrl);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mapId]);

  const uploadMapBackground = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    await setMapCanvasBackground(mapId, file);
    setMapBackgroundUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  const resetMapBackground = async () => {
    await deleteMapCanvasBackground(mapId);
    setMapBackgroundUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
    setMapBackgroundStyle(defaultBackgroundStyle);
  };

  useEffect(() => {
    let active = true;
    listFloatingMedia(mapId).then((records) => {
      if (!active) return;
      const next: Record<string, string> = {};
      records.forEach((record) => { next[record.id] = URL.createObjectURL(record.blob); });
      setMapMediaUrls((current) => {
        Object.values(current).forEach(URL.revokeObjectURL);
        return next;
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [mapId, graph.media?.length]);

  const uploadMapMedia = async (file?: File) => {
    if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return;
    const id = `${mapId}-media-${crypto.randomUUID()}`;
    const item: FloatingMediaItem = {
      id,
      kind: file.type.startsWith('video/') ? 'video' : 'image',
      name: file.name,
      x: 280,
      y: 170 + (graph.media?.length ?? 0) * 36,
      width: 300,
    };
    await setFloatingMedia(mapId, id, file);
    setMapMediaUrls((current) => ({ ...current, [id]: URL.createObjectURL(file) }));
    commitGraphChange((current) => ({ ...current, media: [...(current.media ?? []), item] }));
    setSelectedMediaId(id);
  };

  const deleteMapMediaItem = async (id: string) => {
    await deleteFloatingMedia(id);
    setMapMediaUrls((current) => {
      if (current[id]) URL.revokeObjectURL(current[id]);
      const next = { ...current };
      delete next[id];
      return next;
    });
    commitGraphChange((current) => ({ ...current, media: (current.media ?? []).filter((item) => item.id !== id) }));
    setSelectedMediaId(null);
  };

  const resizeMapMedia = (id: string, amount: number) =>
    commitGraphChange((current) => ({
      ...current,
      media: (current.media ?? []).map((item) =>
        item.id === id ? { ...item, width: Math.min(800, Math.max(120, item.width + amount)) } : item,
      ),
    }));

  const startMapMediaDrag = (id: string, event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    setSelectedMediaId(id);
    setSelectedNodeId(null);
    setSelectedAnnotationId(null);
    setIsFormatPanelReady(false);
    setIsExportMenuOpen(false);
    setIsMoreMenuOpen(false);
    setIsSearchOpen(false);
    setIsImageMenuOpen(false);
    setIsAiMenuOpen(false);
    setIsFlashcardMenuOpen(false);
    setIsContextMoreMenuOpen(false);
    setIsLayoutMenuOpen(false);
    setIsAnimationPanelOpen(false);
    setIsBranchPanelOpen(false);
    setIsMapBackgroundPanelOpen(false);
    mediaDragRef.current = { pointerId: event.pointerId, id, x: event.clientX, y: event.clientY, startGraph: graph };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveMapMedia = (event: PointerEvent<HTMLElement>) => {
    const drag = mediaDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.x) / zoom;
    const dy = (event.clientY - drag.y) / zoom;
    mediaDragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setGraph((current) => ({
      ...current,
      media: (current.media ?? []).map((media) =>
        media.id === drag.id ? { ...media, x: media.x + dx, y: media.y + dy } : media,
      ),
    }));
  };

  const stopMapMediaDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = mediaDragRef.current;
    if (drag?.pointerId === event.pointerId) {
      setUndoStack((current) => [...current, { graph: drag.startGraph }]);
      setRedoStack([]);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    mediaDragRef.current = null;
  };

  const cardImageNodeIdsKey = graph.nodes
    .filter((node) => node.cardStyle?.imageMode)
    .map((node) => node.id)
    .sort()
    .join('|');

  useEffect(() => {
    let active = true;
    const styledIds = cardImageNodeIdsKey ? cardImageNodeIdsKey.split('|') : [];
    Promise.all(styledIds.map(async (nodeId) => ({ nodeId, image: await getCardImage(mapId, nodeId) })))
      .then((images) => {
        if (!active) return;
        const next: Record<string, string> = {};
        images.forEach(({ nodeId, image }) => { if (image) next[nodeId] = URL.createObjectURL(image.blob); });
        Object.values(cardImageUrlsRef.current).forEach(URL.revokeObjectURL);
        cardImageUrlsRef.current = next;
        setCardImageUrls(next);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [cardImageNodeIdsKey, mapId]);

  useEffect(() => () => {
    Object.values(cardImageUrlsRef.current).forEach(URL.revokeObjectURL);
  }, []);

  const flashcardIdsKey = graph.nodes.flatMap((node) => (node.flashcards ?? []).map((card) => card.id).filter(Boolean)).sort().join('|');
  useEffect(() => {
    let active = true;
    const ids = flashcardIdsKey ? flashcardIdsKey.split('|') : [];
    Promise.all(ids.map(async (id) => ({ id, image: await getFlashcardImage(mapId, id) }))).then((images) => {
      if (!active) return;
      const next: Record<string, string> = {};
      images.forEach(({ id, image }) => { if (image) next[id] = URL.createObjectURL(image.blob); });
      setFlashcardImageUrls((previous) => {
        Object.values(previous).forEach(URL.revokeObjectURL);
        return next;
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [flashcardIdsKey, mapId]);

  useEffect(() => {
    writeStoredMapViewState(mapId, {
      layoutMode,
      collapsedNodeIds: Array.from(collapsedNodeIds),
      formatPanelPosition: formatPanelPosition ?? undefined,
      toolbarPosition: toolbarPosition ?? undefined,
      toolbarVisible: isToolbarVisible,
      branchStyle,
      showMasteryIndicators,
    });
  }, [branchStyle, collapsedNodeIds, formatPanelPosition, isToolbarVisible, layoutMode, mapId, showMasteryIndicators, toolbarPosition]);

  useEffect(() => {
    if (!isToolbarVisible || window.innerWidth > 760) return;
    const frame = window.requestAnimationFrame(() => {
      if (toolbarRef.current) toolbarRef.current.scrollLeft = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isToolbarVisible]);

  useEffect(() => {
    const keepPanelInView = () => {
      setFormatPanelPosition((currentPosition) =>
        currentPosition
          ? clampFormatPanelPosition(currentPosition)
          : currentPosition,
      );
    };
    window.addEventListener('resize', keepPanelInView);
    return () => window.removeEventListener('resize', keepPanelInView);
  }, []);

  useEffect(() => {
    const keepToolbarInView = () => {
      window.requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        const toolbar = toolbarRef.current;
        if (!canvas || !toolbar) return;

        setToolbarPosition((currentPosition) => {
          if (!currentPosition) return currentPosition;
          const margin = 8;
          return {
            x: Math.min(
              Math.max(margin, currentPosition.x),
              Math.max(margin, canvas.clientWidth - toolbar.offsetWidth - margin),
            ),
            y: Math.min(
              Math.max(margin, currentPosition.y),
              Math.max(margin, canvas.clientHeight - toolbar.offsetHeight - margin),
            ),
          };
        });
      });
    };

    window.addEventListener('resize', keepToolbarInView);
    window.addEventListener('orientationchange', keepToolbarInView);
    return () => {
      window.removeEventListener('resize', keepToolbarInView);
      window.removeEventListener('orientationchange', keepToolbarInView);
    };
  }, []);

  useEffect(() => {
    if (!isFormatPanelReady || !formatPanelPosition) return;
    const frame = window.requestAnimationFrame(() => {
      setFormatPanelPosition((currentPosition) =>
        currentPosition
          ? clampFormatPanelPosition(currentPosition)
          : currentPosition,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isFormatPanelReady]);

  useEffect(() => {
    if (!isChildDialogOpen) return;

    const focusTimer = window.setTimeout(
      () => childTextInputRef.current?.focus(),
      0,
    );
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChildDialog();
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isChildDialogOpen]);

  useEffect(() => {
    if (!isAnnotationDialogOpen) return;
    const focusTimer = window.setTimeout(
      () => annotationTextInputRef.current?.focus(),
      0,
    );
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAnnotationDialog();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAnnotationDialogOpen]);

  useEffect(() => {
    if (!isLayoutMenuOpen) return;

    const closeMenu = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !layoutMenuRef.current?.contains(event.target)
      ) {
        setIsLayoutMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLayoutMenuOpen(false);
    };

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isLayoutMenuOpen]);

  useEffect(() => {
    if (!detailsNodeId) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNodeDetails();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [detailsNodeId]);

  useEffect(
    () => () => {
      if (formatPanelTimerRef.current !== null) {
        window.clearTimeout(formatPanelTimerRef.current);
      }
    },
    [],
  );

  const commitGraphChange = (
    update: MapGraph | ((currentGraph: MapGraph) => MapGraph),
  ) => {
    const nextGraph =
      typeof update === 'function' ? update(graph) : update;
    if (nextGraph === graph) return;

    setUndoStack((currentStack) => [
      ...currentStack.slice(-99),
      { graph },
    ]);
    setRedoStack([]);
    setGraph(nextGraph);
  };

  const readCardImageSnapshots = async (nodeIds: string[]) => Object.fromEntries(
    await Promise.all(nodeIds.map(async (nodeId) => [nodeId, (await getCardImage(mapId, nodeId)) ?? null] as const)),
  );

  const readNodeImageSnapshots = async (nodeIds: string[]) => Object.fromEntries(
    await Promise.all(nodeIds.map(async (nodeId) => [nodeId, await listNodeImages(mapId, nodeId)] as const)),
  );

  const applyCardImageSnapshots = async (snapshots?: Record<string, StoredCardImage | null>) => {
    if (!snapshots) return;
    pendingAsyncWritesRef.current += 1;
    onSaveStatusChange('saving');
    try {
      await Promise.all(Object.entries(snapshots).map(([nodeId, image]) =>
        image
          ? setCardImage(mapId, nodeId, new File([image.blob], image.name, { type: image.type }))
          : deleteCardImage(mapId, nodeId),
      ));
      const nextUrls = { ...cardImageUrlsRef.current };
      Object.entries(snapshots).forEach(([nodeId, image]) => {
        if (nextUrls[nodeId]) URL.revokeObjectURL(nextUrls[nodeId]);
        if (image) nextUrls[nodeId] = URL.createObjectURL(image.blob);
        else delete nextUrls[nodeId];
      });
      cardImageUrlsRef.current = nextUrls;
      setCardImageUrls(nextUrls);
    } finally {
      pendingAsyncWritesRef.current -= 1;
      if (pendingAsyncWritesRef.current === 0) onSaveStatusChange('saved');
    }
  };

  const applyNodeImageSnapshots = async (snapshots?: Record<string, StoredNodeImage[]>) => {
    if (!snapshots) return;
    pendingAsyncWritesRef.current += 1;
    onSaveStatusChange('saving');
    try {
      await Promise.all(Object.entries(snapshots).map(([nodeId, images]) =>
        replaceNodeImages(mapId, nodeId, images),
      ));
      setNodeImagesRevision((current) => current + 1);
    } finally {
      pendingAsyncWritesRef.current -= 1;
      if (pendingAsyncWritesRef.current === 0) onSaveStatusChange('saved');
    }
  };

  const recordNodeImageHistory = (nodeId: string, previousImages: StoredNodeImage[]) => {
    setUndoStack((current) => [
      ...current.slice(-99),
      { graph, nodeImages: { [nodeId]: previousImages } },
    ]);
    setRedoStack([]);
  };

  const undoGraphChange = async () => {
    if (isHistoryBusyRef.current) return;
    const previousEntry = undoStack.at(-1);
    if (!previousEntry) return;
    isHistoryBusyRef.current = true;
    try {
      const imageNodeIds = Object.keys(previousEntry.cardImages ?? {});
      const currentImages = imageNodeIds.length > 0 ? await readCardImageSnapshots(imageNodeIds) : undefined;
      const nodeImageNodeIds = Object.keys(previousEntry.nodeImages ?? {});
      const currentNodeImages = nodeImageNodeIds.length > 0 ? await readNodeImageSnapshots(nodeImageNodeIds) : undefined;
      setUndoStack(undoStack.slice(0, -1));
      setRedoStack([
        ...redoStack.slice(-99),
        { graph, cardImages: currentImages, nodeImages: currentNodeImages },
      ]);
      await applyCardImageSnapshots(previousEntry.cardImages);
      await applyNodeImageSnapshots(previousEntry.nodeImages);
      setGraph(previousEntry.graph);
      setSelectedNodeId(null);
      setSelectedAnnotationId(null);
      setDetailsNodeId(null);
      setDetailsDraft(null);
      setIsDifferentialViewOpen(false);
    } finally {
      isHistoryBusyRef.current = false;
    }
  };

  const redoGraphChange = async () => {
    if (isHistoryBusyRef.current) return;
    const nextEntry = redoStack.at(-1);
    if (!nextEntry) return;
    isHistoryBusyRef.current = true;
    try {
      const imageNodeIds = Object.keys(nextEntry.cardImages ?? {});
      const currentImages = imageNodeIds.length > 0 ? await readCardImageSnapshots(imageNodeIds) : undefined;
      const nodeImageNodeIds = Object.keys(nextEntry.nodeImages ?? {});
      const currentNodeImages = nodeImageNodeIds.length > 0 ? await readNodeImageSnapshots(nodeImageNodeIds) : undefined;
      setRedoStack(redoStack.slice(0, -1));
      setUndoStack([
        ...undoStack.slice(-99),
        { graph, cardImages: currentImages, nodeImages: currentNodeImages },
      ]);
      await applyCardImageSnapshots(nextEntry.cardImages);
      await applyNodeImageSnapshots(nextEntry.nodeImages);
      setGraph(nextEntry.graph);
      setSelectedNodeId(null);
      setSelectedAnnotationId(null);
      setDetailsNodeId(null);
      setDetailsDraft(null);
      setIsDifferentialViewOpen(false);
    } finally {
      isHistoryBusyRef.current = false;
    }
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      if (event.shiftKey) void redoGraphChange();
      else void undoGraphChange();
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [graph, redoStack, undoStack]);

  useEffect(() => {
    const handleCommandPaletteShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        setCommandQuery('');
        window.setTimeout(() => commandInputRef.current?.focus(), 0);
      } else if (event.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleCommandPaletteShortcut);
    return () => window.removeEventListener('keydown', handleCommandPaletteShortcut);
  }, []);

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const focusNode = (nodeId: string) => {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const targetZoom = Math.max(1.15, zoom);
    setCollapsedNodeIds(new Set());
    setSelectedNodeId(node.id);
    setZoom(targetZoom);
    setPan({ x: -node.x * targetZoom, y: -node.y * targetZoom });
  };

  const fitMapToScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas || visibleNodes.length === 0) return;
    const xs = visibleNodes.map((node) => node.x);
    const ys = visibleNodes.map((node) => node.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const targetZoom = clampZoom(Math.min(
      (canvas.clientWidth - 80) / Math.max(260, maxX - minX + 320),
      (canvas.clientHeight - 140) / Math.max(180, maxY - minY + 220),
      1.25,
    ));
    setZoom(targetZoom);
    setPan({
      x: -((minX + maxX) / 2) * targetZoom,
      y: -((minY + maxY) / 2) * targetZoom,
    });
  };

  const startFormatPanelDrag = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      event.target instanceof Element &&
      event.target.closest('button, input, textarea, select, label')
    ) {
      return;
    }
    const panel = formatPanelRef.current;
    const canvas = canvasRef.current;
    if (!panel || !canvas) return;
    event.preventDefault();
    event.stopPropagation();
    const panelBounds = panel.getBoundingClientRect();
    formatPanelDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - panelBounds.left,
      offsetY: event.clientY - panelBounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveFormatPanel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = formatPanelDragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return;
    event.preventDefault();
    event.stopPropagation();
    const canvasBounds = canvas.getBoundingClientRect();
    setFormatPanelPosition(
      clampFormatPanelPosition({
        x: event.clientX - canvasBounds.left - drag.offsetX,
        y: event.clientY - canvasBounds.top - drag.offsetY,
      }),
    );
  };

  const stopFormatPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = formatPanelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    formatPanelDragRef.current = null;
  };

  const zoomBy = (amount: number) => {
    setZoom((currentZoom) => clampZoom(currentZoom + amount));
  };

  const exportNotesPdf = () => {
    const blob = createNotesPdf(mapName, graph.nodes);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mapName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'knowledge-map'}-notes.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const printNotes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Allow pop-ups to print your notes.');
      return;
    }
    printWindow.opener = null;
    const escapeHtml = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const lines = notesAsLines(mapName, graph.nodes);
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(mapName)} — Notes</title><style>
      @page{margin:18mm}body{font-family:Arial,sans-serif;color:#1f2c4c;line-height:1.55;max-width:760px;margin:0 auto}
      h1{font-family:Georgia,serif;font-size:28px;margin:0 0 24px;border-bottom:1px solid #d7d0c3;padding-bottom:12px}
      pre{font:14px/1.55 Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}
    </style></head><body><h1>${escapeHtml(mapName)} — Notes</h1><pre>${escapeHtml(lines.slice(2).join('\\n'))}</pre></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const getDrawingPoint = (event: PointerEvent<HTMLDivElement>): DrawingPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - bounds.width / 2 - pan.x) / zoom,
      y: (event.clientY - bounds.top - bounds.height / 2 - pan.y) / zoom,
    };
  };

  const eraseAtPoint = (point: DrawingPoint) => {
    const eraser = eraserRef.current;
    if (!eraser) return;
    const radius = 18 / zoom;
    setGraph((currentGraph) => {
      const nextDrawings = (currentGraph.drawings ?? []).filter((stroke) => {
        const isHit = stroke.points.some(
          (strokePoint) =>
            Math.hypot(point.x - strokePoint.x, point.y - strokePoint.y) <=
            radius + stroke.width / 2,
        );
        if (isHit) eraser.removedIds.add(stroke.id);
        return !isHit;
      });
      return nextDrawings.length === (currentGraph.drawings ?? []).length
        ? currentGraph
        : { ...currentGraph, drawings: nextDrawings };
    });
  };

  const handleCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isEraserMode) {
      const point = getDrawingPoint(event);
      if (!point) return;
      event.preventDefault();
      eraserRef.current = {
        pointerId: event.pointerId,
        startGraph: graph,
        removedIds: new Set(),
      };
      eraseAtPoint(point);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (isDrawingMode) {
      const point = getDrawingPoint(event);
      if (!point) return;
      event.preventDefault();
      const stroke: DrawingStroke = {
        id: createDrawingId(graph.drawings ?? []),
        color: drawingColor,
        width: drawingWidth,
        points: [point],
      };
      drawingRef.current = { pointerId: event.pointerId, stroke };
      setActiveDrawing(stroke);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.currentTarget !== event.target) return;

    setSelectedNodeId(null);
    setSelectedAnnotationId(null);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const handleCanvasPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const eraser = eraserRef.current;
    if (eraser && eraser.pointerId === event.pointerId) {
      const point = getDrawingPoint(event);
      if (point) eraseAtPoint(point);
      return;
    }
    const drawing = drawingRef.current;
    if (drawing && drawing.pointerId === event.pointerId) {
      const point = getDrawingPoint(event);
      if (!point) return;
      const previousPoint = drawing.stroke.points.at(-1);
      if (
        previousPoint &&
        Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) < 1.5
      ) {
        return;
      }
      const stroke = {
        ...drawing.stroke,
        points: [...drawing.stroke.points, point],
      };
      drawingRef.current = { ...drawing, stroke };
      setActiveDrawing(stroke);
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setPan((currentPan) => ({
      x: currentPan.x + deltaX,
      y: currentPan.y + deltaY,
    }));
  };

  const stopPanning = (event: PointerEvent<HTMLDivElement>) => {
    const eraser = eraserRef.current;
    if (eraser && eraser.pointerId === event.pointerId) {
      if (eraser.removedIds.size > 0) {
        setUndoStack((currentStack) => [...currentStack, { graph: eraser.startGraph }]);
        setRedoStack([]);
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      eraserRef.current = null;
      return;
    }
    const drawing = drawingRef.current;
    if (drawing && drawing.pointerId === event.pointerId) {
      const stroke =
        drawing.stroke.points.length === 1
          ? {
              ...drawing.stroke,
              points: [
                ...drawing.stroke.points,
                {
                  x: drawing.stroke.points[0].x + 0.01,
                  y: drawing.stroke.points[0].y + 0.01,
                },
              ],
            }
          : drawing.stroke;
      commitGraphChange((currentGraph) => ({
        ...currentGraph,
        drawings: [...(currentGraph.drawings ?? []), stroke],
      }));
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      drawingRef.current = null;
      setActiveDrawing(null);
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsPanning(false);
  };

  const handleNodePointerDown = (
    nodeId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedAnnotationId(null);
    nodeDragRef.current = {
      pointerId: event.pointerId,
      nodeId,
      x: event.clientX,
      y: event.clientY,
      startGraph: graph,
      historyRecorded: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingNodeId(nodeId);
  };

  const handleNodePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = (event.clientX - drag.x) / zoom;
    const deltaY = (event.clientY - drag.y) / zoom;
    if (deltaX === 0 && deltaY === 0) return;

    if (!drag.historyRecorded) {
      setUndoStack((currentStack) => [
        ...currentStack.slice(-99),
        { graph: drag.startGraph },
      ]);
      setRedoStack([]);
    }
    nodeDragRef.current = {
      ...drag,
      x: event.clientX,
      y: event.clientY,
      historyRecorded: true,
    };
    setGraph((currentGraph) => ({
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) =>
        node.id === drag.nodeId
          ? { ...node, x: node.x + deltaX, y: node.y + deltaY }
          : node,
      ),
    }));
  };

  const stopDraggingNode = (event: PointerEvent<HTMLDivElement>) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    nodeDragRef.current = null;
    setDraggingNodeId(null);
  };

  const handleAnnotationPointerDown = (
    annotationId: string,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.stopPropagation();
    setSelectedNodeId(null);
    setSelectedAnnotationId(annotationId);
    annotationDragRef.current = {
      pointerId: event.pointerId,
      annotationId,
      x: event.clientX,
      y: event.clientY,
      startGraph: graph,
      historyRecorded: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAnnotationPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = annotationDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - drag.x) / zoom;
    const deltaY = (event.clientY - drag.y) / zoom;
    if (deltaX === 0 && deltaY === 0) return;
    if (!drag.historyRecorded) {
      setUndoStack((currentStack) => [...currentStack.slice(-99), { graph: drag.startGraph }]);
      setRedoStack([]);
    }
    annotationDragRef.current = {
      ...drag,
      x: event.clientX,
      y: event.clientY,
      historyRecorded: true,
    };
    setGraph((currentGraph) => ({
      ...currentGraph,
      annotations: (currentGraph.annotations ?? []).map((annotation) =>
        annotation.id === drag.annotationId
          ? { ...annotation, x: annotation.x + deltaX, y: annotation.y + deltaY }
          : annotation,
      ),
    }));
  };

  const stopDraggingAnnotation = (event: PointerEvent<HTMLDivElement>) => {
    const drag = annotationDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    annotationDragRef.current = null;
  };

  const getCanvasPoint = (clientX: number, clientY: number): CanvasPan | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const bounds = canvas.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - bounds.width / 2 - pan.x) / zoom,
      y: (clientY - bounds.top - bounds.height / 2 - pan.y) / zoom,
    };
  };

  const findConnectionTarget = (
    clientX: number,
    clientY: number,
    sourceId: string,
  ) => {
    const target = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-node-id]');
    const targetId = target?.dataset.nodeId ?? null;
    return targetId && targetId !== sourceId ? targetId : null;
  };

  const handleConnectorPointerDown = (
    sourceId: string,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    connectionDragRef.current = {
      pointerId: event.pointerId,
      sourceId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setConnectionDraft({ sourceId, ...point });
    setConnectionTargetId(null);
  };

  const handleConnectorPointerMove = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    const drag = connectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    setConnectionDraft({ sourceId: drag.sourceId, ...point });
    setConnectionTargetId(
      findConnectionTarget(event.clientX, event.clientY, drag.sourceId),
    );
  };

  const stopConnecting = (
    event: PointerEvent<HTMLButtonElement>,
    shouldCreateConnection: boolean,
  ) => {
    const drag = connectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const targetId = shouldCreateConnection
      ? findConnectionTarget(event.clientX, event.clientY, drag.sourceId)
      : null;

    if (targetId) {
      commitGraphChange((currentGraph) => {
        const connectionExists = currentGraph.edges.some(
          (edge) => edge.from === drag.sourceId && edge.to === targetId,
        );
        if (connectionExists) return currentGraph;

        return {
          ...currentGraph,
          edges: [
            ...currentGraph.edges,
            {
              id: createEdgeId(currentGraph.edges),
              from: drag.sourceId,
              to: targetId,
            },
          ],
        };
      });
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    connectionDragRef.current = null;
    setConnectionDraft(null);
    setConnectionTargetId(null);
  };

  const toggleConnectionMode = () => {
    setIsConnectionMode((currentMode) => {
      const nextMode = !currentMode;
      if (nextMode) {
        setIsDrawingMode(false);
        setIsEraserMode(false);
      }
      return nextMode;
    });
    setSelectedNodeId(null);
    setConnectionDraft(null);
    setConnectionTargetId(null);
    connectionDragRef.current = null;
  };

  const toggleDrawingMode = () => {
    setIsDrawingMode((currentMode) => {
      const nextMode = !currentMode;
      if (nextMode) {
        setIsConnectionMode(false);
        setIsEraserMode(false);
        setSelectedNodeId(null);
        setSelectedAnnotationId(null);
        setIsFormatPanelReady(false);
      }
      return nextMode;
    });
  };

  const toggleEraserMode = () => {
    setIsEraserMode((currentMode) => {
      const nextMode = !currentMode;
      if (nextMode) {
        setIsDrawingMode(false);
        setIsConnectionMode(false);
        setSelectedNodeId(null);
        setSelectedAnnotationId(null);
        setIsFormatPanelReady(false);
      }
      return nextMode;
    });
  };

  const clearDrawings = () => {
    if ((graph.drawings ?? []).length === 0) return;
    commitGraphChange((currentGraph) => ({
      ...currentGraph,
      drawings: [],
    }));
  };

  const applyLayout = (nextLayout: LayoutMode) => {
    setLayoutMode(nextLayout);
    touchStoredMap(mapId);
    setIsLayoutMenuOpen(false);

    if (nextLayout === 'freeform') return;

    commitGraphChange((currentGraph) => ({
      ...currentGraph,
      nodes: arrangeNodes(currentGraph, nextLayout),
    }));
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const updateNodeFormatting = (
    nodeId: string,
    updates: Partial<Pick<MapNode, 'shape' | 'size' | 'cardStyle'>>,
  ) => {
    const currentGraph = graphRef.current;
    const nextGraph = {
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node,
      ),
    };
    if (nextGraph === currentGraph) return;
    setUndoStack((currentStack) => [
      ...currentStack.slice(-99),
      { graph: currentGraph },
    ]);
    setRedoStack([]);
    graphRef.current = nextGraph;
    setGraph(nextGraph);
  };

  const updateCardStyle = (nodeId: string, updates: Partial<CardStyle>) => {
    commitGraphChange((currentGraph) => ({
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) =>
        node.id === nodeId ? { ...node, cardStyle: { ...node.cardStyle, ...updates } } : node,
      ),
    }));
  };

  const updateNodeMastery = (nodeId: string, updates: Partial<Pick<MapNode, 'masteryScore' | 'studyEnabled'>>) => {
    commitGraphChange((currentGraph) => ({
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              masteryScore: updates.masteryScore === undefined ? node.masteryScore : clampMasteryScore(updates.masteryScore),
              studyEnabled: updates.studyEnabled === undefined ? node.studyEnabled : updates.studyEnabled,
              reviewSchedule: updates.masteryScore === undefined
                ? node.reviewSchedule
                : {
                    ...normalizeReviewSchedule(node.reviewSchedule, node),
                    mastery: clampMasteryScore(updates.masteryScore),
                  },
            }
          : node,
      ),
    }));
  };

  const rateStudyAnswer = (nodeId: string, flashcardIndex: number | undefined, rating: StudyRating) => {
    commitGraphChange((currentGraph) => ({
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) =>
        node.id !== nodeId
          ? node
          : flashcardIndex === undefined
            ? (() => {
                const reviewSchedule = scheduleStudyReview(
                  normalizeReviewSchedule(node.reviewSchedule, node),
                  rating,
                );
                return {
                  ...node,
                  reviewSchedule,
                  masteryScore: reviewSchedule.mastery,
                  lastReviewedAt: reviewSchedule.lastReviewedAt,
                  nextReviewAt: reviewSchedule.nextReviewAt,
                };
              })()
            : {
                ...node,
                flashcards: (node.flashcards ?? []).map((card, index) =>
                  index === flashcardIndex
                    ? {
                        ...card,
                        reviewSchedule: scheduleStudyReview(
                          normalizeReviewSchedule(card.reviewSchedule),
                          rating,
                        ),
                      }
                    : card,
                ),
              },
      ),
    }));
  };

  const toggleComparisonNode = (nodeId: string) => {
    setComparisonNodeIds((current) => current.includes(nodeId)
      ? current.filter((id) => id !== nodeId)
      : current.length < 4 ? [...current, nodeId] : current);
  };

  const saveComparisonAsMap = (title: string, rows: ComparisonRow[]) => {
    const selected = comparisonNodeIds
      .map((id) => graph.nodes.find((node) => node.id === id))
      .filter((node): node is MapNode => Boolean(node));
    const id = `comparison-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const rootId = `root-${id}`;
    const nodes: MapNode[] = [{
      id: rootId,
      text: title,
      x: 0,
      y: -320,
      masteryScore: 0,
      studyEnabled: true,
      reviewSchedule: normalizeReviewSchedule(undefined),
    }];
    const edges: MapEdge[] = [];
    rows.forEach((row, rowIndex) => {
      const rowId = `comparison-row-${rowIndex}-${crypto.randomUUID()}`;
      const rowX = (rowIndex - (rows.length - 1) / 2) * 340;
      nodes.push({
        id: rowId,
        text: row.label || `Category ${rowIndex + 1}`,
        x: rowX,
        y: -40,
        masteryScore: 0,
        studyEnabled: true,
        reviewSchedule: normalizeReviewSchedule(undefined),
      });
      edges.push({ id: crypto.randomUUID(), from: rootId, to: rowId });
      selected.forEach((source, sourceIndex) => {
        const valueId = `comparison-value-${rowIndex}-${sourceIndex}-${crypto.randomUUID()}`;
        nodes.push({
          id: valueId,
          text: `${source.text}: ${row.values[source.id] || '—'}`,
          x: rowX + (sourceIndex - (selected.length - 1) / 2) * 190,
          y: 220,
          masteryScore: 0,
          studyEnabled: true,
          reviewSchedule: normalizeReviewSchedule(undefined),
        });
        edges.push({ id: crypto.randomUUID(), from: rowId, to: valueId });
      });
    });
    onCreateComparisonMap(
      { id, name: title, createdAt, updatedAt: createdAt },
      { nodes, edges, annotations: [], drawings: [], media: [] },
    );
    setIsComparisonWorkspaceOpen(false);
    setIsCompareSelectionMode(false);
    setComparisonNodeIds([]);
  };

  const openFlashcardEditor = (node: MapNode, index?: number, prefillFromNode = false) => {
    const card = index === undefined ? undefined : node.flashcards?.[index];
    const linkedNodes = graph.edges
      .filter((edge) => edge.from === node.id || edge.to === node.id)
      .map((edge) => graph.nodes.find((item) => item.id === (edge.from === node.id ? edge.to : edge.from)))
      .filter((item): item is MapNode => Boolean(item));
    setFlashcardDraft({
      nodeId: node.id,
      index,
      id: card?.id ?? `flashcard-${crypto.randomUUID()}`,
      question: card?.question ?? (prefillFromNode && linkedNodes.length ? `How is ${node.text} related to ${linkedNodes[0].text}?` : prefillFromNode ? node.text : ''),
      answer: card?.answer ?? (prefillFromNode ? linkedNodes.map((item) => item.text).join(', ') || node.details?.notes.trim() || node.text : ''),
      explanation: card?.explanation ?? '',
      tags: card?.tags?.join(', ') ?? '',
      difficulty: card?.difficulty ?? 'medium',
      imageName: card?.imageName,
    });
    setFlashcardImageFile(null);
    setRemoveFlashcardImage(false);
    setIsAiMenuOpen(false);
    setIsFlashcardMenuOpen(false);
  };

  const saveFlashcard = async (event: FormEvent) => {
    event.preventDefault();
    if (!flashcardDraft?.question.trim() || !flashcardDraft.answer.trim()) return;
    const node = graph.nodes.find((item) => item.id === flashcardDraft.nodeId);
    const existing = flashcardDraft.index === undefined ? undefined : node?.flashcards?.[flashcardDraft.index];
    const card: NodeFlashcard = {
      id: flashcardDraft.id,
      question: flashcardDraft.question.trim(),
      answer: flashcardDraft.answer.trim(),
      explanation: flashcardDraft.explanation.trim(),
      tags: flashcardDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      difficulty: flashcardDraft.difficulty,
      sourceNodeId: flashcardDraft.nodeId,
      imageName: removeFlashcardImage ? undefined : flashcardImageFile?.name ?? flashcardDraft.imageName,
      reviewSchedule: normalizeReviewSchedule(existing?.reviewSchedule),
    };
    commitGraphChange((current) => ({
      ...current,
      nodes: current.nodes.map((item) => item.id === flashcardDraft.nodeId ? {
        ...item,
        flashcards: flashcardDraft.index === undefined
          ? [...(item.flashcards ?? []), card]
          : (item.flashcards ?? []).map((value, index) => index === flashcardDraft.index ? card : value),
      } : item),
    }));
    if (removeFlashcardImage) await deleteFlashcardImage(mapId, card.id!);
    if (flashcardImageFile) await setFlashcardImage(mapId, card.id!, flashcardImageFile);
    setFlashcardDraft(null);
  };

  const removeFlashcard = async (nodeId: string, index: number) => {
    const card = graph.nodes.find((node) => node.id === nodeId)?.flashcards?.[index];
    commitGraphChange((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === nodeId
        ? { ...node, flashcards: (node.flashcards ?? []).filter((_, cardIndex) => cardIndex !== index) }
        : node),
    }));
    if (card?.id) await deleteFlashcardImage(mapId, card.id);
  };

  const exportFlashcardsCsv = () => {
    const escape = (value: unknown) => `\"${String(value ?? '').replaceAll('\"', '\"\"')}\"`;
    const rows = [['Question', 'Answer', 'Explanation', 'Tags', 'Difficulty', 'Source Node', 'Mastery Status', 'Mastery']];
    graph.nodes.forEach((node) => (node.flashcards ?? []).forEach((card) => rows.push([
      card.question ?? '',
      card.answer ?? '',
      card.explanation ?? '',
      (card.tags ?? []).join('; '),
      card.difficulty ?? 'medium',
      node.text,
      getMasteryStatusLabel(card.reviewSchedule?.mastery),
      String(card.reviewSchedule?.mastery ?? 0),
    ])));
    const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mapName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-flashcards.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openStudyMode = () => {
    setSelectedNodeId(null);
    setIsDifferentialViewOpen(false);
    setIsStudyModeOpen(true);
  };

  const handleCardImage = async (file: File | undefined) => {
    if (!file || !selectedNode || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    const nodeId = selectedNode.id;
    const previousImages = await readCardImageSnapshots([nodeId]);
    pendingAsyncWritesRef.current += 1;
    onSaveStatusChange('saving');
    try {
      await setCardImage(mapId, nodeId, file);
      const previousUrl = cardImageUrlsRef.current[nodeId];
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      const nextUrl = URL.createObjectURL(file);
      cardImageUrlsRef.current = { ...cardImageUrlsRef.current, [nodeId]: nextUrl };
      setCardImageUrls(cardImageUrlsRef.current);
      const nextGraph = {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                cardStyle: {
                  ...node.cardStyle,
                  imageMode: node.cardStyle?.imageMode ?? 'background',
                  backgroundFit: node.cardStyle?.backgroundFit ?? 'cover',
                  imagePosition: node.cardStyle?.imagePosition ?? 'center',
                },
              }
            : node,
        ),
      };
      setUndoStack((current) => [...current.slice(-99), { graph, cardImages: previousImages }]);
      setRedoStack([]);
      setGraph(nextGraph);
    } finally {
      pendingAsyncWritesRef.current -= 1;
    }
  };

  const removeSelectedCardImage = async () => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;
    const previousImages = await readCardImageSnapshots([nodeId]);
    pendingAsyncWritesRef.current += 1;
    onSaveStatusChange('saving');
    try {
      await deleteCardImage(mapId, nodeId);
      const previousUrl = cardImageUrlsRef.current[nodeId];
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      const nextUrls = { ...cardImageUrlsRef.current };
      delete nextUrls[nodeId];
      cardImageUrlsRef.current = nextUrls;
      setCardImageUrls(nextUrls);
      const nextGraph = {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, cardStyle: { ...node.cardStyle, imageMode: undefined } }
            : node,
        ),
      };
      setUndoStack((current) => [...current.slice(-99), { graph, cardImages: previousImages }]);
      setRedoStack([]);
      setGraph(nextGraph);
    } finally {
      pendingAsyncWritesRef.current -= 1;
    }
  };

  const openChildDialog = (parentId: string) => {
    setSelectedNodeId(parentId);
    setChildParentId(parentId);
    setIsCreatingSeparateNode(false);
    setChildText('');
    setChildTextError('');
    setIsChildDialogOpen(true);
  };

  const openSeparateNodeDialog = () => {
    setChildParentId(null);
    setIsCreatingSeparateNode(true);
    setChildText('');
    setChildTextError('');
    setIsChildDialogOpen(true);
  };

  const closeChildDialog = () => {
    setIsChildDialogOpen(false);
    setChildParentId(null);
    setIsCreatingSeparateNode(false);
    setChildText('');
    setChildTextError('');
  };

  const openAnnotationDialog = (annotationId?: string) => {
    const annotation = annotationId
      ? (graph.annotations ?? []).find((item) => item.id === annotationId)
      : undefined;
    setEditingAnnotationId(annotation?.id ?? null);
    setAnnotationText(annotation?.text ?? '');
    setAnnotationTextError('');
    setIsAnnotationDialogOpen(true);
  };

  const closeAnnotationDialog = () => {
    setIsAnnotationDialogOpen(false);
    setEditingAnnotationId(null);
    setAnnotationText('');
    setAnnotationTextError('');
  };

  const handleSaveAnnotation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedText = annotationText.trim();
    if (!trimmedText) {
      setAnnotationTextError('Add some text to create this textbox.');
      annotationTextInputRef.current?.focus();
      return;
    }

    if (editingAnnotationId) {
      commitGraphChange((currentGraph) => ({
        ...currentGraph,
        annotations: (currentGraph.annotations ?? []).map((annotation) =>
          annotation.id === editingAnnotationId
            ? { ...annotation, text: trimmedText }
            : annotation,
        ),
      }));
      setSelectedAnnotationId(editingAnnotationId);
    } else {
      const annotations = graph.annotations ?? [];
      const annotation: MapAnnotation = {
        id: createAnnotationId(annotations),
        text: trimmedText,
        x: -pan.x / zoom + 280,
        y: -pan.y / zoom + 170 + annotations.length * 42,
      };
      commitGraphChange((currentGraph) => ({
        ...currentGraph,
        annotations: [...(currentGraph.annotations ?? []), annotation],
      }));
      setSelectedNodeId(null);
      setSelectedAnnotationId(annotation.id);
    }
    closeAnnotationDialog();
  };

  const deleteAnnotation = (annotationId: string) => {
    commitGraphChange((currentGraph) => ({
      ...currentGraph,
      annotations: (currentGraph.annotations ?? []).filter(
        (annotation) => annotation.id !== annotationId,
      ),
    }));
    setSelectedAnnotationId(null);
  };

  const updateAnnotationStyle = (
    annotationId: string,
    updates: Partial<MapAnnotation>,
  ) => {
    commitGraphChange((currentGraph) => ({
      ...currentGraph,
      annotations: (currentGraph.annotations ?? []).map((annotation) =>
        annotation.id === annotationId
          ? { ...annotation, ...updates }
          : annotation,
      ),
    }));
  };

  const handleCreateChild = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedText = childText.trim();

    if (!trimmedText) {
      setChildTextError('Add some text to create this node.');
      childTextInputRef.current?.focus();
      return;
    }

    const parent = childParentId
      ? graph.nodes.find((node) => node.id === childParentId)
      : undefined;
    if (!isCreatingSeparateNode && (!parent || !childParentId)) return;

    const siblingCount = childParentId
      ? graph.edges.filter((edge) => edge.from === childParentId).length
      : 0;
    const maxY = Math.max(...graph.nodes.map((node) => node.y), 0);
    const newNode: MapNode = {
      id: createNodeId(graph.nodes),
      text: trimmedText,
      x: parent ? parent.x + 320 : graph.nodes[0]?.x ?? 0,
      y: parent ? parent.y + siblingCount * 145 : maxY + 220,
      shape: 'rectangle',
      size: 'medium',
      details: { ...emptyNodeDetails },
      masteryScore: 0,
      studyEnabled: true,
      reviewSchedule: normalizeReviewSchedule(undefined),
    };
    const nextGraph: MapGraph = {
      nodes: [...graph.nodes, newNode],
      edges: parent
        ? [
            ...graph.edges,
            {
              id: `edge-${newNode.id}`,
              from: parent.id,
              to: newNode.id,
            },
          ]
        : graph.edges,
      annotations: graph.annotations ?? [],
      drawings: graph.drawings ?? [],
      media: graph.media ?? [],
    };

    commitGraphChange(nextGraph);
    setSelectedNodeId(newNode.id);
    closeChildDialog();
  };

  const handleCanvasWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const cursorX = event.clientX - bounds.left - bounds.width / 2;
    const cursorY = event.clientY - bounds.top - bounds.height / 2;
    const nextZoom = clampZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));

    if (nextZoom === zoom) return;

    setPan({
      x: cursorX - (cursorX - pan.x) * (nextZoom / zoom),
      y: cursorY - (cursorY - pan.y) * (nextZoom / zoom),
    });
    setZoom(nextZoom);
  };

  const handleCanvasKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const panAmount = event.shiftKey ? 120 : 48;
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault();
      setPan((currentPan) => ({
        x:
          currentPan.x +
          (event.key === 'ArrowLeft'
            ? -panAmount
            : event.key === 'ArrowRight'
              ? panAmount
              : 0),
        y:
          currentPan.y +
          (event.key === 'ArrowUp'
            ? -panAmount
            : event.key === 'ArrowDown'
              ? panAmount
              : 0),
      }));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(0.1);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomBy(-0.1);
    } else if (event.key === '0') {
      event.preventDefault();
      resetView();
    }
  };

  const handleNodeKeyDown = (
    nodeId: string,
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedNodeId(nodeId);
    }
  };

  const toggleNodeCollapsed = (nodeId: string) => {
    touchStoredMap(mapId);
    setCollapsedNodeIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(nodeId)) {
        nextIds.delete(nodeId);
      } else {
        nextIds.add(nodeId);
      }
      return nextIds;
    });
    setSelectedNodeId(nodeId);
    setConnectionDraft(null);
    setConnectionTargetId(null);
    connectionDragRef.current = null;
  };

  const openNodeDetails = (nodeId: string) => {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    if (formatPanelTimerRef.current !== null) {
      window.clearTimeout(formatPanelTimerRef.current);
      formatPanelTimerRef.current = null;
    }
    setSelectedNodeId(nodeId);
    setIsFormatPanelReady(false);
    setDetailsNodeId(nodeId);
    setDetailsDraft({
      title: node.text,
      ...emptyNodeDetails,
      ...node.details,
    });
  };

  const updateNodeDetails = (nextDraft: NodeDetailsDraft) => {
    setDetailsDraft(nextDraft);
    if (!detailsNodeId) return;

    const { title, ...details } = nextDraft;
    commitGraphChange((currentGraph) => ({
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) =>
        node.id === detailsNodeId ? { ...node, text: title, details } : node,
      ),
    }));
  };

  const closeAiPanel = () => {
    aiOperation.cancel();
    aiOperation.reset();
    setActiveAiAction(null);
    setAiTargetNodeId(null);
    setAiSelectedItems(new Set());
  };

  const startAiAction = async (action: AiActionType, targetNodeId = selectedNode?.id) => {
    const targetNode = graph.nodes.find((node) => node.id === targetNodeId);
    if (!targetNode) return;
    setIsAiMenuOpen(false);
    setActiveAiAction(action);
    setAiTargetNodeId(targetNode.id);
    setAiSelectedItems(new Set());
    aiOperation.reset();

    const payload = {
      mapTitle: mapName,
      selectedNodeIds: [targetNode.id],
      nodes: graph.nodes.map(n => ({ id: n.id, text: n.text, notes: n.details?.notes })),
      edges: graph.edges.map(e => ({ from: e.from, to: e.to })),
    };

    try {
      switch (action) {
        case 'explain':
          await aiOperation.execute({ operation: 'explain', payload: { ...payload, instructions: 'Provide a concise explanation of this concept.' } });
          break;
        case 'expandNode':
          await aiOperation.execute({ operation: 'expandNode', payload: { ...payload, instructions: 'Suggest logical subcategories for this concept.' } });
          break;
        case 'generateChildren':
          await aiOperation.execute({ operation: 'expandNode', payload: { ...payload, instructions: 'Only generate immediate child concepts.' } });
          break;
        case 'generateFlashcards':
          await aiOperation.execute({ operation: 'generateFlashcards', payload });
          break;
        case 'generateQuiz':
          await aiOperation.execute({ operation: 'generateQuiz', payload });
          break;
        case 'simplify':
          await aiOperation.execute({ operation: 'rewrite', payload: { ...payload, instructions: 'Simplify the notes to make them easy to understand.' } });
          break;
        case 'addExamples':
          await aiOperation.execute({ operation: 'explain', payload: { ...payload, instructions: 'Provide a list of concrete examples.' } });
          break;
        case 'identifyMissing':
          await aiOperation.execute({ operation: 'detectKnowledgeGaps', payload });
          break;
      }
    } catch (err) {
      // Error is caught and stored in aiOperation.error
    }
  };

  const commitAiSuggestions = (overrideSelectedItems?: Set<string>) => {
    const activeSelectedItems = overrideSelectedItems ?? aiSelectedItems;
    const targetNode = graph.nodes.find((node) => node.id === aiTargetNodeId);
    if (!targetNode || !aiOperation.data || !activeAiAction) {
      closeAiPanel();
      return;
    }

    const result = aiOperation.data.result;
    const newNodes = [...graph.nodes];
    const newEdges = [...graph.edges];
    let didChange = false;

    if (activeAiAction === 'expandNode' || activeAiAction === 'generateChildren') {
      const generatedNodes = result.nodes ?? [];
      const tempIdMap = new Map<string, string>();
      const nodesToAdd = generatedNodes.filter(n => activeSelectedItems.has(n.tempId ?? n.title));

      nodesToAdd.forEach((n, idx) => {
        const newId = `node-${Date.now()}-${idx}`;
        if (n.tempId) tempIdMap.set(n.tempId, newId);
        
        let parentId = targetNode.id;
        if (n.parentTempId && tempIdMap.has(n.parentTempId)) {
           parentId = tempIdMap.get(n.parentTempId)!;
        }

        const parentNode = newNodes.find(pn => pn.id === parentId) || targetNode;

        const newNode: MapNode = {
          id: newId,
          text: n.title,
          x: parentNode.x + ((idx % 3) - 1) * 150,
          y: parentNode.y + 100 + Math.floor(idx / 3) * 100,
          masteryScore: 0,
          studyEnabled: true,
          reviewSchedule: normalizeReviewSchedule(undefined),
          details: {
            notes: n.description ?? '',
            differentialDiagnosis: '',
            keyDiagnosticFeatures: '',
            immunohistochemistry: '',
            molecularFindings: '',
            references: '',
          },
        };
        newNodes.push(newNode);
        newEdges.push({ id: `edge-${parentId}-${newId}`, from: parentId, to: newId });
        didChange = true;
      });
    } else if (activeAiAction === 'generateFlashcards') {
      const generatedCards = result.flashcards ?? [];
      const cardsToAdd = generatedCards.filter((_, idx) => activeSelectedItems.has(String(idx)));
      
       const nodeIndex = newNodes.findIndex(n => n.id === targetNode.id);
      if (nodeIndex !== -1) {
        const existingCards = newNodes[nodeIndex].flashcards ?? [];
        const mappedCards: NodeFlashcard[] = cardsToAdd.map(c => ({
           id: crypto.randomUUID(),
           question: c.question,
           answer: c.answer,
           explanation: c.explanation,
           tags: c.tags,
           difficulty: c.difficulty,
            sourceNodeId: targetNode.id,
           reviewSchedule: normalizeReviewSchedule(undefined)
        }));
        newNodes[nodeIndex] = { ...newNodes[nodeIndex], flashcards: [...existingCards, ...mappedCards] };
        didChange = true;
      }
    } else if (activeAiAction === 'generateQuiz') {
      const generatedQuizzes = result.questions ?? [];
      const quizzesToAdd = generatedQuizzes.filter((_, idx) => activeSelectedItems.has(String(idx)));
      
       const nodeIndex = newNodes.findIndex(n => n.id === targetNode.id);
      if (nodeIndex !== -1) {
        const existingCards = newNodes[nodeIndex].flashcards ?? [];
        const mappedCards: NodeFlashcard[] = quizzesToAdd.map(q => ({
           id: crypto.randomUUID(),
           question: `${q.question}\n\nChoices:\n${q.choices.map(c => `- ${c}`).join('\n')}`,
           answer: q.correctAnswer,
           explanation: q.explanation,
            tags: ['quiz'],
            difficulty: 'medium',
            sourceNodeId: targetNode.id,
           reviewSchedule: normalizeReviewSchedule(undefined)
        }));
        newNodes[nodeIndex] = { ...newNodes[nodeIndex], flashcards: [...existingCards, ...mappedCards] };
        didChange = true;
      }
    } else if (activeAiAction === 'simplify') {
      if (result.text && activeSelectedItems.has('simplify')) {
         const nodeIndex = newNodes.findIndex(n => n.id === targetNode.id);
         if (nodeIndex !== -1) {
           newNodes[nodeIndex] = { 
             ...newNodes[nodeIndex], 
             details: {
               ...(newNodes[nodeIndex].details ?? {
                 notes: '', differentialDiagnosis: '', keyDiagnosticFeatures: '', immunohistochemistry: '', molecularFindings: '', references: ''
               }),
               notes: result.text
             }
           };
           didChange = true;
         }
      }
    } else if (activeAiAction === 'addExamples') {
      const generatedExamples = result.keyPoints?.length ? result.keyPoints : result.text ? [result.text] : [];
      const examplesToAdd = generatedExamples.filter((_, idx) => activeSelectedItems.has(String(idx)));
      
      if (examplesToAdd.length > 0) {
        const nodeIndex = newNodes.findIndex(n => n.id === targetNode.id);
        if (nodeIndex !== -1) {
          const currentNotes = newNodes[nodeIndex].details?.notes ?? '';
          const newNotes = currentNotes + (currentNotes ? '\n\n' : '') + 'Examples:\n' + examplesToAdd.map(e => `- ${e}`).join('\n');
          
          newNodes[nodeIndex] = { 
             ...newNodes[nodeIndex], 
             details: {
               ...(newNodes[nodeIndex].details ?? {
                 notes: '', differentialDiagnosis: '', keyDiagnosticFeatures: '', immunohistochemistry: '', molecularFindings: '', references: ''
               }),
               notes: newNotes
             }
           };
           didChange = true;
        }
      }
    } else if (activeAiAction === 'identifyMissing') {
      const generatedGaps = result.gaps ?? [];
      const gapsToAdd = generatedGaps.filter((_, idx) => activeSelectedItems.has(String(idx)));
      
      gapsToAdd.forEach((g, idx) => {
        const newId = `node-${Date.now()}-${idx}`;
        const newNode: MapNode = {
          id: newId,
          text: g.topic,
          x: targetNode.x + ((idx % 3) - 1) * 150,
          y: targetNode.y + 150 + Math.floor(idx / 3) * 100,
          masteryScore: 0,
          studyEnabled: true,
          reviewSchedule: normalizeReviewSchedule(undefined),
          details: {
            notes: `Reason for gap: ${g.reason}\n\nSuggested Next Step: ${g.suggestedNextStep}`,
            differentialDiagnosis: '',
            keyDiagnosticFeatures: '',
            immunohistochemistry: '',
            molecularFindings: '',
            references: '',
          },
        };
        newNodes.push(newNode);
        newEdges.push({ id: `edge-${targetNode.id}-${newId}`, from: targetNode.id, to: newId });
        didChange = true;
      });
    }

    if (didChange) {
      commitGraphChange({ ...graph, nodes: newNodes, edges: newEdges });
    }
    
    closeAiPanel();
  };
  const closeNodeDetails = () => {
    setDetailsNodeId(null);
    setDetailsDraft(null);
    setSelectedNodeId(null);
    setIsFormatPanelReady(false);
  };

  const hiddenNodeIds = getHiddenDescendantIds(graph, collapsedNodeIds);
  const visibleNodes = graph.nodes.filter(
    (node) => !hiddenNodeIds.has(node.id),
  );
  const selectedNode = visibleNodes.find(
    (node) => node.id === selectedNodeId,
  );
  const normalizedSearchQuery = isSearchOpen ? searchQuery.trim().toLocaleLowerCase() : '';
  const searchResults = normalizedSearchQuery
    ? graph.nodes.filter((node) => getSearchableNodeText(node, graph).includes(normalizedSearchQuery))
    : [];
  const matchingNodeIds = new Set(searchResults.map((node) => node.id));
  const selectedNodeScreenX = selectedNode
    ? (canvasRef.current?.getBoundingClientRect().left ?? 0)
      + (canvasRef.current?.clientWidth ?? window.innerWidth) / 2
      + pan.x
      + selectedNode.x * zoom
    : 0;
  const contextToolbarHalfWidth = window.innerWidth <= 760 ? 118 : 246;
  const contextToolbarOffsetX = selectedNode
    ? Math.min(
        window.innerWidth - 12 - contextToolbarHalfWidth,
        Math.max(12 + contextToolbarHalfWidth, selectedNodeScreenX),
      ) - selectedNodeScreenX
    : 0;
  const selectedAnnotation = (graph.annotations ?? []).find(
    (annotation) => annotation.id === selectedAnnotationId,
  );
  const detailsNode = visibleNodes.find((node) => node.id === detailsNodeId);
  const canDeleteSelectedNode = Boolean(selectedNode);

  const renameCurrentMap = () => {
    const nextName = window.prompt('Rename map', mapName)?.trim();
    if (!nextName || nextName === mapName) return;
    onRenameMap(nextName);
    if (graph.nodes[0]?.text === mapName) {
      commitGraphChange({
        ...graph,
        nodes: graph.nodes.map((node, index) => index === 0 ? { ...node, text: nextName } : node),
      });
    }
  };

  const openNodeSearch = () => {
    setIsCommandPaletteOpen(false);
    setIsSearchOpen(true);
    setIsMoreMenuOpen(false);
    setIsExportMenuOpen(false);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const commandItems: Array<{ label: string; keywords: string; disabled?: boolean; run: () => void }> = [
    { label: 'Add node', keywords: 'create new separate', run: openSeparateNodeDialog },
    { label: 'Add child', keywords: 'create branch', disabled: graph.nodes.length === 0, run: () => openChildDialog(selectedNode?.id ?? graph.nodes[0]?.id) },
    { label: 'Search node', keywords: 'find notes flashcards tags', run: openNodeSearch },
    { label: 'Rename map', keywords: 'title sheet', run: renameCurrentMap },
    { label: 'Study map', keywords: 'review recall learn', disabled: graph.nodes.length === 0, run: openStudyMode },
    { label: 'Generate flashcards', keywords: 'study cards ai', disabled: graph.nodes.length === 0, run: () => { setSelectedNodeId(selectedNode?.id ?? graph.nodes[0]?.id); setIsFlashcardMenuOpen(true); } },
    { label: 'Export PDF', keywords: 'download notes', run: exportNotesPdf },
    { label: 'Print', keywords: 'paper map', run: () => window.print() },
    { label: 'Fit map to screen', keywords: 'center zoom reset view', run: fitMapToScreen },
    ...layoutOptions.map((option) => ({
      label: `Change layout: ${option.label}`,
      keywords: `arrange ${option.value}`,
      run: () => applyLayout(option.value),
    })),
    { label: 'Undo', keywords: 'revert back', disabled: undoStack.length === 0, run: () => void undoGraphChange() },
    { label: 'Redo', keywords: 'restore forward', disabled: redoStack.length === 0, run: () => void redoGraphChange() },
  ];
  const filteredCommandItems = commandItems.filter((command) =>
    `${command.label} ${command.keywords}`.toLocaleLowerCase().includes(commandQuery.trim().toLocaleLowerCase()),
  );

  const runCommand = (command: (typeof commandItems)[number]) => {
    if (command.disabled) return;
    setIsCommandPaletteOpen(false);
    setCommandQuery('');
    command.run();
  };

  const startToolbarDrag = (event: PointerEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const dragHandle = target?.closest('.toolbar-drag-handle');
    if (target?.closest('button, input, select, textarea') && !dragHandle) return;
    const canvas = canvasRef.current;
    const toolbar = toolbarRef.current;
    if (!canvas || !toolbar) return;
    event.stopPropagation();
    const canvasRect = canvas.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    toolbarDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - toolbarRect.left,
      offsetY: event.clientY - toolbarRect.top,
    };
    setToolbarPosition({ x: toolbarRect.left - canvasRect.left, y: toolbarRect.top - canvasRect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveToolbar = (event: PointerEvent<HTMLElement>) => {
    const drag = toolbarDragRef.current;
    const canvas = canvasRef.current;
    const toolbar = toolbarRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas || !toolbar) return;
    const rect = canvas.getBoundingClientRect();
    setToolbarPosition({
      x: Math.max(8, Math.min(rect.width - toolbar.offsetWidth - 8, event.clientX - rect.left - drag.offsetX)),
      y: Math.max(8, Math.min(rect.height - toolbar.offsetHeight - 8, event.clientY - rect.top - drag.offsetY)),
    });
  };

  const stopToolbarDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    toolbarDragRef.current = null;
  };

  const deleteSelectedNode = async () => {
    if (!selectedNode || !canDeleteSelectedNode) return;

    const nodeIdsToDelete = new Set<string>([selectedNode.id]);
    const queue = [selectedNode.id];
    while (queue.length > 0) {
      const parentId = queue.shift();
      if (!parentId) continue;
      graph.edges
        .filter((edge) => edge.from === parentId)
        .forEach((edge) => {
          if (!nodeIdsToDelete.has(edge.to)) {
            nodeIdsToDelete.add(edge.to);
            queue.push(edge.to);
          }
        });
    }

    const deletedNodeIds = Array.from(nodeIdsToDelete);
    const [cardImages, nodeImages] = await Promise.all([
      readCardImageSnapshots(deletedNodeIds),
      readNodeImageSnapshots(deletedNodeIds),
    ]);
    pendingAsyncWritesRef.current += 1;
    onSaveStatusChange('saving');
    try {
      await Promise.all(deletedNodeIds.flatMap((nodeId) => [
        deleteCardImage(mapId, nodeId),
        replaceNodeImages(mapId, nodeId, []),
      ]));
    } finally {
      pendingAsyncWritesRef.current -= 1;
    }
    const nextGraph = {
      nodes: graph.nodes.filter((node) => !nodeIdsToDelete.has(node.id)),
      edges: graph.edges.filter(
        (edge) =>
          !nodeIdsToDelete.has(edge.from) && !nodeIdsToDelete.has(edge.to),
      ),
      annotations: graph.annotations ?? [],
      drawings: graph.drawings ?? [],
      media: graph.media ?? [],
    };
    setUndoStack((current) => [...current.slice(-99), { graph, cardImages, nodeImages }]);
    setRedoStack([]);
    setGraph(nextGraph);
    setCollapsedNodeIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nodeIdsToDelete.forEach((nodeId) => nextIds.delete(nodeId));
      return nextIds;
    });
    setSelectedNodeId(null);
    setDetailsNodeId(null);
    setDetailsDraft(null);
    setIsFormatPanelReady(false);
  };

  return (
    <div
      ref={canvasRef}
      className={`map-canvas${isPanning ? ' is-panning' : ''}${isConnectionMode ? ' is-connection-mode' : ''}${isDrawingMode ? ' is-drawing-mode' : ''}${isEraserMode ? ' is-eraser-mode' : ''}`}
      role="application"
      tabIndex={0}
      aria-label={`Interactive canvas for ${mapName}. Drag empty space to pan. Drag nodes to move them. Use the mouse wheel or controls to zoom.`}
      data-testid="interactive-map-canvas"
      style={{
        backgroundColor: mapBackgroundStyle.color,
        backgroundImage: mapBackgroundUrl
          ? `${mapBackgroundStyle.overlay ? 'linear-gradient(rgb(255 255 255 / 0.3), rgb(255 255 255 / 0.3)),' : ''} url("${mapBackgroundUrl}")`
          : undefined,
        backgroundSize: mapBackgroundUrl
          ? `${mapBackgroundStyle.overlay ? '100% 100%, ' : ''}${mapBackgroundStyle.fit === 'stretch' ? '100% 100%' : mapBackgroundStyle.fit}`
          : undefined,
        backgroundPosition: mapBackgroundUrl
          ? 'center'
          : `calc(50% + ${pan.x}px) calc(50% + ${pan.y}px), calc(50% + ${pan.x}px) calc(50% + ${pan.y}px), 50% 50%`,
        backgroundRepeat: mapBackgroundUrl ? 'no-repeat' : undefined,
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={stopPanning}
      onPointerCancel={stopPanning}
      onWheel={handleCanvasWheel}
      onKeyDown={handleCanvasKeyDown}
    >
      <div className="canvas-title-corner">
        <p className="workspace-kicker">Knowledge map</p>
        <h1 id="map-title" data-testid="text-map-title">
          {mapName}
        </h1>
      </div>

      <div
        className="canvas-scene"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <svg className="canvas-drawings" aria-hidden="true" focusable="false">
          {[...(graph.drawings ?? []), ...(activeDrawing ? [activeDrawing] : [])].map(
            (stroke) => (
              <polyline
                key={stroke.id}
                points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                stroke={stroke.color}
                strokeWidth={stroke.width}
              />
            ),
          )}
        </svg>

        {(graph.media ?? []).map((item) => (
          <div
            key={item.id}
            className="canvas-media-position"
            style={{ transform: `translate(${item.x}px, ${item.y}px)`, width: item.width }}
          >
            <div
              className={`floating-media-frame canvas-floating-media${selectedMediaId === item.id ? ' is-selected' : ''}`}
              onClick={(event) => { event.stopPropagation(); setSelectedMediaId(item.id); setSelectedNodeId(null); setSelectedAnnotationId(null); }}
            >
              <div
                className="floating-media-toolbar"
                onPointerDown={(event) => startMapMediaDrag(item.id, event)}
                onPointerMove={moveMapMedia}
                onPointerUp={stopMapMediaDrag}
                onPointerCancel={stopMapMediaDrag}
                data-testid={`move-map-media-${item.id}`}
              >
                <span><Move size={12} aria-hidden="true" /> Move {item.kind}</span>
                <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => resizeMapMedia(item.id, -40)} aria-label="Make smaller">−</button>
                <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => resizeMapMedia(item.id, 40)} aria-label="Make larger">+</button>
                <button
                  type="button"
                  className="media-delete-button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => void deleteMapMediaItem(item.id)}
                  aria-label={`Delete ${item.kind}`}
                  title={`Delete ${item.kind}`}
                  data-testid={`button-delete-map-media-${item.id}`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
              {item.kind === 'video' ? (
                <video src={mapMediaUrls[item.id]} controls preload="metadata" />
              ) : (
                <img
                  src={mapMediaUrls[item.id]}
                  alt={item.name}
                  draggable={false}
                  onPointerDown={(event) => startMapMediaDrag(item.id, event)}
                  onPointerMove={moveMapMedia}
                  onPointerUp={stopMapMediaDrag}
                  onPointerCancel={stopMapMediaDrag}
                  data-testid={`draggable-map-image-${item.id}`}
                />
              )}
            </div>
          </div>
        ))}

        {(graph.annotations ?? []).map((annotation) => (
          <div
            key={annotation.id}
            className="canvas-annotation-position"
            style={{ transform: `translate(${annotation.x}px, ${annotation.y}px)` }}
          >
            <div
              className={`canvas-annotation${selectedAnnotationId === annotation.id ? ' is-selected' : ''}`}
              role="group"
              tabIndex={0}
              aria-label={`Textbox: ${annotation.text}. Drag to reposition. Double-click to edit.`}
              data-testid={`canvas-annotation-${annotation.id}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedNodeId(null);
                setSelectedAnnotationId(annotation.id);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                openAnnotationDialog(annotation.id);
              }}
              onPointerDown={(event) => handleAnnotationPointerDown(annotation.id, event)}
              onPointerMove={handleAnnotationPointerMove}
              onPointerUp={stopDraggingAnnotation}
              onPointerCancel={stopDraggingAnnotation}
            >
              <p
                style={{
                  color: annotation.color,
                  fontFamily: fontFamilyValues[annotation.fontFamily ?? 'sans'],
                  fontSize: annotation.fontSize,
                  fontWeight:
                    annotation.fontWeight === 'bold'
                      ? 700
                      : annotation.fontWeight === 'semibold'
                        ? 600
                        : 400,
                  fontStyle: annotation.fontItalic ? 'italic' : 'normal',
                  textAlign: annotation.textAlign ?? 'left',
                }}
              >
                {annotation.text}
              </p>
              {selectedAnnotationId === annotation.id ? (
                <button
                  type="button"
                  className="canvas-annotation-delete"
                  aria-label="Delete textbox"
                  title="Delete textbox"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteAnnotation(annotation.id);
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        ))}

        <svg
          className={`canvas-connections branch-style-${branchStyle}`}
          aria-hidden="true"
          focusable="false"
        >
          {graph.edges
            .filter(
              (edge) =>
                !hiddenNodeIds.has(edge.from) &&
                !hiddenNodeIds.has(edge.to),
            )
            .map((edge) => {
              const from = graph.nodes.find((node) => node.id === edge.from);
              const to = graph.nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;
              if (branchStyle === 'curved') {
                const middleX = (from.x + to.x) / 2;
                return <path key={edge.id} d={`M ${from.x} ${from.y} Q ${middleX} ${from.y} ${to.x} ${to.y}`} />;
              }
              if (branchStyle === 'elbow') {
                const middleX = (from.x + to.x) / 2;
                return <path key={edge.id} d={`M ${from.x} ${from.y} H ${middleX} V ${to.y} H ${to.x}`} />;
              }
              return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
            })}
          {connectionDraft
            ? (() => {
                const source = graph.nodes.find(
                  (node) => node.id === connectionDraft.sourceId,
                );
                if (!source) return null;
                return (
                  <line
                    className="connection-preview"
                    x1={source.x}
                    y1={source.y}
                    x2={connectionDraft.x}
                    y2={connectionDraft.y}
                  />
                );
              })()
            : null}
        </svg>

        {visibleNodes.map((node) => (
          <div
            key={`${node.id}-${animationReplay[node.id] ?? 0}`}
            className="canvas-node-position"
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
          >
            <div
              className={`map-origin node-shape-${node.shape ?? 'rectangle'} node-size-${node.size ?? 'medium'} node-animation-${node.cardStyle?.animation ?? 'none'} node-animation-speed-${node.cardStyle?.animationSpeed ?? 'normal'}${node.cardStyle?.borderColor ? ' has-custom-card-border' : ''}${draggingNodeId === node.id ? ' is-dragging' : ''}${selectedNodeId === node.id ? ' is-selected' : ''}${comparisonNodeIds.includes(node.id) ? ' is-comparison-selected' : ''}${normalizedSearchQuery && matchingNodeIds.has(node.id) ? ' is-search-match' : ''}${normalizedSearchQuery && !matchingNodeIds.has(node.id) ? ' is-search-dimmed' : ''}${connectionDraft?.sourceId === node.id ? ' is-connection-source' : ''}${connectionTargetId === node.id ? ' is-connection-target' : ''}`}
              role="group"
              tabIndex={0}
              aria-label={`Map node: ${node.text}. Drag to reposition. Click to reveal the add child button.`}
              data-testid={node.id === graph.nodes[0]?.id ? 'map-origin-node' : `map-node-${node.id}`}
              data-node-id={node.id}
              onClick={(event) => {
                if (isCompareSelectionMode) {
                  event.stopPropagation();
                  setSelectedNodeId(null);
                  toggleComparisonNode(node.id);
                  return;
                }
                setSelectedNodeId(node.id);
                setIsExportMenuOpen(false);
                setIsMoreMenuOpen(false);
                setIsSearchOpen(false);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                openNodeDetails(node.id);
              }}
              onKeyDown={(event) => handleNodeKeyDown(node.id, event)}
              onPointerDown={(event) => {
                if (isCompareSelectionMode) {
                  event.stopPropagation();
                  return;
                }
                handleNodePointerDown(node.id, event);
              }}
              onPointerMove={handleNodePointerMove}
              onPointerUp={stopDraggingNode}
              onPointerCancel={stopDraggingNode}
            >
              {(node.shape ?? 'rectangle') === 'diamond' ? (
                <svg
                  className="diamond-node-outer-ring"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  style={{
                    ['--diamond-border-color' as string]:
                      node.cardStyle?.borderColor,
                    ['--diamond-border-width' as string]:
                      node.cardStyle?.borderColor ? '2px' : '1px',
                  }}
                >
                  <polygon className="diamond-node-ring-stroke" points="50,0 100,50 50,100 0,50" />
                  <polygon className="diamond-node-inner-stroke" points="50,0 100,50 50,100 0,50" style={{
                    stroke: node.cardStyle?.borderColor,
                    strokeWidth: node.cardStyle?.borderWidth !== undefined ? `${node.cardStyle.borderWidth}px` : undefined,
                    strokeDasharray: node.cardStyle?.borderStyle === 'dashed' ? '8 8' : node.cardStyle?.borderStyle === 'dotted' ? '3 6' : undefined,
                  }} />
                </svg>
              ) : null}
              {showMasteryIndicators ? (
                <span
                  className={`mastery-indicator mastery-${getMasteryStatus(node.masteryScore)}`}
                  style={{ ['--mastery-progress' as string]: `${clampMasteryScore(node.masteryScore) * 3.6}deg` }}
                  title={`Mastery: ${clampMasteryScore(node.masteryScore)}%`}
                  aria-label={`Mastery: ${clampMasteryScore(node.masteryScore)}%. ${getMasteryStatusLabel(node.masteryScore)}.`}
                  data-testid={`mastery-indicator-${node.id}`}
                >
                  <span>{clampMasteryScore(node.masteryScore)}</span>
                </span>
              ) : null}
              <div
                className={`map-node-surface${node.cardStyle?.imageMode === 'card' && cardImageUrls[node.id] ? ` card-image-${node.cardStyle.imagePosition ?? 'above'}` : ''}`}
                style={{
                   borderRadius:
                     node.shape === 'circle' || node.shape === 'oval'
                       ? '50%'
                       : node.shape === 'rounded-rectangle'
                         ? '22px'
                         : undefined,
                   clipPath:
                     node.shape === 'diamond'
                       ? 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)'
                       : undefined,
                  background:
                    node.cardStyle?.backgroundColor,
                  color: node.cardStyle?.textColor,
                  borderColor: node.cardStyle?.borderColor,
                  borderWidth: node.cardStyle?.borderWidth !== undefined
                    ? `${node.cardStyle.borderWidth}px`
                    : node.cardStyle?.borderColor
                      ? '2px'
                      : undefined,
                  borderStyle: node.cardStyle?.borderStyle ?? (node.cardStyle?.borderColor ? 'solid' : undefined),
                  fontFamily:
                    fontFamilyValues[node.cardStyle?.fontFamily ?? 'sans'],
                  fontSize: node.cardStyle?.fontSize,
                  fontWeight:
                    node.cardStyle?.fontWeight === 'bold'
                      ? 700
                      : node.cardStyle?.fontWeight === 'semibold'
                        ? 600
                        : 400,
                  fontStyle: node.cardStyle?.fontItalic ? 'italic' : 'normal',
                  textAlign: node.cardStyle?.textAlign ?? 'center',
                }}
              >
                {node.cardStyle?.imageMode === 'background' && cardImageUrls[node.id] ? (
                  <>
                    <span
                      className="card-node-background"
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url("${cardImageUrls[node.id]}")`,
                        backgroundPosition: node.cardStyle.imagePosition ?? 'center',
                        backgroundSize:
                          node.cardStyle.backgroundFit === 'stretch'
                            ? '100% 100%'
                            : node.cardStyle.backgroundFit === 'original'
                              ? 'auto'
                              : node.cardStyle.backgroundFit ?? 'cover',
                        backgroundRepeat: 'no-repeat',
                        opacity: node.cardStyle.backgroundOpacity ?? 1,
                      }}
                    />
                    {(node.cardStyle.backgroundOverlayOpacity ?? (node.cardStyle.readabilityOverlay ? 0.42 : 0)) > 0 ? (
                      <span
                        className="card-node-overlay"
                        aria-hidden="true"
                        style={{ opacity: node.cardStyle.backgroundOverlayOpacity ?? 0.42 }}
                      />
                    ) : null}
                  </>
                ) : null}
                {node.cardStyle?.imageMode === 'card' && cardImageUrls[node.id] ? (
                  <img className="card-node-image" src={cardImageUrls[node.id]} alt="" style={{ ['--card-image-size' as string]: `${node.cardStyle.imageSize ?? 35}%` }} />
                ) : null}
                <span className="map-node-label">{node.text}</span>
              </div>
              {graph.edges.some((edge) => edge.from === node.id) ? (
                <button
                  type="button"
                  className="node-collapse-button"
                  aria-label={
                    collapsedNodeIds.has(node.id)
                      ? `Expand descendants of ${node.text}`
                      : `Collapse descendants of ${node.text}`
                  }
                  title={
                    collapsedNodeIds.has(node.id)
                      ? 'Expand branch'
                      : 'Collapse branch'
                  }
                  aria-expanded={!collapsedNodeIds.has(node.id)}
                  data-testid={`button-collapse-${node.id}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleNodeCollapsed(node.id);
                  }}
                >
                  {collapsedNodeIds.has(node.id) ? (
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ) : null}
              {selectedNodeId === node.id && !isConnectionMode ? (
                <button
                  type="button"
                  className="node-add-button"
                  aria-label={`Add child node to ${node.text}`}
                  title="Add child node"
                  data-testid={`button-add-child-${node.id}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    openChildDialog(node.id);
                  }}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
              {isConnectionMode ? (
                <button
                  type="button"
                  className="node-connector-handle"
                  aria-label={`Drag to connect ${node.text} to another node`}
                  title="Drag to another node"
                  data-testid={`connector-${node.id}`}
                  onPointerDown={(event) =>
                    handleConnectorPointerDown(node.id, event)
                  }
                  onPointerMove={handleConnectorPointerMove}
                  onPointerUp={(event) => stopConnecting(event, true)}
                  onPointerCancel={(event) => stopConnecting(event, false)}
                >
                  <Link2 size={13} strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        ))}

        {selectedNode && !isConnectionMode && !isCompareSelectionMode && !detailsNodeId && (
          <div
            style={{
              position: 'absolute',
              left: selectedNode.x,
              top: selectedNode.y,
              zIndex: 70,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                transform: `scale(${1 / zoom})`,
                transformOrigin: 'top center',
                pointerEvents: 'auto',
              }}
            >
              <div
                className={`node-context-toolbar placement-${(window.innerHeight / 2) + pan.y + (selectedNode.y * zoom) < 180 ? 'below' : 'above'}`}
                style={{
                  position: 'absolute',
                  ...((window.innerHeight / 2) + pan.y + (selectedNode.y * zoom) < 180
                    ? { top: '65px' }
                    : { bottom: '65px' }),
                  left: `calc(50% + ${contextToolbarOffsetX}px)`,
                  transform: 'translateX(-50%)',
                }}
                role="toolbar"
                aria-label={`Actions for ${selectedNode.text}`}
                data-testid="node-context-toolbar"
                onPointerDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="context-action-btn"
                  onClick={() => openNodeDetails(selectedNode.id)}
                  title="Edit details"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  type="button"
                  className={`context-action-btn${isFormatPanelReady ? ' is-active' : ''}`}
                  onClick={() => setIsFormatPanelReady(!isFormatPanelReady)}
                  title="Style node"
                >
                  <Paintbrush size={14} /> Style
                </button>
                <button
                  type="button"
                  className={`context-action-btn${isImageMenuOpen ? ' is-active' : ''}`}
                  onClick={() => { setIsImageMenuOpen(!isImageMenuOpen); setIsAiMenuOpen(false); setIsContextMoreMenuOpen(false); setIsFlashcardMenuOpen(false); }}
                  title="Node image"
                >
                  <Image size={14} /> Image
                </button>
                <button
                  type="button"
                  className={`context-action-btn${isFlashcardMenuOpen ? ' is-active' : ''}`}
                  onClick={() => { setIsFlashcardMenuOpen(!isFlashcardMenuOpen); setIsAiMenuOpen(false); setIsImageMenuOpen(false); setIsContextMoreMenuOpen(false); }}
                  title="Flashcards"
                >
                  <Copy size={14} /> Flashcard
                </button>
                <div className="context-menu-wrapper">
                  <button
                    type="button"
                    className={`context-action-btn${isAiMenuOpen ? ' is-active' : ''}`}
                    onClick={() => { setIsAiMenuOpen((open) => !open); setIsFlashcardMenuOpen(false); setIsImageMenuOpen(false); setIsContextMoreMenuOpen(false); }}
                    title="AI Actions"
                    data-testid="button-node-ai-menu"
                  >
                    <Sparkles size={14} /> AI
                  </button>
                  {isAiMenuOpen && (
                    <div className="context-popover flashcard-popover" role="menu">
                      <p className="flashcard-placeholder-title">AI Actions</p>
                      <button type="button" role="menuitem" onClick={() => startAiAction('explain')}>Explain</button>
                      <button type="button" role="menuitem" onClick={() => startAiAction('expandNode')}>Expand</button>
                      <button type="button" role="menuitem" onClick={() => startAiAction('generateChildren')}>Generate Children</button>
                      <button type="button" role="menuitem" onClick={() => startAiAction('generateFlashcards')}>Generate Flashcards</button>
                      <button type="button" role="menuitem" onClick={() => startAiAction('generateQuiz')}>Generate Quiz</button>
                      <button type="button" role="menuitem" onClick={() => startAiAction('simplify')}>Simplify</button>
                      <button type="button" role="menuitem" onClick={() => startAiAction('addExamples')}>Add Examples</button>
                      <button type="button" role="menuitem" onClick={() => {
                        closeAiPanel();
                        setIsAiMenuOpen(false);
                        setIsCompareSelectionMode(true);
                        setComparisonNodeIds([selectedNode.id]);
                        setSelectedNodeId(null);
                      }}>Compare</button>
                      <button type="button" role="menuitem" onClick={() => startAiAction('identifyMissing')}>Identify Missing Information</button>
                    </div>
                  )}
                </div>
                <div className="context-menu-wrapper">
                  <button
                    type="button"
                    className={`context-action-btn${isContextMoreMenuOpen ? ' is-active' : ''}`}
                    onClick={() => { setIsContextMoreMenuOpen(!isContextMoreMenuOpen); setIsAiMenuOpen(false); setIsImageMenuOpen(false); setIsFlashcardMenuOpen(false); }}
                    title="More actions"
                  >
                    <MoreHorizontal size={14} /> More
                  </button>
                  {isContextMoreMenuOpen && (
                    <div className="context-popover" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsContextMoreMenuOpen(false);
                          setIsAnimationPanelOpen(true);
                        }}
                      >
                        <Sparkles size={14} /> Animate
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsContextMoreMenuOpen(false);
                          setIsDifferentialViewOpen(true);
                        }}
                      >
                        <Columns size={14} /> Differential view
                      </button>
                      <div className="popover-divider" />
                      <button
                        type="button"
                        role="menuitem"
                        className="danger-action"
                        disabled={!canDeleteSelectedNode}
                        onClick={() => {
                          deleteSelectedNode();
                          setIsContextMoreMenuOpen(false);
                        }}
                      >
                        <Trash2 size={14} /> Delete node
                      </button>
                    </div>
                  )}
                  {isFlashcardMenuOpen && (
                    <div className="context-popover flashcard-popover" role="menu">
                      <p className="flashcard-placeholder-title">Flashcards · {selectedNode.flashcards?.length ?? 0}</p>
                      <button type="button" role="menuitem" onClick={() => openFlashcardEditor(selectedNode, undefined, true)} data-testid="create-flashcard-from-node">
                        <Sparkles size={14} /> Create Flashcard from Node
                      </button>
                      <button type="button" role="menuitem" onClick={() => openFlashcardEditor(selectedNode)}>
                        <Plus size={14} /> Create blank flashcard
                      </button>
                      {(selectedNode.flashcards ?? []).map((card, index) => (
                        <div className="flashcard-list-item" key={card.id ?? index}>
                          <button type="button" onClick={() => openFlashcardEditor(selectedNode, index)}>
                            <span>{card.question || 'Untitled card'}</span>
                            <small>{getMasteryStatusLabel(card.reviewSchedule?.mastery)} · {card.difficulty ?? 'medium'}</small>
                          </button>
                          <button type="button" className="danger-action" aria-label={`Delete flashcard ${card.question}`} onClick={() => void removeFlashcard(selectedNode.id, index)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      <div className="popover-divider" />
                      <button type="button" role="menuitem" disabled={!graph.nodes.some((node) => node.flashcards?.length)} onClick={() => { setIsFlashcardStudyOpen(true); setIsFlashcardMenuOpen(false); }}>
                        <Copy size={14} /> Study Flashcards
                      </button>
                      <button type="button" role="menuitem" disabled={!graph.nodes.some((node) => node.flashcards?.length)} onClick={exportFlashcardsCsv}>
                        <FileDown size={14} /> Export flashcards to CSV
                      </button>
                    </div>
                  )}
                  {isImageMenuOpen && (
                    <div className="context-popover image-popover" role="menu">
                      <label className="card-control-label">Image display
                        <select
                          data-testid="context-image-mode"
                          value={selectedNode.cardStyle?.imageMode ?? 'background'}
                          onChange={(event) => updateCardStyle(selectedNode.id, { imageMode: event.target.value as CardStyle['imageMode'] })}
                        >
                          <option value="background">Background</option>
                          <option value="card">Card image</option>
                        </select>
                      </label>
                      <label className="card-control-label">Node image
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void handleCardImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                      </label>
                      {!cardImageUrls[selectedNode.id] && <p className="card-image-help">Upload an image.</p>}
                      {cardImageUrls[selectedNode.id] && (
                        <>
                          <label className="card-control-label">Position
                            <select value={selectedNode.cardStyle?.imagePosition ?? 'above'} onChange={(event) => updateCardStyle(selectedNode.id, { imagePosition: event.target.value as CardStyle['imagePosition'] })}>{(selectedNode.cardStyle?.imageMode === 'background' ? ['center', 'top', 'bottom', 'left', 'right'] : ['above', 'below', 'left', 'right']).map((position) => <option key={position}>{position}</option>)}</select>
                          </label>
                          {selectedNode.cardStyle?.imageMode !== 'background' ? (
                            <label className="card-control-label">Size {selectedNode.cardStyle?.imageSize ?? 35}%
                              <input type="range" min="15" max="70" value={selectedNode.cardStyle?.imageSize ?? 35} onChange={(event) => updateCardStyle(selectedNode.id, { imageSize: Number(event.target.value) })} />
                            </label>
                          ) : (
                            <>
                              <label className="card-control-label">Image opacity {Math.round((selectedNode.cardStyle?.backgroundOpacity ?? 1) * 100)}%
                                <input type="range" min="0" max="1" step="0.05" value={selectedNode.cardStyle?.backgroundOpacity ?? 1} onChange={(event) => updateCardStyle(selectedNode.id, { backgroundOpacity: Number(event.target.value) })} />
                              </label>
                              <label className="card-control-label">Fit
                                <select value={selectedNode.cardStyle?.backgroundFit ?? 'cover'} onChange={(event) => updateCardStyle(selectedNode.id, { backgroundFit: event.target.value as CardStyle['backgroundFit'] })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option><option value="original">Original</option></select>
                              </label>
                              <label className="card-control-label">Darken overlay {Math.round((selectedNode.cardStyle?.backgroundOverlayOpacity ?? (selectedNode.cardStyle?.readabilityOverlay ? 0.42 : 0)) * 100)}%
                                <input type="range" min="0" max="0.8" step="0.05" value={selectedNode.cardStyle?.backgroundOverlayOpacity ?? (selectedNode.cardStyle?.readabilityOverlay ? 0.42 : 0)} onChange={(event) => updateCardStyle(selectedNode.id, { backgroundOverlayOpacity: Number(event.target.value), readabilityOverlay: false })} />
                              </label>
                            </>
                          )}
                          <button type="button" className="danger-action" onClick={() => void removeSelectedCardImage()}>Remove background image</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedNode &&
      !isConnectionMode &&
      !detailsNodeId &&
      isFormatPanelReady ? (
        <aside
          ref={formatPanelRef}
          className="node-format-panel"
          style={
            formatPanelPosition
              ? {
                  left: formatPanelPosition.x,
                  top: formatPanelPosition.y,
                  right: 'auto',
                }
              : undefined
          }
          aria-label={`Format ${selectedNode.text}`}
          data-testid="node-format-panel"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div
            className="node-format-heading"
            onPointerDown={startFormatPanelDrag}
            onPointerMove={moveFormatPanel}
            onPointerUp={stopFormatPanelDrag}
            onPointerCancel={stopFormatPanelDrag}
          >
            <div>
              <p className="node-format-kicker">Selected node</p>
              <h2>{selectedNode.text}</h2>
            </div>
            <button
              type="button"
              className="node-format-close"
              onClick={() => {
                setSelectedNodeId(null);
                setIsFormatPanelReady(false);
              }}
              aria-label="Close formatting panel"
              title="Close"
            >
              ×
            </button>
          </div>

          <fieldset className="node-format-fieldset">
            <legend>Shape</legend>
            <div className="node-shape-options">
              {nodeShapeOptions.map((option) => {
                const isSelected =
                  (selectedNode.shape ?? 'rectangle') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`node-shape-option${isSelected ? ' is-selected' : ''}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedNodeId(selectedNode.id);
                      updateNodeFormatting(selectedNode.id, {
                        shape: option.value,
                      });
                    }}
                    aria-pressed={isSelected}
                    data-testid={`node-shape-${option.value}`}
                  >
                    <span
                      className={`node-shape-preview preview-${option.value}`}
                      aria-hidden="true"
                    />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="node-format-fieldset">
            <legend>Size</legend>
            <div className="node-size-options">
              {nodeSizeOptions.map((option) => {
                const isSelected =
                  (selectedNode.size ?? 'medium') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`node-size-option${isSelected ? ' is-selected' : ''}`}
                    onClick={() =>
                      updateNodeFormatting(selectedNode.id, {
                        size: option.value,
                      })
                    }
                    aria-pressed={isSelected}
                    data-testid={`node-size-${option.value}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="node-format-fieldset mastery-controls">
            <legend>Mastery</legend>
            <div className="mastery-control-heading">
              <strong>{getMasteryStatusLabel(selectedNode.masteryScore)}</strong>
              <span>{clampMasteryScore(selectedNode.masteryScore)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={clampMasteryScore(selectedNode.masteryScore)}
              onChange={(event) => updateNodeMastery(selectedNode.id, { masteryScore: Number(event.target.value) })}
              aria-label="Node mastery score"
              data-testid="node-mastery-score"
            />
            <label className="mastery-study-toggle">
              <input
                type="checkbox"
                checked={selectedNode.studyEnabled !== false}
                onChange={(event) => updateNodeMastery(selectedNode.id, { studyEnabled: event.target.checked })}
                data-testid="node-study-enabled"
              />
              Include in map mastery
            </label>
          </fieldset>
          <fieldset className="node-format-fieldset">
            <legend>Typography</legend>
            <label className="card-control-label">Font
              <select
                data-testid="node-font-family"
                value={selectedNode.cardStyle?.fontFamily ?? 'sans'}
                onChange={(event) => updateCardStyle(selectedNode.id, { fontFamily: event.target.value as CardStyle['fontFamily'] })}
              >
                <option value="sans">Sans serif</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
                <option value="display">Display</option>
              </select>
            </label>
            <label className="card-control-label">Font size {selectedNode.cardStyle?.fontSize ?? 16}px
              <input data-testid="node-font-size" type="range" min="11" max="32" value={selectedNode.cardStyle?.fontSize ?? 16} onChange={(event) => updateCardStyle(selectedNode.id, { fontSize: Number(event.target.value) })} />
            </label>
            <label className="card-control-label">Weight
              <select data-testid="node-font-weight" value={selectedNode.cardStyle?.fontWeight ?? 'normal'} onChange={(event) => updateCardStyle(selectedNode.id, { fontWeight: event.target.value as CardStyle['fontWeight'] })}>
                <option value="normal">Regular</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </label>
            <div className="text-style-button-row" role="group" aria-label="Node text style">
              <button type="button" className={selectedNode.cardStyle?.fontItalic ? 'is-selected' : ''} onClick={() => updateCardStyle(selectedNode.id, { fontItalic: !selectedNode.cardStyle?.fontItalic })} data-testid="node-font-italic"><em>I</em></button>
              {(['left', 'center', 'right'] as const).map((alignment) => (
                <button key={alignment} type="button" className={(selectedNode.cardStyle?.textAlign ?? 'center') === alignment ? 'is-selected' : ''} onClick={() => updateCardStyle(selectedNode.id, { textAlign: alignment })} data-testid={`node-text-align-${alignment}`}>{alignment.slice(0, 1).toUpperCase()}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="node-format-fieldset">
            <legend>Appearance</legend>
            <label className="card-control-label">Image display
              <select
                data-testid="card-image-mode"
                value={selectedNode.cardStyle?.imageMode ?? 'background'}
                onChange={(event) => updateCardStyle(selectedNode.id, { imageMode: event.target.value as CardStyle['imageMode'] })}
              >
                <option value="background">Background image</option>
                <option value="card">Card image</option>
              </select>
            </label>
            <label className="card-control-label">Node image (JPG, PNG, or WebP)
              <input data-testid="card-image-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void handleCardImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            </label>
            {!cardImageUrls[selectedNode.id] ? <p className="card-image-help">Choose an image to replace the node background.</p> : null}
            <label className="card-control-label">Background Color
              <input data-testid="card-background-color" type="color" value={selectedNode.cardStyle?.backgroundColor ?? '#24546a'} onInput={(event) => updateCardStyle(selectedNode.id, { backgroundColor: event.currentTarget.value })} />
            </label>
            <div className="card-color-presets" aria-label="Background presets">
              {['#24546a', '#dc2626', '#2563eb', '#16a34a', '#6b3d65', '#9a5b2d'].map((color) => <button key={color} type="button" data-testid={`card-color-preset-${color.slice(1)}`} aria-label={`Use ${color}`} style={{ backgroundColor: color }} onClick={() => updateCardStyle(selectedNode.id, { backgroundColor: color })} />)}
            </div>
            <label className="card-control-label">Text Color
              <input data-testid="card-text-color" type="color" value={selectedNode.cardStyle?.textColor ?? '#ffffff'} onInput={(event) => updateCardStyle(selectedNode.id, { textColor: event.currentTarget.value })} />
            </label>
            <label className="card-control-label">Border Color
              <input data-testid="card-border-color" type="color" value={selectedNode.cardStyle?.borderColor ?? '#d7d0c3'} onInput={(event) => updateCardStyle(selectedNode.id, { borderColor: event.currentTarget.value })} />
            </label>
            <label className="card-control-label">Border Width {selectedNode.cardStyle?.borderWidth ?? 1}px
              <input data-testid="card-border-width" type="range" min="0" max="8" value={selectedNode.cardStyle?.borderWidth ?? 1} onChange={(event) => updateCardStyle(selectedNode.id, { borderWidth: Number(event.target.value) })} />
            </label>
            <label className="card-control-label">Border Style
              <select data-testid="card-border-style" value={selectedNode.cardStyle?.borderStyle ?? 'solid'} onChange={(event) => updateCardStyle(selectedNode.id, { borderStyle: event.target.value as CardStyle['borderStyle'] })}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </label>
            {cardImageUrls[selectedNode.id] ? <>
              <label className="card-control-label">Position
                <select data-testid="card-image-position" value={selectedNode.cardStyle?.imagePosition ?? 'above'} onChange={(event) => updateCardStyle(selectedNode.id, { imagePosition: event.target.value as CardStyle['imagePosition'] })}>{(selectedNode.cardStyle?.imageMode === 'background' ? ['center', 'top', 'bottom', 'left', 'right'] : ['above', 'below', 'left', 'right']).map((position) => <option key={position}>{position}</option>)}</select>
              </label>
              {selectedNode.cardStyle?.imageMode !== 'background' ? <label className="card-control-label">Image size {selectedNode.cardStyle?.imageSize ?? 35}%
                <input data-testid="card-image-size" type="range" min="15" max="70" value={selectedNode.cardStyle?.imageSize ?? 35} onChange={(event) => updateCardStyle(selectedNode.id, { imageSize: Number(event.target.value) })} />
              </label> : <>
                <label className="card-control-label">Image opacity {Math.round((selectedNode.cardStyle?.backgroundOpacity ?? 1) * 100)}%
                  <input data-testid="card-background-opacity" type="range" min="0" max="1" step="0.05" value={selectedNode.cardStyle?.backgroundOpacity ?? 1} onChange={(event) => updateCardStyle(selectedNode.id, { backgroundOpacity: Number(event.target.value) })} />
                </label>
                <label className="card-control-label">Fit
                  <select data-testid="card-background-fit" value={selectedNode.cardStyle?.backgroundFit ?? 'cover'} onChange={(event) => updateCardStyle(selectedNode.id, { backgroundFit: event.target.value as CardStyle['backgroundFit'] })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option><option value="original">Original</option></select>
                </label>
                <label className="card-control-label">Darken overlay {Math.round((selectedNode.cardStyle?.backgroundOverlayOpacity ?? (selectedNode.cardStyle?.readabilityOverlay ? 0.42 : 0)) * 100)}%
                  <input data-testid="card-background-overlay-opacity" type="range" min="0" max="0.8" step="0.05" value={selectedNode.cardStyle?.backgroundOverlayOpacity ?? (selectedNode.cardStyle?.readabilityOverlay ? 0.42 : 0)} onChange={(event) => updateCardStyle(selectedNode.id, { backgroundOverlayOpacity: Number(event.target.value), readabilityOverlay: false })} />
                </label>
              </>}
              <button type="button" data-testid="card-image-remove" onClick={() => void removeSelectedCardImage()}>Remove background image</button>
            </> : null}
            <div className="card-style-actions">
              <button type="button" data-testid="card-apply-all" onClick={() => {
                void copyCardImageToNodes(mapId, selectedNode.id, graph.nodes.map((node) => node.id)).then(() => {
                  commitGraphChange({ ...graph, nodes: graph.nodes.map((node) => ({ ...node, cardStyle: selectedNode.cardStyle })) });
                });
              }}>Apply to All Cards</button>
              <button type="button" data-testid="card-reset-style" onClick={() => updateNodeFormatting(selectedNode.id, { cardStyle: undefined })}>Reset Card Style</button>
            </div>
          </fieldset>
        </aside>
      ) : null}

      {selectedAnnotation && !isDrawingMode && !isEraserMode ? (
        <aside
          className="node-format-panel annotation-format-panel"
          aria-label={`Format textbox ${selectedAnnotation.text}`}
          data-testid="annotation-format-panel"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="node-format-heading">
            <div>
              <p className="node-format-kicker">Selected textbox</p>
              <h2>Text style</h2>
            </div>
            <button type="button" className="node-format-close" onClick={() => setSelectedAnnotationId(null)} aria-label="Close textbox formatting">×</button>
          </div>
          <fieldset className="node-format-fieldset">
            <legend>Typography</legend>
            <label className="card-control-label">Font
              <select data-testid="annotation-font-family" value={selectedAnnotation.fontFamily ?? 'sans'} onChange={(event) => updateAnnotationStyle(selectedAnnotation.id, { fontFamily: event.target.value as MapAnnotation['fontFamily'] })}>
                <option value="sans">Sans serif</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
                <option value="display">Display</option>
              </select>
            </label>
            <label className="card-control-label">Font size {selectedAnnotation.fontSize ?? 16}px
              <input data-testid="annotation-font-size" type="range" min="11" max="48" value={selectedAnnotation.fontSize ?? 16} onChange={(event) => updateAnnotationStyle(selectedAnnotation.id, { fontSize: Number(event.target.value) })} />
            </label>
            <label className="card-control-label">Weight
              <select data-testid="annotation-font-weight" value={selectedAnnotation.fontWeight ?? 'normal'} onChange={(event) => updateAnnotationStyle(selectedAnnotation.id, { fontWeight: event.target.value as MapAnnotation['fontWeight'] })}>
                <option value="normal">Regular</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </label>
            <label className="card-control-label">Text color
              <input data-testid="annotation-text-color" type="color" value={selectedAnnotation.color ?? '#263c6a'} onInput={(event) => updateAnnotationStyle(selectedAnnotation.id, { color: event.currentTarget.value })} />
            </label>
            <div className="text-style-button-row" role="group" aria-label="Textbox text style">
              <button type="button" className={selectedAnnotation.fontItalic ? 'is-selected' : ''} onClick={() => updateAnnotationStyle(selectedAnnotation.id, { fontItalic: !selectedAnnotation.fontItalic })} data-testid="annotation-font-italic"><em>I</em></button>
              {(['left', 'center', 'right'] as const).map((alignment) => (
                <button key={alignment} type="button" className={(selectedAnnotation.textAlign ?? 'left') === alignment ? 'is-selected' : ''} onClick={() => updateAnnotationStyle(selectedAnnotation.id, { textAlign: alignment })} data-testid={`annotation-text-align-${alignment}`}>{alignment.slice(0, 1).toUpperCase()}</button>
              ))}
            </div>
          </fieldset>
        </aside>
      ) : null}

      {isBranchPanelOpen ? (
        <aside className="branch-panel" aria-label="Branch controls" data-testid="branch-panel" onPointerDown={(event) => event.stopPropagation()}>
          <div className="map-background-panel-header">
            <div><p>Creative connections</p><h2>Branches</h2></div>
            <button type="button" onClick={() => setIsBranchPanelOpen(false)} aria-label="Close branch controls">×</button>
          </div>
          <div className="branch-style-grid" role="group" aria-label="Branch style">
            {(['straight', 'curved', 'elbow', 'dotted', 'bold'] as BranchStyle[]).map((style) => (
              <button key={style} type="button" className={branchStyle === style ? 'is-selected' : ''} onClick={() => setBranchStyle(style)} data-testid={`branch-style-${style}`}>
                <span className={`branch-style-preview preview-${style}`} aria-hidden="true" />
                {style}
              </button>
            ))}
          </div>
          <div className="branch-visibility-actions">
            <button type="button" disabled={!selectedNode || !graph.edges.some((edge) => edge.from === selectedNode.id)} onClick={() => selectedNode && setCollapsedNodeIds((current) => new Set(current).add(selectedNode.id))} data-testid="button-hide-selected-branch">Hide selected branch</button>
            <button type="button" disabled={!selectedNode} onClick={() => selectedNode && setCollapsedNodeIds((current) => { const next = new Set(current); next.delete(selectedNode.id); return next; })} data-testid="button-show-selected-branch">Show selected branch</button>
            <button type="button" onClick={() => setCollapsedNodeIds(new Set(graph.edges.map((edge) => edge.from)))} data-testid="button-hide-all-branches">Hide all branches</button>
            <button type="button" onClick={() => setCollapsedNodeIds(new Set())} data-testid="button-show-all-branches">Show all branches</button>
          </div>
          <p className="node-animation-help">Select a main node, then hide or reveal all of its child notes with one click.</p>
        </aside>
      ) : null}

      {isAnimationPanelOpen && selectedNode ? (
        <aside
          className="node-animation-panel"
          aria-label="Node animations"
          data-testid="node-animation-panel"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="map-background-panel-header">
            <div>
              <p>Make it move</p>
              <h2>Node Animation</h2>
            </div>
            <button type="button" onClick={() => setIsAnimationPanelOpen(false)} aria-label="Close node animations">×</button>
          </div>
          <div className="node-animation-grid" role="group" aria-label="Animation style">
            {([
              ['none', 'Still'],
              ['pop', 'Pop'],
              ['bounce', 'Bounce'],
              ['float', 'Float'],
              ['pulse', 'Pulse'],
              ['wiggle', 'Wiggle'],
              ['glow', 'Glow'],
            ] as Array<[NodeAnimation, string]>).map(([animation, label]) => (
              <button
                key={animation}
                type="button"
                className={(selectedNode.cardStyle?.animation ?? 'none') === animation ? 'is-selected' : ''}
                onClick={() => {
                  updateCardStyle(selectedNode.id, { animation });
                  setAnimationReplay((current) => ({ ...current, [selectedNode.id]: (current[selectedNode.id] ?? 0) + 1 }));
                }}
                data-testid={`node-animation-${animation}`}
              >
                <span className={`animation-swatch animation-swatch-${animation}`} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <label>
            Animation speed
            <select
              value={selectedNode.cardStyle?.animationSpeed ?? 'normal'}
              onChange={(event) => updateCardStyle(selectedNode.id, { animationSpeed: event.currentTarget.value as NodeAnimationSpeed })}
              data-testid="select-node-animation-speed"
            >
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <button
            type="button"
            className="node-animation-replay"
            disabled={(selectedNode.cardStyle?.animation ?? 'none') === 'none'}
            onClick={() => setAnimationReplay((current) => ({ ...current, [selectedNode.id]: (current[selectedNode.id] ?? 0) + 1 }))}
            data-testid="button-replay-node-animation"
          >
            <Sparkles size={15} aria-hidden="true" />
            Replay animation
          </button>
          <p className="node-animation-help">Float, pulse, and glow loop continuously. Pop, bounce, and wiggle replay on demand.</p>
        </aside>
      ) : null}

      {isMapBackgroundPanelOpen ? (
        <aside
          className="map-background-panel"
          aria-label="Map background"
          data-testid="map-background-panel"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="map-background-panel-header">
            <div>
              <p>Canvas appearance</p>
              <h2>Map Background</h2>
            </div>
            <button type="button" onClick={() => setIsMapBackgroundPanelOpen(false)} aria-label="Close map background">×</button>
          </div>
          <label>
            Background color
            <input
              type="color"
              value={mapBackgroundStyle.color}
              onInput={(event) => {
                const color = event.currentTarget.value;
                setMapBackgroundStyle((current) => ({ ...current, color }));
              }}
              data-testid="map-background-color"
            />
          </label>
          <div className="map-background-presets" aria-label="Background color presets">
            {['#f4f0e7', '#eef5f7', '#f2edf6', '#edf4ec', '#f8eee8', '#faf4d8'].map((color) => (
              <button key={color} type="button" style={{ backgroundColor: color }} onClick={() => setMapBackgroundStyle((current) => ({ ...current, color }))} aria-label={`Use ${color}`} />
            ))}
          </div>
          <button type="button" className="map-background-upload" onClick={() => mapBackgroundInputRef.current?.click()} data-testid="button-upload-map-background">
            <Image size={15} aria-hidden="true" />
            {mapBackgroundUrl ? 'Replace image' : 'Upload image'}
          </button>
          <input
            ref={mapBackgroundInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              void uploadMapBackground(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
          <label>
            Image fit
            <select value={mapBackgroundStyle.fit} onChange={(event) => {
              const fit = event.currentTarget.value as BackgroundStyle['fit'];
              setMapBackgroundStyle((current) => ({ ...current, fit }));
            }} disabled={!mapBackgroundUrl} data-testid="select-map-background-fit">
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="stretch">Stretch</option>
            </select>
          </label>
          <label className="map-background-overlay">
            <input type="checkbox" checked={mapBackgroundStyle.overlay} onChange={(event) => {
              const overlay = event.currentTarget.checked;
              setMapBackgroundStyle((current) => ({ ...current, overlay }));
            }} disabled={!mapBackgroundUrl} />
            Add light readability overlay
          </label>
          <button type="button" className="map-background-reset" onClick={() => void resetMapBackground()} data-testid="button-reset-map-background">Reset background</button>
        </aside>
      ) : null}

      {detailsNode && detailsDraft ? (
        <aside
          className="node-details-panel"
          aria-label="Node Details"
          data-testid="node-details-panel"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="node-details-header">
            <div>
              <p className="node-details-kicker">Clinical annotation</p>
              <h2>Node Details</h2>
            </div>
            <button
              type="button"
              className="node-details-close"
              onClick={closeNodeDetails}
              aria-label="Close Node Details"
              title="Close"
              data-testid="button-close-node-details"
            >
              ×
            </button>
          </div>

          <div className="node-details-form">
            <div className="node-details-field">
              <label htmlFor="node-details-title">Title</label>
              <input
                id="node-details-title"
                type="text"
                value={detailsDraft.title}
                onChange={(event) => {
                  updateNodeDetails({
                    ...detailsDraft,
                    title: event.target.value,
                  });
                }}
                data-testid="input-node-details-title"
              />
            </div>

            <NoteBackgroundEditor
              mapId={mapId}
              nodeId={detailsNode.id}
              value={detailsDraft.notes}
              settings={detailsDraft.noteBackground}
              onChange={(notes) =>
                updateNodeDetails({ ...detailsDraft, notes })
              }
              onSettingsChange={(noteBackground) =>
                updateNodeDetails({ ...detailsDraft, noteBackground })
              }
              onMediaChange={() => touchStoredMap(mapId)}
            />

            {nodeDetailFields.map((field) => (
              <div className="node-details-field" key={field.key}>
                <label htmlFor={`node-details-${field.key}`}>
                  {field.label}
                </label>
                <textarea
                  id={`node-details-${field.key}`}
                  rows={field.rows}
                  value={detailsDraft[field.key]}
                  onChange={(event) => {
                    updateNodeDetails({
                      ...detailsDraft,
                      [field.key]: event.target.value,
                    });
                  }}
                  data-testid={`input-node-details-${field.key}`}
                />
              </div>
            ))}

            <NodeImagesSection
              mapId={mapId}
              nodeId={detailsNode.id}
              onChange={() => touchStoredMap(mapId)}
              onMutation={recordNodeImageHistory}
              onSaveStatusChange={onSaveStatusChange}
              refreshToken={nodeImagesRevision}
            />

            <div className="node-details-actions">
              <div className="note-output-actions">
                <button type="button" onClick={exportNotesPdf} data-testid="button-export-notes-pdf">
                  <FileDown size={14} aria-hidden="true" />
                  Export notes PDF
                </button>
                <button type="button" onClick={printNotes} data-testid="button-print-notes-panel">
                  <Printer size={14} aria-hidden="true" />
                  Print notes
                </button>
              </div>
              <span className="node-details-autosaved">Saved</span>
            </div>
          </div>
        </aside>
      ) : null}

      <p className="canvas-hint">
        {isCompareSelectionMode
          ? 'Select 2–4 nodes, then choose Compare.'
          : isDrawingMode
          ? 'Draw freely on the canvas. Use Undo to remove the latest stroke.'
          : isEraserMode
            ? 'Drag across a drawing stroke to erase it. Use Undo to restore erased strokes.'
          : isConnectionMode
          ? 'Drag a connector from any node to any other node.'
          : 'Add a child branch or start a separate node. Drag nodes to place them, or drag empty space to pan.'}
      </p>

      {isCompareSelectionMode ? (
        <div className="comparison-selection-bar" role="status">
          <span><strong>{comparisonNodeIds.length}</strong> of 2–4 nodes selected</span>
          <button type="button" onClick={() => { setIsCompareSelectionMode(false); setComparisonNodeIds([]); }}>Cancel</button>
          <button type="button" className="comparison-selection-primary" disabled={comparisonNodeIds.length < 2} onClick={() => setIsComparisonWorkspaceOpen(true)} data-testid="open-comparison-workspace">
            Compare
          </button>
        </div>
      ) : null}

      {isToolbarVisible && !isCompareSelectionMode ? (
      <>
        {isDrawingMode && (
          <div className="sub-toolbar drawing-toolbar-options" aria-label="Drawing options">
            <label title="Drawing color" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
              Color
              <input
                type="color"
                value={drawingColor}
                onInput={(event) => setDrawingColor(event.currentTarget.value)}
                data-testid="input-drawing-color"
              />
            </label>
            <label className="drawing-width-control" title={`Brush size ${drawingWidth}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
              Width
              <input
                type="range"
                min="1"
                max="14"
                value={drawingWidth}
                onChange={(event) => setDrawingWidth(Number(event.target.value))}
                data-testid="input-drawing-width"
              />
            </label>
            <button
              type="button"
              className="canvas-control"
              onClick={clearDrawings}
              disabled={(graph.drawings ?? []).length === 0}
              aria-label="Clear all drawings"
              title="Clear all drawings"
              data-testid="button-clear-drawings"
              style={{ marginLeft: '8px' }}
            >
              <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        )}
      <div
        ref={toolbarRef}
        className={`canvas-controls${isLayoutMenuOpen ? ' has-open-layout-menu' : ''}${isMoreMenuOpen || isExportMenuOpen || isSearchOpen ? ' has-open-toolbar-menu' : ''}${toolbarPosition ? ' is-moved' : ''}`}
        style={toolbarPosition ? { left: toolbarPosition.x, top: toolbarPosition.y } : undefined}
        role="group"
        aria-label="Canvas view controls"
        data-testid="canvas-controls"
         onPointerDown={startToolbarDrag}
         onPointerMove={moveToolbar}
         onPointerUp={stopToolbarDrag}
         onPointerCancel={stopToolbarDrag}
        onWheel={(event) => event.stopPropagation()}
      >

        <button type="button" className="toolbar-drag-handle" aria-label="Move toolbar" title="Drag to move toolbar" data-testid="toolbar-drag-handle">
          <GripHorizontal size={16} aria-hidden="true" />
        </button>
        <button type="button" className="toolbar-scroll-button toolbar-scroll-left" onClick={() => {
          if (toolbarRef.current) toolbarRef.current.scrollLeft = Math.max(0, toolbarRef.current.scrollLeft - 240);
        }} aria-label="Previous toolbar actions" title="Previous toolbar actions">
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="canvas-control canvas-control-labeled"
          onClick={openSeparateNodeDialog}
          aria-label="Add Node"
          title="Add Node"
        >
          <CirclePlus size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Add Node</span>
        </button>
        <button
          type="button"
          className="canvas-control canvas-control-labeled"
          onClick={() => openChildDialog(selectedNode?.id ?? graph.nodes[0]?.id)}
          disabled={graph.nodes.length === 0}
          aria-label="Add Child Node"
          title="Add Child Node"
        >
          <GitBranch size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Add Child</span>
        </button>

        <button
          type="button"
          className={`canvas-control canvas-control-labeled${isFormatPanelReady ? ' is-active' : ''}`}
          onClick={() => {
            if (!selectedNode) return;
            setIsFormatPanelReady(true);
            setIsImageMenuOpen(false);
            setIsFlashcardMenuOpen(false);
            setIsAiMenuOpen(false);
            setIsContextMoreMenuOpen(false);
          }}
          disabled={!selectedNode}
          aria-label="Style selected node"
          title={selectedNode ? 'Style selected node' : 'Select a node to style it'}
          data-testid="button-style-selected-node"
        >
          <Paintbrush size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Style</span>
        </button>

        <span className="canvas-toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className="canvas-control canvas-control-labeled"
          onClick={undoGraphChange}
          disabled={undoStack.length === 0}
          aria-label="Undo"
          title="Undo"
        >
          <Undo2 size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Undo</span>
        </button>
        <button
          type="button"
          className="canvas-control canvas-control-labeled"
          onClick={redoGraphChange}
          disabled={redoStack.length === 0}
          aria-label="Redo"
          title="Redo"
        >
          <Redo2 size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Redo</span>
        </button>

        <span className="canvas-toolbar-divider" aria-hidden="true" />

        <div className="toolbar-popover-wrapper toolbar-search-wrapper">
          <button
            type="button"
            className={`canvas-control canvas-control-labeled${isSearchOpen ? ' is-active' : ''}`}
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              setIsMoreMenuOpen(false);
              setIsExportMenuOpen(false);
              if (isSearchOpen) setSearchQuery('');
              if (!isSearchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            aria-label="Search map"
            title="Search map"
          >
            <Search size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Search</span>
          </button>
          {isSearchOpen && (
            <div className="toolbar-popover" role="menu">
              <input 
                ref={searchInputRef}
                type="search"
                className="toolbar-search-input"
                placeholder="Search names, notes, cards, tags..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchResults[0]) {
                    focusNode(searchResults[0].id);
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  } else if (event.key === 'Escape') {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }
                }}
              />
              {normalizedSearchQuery ? (
                <div className="toolbar-search-results" role="listbox" aria-label="Map search results">
                  {searchResults.length > 0 ? searchResults.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      role="option"
                      onClick={() => {
                        focusNode(node.id);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <span>{node.text}</span>
                      <small>Open and center node</small>
                    </button>
                  )) : <p>No matching nodes</p>}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <button
          type="button"
          className="canvas-control canvas-control-labeled"
          onClick={openStudyMode}
          aria-label="Study"
          title="Study map"
        >
          <Columns size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Study</span>
        </button>

        <button
          type="button"
          className={`canvas-control canvas-control-labeled${isCompareSelectionMode ? ' is-active' : ''}`}
          onClick={() => {
            setIsCompareSelectionMode((active) => !active);
            setComparisonNodeIds([]);
            setSelectedNodeId(null);
          }}
          aria-label="Compare Nodes"
          title="Select 2–4 nodes to compare"
          data-testid="button-compare-nodes"
        >
          <Columns size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Compare</span>
        </button>


        <div className="toolbar-popover-wrapper toolbar-export-wrapper">
          <button
            type="button"
            className={`canvas-control canvas-control-labeled${isExportMenuOpen ? ' is-active' : ''}`}
            onClick={() => {
              setIsExportMenuOpen(!isExportMenuOpen);
              setIsMoreMenuOpen(false);
              setIsSearchOpen(false);
            }}
            aria-label="Export map"
            title="Export map"
          >
            <FileDown size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Export</span>
          </button>
          {isExportMenuOpen && (
            <div className="toolbar-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => { exportNotesPdf(); setIsExportMenuOpen(false); }}>
                <FileDown size={14} /> Notes PDF
              </button>
              <button type="button" role="menuitem" onClick={() => { printNotes(); setIsExportMenuOpen(false); }}>
                <Printer size={14} /> Print Notes
              </button>
              <button type="button" role="menuitem" onClick={() => { window.print(); setIsExportMenuOpen(false); }}>
                <Printer size={14} /> Print Map
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-popover-wrapper toolbar-more-wrapper">
          <button
            type="button"
            className={`canvas-control canvas-control-labeled${isMoreMenuOpen ? ' is-active' : ''}`}
            onClick={() => {
              setIsMoreMenuOpen(!isMoreMenuOpen);
              setIsExportMenuOpen(false);
              setIsSearchOpen(false);
            }}
            aria-label="More actions"
            title="More actions"
          >
            <MoreHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>More</span>
          </button>
          {isMoreMenuOpen && (
            <div className="toolbar-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => { openAnnotationDialog(); setIsMoreMenuOpen(false); }}>
                <Type size={14} /> Textbox
              </button>
              <button type="button" role="menuitem" onClick={() => { mapMediaInputRef.current?.click(); setIsMoreMenuOpen(false); }}>
                <Video size={14} /> Media
              </button>
              <input ref={mapMediaInputRef} className="sr-only" type="file" accept="image/*,video/*" onChange={(e) => { void uploadMapMedia(e.target.files?.[0]); e.currentTarget.value = ''; }} />
              <button type="button" role="menuitem" onClick={() => { setIsMapBackgroundPanelOpen(true); setIsMoreMenuOpen(false); }}>
                <Image size={14} /> Background
              </button>
              <button type="button" role="menuitem" onClick={() => { setIsBranchPanelOpen(true); setIsMoreMenuOpen(false); }}>
                <GitBranch size={14} /> Branches
              </button>
              <div className="popover-divider" />
              <button type="button" role="menuitem" className={isDrawingMode ? 'is-active' : ''} onClick={() => { toggleDrawingMode(); setIsMoreMenuOpen(false); }}>
                <Paintbrush size={14} /> Draw
              </button>
              <button type="button" role="menuitem" className={isEraserMode ? 'is-active' : ''} onClick={() => { toggleEraserMode(); setIsMoreMenuOpen(false); }}>
                <Eraser size={14} /> Eraser
              </button>
              <button type="button" role="menuitem" className={isConnectionMode ? 'is-active' : ''} onClick={() => { toggleConnectionMode(); setIsMoreMenuOpen(false); }}>
                <Link2 size={14} /> Connect
              </button>
              <div className="popover-divider" />
              {layoutOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  className={layoutMode === option.value ? 'is-active' : ''}
                  onClick={() => {
                    applyLayout(option.value);
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <LayoutTemplate size={14} /> {option.label}
                </button>
              ))}
              <div className="popover-divider" />
              <div className="zoom-controls">
                <button type="button" onClick={() => zoomBy(-0.1)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
                  <Minus size={14} />
                </button>
                <button type="button" onClick={resetView} aria-label="Center map">
                  <RotateCcw size={14} />
                </button>
                <button type="button" onClick={() => zoomBy(0.1)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
                  <Plus size={14} />
                </button>
              </div>
              <div className="popover-divider" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowMasteryIndicators((visible) => !visible);
                  setIsMoreMenuOpen(false);
                }}
                data-testid="toggle-mastery-indicators"
              >
                {showMasteryIndicators ? <EyeOff size={14} /> : <Eye size={14} />}
                {showMasteryIndicators ? 'Hide mastery indicators' : 'Show mastery indicators'}
              </button>
              <button type="button" role="menuitem" onClick={() => { setIsToolbarVisible(false); setIsMoreMenuOpen(false); }}>
                <EyeOff size={14} /> Hide toolbar
              </button>
            </div>
          )}
        </div>

        <button type="button" className="toolbar-scroll-button toolbar-scroll-right" onClick={() => {
          if (toolbarRef.current) {
            toolbarRef.current.scrollLeft = Math.min(
              toolbarRef.current.scrollWidth - toolbarRef.current.clientWidth,
              toolbarRef.current.scrollLeft + 240,
            );
          }
        }} aria-label="More toolbar actions" title="More toolbar actions">
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      </>
      ) : (
        <button
          type="button"
          className="toolbar-show-button"
          style={toolbarPosition ? { left: toolbarPosition.x, top: toolbarPosition.y } : undefined}
          onClick={() => setIsToolbarVisible(true)}
          aria-label="Show toolbar"
          title="Show toolbar"
          data-testid="button-show-toolbar"
        >
          <Eye size={16} aria-hidden="true" />
          <span>Show toolbar</span>
        </button>
      )}

      {isChildDialogOpen ? (
        <div
          className="new-map-dialog"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeChildDialog();
          }}
        >
          <section
            className="new-map-dialog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="child-node-dialog-title"
            aria-describedby="child-node-dialog-description"
            data-testid={isCreatingSeparateNode ? 'dialog-add-separate-node' : 'dialog-add-child-node'}
          >
            <p className="new-map-dialog-kicker">
              {isCreatingSeparateNode ? 'New starting point' : 'New branch'}
            </p>
            <h2 className="new-map-dialog-title" id="child-node-dialog-title">
              {isCreatingSeparateNode ? 'Add a separate node' : 'Add a child node'}
            </h2>
            <p
              className="new-map-dialog-description"
              id="child-node-dialog-description"
            >
              {isCreatingSeparateNode
                ? 'Start another independent idea that can grow its own branches.'
                : 'Add the next idea branching from this node.'}
            </p>
            <form className="new-map-form" onSubmit={handleCreateChild}>
              <label htmlFor="child-node-text">Node text</label>
              <input
                ref={childTextInputRef}
                id="child-node-text"
                name="child-node-text"
                type="text"
                value={childText}
                onChange={(event) => {
                  setChildText(event.target.value);
                  if (childTextError) setChildTextError('');
                }}
                aria-invalid={Boolean(childTextError)}
                aria-describedby={
                  childTextError ? 'child-node-text-error' : undefined
                }
                autoComplete="off"
                data-testid="input-child-node-text"
              />
              <p
                className="dialog-error"
                id="child-node-text-error"
                role="alert"
              >
                {childTextError}
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="dialog-action"
                  onClick={closeChildDialog}
                  data-testid="button-cancel-child-node"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dialog-action dialog-action-primary"
                  data-testid={isCreatingSeparateNode ? 'button-create-separate-node' : 'button-create-child-node'}
                >
                  {isCreatingSeparateNode ? 'Add Separate Node' : 'Add Node'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isAnnotationDialogOpen ? (
        <div
          className="new-map-dialog"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAnnotationDialog();
          }}
        >
          <section
            className="new-map-dialog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="annotation-dialog-title"
            aria-describedby="annotation-dialog-description"
            data-testid="dialog-textbox"
          >
            <p className="new-map-dialog-kicker">Canvas annotation</p>
            <h2 className="new-map-dialog-title" id="annotation-dialog-title">
              {editingAnnotationId ? 'Edit textbox' : 'Insert a textbox'}
            </h2>
            <p className="new-map-dialog-description" id="annotation-dialog-description">
              Add free-floating text that can be dragged anywhere without connecting to nodes.
            </p>
            <form className="new-map-form" onSubmit={handleSaveAnnotation}>
              <label htmlFor="annotation-text">Textbox text</label>
              <textarea
                ref={annotationTextInputRef}
                id="annotation-text"
                name="annotation-text"
                rows={5}
                value={annotationText}
                onChange={(event) => {
                  setAnnotationText(event.target.value);
                  if (annotationTextError) setAnnotationTextError('');
                }}
                aria-invalid={Boolean(annotationTextError)}
                aria-describedby={annotationTextError ? 'annotation-text-error' : undefined}
                data-testid="input-textbox-text"
              />
              <p className="dialog-error" id="annotation-text-error" role="alert">
                {annotationTextError}
              </p>
              <div className="dialog-actions">
                <button type="button" className="dialog-action" onClick={closeAnnotationDialog}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dialog-action dialog-action-primary"
                  data-testid="button-save-textbox"
                >
                  {editingAnnotationId ? 'Save Changes' : 'Insert Textbox'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isStudyModeOpen ? (
        <StudyMap
          mapName={mapName}
          nodes={graph.nodes}
          edges={graph.edges}
          onRate={rateStudyAnswer}
          onClose={() => setIsStudyModeOpen(false)}
        />
      ) : null}

      {isFlashcardStudyOpen ? (
        <FlashcardStudy
          mapName={mapName}
          cards={graph.nodes.flatMap((node) => (node.flashcards ?? [])
            .filter((card) => card.question?.trim() && card.answer?.trim())
            .map((card, cardIndex) => ({
              nodeId: node.id,
              nodeTitle: node.text,
              cardIndex,
              card,
              imageUrl: card.id ? flashcardImageUrls[card.id] : undefined,
            })))}
          onRate={(nodeId, cardIndex, rating) => rateStudyAnswer(nodeId, cardIndex, rating)}
          onClose={() => setIsFlashcardStudyOpen(false)}
        />
      ) : null}

      {flashcardDraft ? (
        <div className="new-map-dialog flashcard-editor-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setFlashcardDraft(null);
        }}>
          <section className="new-map-dialog-panel flashcard-editor-panel" role="dialog" aria-modal="true" aria-labelledby="flashcard-editor-title">
            <p className="new-map-dialog-kicker">Source node · {graph.nodes.find((node) => node.id === flashcardDraft.nodeId)?.text}</p>
            <h2 className="new-map-dialog-title" id="flashcard-editor-title">{flashcardDraft.index === undefined ? 'Create flashcard' : 'Edit flashcard'}</h2>
            <form className="new-map-form flashcard-form" onSubmit={(event) => void saveFlashcard(event)}>
              <label>Question
                <textarea rows={2} required value={flashcardDraft.question} onChange={(event) => setFlashcardDraft({ ...flashcardDraft, question: event.target.value })} data-testid="flashcard-question" />
              </label>
              <label>Answer
                <textarea rows={3} required value={flashcardDraft.answer} onChange={(event) => setFlashcardDraft({ ...flashcardDraft, answer: event.target.value })} data-testid="flashcard-answer" />
              </label>
              <label>Explanation
                <textarea rows={2} value={flashcardDraft.explanation} onChange={(event) => setFlashcardDraft({ ...flashcardDraft, explanation: event.target.value })} />
              </label>
              <div className="flashcard-form-row">
                <label>Tags
                  <input value={flashcardDraft.tags} onChange={(event) => setFlashcardDraft({ ...flashcardDraft, tags: event.target.value })} placeholder="biology, exam" />
                </label>
                <label>Difficulty
                  <select value={flashcardDraft.difficulty} onChange={(event) => setFlashcardDraft({ ...flashcardDraft, difficulty: event.target.value as 'easy' | 'medium' | 'hard' })}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>
              <label>Image
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setFlashcardImageFile(file);
                  setRemoveFlashcardImage(false);
                }} />
              </label>
              {(flashcardImageFile || flashcardDraft.imageName) && !removeFlashcardImage ? (
                <div className="flashcard-image-preview">
                  {!flashcardImageFile && flashcardImageUrls[flashcardDraft.id] ? <img src={flashcardImageUrls[flashcardDraft.id]} alt="" /> : null}
                  <span>{flashcardImageFile?.name ?? flashcardDraft.imageName}</span>
                  <button type="button" onClick={() => { setFlashcardImageFile(null); setRemoveFlashcardImage(true); }}>Remove</button>
                </div>
              ) : null}
              <div className="flashcard-mastery-row">
                <span>Mastery status</span>
                <strong>{getMasteryStatusLabel(graph.nodes.find((node) => node.id === flashcardDraft.nodeId)?.flashcards?.[flashcardDraft.index ?? -1]?.reviewSchedule?.mastery)}</strong>
              </div>
              <div className="dialog-actions">
                <button type="button" className="dialog-action" onClick={() => setFlashcardDraft(null)}>Cancel</button>
                <button type="submit" className="dialog-action dialog-action-primary" data-testid="save-flashcard">Save Flashcard</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isDifferentialViewOpen && selectedNode ? (
        <DifferentialView
          mapId={mapId}
          sourceNode={selectedNode}
          graph={graph}
          onClose={() => setIsDifferentialViewOpen(false)}
        />
      ) : null}

      {isComparisonWorkspaceOpen ? (
        <CompareNodesWorkspace
          nodes={comparisonNodeIds.map((id) => graph.nodes.find((node) => node.id === id)).filter((node): node is MapNode => Boolean(node))}
          graph={graph}
          onClose={() => setIsComparisonWorkspaceOpen(false)}
          onSaveAsMap={saveComparisonAsMap}
        />
      ) : null}

      {isCommandPaletteOpen ? (
        <div
          className="command-palette-backdrop"
          role="presentation"
          onMouseDown={() => setIsCommandPaletteOpen(false)}
          data-testid="command-palette-backdrop"
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onMouseDown={(event) => event.stopPropagation()}
            data-testid="command-palette"
          >
            <div className="command-palette-search">
              <Search size={17} aria-hidden="true" />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && filteredCommandItems[0]) {
                    runCommand(filteredCommandItems[0]);
                  } else if (event.key === 'Escape') {
                    setIsCommandPaletteOpen(false);
                  }
                }}
                placeholder="Type a command..."
                aria-label="Search commands"
                data-testid="command-palette-input"
              />
              <kbd>Esc</kbd>
            </div>
            <div className="command-palette-results" role="menu">
              {filteredCommandItems.length > 0 ? filteredCommandItems.map((command) => (
                <button
                  key={command.label}
                  type="button"
                  role="menuitem"
                  disabled={command.disabled}
                  onClick={() => runCommand(command)}
                >
                  <span>{command.label}</span>
                  {command.label === 'Undo' ? <kbd>⌘Z</kbd> : null}
                  {command.label === 'Redo' ? <kbd>⇧⌘Z</kbd> : null}
                </button>
              )) : <p>No commands found</p>}
            </div>
          </section>
        </div>
      ) : null}

      {(activeAiAction || aiOperation.isLoading || aiOperation.data || aiOperation.error) ? (
        <AiReviewSidebar
          activeAction={activeAiAction!}
          operation={aiOperation}
          selectedItems={aiSelectedItems}
          onToggleItem={(id: string, selected: boolean) => {
            const next = new Set(aiSelectedItems);
            if (selected) next.add(id);
            else next.delete(id);
            setAiSelectedItems(next);
          }}
          onAccept={() => commitAiSuggestions()}
          onAcceptAll={() => {
            if (!aiOperation.data?.result) return;
            const res = aiOperation.data.result;
            const next = new Set<string>();
            if (res.nodes) res.nodes.forEach(n => next.add(n.tempId ?? n.title));
            if (res.flashcards) res.flashcards.forEach((_, i) => next.add(String(i)));
            if (res.questions) res.questions.forEach((_, i) => next.add(String(i)));
            if (res.keyPoints) res.keyPoints.forEach((_, i) => next.add(String(i)));
            if (activeAiAction === 'addExamples' && !res.keyPoints?.length && res.text) next.add('0');
            if (res.gaps) res.gaps.forEach((_, i) => next.add(String(i)));
            if (res.text && activeAiAction === 'simplify') next.add('simplify');
            setAiSelectedItems(next);
            commitAiSuggestions(next);
          }}
          onCancel={closeAiPanel}
          onRetry={() => {
             if (activeAiAction && aiTargetNodeId) startAiAction(activeAiAction, aiTargetNodeId);
          }}
        />
      ) : null}
    </div>
  );
}

function MapWorkspace() {
  const { mapId } = useParams<{ mapId: string }>();
  const [maps, setMaps] = useMapLibrary();
  const [, setLocation] = useLocation();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const selectedMap = maps.find((map) => map.id === mapId);
  const renameSelectedMap = (name: string) => {
    if (!mapId) return;
    setMaps((currentMaps) => currentMaps.map((map) =>
      map.id === mapId ? { ...map, name, updatedAt: new Date().toISOString() } : map,
    ));
  };

  if (!selectedMap) return <MapNotFound />;

  return (
    <main className="workspace-page min-h-[100dvh]" data-testid="map-workspace">
      <header className="workspace-header">
        <Link href="/" className="workspace-brand" data-testid="link-return-home">
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Knowledge Maps</span>
        </Link>
        <div className="workspace-status" data-testid="text-map-status">
          <Circle size={7} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          <span>{saveStatus === 'saving' ? 'Saving...' : 'Saved'}</span>
        </div>
      </header>

      <section className="map-shell" aria-labelledby="map-title">
      <MapCanvas
        key={selectedMap.id}
        mapId={selectedMap.id}
        mapName={selectedMap.name}
        onSaveStatusChange={setSaveStatus}
        onRenameMap={renameSelectedMap}
        onCreateComparisonMap={(comparisonMap, comparisonGraph) => {
          writeStoredMapGraph(comparisonMap.id, comparisonGraph);
          setMaps((currentMaps) => [...currentMaps, comparisonMap]);
          setLocation(`/map/${comparisonMap.id}`);
        }}
      />
      </section>
    </main>
  );
}

function MapCompatibilityRoute() {
  return (
    <main className="route-not-found" data-testid="map-compatibility">
      <div className="route-not-found-content">
        <p className="route-not-found-code">Choose a sheet</p>
        <h1>Maps have their own pages.</h1>
        <p>Return to the library to open a saved map or start a new one.</p>
        <Link href="/" className="route-home-link" data-testid="link-compatibility-home">
          <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Back to Knowledge Maps</span>
        </Link>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/map" component={MapCompatibilityRoute} />
        <Route path="/map/:mapId" component={MapWorkspace} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
