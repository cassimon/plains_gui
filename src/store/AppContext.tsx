import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

// ── Material ────────────────────────────────────────────────────────────────

export type Material = {
  id: string;
  type: string;
  name: string;
  supplier: string;
  supplierNumber: string;
  casNumber: string;
  pubchemCid: string;
  inventoryLabel: string;
  purity: string;
};

export function newMaterial(): Material {
  return {
    id: crypto.randomUUID(),
    type: '',
    name: '',
    supplier: '',
    supplierNumber: '',
    casNumber: '',
    pubchemCid: '',
    inventoryLabel: '',
    purity: '',
  };
}

// ── Experiment ───────────────────────────────────────────────────────────────

export type Experiment = {
  id: string;
  name: string;
  description: string;
  date: string; // ISO date string
};

export function newExperiment(): Experiment {
  return {
    id: crypto.randomUUID(),
    name: 'New Experiment',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  };
}

// ── Solution ─────────────────────────────────────────────────────────────────

export type SolutionComponent = {
  id: string;
  materialId: string;
  amount: string;
  unit: 'mg' | 'ml';
};

export type Solution = {
  id: string;
  name: string;
  components: SolutionComponent[];
};

export function newSolution(): Solution {
  return { id: crypto.randomUUID(), name: 'New Solution', components: [] };
}

export function newComponent(): SolutionComponent {
  return { id: crypto.randomUUID(), materialId: '', amount: '', unit: 'mg' };
}

// ── Organization / Canvas ─────────────────────────────────────────────────────
//
// Data model designed for future backend integration:
//   - All entities have stable `id` (UUID) keys
//   - Mutations go through typed repository functions on the context
//   - The context surface (useAppContext) is the sole interface that a backend
//     adapter needs to replace — swap useState for API calls without touching UI

export type CanvasElementType = 'text' | 'plaintext' | 'line' | 'collection';

export type Vec2 = { x: number; y: number };

export type CanvasTextElement = {
  id: string;
  type: 'text';
  position: Vec2;
  size: Vec2;
  content: string;
  color?: string;
};

export type TextFormatting = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type CanvasPlainTextElement = {
  id: string;
  type: 'plaintext';
  position: Vec2;
  size: Vec2;
  content: string;
  color: string; // text color, default black
  formatting: TextFormatting;
};

export type CanvasLineElement = {
  id: string;
  type: 'line';
  points: Vec2[]; // sequence of absolute canvas coordinates
  color?: string;
};

/**
 * A Collection is a named folder placed on the canvas that groups references
 * to Materials, Solutions and (extensibly) other app entities.
 */
export type CollectionRef = { kind: 'material' | 'solution' | 'experiment' | 'result' | 'analysis'; id: string };

export type CanvasCollectionElement = {
  id: string;
  type: 'collection';
  position: Vec2;
  size: Vec2;
  name: string;
  refs: CollectionRef[];
  color?: string;
};

export type CanvasElement =
  | CanvasTextElement
  | CanvasPlainTextElement
  | CanvasLineElement
  | CanvasCollectionElement;

export type Plane = {
  id: string;
  name: string;
  elements: CanvasElement[];
};

export function newPlane(name?: string): Plane {
  return { id: crypto.randomUUID(), name: name ?? 'New Plane', elements: [] };
}

function newTextElement(position: Vec2): CanvasTextElement {
  return { id: crypto.randomUUID(), type: 'text', position, size: { x: 200, y: 80 }, content: '' };
}

function newPlainTextElement(position: Vec2, color: string, formatting: TextFormatting): CanvasPlainTextElement {
  return {
    id: crypto.randomUUID(),
    type: 'plaintext',
    position,
    size: { x: 200, y: 40 },
    content: '',
    color,
    formatting,
  };
}

function newLineElement(start: Vec2): CanvasLineElement {
  // Initialize with two points so the line is immediately visible during drag
  return { id: crypto.randomUUID(), type: 'line', points: [start, { ...start }] };
}

