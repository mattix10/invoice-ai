import { Route, Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';
import { OverviewPage } from './features/overview/overview-page/overview-page';
import { confirmPendingChanges } from './core/navigation/pending-changes';

const uploadPage: NonNullable<Route['loadComponent']> = () =>
  import('./features/intake/upload-page/upload-page').then((m) => m.UploadPage);
const draftPage: NonNullable<Route['loadComponent']> = () =>
  import('./features/intake/draft-page/draft-page').then((m) => m.DraftPage);

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: OverviewPage, title: 'Overview' },
      {
        path: 'overview/intake/new',
        loadComponent: uploadPage,
        title: 'Upload invoice',
        data: { breadcrumb: 'Overview' },
      },
      {
        path: 'overview/intake/:documentId',
        loadComponent: draftPage,
        title: 'Invoice intake',
        data: { breadcrumb: 'Overview' },
        canDeactivate: [confirmPendingChanges],
      },
      {
        path: 'invoices/new',
        loadComponent: uploadPage,
        title: 'Upload invoice',
        data: { breadcrumb: 'Overview' },
      },
      {
        path: 'intake/:documentId',
        loadComponent: draftPage,
        title: 'Invoice intake',
        data: { breadcrumb: 'Overview' },
        canDeactivate: [confirmPendingChanges],
      },
      {
        path: 'invoices/:id/investigation',
        loadComponent: () =>
          import('./features/invoices/investigation-page/investigation-page').then(
            (m) => m.InvestigationPage,
          ),
        title: 'AI investigation',
      },
      {
        path: 'invoices/:id',
        loadComponent: () =>
          import('./features/invoices/invoice-workspace-page/invoice-workspace-page').then(
            (m) => m.InvoiceWorkspacePage,
          ),
        title: 'Invoice workspace',
        canDeactivate: [confirmPendingChanges],
      },
      {
        path: '**',
        loadComponent: () => import('./core/layout/not-found/not-found').then((m) => m.NotFound),
        title: 'Page not found',
      },
    ],
  },
];
