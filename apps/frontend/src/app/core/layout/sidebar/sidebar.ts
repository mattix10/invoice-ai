import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly links = [
    {
      path: '/overview',
      label: 'Overview',
      icon: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
    },
    {
      path: '/invoices/INV-2026-1042',
      label: 'Invoice workspace',
      icon: 'M5 2h14v20H5z M9 7h6 M9 11h6 M9 15h4',
    },
    {
      path: '/invoices/INV-2026-1042/investigation',
      label: 'AI investigation',
      icon: 'M12 3 13.7 9.3 20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3z M19 18v4 M17 20h4',
    },
  ];
}
