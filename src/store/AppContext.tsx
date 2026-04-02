import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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

export type CanvasElementType = 'text' | 'line' | 'collection';

export type Vec2 = { x: number; y: number };

export type CanvasTextElement = {
  id: string;
  type: 'text';
  position: Vec2;
  size: Vec2;
  content: string;
  color?: string;
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

export { newTextElement, newLineElement, newCollectionElement };

// ── Context ───────────────────────────────────────────────────────────────────

type AppContextValue = {
  // ── Data ──────────────────────────────────────────────────────────────────
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  solutions: Solution[];
  setSolutions: React.Dispatch<React.SetStateAction<Solution[]>>;
  planes: Plane[];

  // ── Plane repository ──────────────────────────────────────────────────────
  addPlane: (name?: string) => Plane;
  updatePlane: (plane: Plane) => void;
  deletePlane: (id: string) => void;

  // ── Element repository (operates on a specific plane) ─────────────────────
  addTextElement: (planeId: string, position: Vec2) => CanvasTextElement;
  addLineElement: (planeId: string, start: Vec2) => CanvasLineElement;
  addCollectionElement: (planeId: string, position: Vec2) => CanvasCollectionElement;
  updateElement: (planeId: string, element: CanvasElement) => void;
  deleteElement: (planeId: string, elementId: string) => void;

  // ── Selection ─────────────────────────────────────────────────────────────
  /** ID of the currently focused Collection canvas element, or null */
  activeCollectionId: string | null;
  setActiveCollectionId: (id: string | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [planes, setPlanes] = useState<Plane[]>([newPlane('Plane 1')]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

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

  return (
    <AppContext.Provider
      value={{
        materials,
        setMaterials,
        solutions,
        setSolutions,
        planes,
        addPlane,
        updatePlane,
        deletePlane,
        addTextElement,
        addLineElement,
        addCollectionElement,
        updateElement,
        deleteElement,
        activeCollectionId,
        setActiveCollectionId,
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
