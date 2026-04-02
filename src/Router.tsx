import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AppProvider } from './store/AppContext';
import { AnalysisPage } from './pages/Analysis.page';
import { ExperimentsPage } from './pages/Experiments.page';
import { ExportPage } from './pages/Export.page';
import { MaterialsPage } from './pages/Materials.page';
import { OrganizationPage } from './pages/Organization.page';
import { ResultsPage } from './pages/Results.page';
import { SolutionsPage } from './pages/Solutions.page';

const router = createBrowserRouter([
  {
    element: (
      <AppProvider>
        <AppLayout />
      </AppProvider>
    ),
    children: [
      { index: true, element: <Navigate to="/materials" replace /> },
      { path: 'materials', element: <MaterialsPage /> },
      { path: 'solutions', element: <SolutionsPage /> },
      { path: 'experiments', element: <ExperimentsPage /> },
      { path: 'results', element: <ResultsPage /> },
      { path: 'analysis', element: <AnalysisPage /> },
      { path: 'export', element: <ExportPage /> },
      { path: 'organization', element: <OrganizationPage /> },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
