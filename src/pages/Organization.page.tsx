import {
  ActionIcon,
  Badge,
  Box,
  Button,
  ColorSwatch,
  Divider,
  Group,
  Paper,
  Popover,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  rem,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconBottle,
  IconChartBar,
  IconFlask2,
  IconFolderPlus,
  IconLetterT,
  IconMinus,
  IconPencil,
  IconPlus,
  IconReportAnalytics,
  IconTestPipe,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  type CanvasCollectionElement,
  type CanvasElement,
  type CanvasLineElement,
  type CanvasTextElement,
  type CollectionRef,
  type Plane,
  type Vec2,
  useAppContext,
} from '../store/AppContext';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRID = 20; // px – subtle grid snap

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function snapToGrid(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function canvasCoords(
  e: MouseEvent<HTMLDivElement>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  pan: Vec2
): Vec2 {
  const rect = containerRef.current!.getBoundingClientRect();
  return {
    x: snapToGrid(e.clientX - rect.left - pan.x),
    y: snapToGrid(e.clientY - rect.top - pan.y),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Color palette
// ─────────────────────────────────────────────────────────────────────────────

const PALETTE = [
  '#f8f9fa', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc', '#f783ac', '#ffa94d', '#63e6be',
];

// Inject keyframes for bubble animation
if (typeof document !== 'undefined' && !document.getElementById('bubble-keyframes')) {
  const style = document.createElement('style');
  style.id = 'bubble-keyframes';
  style.textContent = `
    @keyframes bubble-in {
      from { transform: scale(0); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// Text element
// ─────────────────────────────────────────────────────────────────────────────

function TextEl({
  el,
  onUpdate,
  onDelete,
  pan,
}: {
  el: CanvasTextElement;
  onUpdate: (e: CanvasElement) => void;
  onDelete: () => void;
  pan: Vec2;
}) {
  const [editing, setEditing] = useState(el.content === '');
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mouse: Vec2; origin: Vec2 } | null>(null);

  const startDrag = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (editing) return;
    setDragging(true);
    dragStart.current = { mouse: { x: ev.clientX, y: ev.clientY }, origin: { ...el.position } };
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
  };

  const onPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStart.current) return;
    const dx = ev.clientX - dragStart.current.mouse.x;
    const dy = ev.clientY - dragStart.current.mouse.y;
    onUpdate({
      ...el,
      position: {
        x: snapToGrid(dragStart.current.origin.x + dx),
        y: snapToGrid(dragStart.current.origin.y + dy),
      },
    });
  };

  const stopDrag = () => { setDragging(false); dragStart.current = null; };

  return (
    <Box
      style={{
        position: 'absolute',
        left: el.position.x + pan.x,
        top: el.position.y + pan.y,
        width: el.size.x,
        minHeight: el.size.y,
        cursor: dragging ? 'grabbing' : editing ? 'text' : 'grab',
        userSelect: 'none',
      }}
      onPointerDown={startDrag}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
    >
      <Paper
        withBorder
        shadow="xs"
        p={4}
        style={{ position: 'relative', background: el.color || 'var(--mantine-color-yellow-0)' }}
      >
        <Group justify="flex-end" gap={2} mb={2}>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="gray"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setEditing((v) => !v)}
          >
            <IconPencil size={10} />
          </ActionIcon>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="red"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onDelete}
          >
            <IconX size={10} />
          </ActionIcon>
        </Group>
        {editing ? (
          <Textarea
            autosize
            autoFocus
            size="xs"
            minRows={2}
            value={el.content}
            onChange={(e) => onUpdate({ ...el, content: e.currentTarget.value })}
            onBlur={() => setEditing(false)}
            onPointerDown={(e) => e.stopPropagation()}
            styles={{ input: { background: 'transparent', border: 'none', resize: 'none' } }}
          />
        ) : (
          <Text
            size="sm"
            style={{ whiteSpace: 'pre-wrap', minHeight: rem(40), cursor: 'grab' }}
            onDoubleClick={() => setEditing(true)}
          >
            {el.content || <Text span c="dimmed" size="xs">Double-click to edit…</Text>}
          </Text>
        )}
      </Paper>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Line element – rendered as SVG overlay
// ─────────────────────────────────────────────────────────────────────────────

const LINE_COLORS = ['#228be6', '#40c057', '#fa5252', '#fab005', '#7950f2', '#12b886'];

function LineOverlay({
  lines,
  pan,
  onUpdate,
  onDelete,
}: {
  lines: CanvasLineElement[];
  pan: Vec2;
  onUpdate: (el: CanvasLineElement) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const cycleColor = (line: CanvasLineElement) => {
    const idx = LINE_COLORS.indexOf(line.color || LINE_COLORS[0]);
    const next = LINE_COLORS[(idx + 1) % LINE_COLORS.length];
    onUpdate({ ...line, color: next });
  };

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {lines.map((line) => {
        if (line.points.length < 2) return null;
        const d = line.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x + pan.x} ${p.y + pan.y}`)
          .join(' ');
        const color = line.color || LINE_COLORS[0];
        return (
          <g key={line.id}>
            {/* hit-area */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={12}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => setHovered(line.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => {
                if (e.shiftKey) {
                  cycleColor(line);
                } else {
                  modals.openConfirmModal({
                    title: 'Delete line',
                    children: <Text size="sm">Remove this line? (Shift+click to change color)</Text>,
                    labels: { confirm: 'Delete', cancel: 'Cancel' },
                    confirmProps: { color: 'red' },
                    onConfirm: () => onDelete(line.id),
                  });
                }
              }}
            />
            <path
              d={d}
              stroke={hovered === line.id ? 'var(--mantine-color-red-5)' : color}
              strokeWidth={2}
              fill="none"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection element – minimal card with speech-bubble actions when selected
// ─────────────────────────────────────────────────────────────────────────────

/** Speech-bubble action button rendered outside the collection card */
function ActionBubble({
  label,
  Icon,
  color,
  onClick,
  index,
}: {
  label: string;
  Icon: React.ElementType;
  color: string;
  onClick: () => void;
  index: number;
}) {
  // Position bubbles in a vertical stack to the right of the collection
  return (
    <Tooltip label={label} position="right" withArrow>
      <ActionIcon
        size="md"
        variant="filled"
        color={color}
        radius="xl"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          right: -44,
          top: 4 + index * 36,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          animation: 'bubble-in 150ms ease-out',
        }}
      >
        <Icon size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

function CollectionEl({
  el,
  onUpdate,
  onDelete,
  pan,
}: {
  el: CanvasCollectionElement;
  onUpdate: (e: CanvasElement) => void;
  onDelete: () => void;
  pan: Vec2;
}) {
  const { materials, solutions, activeCollectionId, setActiveCollectionId } = useAppContext();
  const [dragging, setDragging] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameBuffer, setNameBuffer] = useState(el.name);
  const dragStart = useRef<{ mouse: Vec2; origin: Vec2 } | null>(null);
  const didMove = useRef(false);
  const isActive = activeCollectionId === el.id;

  const startDrag = (ev: ReactPointerEvent<HTMLDivElement>) => {
    setDragging(true);
    didMove.current = false;
    dragStart.current = { mouse: { x: ev.clientX, y: ev.clientY }, origin: { ...el.position } };
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
  };

  const onPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStart.current) return;
    const dx = ev.clientX - dragStart.current.mouse.x;
    const dy = ev.clientY - dragStart.current.mouse.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didMove.current = true;
    onUpdate({
      ...el,
      position: {
        x: snapToGrid(dragStart.current.origin.x + dx),
        y: snapToGrid(dragStart.current.origin.y + dy),
      },
    });
  };

  const stopDrag = () => {
    if (!didMove.current) {
      setActiveCollectionId(isActive ? null : el.id);
    }
    setDragging(false);
    dragStart.current = null;
  };

  const addRef = (ref: CollectionRef) => {
    if (el.refs.some((r) => r.kind === ref.kind && r.id === ref.id)) return;
    onUpdate({ ...el, refs: [...el.refs, ref] });
  };

  const commitName = () => {
    onUpdate({ ...el, name: nameBuffer.trim() || el.name });
    setEditingName(false);
  };

  // Count refs by type
  const refCounts = el.refs.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] || 0) + 1;
    return acc;
  }, {});

  const hasExperiment = el.refs.some((r) => r.kind === 'experiment');

  // Build action bubbles
  const actions: { label: string; Icon: React.ElementType; color: string; kind: CollectionRef['kind'] }[] = [
    { label: 'Add Material', Icon: IconBottle, color: 'teal', kind: 'material' },
    { label: 'Add Solution', Icon: IconFlask2, color: 'blue', kind: 'solution' },
    { label: 'Add Experiment', Icon: IconTestPipe, color: 'grape', kind: 'experiment' },
  ];
  if (hasExperiment) {
    actions.push(
      { label: 'Add Results', Icon: IconChartBar, color: 'orange', kind: 'result' },
      { label: 'Add Analysis', Icon: IconReportAnalytics, color: 'red', kind: 'analysis' }
    );
  }

  return (
    <Box
      style={{
        position: 'absolute',
        left: el.position.x + pan.x,
        top: el.position.y + pan.y,
        cursor: dragging ? 'grabbing' : 'pointer',
        userSelect: 'none',
      }}
      onPointerDown={startDrag}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
    >
      {/* Main card */}
      <Paper
        withBorder
        shadow={isActive ? 'md' : 'xs'}
        p="xs"
        style={{
          width: 140,
          borderLeft: `4px solid ${el.color || 'var(--mantine-color-violet-5)'}`,
          background: 'var(--mantine-color-body)',
          outline: isActive ? '2px solid var(--mantine-color-blue-5)' : 'none',
          outlineOffset: 2,
          transition: 'box-shadow 100ms ease, outline 100ms ease',
        }}
      >
        {/* Name */}
        {editingName ? (
          <TextInput
            size="xs"
            value={nameBuffer}
            autoFocus
            onChange={(e) => setNameBuffer(e.currentTarget.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <Text
            fw={600}
            size="sm"
            mb={4}
            onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ cursor: 'text' }}
          >
            {el.name}
          </Text>
        )}

        {/* Compact ref summary */}
        {el.refs.length > 0 ? (
          <Group gap={4} wrap="wrap">
            {Object.entries(refCounts).map(([kind, count]) => (
              <Badge key={kind} size="xs" variant="dot" color={
                kind === 'material' ? 'teal' :
                kind === 'solution' ? 'blue' :
                kind === 'experiment' ? 'grape' :
                kind === 'result' ? 'orange' : 'red'
              }>
                {count}
              </Badge>
            ))}
          </Group>
        ) : (
          <Text size="xs" c="dimmed">Empty</Text>
        )}
      </Paper>

      {/* Speech-bubble actions (only when selected) */}
      {isActive && actions.map((a, i) => (
        <ActionBubble
          key={a.kind}
          label={a.label}
          Icon={a.Icon}
          color={a.color}
          onClick={() => addRef({ kind: a.kind, id: `new-${a.kind}-${Date.now()}` })}
          index={i}
        />
      ))}

      {/* Delete button (only when selected) */}
      {isActive && (
        <ActionIcon
          size="xs"
          variant="filled"
          color="red"
          radius="xl"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          <IconX size={10} />
        </ActionIcon>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Infinite-scroll canvas for one Plane
// ─────────────────────────────────────────────────────────────────────────────

type CanvasTool = 'select' | 'text' | 'line' | 'collection';

function PlaneCanvas({ plane }: { plane: Plane }) {
  const { updateElement, deleteElement, addTextElement, addLineElement, addCollectionElement, setActiveCollectionId } =
    useAppContext();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState<Vec2>({ x: 0, y: 0 });
  const panStart = useRef<{ mouse: Vec2; origin: Vec2 } | null>(null);

  const [tool, setTool] = useState<CanvasTool>('select');
  const [selectedColor, setSelectedColor] = useState<string>(PALETTE[0]);
  const drawingLineId = useRef<string | null>(null);

  // ── Panning (middle-mouse or space+drag) ────────────────────────────────────
  const isPanning = useRef(false);
  const spaceDown = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = e.type === 'keydown';
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
  }, []);

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Middle mouse or Space+left = pan
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      isPanning.current = true;
      panStart.current = { mouse: { x: e.clientX, y: e.clientY }, origin: { ...pan } };
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    // clicking bare canvas background deselects active collection
    if (tool === 'select') setActiveCollectionId(null);

    const pos = canvasCoords(e, containerRef, pan);

    if (tool === 'text') {
      const el = addTextElement(plane.id, pos);
      updateElement(plane.id, { ...el, color: selectedColor });
      setTool('select');
    } else if (tool === 'collection') {
      const el = addCollectionElement(plane.id, pos);
      updateElement(plane.id, { ...el, color: selectedColor });
      setTool('select');
    } else if (tool === 'line') {
      const el = addLineElement(plane.id, pos);
      updateElement(plane.id, { ...el, color: selectedColor } as CanvasLineElement);
      drawingLineId.current = el.id;
    }
  };

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning.current && panStart.current) {
      const dx = e.clientX - panStart.current.mouse.x;
      const dy = e.clientY - panStart.current.mouse.y;
      setPan({ x: panStart.current.origin.x + dx, y: panStart.current.origin.y + dy });
      return;
    }
    if (tool === 'line' && drawingLineId.current) {
      const pos = canvasCoords(e, containerRef, pan);
      const existing = plane.elements.find((el) => el.id === drawingLineId.current) as
        | CanvasLineElement
        | undefined;
      if (existing && existing.points.length >= 2) {
        // Update the last point (the "live" end)
        const newPoints = [...existing.points];
        newPoints[newPoints.length - 1] = pos;
        updateElement(plane.id, { ...existing, points: newPoints } as CanvasLineElement);
      }
    }
  };

  const onMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning.current) {
      isPanning.current = false;
      panStart.current = null;
      return;
    }
    if (tool === 'line' && drawingLineId.current) {
      // Finalize the line (the second point was already placed via onMouseMove)
      drawingLineId.current = null;
      setTool('select');
    }
  };

  const lines = plane.elements.filter((e): e is CanvasLineElement => e.type === 'line');
  const nonLines = plane.elements.filter((e) => e.type !== 'line');

  const toolbarColor = (t: CanvasTool) => (tool === t ? 'blue' : 'gray');

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Group
        gap="xs"
        px="sm"
        py={6}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-body)',
          flexShrink: 0,
        }}
      >
        <Tooltip label="Select / Pan (or hold Space)" position="bottom">
          <ActionIcon variant={tool === 'select' ? 'filled' : 'subtle'} color={toolbarColor('select')} onClick={() => setTool('select')}>
            ⬡
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Add text field" position="bottom">
          <ActionIcon variant={tool === 'text' ? 'filled' : 'subtle'} color={toolbarColor('text')} onClick={() => setTool('text')}>
            <IconLetterT size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Draw line (click start, click end)" position="bottom">
          <ActionIcon variant={tool === 'line' ? 'filled' : 'subtle'} color={toolbarColor('line')} onClick={() => setTool('line')}>
            <IconMinus size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Add Collection folder" position="bottom">
          <ActionIcon variant={tool === 'collection' ? 'filled' : 'subtle'} color={toolbarColor('collection')} onClick={() => setTool('collection')}>
            <IconFolderPlus size={16} />
          </ActionIcon>
        </Tooltip>
        <Divider orientation="vertical" />
        {/* Color picker */}
        <Popover withArrow shadow="md">
          <Popover.Target>
            <Tooltip label="Select color for new elements" position="bottom">
              <ActionIcon variant="subtle" color="gray">
                <ColorSwatch color={selectedColor} size={16} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown p={6}>
            <Group gap={4} wrap="wrap" w={120}>
              {PALETTE.map((c) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  size={24}
                  style={{ cursor: 'pointer', outline: selectedColor === c ? '2px solid var(--mantine-color-blue-6)' : 'none', outlineOffset: 2 }}
                  onClick={() => setSelectedColor(c)}
                />
              ))}
            </Group>
          </Popover.Dropdown>
        </Popover>
        <Divider orientation="vertical" />
        <Text size="xs" c="dimmed">
          {tool === 'select' && 'Select or drag to pan · Middle-mouse drag also pans'}
          {tool === 'text' && 'Click anywhere to place a text field'}
          {tool === 'line' && 'Click to start line, move, click to end'}
          {tool === 'collection' && 'Click anywhere to place a Collection folder'}
        </Text>
      </Group>

      {/* Canvas */}
      <Box
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor:
            tool === 'select' || spaceDown
              ? isPanning.current
                ? 'grabbing'
                : 'grab'
              : 'crosshair',
          backgroundImage:
            'radial-gradient(circle, var(--mantine-color-gray-3) 1px, transparent 1px)',
          backgroundSize: `${GRID}px ${GRID}px`,
          backgroundPosition: `${pan.x % GRID}px ${pan.y % GRID}px`,
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {/* SVG line layer */}
        <LineOverlay
          lines={lines}
          pan={pan}
          onUpdate={(el) => updateElement(plane.id, el)}
          onDelete={(id) => deleteElement(plane.id, id)}
        />

        {/* Element layer */}
        {nonLines.map((el) => {
          if (el.type === 'text') {
            return (
              <TextEl
                key={el.id}
                el={el as CanvasTextElement}
                onUpdate={(updated) => updateElement(plane.id, updated)}
                onDelete={() => deleteElement(plane.id, el.id)}
                pan={pan}
              />
            );
          }
          if (el.type === 'collection') {
            return (
              <CollectionEl
                key={el.id}
                el={el as CanvasCollectionElement}
                onUpdate={(updated) => updateElement(plane.id, updated)}
                onDelete={() =>
                  modals.openConfirmModal({
                    title: 'Delete Collection',
                    children: <Text size="sm">Delete this collection? Its references will be removed but Materials/Solutions remain unchanged.</Text>,
                    labels: { confirm: 'Delete', cancel: 'Cancel' },
                    confirmProps: { color: 'red' },
                    onConfirm: () => deleteElement(plane.id, el.id),
                  })
                }
                pan={pan}
              />
            );
          }
          return null;
        })}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plane tab label (editable double-click, close button)
