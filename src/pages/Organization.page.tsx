import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  Paper,
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
  IconFolderPlus,
  IconGripVertical,
  IconLetterT,
  IconMinus,
  IconPencil,
  IconPlus,
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
        style={{ position: 'relative', background: 'var(--mantine-color-yellow-0)' }}
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

function LineOverlay({
  lines,
  pan,
  onDelete,
}: {
  lines: CanvasLineElement[];
  pan: Vec2;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

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
              onClick={() =>
                modals.openConfirmModal({
                  title: 'Delete line',
                  children: <Text size="sm">Remove this line?</Text>,
                  labels: { confirm: 'Delete', cancel: 'Cancel' },
                  confirmProps: { color: 'red' },
                  onConfirm: () => onDelete(line.id),
                })
              }
            />
            <path
              d={d}
              stroke={hovered === line.id ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-blue-6)'}
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
// Collection element
// ─────────────────────────────────────────────────────────────────────────────

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
      // click — select this collection
      setActiveCollectionId(el.id);
    }
    setDragging(false);
    dragStart.current = null;
  };

  const addRef = (ref: CollectionRef) => {
    if (el.refs.some((r) => r.kind === ref.kind && r.id === ref.id)) return;
    onUpdate({ ...el, refs: [...el.refs, ref] });
  };

  const removeRef = (ref: CollectionRef) => {
    onUpdate({ ...el, refs: el.refs.filter((r) => !(r.kind === ref.kind && r.id === ref.id)) });
  };

  const commitName = () => {
    onUpdate({ ...el, name: nameBuffer.trim() || el.name });
    setEditingName(false);
  };

  const refLabel = (ref: CollectionRef): string => {
    if (ref.kind === 'material') {
      const m = materials.find((m) => m.id === ref.id);
      return m ? (m.name || m.inventoryLabel || m.casNumber || ref.id) : ref.id;
    }
    const s = solutions.find((s) => s.id === ref.id);
    return s ? s.name : ref.id;
  };

  return (
    <Box
      style={{
        position: 'absolute',
        left: el.position.x + pan.x,
        top: el.position.y + pan.y,
        width: el.size.x,
        minHeight: el.size.y,
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onPointerDown={startDrag}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
    >
      <Paper
        withBorder
        shadow="sm"
        p="xs"
        style={{
          borderTop: `4px solid ${isActive ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-violet-5)'}`,
          background: 'var(--mantine-color-body)',
          outline: isActive ? '2px solid var(--mantine-color-blue-4)' : 'none',
          outlineOffset: '2px',
        }}
      >
        {/* Header */}
        <Group justify="space-between" mb={6} gap={4} wrap="nowrap">
          <Group gap={4} wrap="nowrap" style={{ flex: 1 }} onPointerDown={(e) => e.stopPropagation()}>
            <Box onPointerDown={startDrag} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
              <IconGripVertical size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
            </Box>
            {editingName ? (
              <TextInput
                size="xs"
                value={nameBuffer}
                autoFocus
                onChange={(e) => setNameBuffer(e.currentTarget.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
                style={{ flex: 1 }}
              />
            ) : (
              <Text fw={600} size="sm" style={{ flex: 1 }} onDoubleClick={() => setEditingName(true)}>
                📁 {el.name}
              </Text>
            )}
          </Group>
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

        <Divider mb={6} />

        {/* Refs list */}
        <Stack gap={4} onPointerDown={(e) => e.stopPropagation()}>
          {el.refs.length === 0 && (
            <Text size="xs" c="dimmed">No items. Use the menu below to add.</Text>
          )}
          {el.refs.map((ref, i) => (
            <Group key={i} justify="space-between" wrap="nowrap">
              <Group gap={4}>
                <Badge size="xs" variant="light" color={ref.kind === 'material' ? 'teal' : 'blue'}>
                  {ref.kind}
                </Badge>
                <Text size="xs">{refLabel(ref)}</Text>
              </Group>
              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeRef(ref)}>
                <IconX size={8} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>

        {/* Add ref menu */}
        <Menu shadow="md" width={220} withinPortal>
          <Menu.Target>
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconPlus size={10} />}
              mt={6}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Add item
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {materials.length > 0 && (
              <>
                <Menu.Label>Materials</Menu.Label>
                {materials.map((m) => (
                  <Menu.Item key={m.id} onClick={() => addRef({ kind: 'material', id: m.id })}>
                    {m.name || m.inventoryLabel || m.casNumber || m.id}
                  </Menu.Item>
                ))}
              </>
            )}
            {solutions.length > 0 && (
              <>
                <Menu.Label>Solutions</Menu.Label>
                {solutions.map((s) => (
                  <Menu.Item key={s.id} onClick={() => addRef({ kind: 'solution', id: s.id })}>
                    {s.name}
                  </Menu.Item>
                ))}
              </>
            )}
            {materials.length === 0 && solutions.length === 0 && (
              <Menu.Item disabled>No materials or solutions yet</Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Paper>
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
      addTextElement(plane.id, pos);
      setTool('select');
    } else if (tool === 'collection') {
      addCollectionElement(plane.id, pos);
      setTool('select');
    } else if (tool === 'line') {
      const el = addLineElement(plane.id, pos);
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
      if (existing) {
        updateElement(plane.id, {
          ...existing,
          points: [...existing.points.slice(0, -1), pos],
        } as CanvasLineElement);
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
      const pos = canvasCoords(e, containerRef, pan);
      const existing = plane.elements.find((el) => el.id === drawingLineId.current) as
        | CanvasLineElement
        | undefined;
      if (existing) {
        // append final point
        updateElement(plane.id, {
          ...existing,
          points: [...existing.points, pos],
        } as CanvasLineElement);
      }
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
