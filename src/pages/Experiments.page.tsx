import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Container,
  Group,
  ScrollArea,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  rem,
} from '@mantine/core';
import { IconCheck, IconInfoCircle, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { type Experiment, newExperiment, useAppContext, useEntityCollection } from '../store/AppContext';

// ── Editable row ─────────────────────────────────────────────────────────────

function ExperimentRow({
  experiment,
  onUpdate,
  onDelete,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  collectionColor,
}: {
  experiment: Experiment;
  onUpdate: (e: Experiment) => void;
  onDelete: () => void;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: () => void;
  onCancel: () => void;
  collectionColor?: string;
}) {
  const [draft, setDraft] = useState(experiment);

  useEffect(() => { setDraft(experiment); }, [experiment]);

  const commit = () => { onUpdate(draft); onCommit(); };
  const cancel = () => { setDraft(experiment); onCancel(); };

  if (editing) {
    return (
      <Table.Tr>
        <Table.Td style={{ padding: 0, width: 6, minWidth: 6, background: collectionColor ?? 'transparent' }} />
        <Table.Td>
          <TextInput
            size="xs"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })}
            autoFocus
          />
        </Table.Td>
        <Table.Td>
          <Textarea
            size="xs"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.currentTarget.value })}
            minRows={1}
            autosize
          />
        </Table.Td>
        <Table.Td>
          <TextInput
            size="xs"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.currentTarget.value })}
          />
        </Table.Td>
        <Table.Td>
          <Group gap={4} wrap="nowrap">
            <ActionIcon size="xs" variant="subtle" color="green" onClick={commit}>
              <IconCheck size={14} />
            </ActionIcon>
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={cancel}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  }

  return (
    <Table.Tr>
      <Table.Td style={{ padding: 0, width: 6, minWidth: 6, background: collectionColor ?? 'transparent' }} />
      <Table.Td>
        <Text size="sm">{experiment.name || <Text span c="dimmed" size="sm">—</Text>}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', maxWidth: rem(300) }}>
          {experiment.description || <Text span c="dimmed" size="sm">—</Text>}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{experiment.date || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Edit">
            <ActionIcon size="xs" variant="subtle" color="blue" onClick={onStartEdit}>
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ExperimentsPage() {
  const { experiments, setExperiments, planes, updateElement, pendingCollectionLink, setPendingCollectionLink, activeCollectionId, activePlaneId } = useAppContext();
  const { getEntityColor, isEntityVisible } = useEntityCollection();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Auto-create experiment + link to collection when navigated from action bubble
  useEffect(() => {
    console.log('[ExperimentsPage] useEffect fired, pendingCollectionLink:', pendingCollectionLink);
    if (!pendingCollectionLink || pendingCollectionLink.kind !== 'experiment') return;
    const { collectionId, planeId } = pendingCollectionLink;
    setPendingCollectionLink(null);

    const exp = newExperiment();
    setExperiments((prev) => [...prev, exp]);

    // Link back to collection
    const plane = planes.find((p) => p.id === planeId);
    if (plane) {
      const col = plane.elements.find((e) => e.id === collectionId);
      if (col && col.type === 'collection') {
        const updated = { ...col, refs: [...col.refs, { kind: 'experiment' as const, id: exp.id }] };
        updateElement(planeId, updated);
      }
    }

    setEditingId(exp.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addExperiment = () => {
    const exp = newExperiment();
    setExperiments((prev) => [...prev, exp]);
    if (activeCollectionId && activePlaneId) {
      const plane = planes.find((p) => p.id === activePlaneId);
      if (plane) {
        const col = plane.elements.find((e) => e.id === activeCollectionId);
        if (col && col.type === 'collection') {
          updateElement(activePlaneId, { ...col, refs: [...col.refs, { kind: 'experiment' as const, id: exp.id }] });
        }
      }
    }
    setEditingId(exp.id);
  };

  const updateExperiment = (updated: Experiment) => {
    setExperiments((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const deleteExperiment = (id: string) => {
    setExperiments((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const visibleExperiments = experiments.filter((e) => isEntityVisible('experiment', e.id));

  return (
    <Container size="xl" pt="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Experiments</Title>
        <Button leftSection={<IconPlus size={14} />} onClick={addExperiment} disabled={!activeCollectionId}>
          New Experiment
        </Button>
      </Group>

      {!activeCollectionId && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="md">
          Select or create a collection in the Organization tab to add experiments.
        </Alert>
      )}

      <ScrollArea>
        <Box style={{ minWidth: 600 }}>
          <Table striped highlightOnHover withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ padding: 0, width: 6 }} />
                <Table.Th style={{ width: rem(180) }}>Name</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th style={{ width: rem(140) }}>Date</Table.Th>
                <Table.Th style={{ width: rem(80) }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleExperiments.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center" py="md">
                      {experiments.length === 0
                        ? 'No experiments yet. Click "New Experiment" to add one.'
                        : 'No experiments in the selected collection.'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                visibleExperiments.map((exp) => (
                  <ExperimentRow
                    key={exp.id}
                    experiment={exp}
                    onUpdate={updateExperiment}
                    onDelete={() => deleteExperiment(exp.id)}
                    editing={editingId === exp.id}
                    onStartEdit={() => setEditingId(exp.id)}
                    onCommit={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                    collectionColor={getEntityColor('experiment', exp.id) ?? undefined}
                  />
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </ScrollArea>
    </Container>
  );
}
