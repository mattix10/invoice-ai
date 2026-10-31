import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';
import { OverviewPage } from './features/overview/overview-page/overview-page';
import { InvestigationPage } from './features/invoices/investigation-page/investigation-page';
import { InvoiceWorkspacePage } from './features/invoices/invoice-workspace-page/invoice-workspace-page';
export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: OverviewPage },
      {
        path: 'invoices/:id/investigation',
        component: InvestigationPage,
      },
      { path: 'invoices/:id', component: InvoiceWorkspacePage },
    ],
  },
];
