import { AppShell, Group, Title, useMantineColorScheme, ActionIcon, Stack, Tooltip, rem } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { type CanvasCollectionElement, useAppContext } from '../store/AppContext';
import { pageIcons } from './AppLayout.icons';

const pages = [
  { label: 'Organization', value: '/organization' },
  { label: 'Materials', value: '/materials' },
  { label: 'Solutions', value: '/solutions' },
  { label: 'Experiments', value: '/experiments' },
  { label: 'Results', value: '/results' },
  { label: 'Analysis', value: '/analysis' },
  { label: 'Export', value: '/export' },
] as const;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { planes, activeCollectionId } = useAppContext();

  const currentPage = pages.find((p) => location.pathname.startsWith(p.value))?.value ?? pages[0].value;

  // When on the Organization page and a collection is selected, compute which
  // page paths have refs in that collection — all others are dimmed.
  const litPaths = useMemo<Set<string> | null>(() => {
    if (!location.pathname.startsWith('/organization') || !activeCollectionId) return null;
    for (const plane of planes) {
      const el = plane.elements.find((e) => e.id === activeCollectionId);
      if (el && el.type === 'collection') {
        const col = el as CanvasCollectionElement;
        const lit = new Set<string>(['/organization']);
        col.refs.forEach((r) => {
          if (r.kind === 'material') lit.add('/materials');
          if (r.kind === 'solution') lit.add('/solutions');
          if (r.kind === 'experiment') lit.add('/experiments');
          if (r.kind === 'result') lit.add('/results');
          if (r.kind === 'analysis') lit.add('/analysis');
        });
        return lit;
      }
    }
    return null;
  }, [activeCollectionId, planes, location.pathname]);

  return (
    <AppShell
      header={{ height: 60 }}
      aside={{ width: 120, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Plains</Title>
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => toggleColorScheme()}
            aria-label="Toggle color scheme"
          >
            {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Aside>
        <Stack align="center" justify="center" h="100%" py="md" gap="xs">
          {pages.map((page) => {
            const Icon = pageIcons[page.value as keyof typeof pageIcons];
            const active = currentPage === page.value;
            const dimmed = litPaths !== null && !litPaths.has(page.value);
            return (
              <Tooltip label={page.label} position="left" key={page.value}>
                <ActionIcon
                  variant={active ? 'filled' : 'subtle'}
                  color={active ? 'blue' : 'gray'}
                  size="lg"
                  radius="md"
                  onClick={() => navigate(page.value)}
                  aria-label={page.label}
                  style={{
                    width: rem(48),
                    height: rem(48),
                    opacity: dimmed ? 0.25 : 1,
                    transition: 'opacity 150ms ease',
                  }}
                >
                  {Icon ? <Icon size={28} /> : null}
                </ActionIcon>
              </Tooltip>
            );
          })}
        </Stack>
      </AppShell.Aside>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
