import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';
import { ReconciliationRead } from '../../../core/api/schema';
import { InvoiceApi } from '../data-access/invoice-api';
import { formatInvoiceAmount } from '../data-access/invoice-adapter';

@Component({
  selector: 'app-investigation-page',
  imports: [RouterLink],
  templateUrl: './investigation-page.html',
  styleUrl: './investigation-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestigationPage {
  private readonly api = inject(InvoiceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retry = new Subject<void>();
  protected readonly invoiceId = signal('');
  protected readonly result = signal<ReconciliationRead | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly amount = formatInvoiceAmount;

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id') ?? '';
          this.invoiceId.set(id);

          return this.retry.pipe(
            startWith(undefined),
            switchMap(() => {
              this.state.set('loading');
              this.result.set(null);

              return this.api.latestReconciliation(id).pipe(
                map((result) => ({ result })),
                catchError(() => of({ result: null })),
              );
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ result }) => {
        this.result.set(result);
        this.state.set(result ? 'ready' : 'error');
      });
  }

  protected load(): void {
    this.retry.next();
  }
}
