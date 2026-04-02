import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { AppProvider } from './store/AppContext';
import { Router } from './Router';
import { theme } from './theme';

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <AppProvider>
        <ModalsProvider>
          <Router />
        </ModalsProvider>
      </AppProvider>
    </MantineProvider>
  );
}