// ─────────────────────────────────────────────────────────────────────────────

function PlaneTabLabel({
  plane,
  onRename,
  onClose,
  canClose,
}: {
  plane: Plane;
  onRename: (name: string) => void;
  onClose: () => void;
  canClose: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [buf, setBuf] = useState(plane.name);

  const commit = () => {
    onRename(buf.trim() || plane.name);
    setEditing(false);
  };

  if (editing) {
    return (
      <TextInput
        size="xs"
        value={buf}
        autoFocus
        onChange={(e) => setBuf(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setBuf(plane.name); setEditing(false); } }}
        style={{ width: rem(100) }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <Group gap={4} wrap="nowrap">
      <Text size="sm" onDoubleClick={() => setEditing(true)} style={{ cursor: 'text' }}>
        {plane.name}
      </Text>
      {canClose && (
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          <IconX size={10} />
        </ActionIcon>
      )}
    </Group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Organization page
// ─────────────────────────────────────────────────────────────────────────────

export function OrganizationPage() {
  const { planes, addPlane, updatePlane, deletePlane } = useAppContext();
  const [activeId, setActiveId] = useState<string>(() => planes[0]?.id ?? '');

  // Keep active tab valid
  useEffect(() => {
    if (!planes.find((p) => p.id === activeId) && planes.length > 0) {
      setActiveId(planes[planes.length - 1].id);
    }
  }, [planes, activeId]);

  const handleAddPlane = () => {
    const p = addPlane(`Plane ${planes.length + 1}`);
    setActiveId(p.id);
  };

  const handleDeletePlane = (id: string) => {
    if (planes.length <= 1) return;
    modals.openConfirmModal({
      title: 'Delete plane',
      children: <Text size="sm">Delete this plane and all its content?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deletePlane(id);
        if (activeId === id) {
          const remaining = planes.filter((p) => p.id !== id);
          setActiveId(remaining[remaining.length - 1]?.id ?? '');
        }
      },
    });
  };

  const activePlane = planes.find((p) => p.id === activeId);

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100dvh - var(--app-shell-header-height, 60px) - var(--app-shell-padding, 16px) * 2)',
      }}
    >
      <Tabs
        value={activeId}
        onChange={(v) => { if (v) setActiveId(v); }}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
        keepMounted={false}
      >
        <Group align="flex-end" gap={0} px="md" style={{ flexShrink: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
          <ScrollArea type="never" style={{ flex: 1 }}>
            <Tabs.List style={{ flexWrap: 'nowrap', borderBottom: 'none' }}>
              {planes.map((p) => (
                <Tabs.Tab value={p.id} key={p.id}>
                  <PlaneTabLabel
                    plane={p}
                    onRename={(name) => updatePlane({ ...p, name })}
                    onClose={() => handleDeletePlane(p.id)}
                    canClose={planes.length > 1}
                  />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </ScrollArea>
          <Tooltip label="Add plane">
            <ActionIcon variant="subtle" size="sm" mb={4} ml={4} onClick={handleAddPlane}>
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Tab panels */}
        <Box
          style={{
            flex: 1,
            overflow: 'hidden',
            borderTop: '1px solid var(--mantine-color-default-border)',
          }}
        >
          {planes.map((p) => (
            <Tabs.Panel
              key={p.id}
              value={p.id}
              style={{ height: '100%' }}
            >
              <PlaneCanvas plane={p} />
            </Tabs.Panel>
          ))}
        </Box>
      </Tabs>

      {!activePlane && (
        <Stack align="center" justify="center" style={{ flex: 1 }}>
          <Text c="dimmed">No planes yet.</Text>
          <Button leftSection={<IconPlus size={14} />} onClick={handleAddPlane}>Add Plane</Button>
        </Stack>
      )}
    </Box>
  );
}
