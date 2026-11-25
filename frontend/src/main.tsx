import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './app-providers';
import { createQueryClient } from './lib/query-client';
import { routes } from './routes';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <AppProviders client={createQueryClient()}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </AppProviders>
  </StrictMode>,
);