function newCollectionElement(position: Vec2): CanvasCollectionElement {
  return {
    id: crypto.randomUUID(),
    type: 'collection',
    position,
    size: { x: 200, y: 160 },
    name: 'New Collection',
    refs: [],
  };
}

export { newTextElement, newPlainTextElement, newLineElement, newCollectionElement };

// ── Context ───────────────────────────────────────────────────────────────────

type AppContextValue = {
  // ── Data ──────────────────────────────────────────────────────────────────
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  solutions: Solution[];
  setSolutions: React.Dispatch<React.SetStateAction<Solution[]>>;
  experiments: Experiment[];
  setExperiments: React.Dispatch<React.SetStateAction<Experiment[]>>;
  planes: Plane[];

  // ── Plane repository ──────────────────────────────────────────────────────
  addPlane: (name?: string) => Plane;
  updatePlane: (plane: Plane) => void;
  deletePlane: (id: string) => void;

  // ── Element repository (operates on a specific plane) ─────────────────────
  addTextElement: (planeId: string, position: Vec2) => CanvasTextElement;
  addPlainTextElement: (planeId: string, position: Vec2, color: string, formatting: TextFormatting) => CanvasPlainTextElement;
  addLineElement: (planeId: string, start: Vec2) => CanvasLineElement;
  addCollectionElement: (planeId: string, position: Vec2) => CanvasCollectionElement;
  updateElement: (planeId: string, element: CanvasElement) => void;
  deleteElement: (planeId: string, elementId: string) => void;
  /** Remove srcId and dstId, insert merged collection — all in one atomic update */
  fuseCollections: (planeId: string, srcId: string, dstId: string, merged: CanvasCollectionElement) => void;

  // ── Selection ─────────────────────────────────────────────────────────────
  /** ID of the currently focused Collection canvas element, or null */
  activeCollectionId: string | null;
  setActiveCollectionId: (id: string | null) => void;

  /** ID of the plane currently shown in the Organisation tab */
  activePlaneId: string | null;
  setActivePlaneId: (id: string | null) => void;

  /**
   * When an action bubble creates a new item and navigates to another page,
   * this holds { collectionId, kind } so that page knows to auto-create an
   * item and link it back to the collection.
   */
  pendingCollectionLink: { collectionId: string; planeId: string; kind: CollectionRef['kind'] } | null;
  setPendingCollectionLink: (v: { collectionId: string; planeId: string; kind: CollectionRef['kind'] } | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [planes, setPlanes] = useState<Plane[]>([newPlane('Plane 1')]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activePlaneId, setActivePlaneId] = useState<string | null>(null);
  const [pendingCollectionLink, setPendingCollectionLink] = useState<{ collectionId: string; planeId: string; kind: CollectionRef['kind'] } | null>(null);

  // ── Plane mutations ────────────────────────────────────────────────────────

  const addPlane = useCallback((name?: string): Plane => {
    const p = newPlane(name);
    setPlanes((prev) => [...prev, p]);
    return p;
  }, []);

  const updatePlane = useCallback((plane: Plane) => {
    setPlanes((prev) => prev.map((p) => (p.id === plane.id ? plane : p)));
  }, []);

  const deletePlane = useCallback((id: string) => {
    setPlanes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Element mutations ──────────────────────────────────────────────────────

  const addTextElement = useCallback((planeId: string, position: Vec2): CanvasTextElement => {
    const el = newTextElement(position);
    setPlanes((prev) =>
      prev.map((p) => (p.id === planeId ? { ...p, elements: [...p.elements, el] } : p))
    );
    return el;
  }, []);

  const addPlainTextElement = useCallback(
    (planeId: string, position: Vec2, color: string, formatting: TextFormatting): CanvasPlainTextElement => {
      const el = newPlainTextElement(position, color, formatting);
      setPlanes((prev) =>
        prev.map((p) => (p.id === planeId ? { ...p, elements: [...p.elements, el] } : p))
      );
      return el;
    },
    []
  );

  const addLineElement = useCallback((planeId: string, start: Vec2): CanvasLineElement => {
    const el = newLineElement(start);
    setPlanes((prev) =>
      prev.map((p) => (p.id === planeId ? { ...p, elements: [...p.elements, el] } : p))
    );
    return el;
  }, []);

  const addCollectionElement = useCallback(
    (planeId: string, position: Vec2): CanvasCollectionElement => {
      const el = newCollectionElement(position);
      setPlanes((prev) =>
        prev.map((p) => (p.id === planeId ? { ...p, elements: [...p.elements, el] } : p))
      );
      return el;
    },
    []
  );

  const updateElement = useCallback((planeId: string, element: CanvasElement) => {
    setPlanes((prev) =>
      prev.map((p) =>
        p.id === planeId
          ? { ...p, elements: p.elements.map((e) => (e.id === element.id ? element : e)) }
          : p
      )
    );
  }, []);

  const deleteElement = useCallback((planeId: string, elementId: string) => {
    setPlanes((prev) =>
      prev.map((p) =>
        p.id === planeId ? { ...p, elements: p.elements.filter((e) => e.id !== elementId) } : p
      )
    );
  }, []);

  const fuseCollections = useCallback(
    (planeId: string, srcId: string, dstId: string, merged: CanvasCollectionElement) => {
      setPlanes((prev) =>
        prev.map((p) => {
          if (p.id !== planeId) return p;
          const kept = p.elements.filter((e) => e.id !== srcId && e.id !== dstId);
          return { ...p, elements: [...kept, merged] };
        })
      );
    },
    []
  );

  return (
    <AppContext.Provider
      value={{
        materials,
        setMaterials,
        solutions,
        setSolutions,
        experiments,
        setExperiments,
        planes,
        addPlane,
        updatePlane,
        deletePlane,
        addTextElement,
        addPlainTextElement,
        addLineElement,
        addCollectionElement,
        updateElement,
        deleteElement,
        fuseCollections,
        activeCollectionId,
        setActiveCollectionId,
        activePlaneId,
        setActivePlaneId,
        pendingCollectionLink,
        setPendingCollectionLink,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}

/**
 * Returns helpers for filtering entity lists and resolving collection colors
 * based on the currently active plane and collection selection.
 */
export function useEntityCollection() {
  const { planes, activePlaneId, activeCollectionId } = useAppContext();

  const activePlane = useMemo(
    () => planes.find((p) => p.id === activePlaneId) ?? planes[0] ?? null,
    [planes, activePlaneId]
  );

  // Map from "kind:id" → the first CanvasCollectionElement that owns it in the active plane
  const entityToCollection = useMemo(() => {
    const map = new Map<string, CanvasCollectionElement>();
    if (!activePlane) return map;
    for (const el of activePlane.elements) {
      if (el.type !== 'collection') continue;
      const col = el as CanvasCollectionElement;
      for (const ref of col.refs) {
        if (!map.has(`${ref.kind}:${ref.id}`)) {
          map.set(`${ref.kind}:${ref.id}`, col);
        }
      }
    }
    return map;
  }, [activePlane]);

  const activeCollection = useMemo(() => {
    if (!activeCollectionId || !activePlane) return null;
    const el = activePlane.elements.find((e) => e.id === activeCollectionId);
    return el?.type === 'collection' ? (el as CanvasCollectionElement) : null;
  }, [activeCollectionId, activePlane]);

  /** Color of the collection that owns this entity in the active plane, or null */
  const getEntityColor = useCallback(
    (kind: CollectionRef['kind'], id: string): string | null =>
      entityToCollection.get(`${kind}:${id}`)?.color ?? null,
    [entityToCollection]
  );

  /** True when entity should be shown: all entities shown when no collection selected */
  const isEntityVisible = useCallback(
    (kind: CollectionRef['kind'], id: string): boolean => {
      if (!activeCollection) return true;
      return activeCollection.refs.some((r) => r.kind === kind && r.id === id);
    },
    [activeCollection]
  );

  return { getEntityColor, isEntityVisible };
}
