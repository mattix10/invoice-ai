import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  private readonly router = inject(Router);
  private readonly navigation = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
  );

  protected readonly title = computed(() => {
    const url = this.navigation()?.urlAfterRedirects ?? this.router.url;

    return url.includes('/investigation')
      ? 'AI investigation'
      : url.startsWith('/invoices/')
        ? 'Invoice workspace'
        : 'Overview';
  });
}
