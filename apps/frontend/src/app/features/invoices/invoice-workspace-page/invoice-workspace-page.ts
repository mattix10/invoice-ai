import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, Subject, switchMap, startWith, throwError } from 'rxjs';
import { InvoiceApi, InvoiceDetailDto } from '../data-access/invoice-api';
import {
  detailView,
  formatInvoiceAmount,
  statusLabels,
  InvoiceWorkspaceView,
} from '../data-access/invoice-adapter';
import { InvoiceDocument } from '../invoice-document/invoice-document';
import { InvoiceFields } from '../invoice-fields/invoice-fields';
import { InvoiceComparison } from '../invoice-comparison/invoice-comparison';

@Component({
  selector: 'app-invoice-workspace-page',
  imports: [RouterLink, InvoiceDocument, InvoiceFields, InvoiceComparison],
  templateUrl: './invoice-workspace-page.html',
  styleUrl: './invoice-workspace-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceWorkspacePage {
  private readonly api = inject(InvoiceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retry = new Subject<void>();
  protected readonly state = signal<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  protected readonly invoice = signal<InvoiceDetailDto | null>(null);
  protected readonly view = signal<InvoiceWorkspaceView | null>(null);
  protected readonly gross = signal('');
  protected readonly statusLabels = statusLabels;

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.retry.pipe(
            startWith(undefined),
            switchMap(() => {
              this.state.set('loading');
              this.invoice.set(null);
              this.view.set(null);
              const id = params.get('id') ?? '';

              return forkJoin({
                invoice: this.api.detail(id),
                comparison: this.api
                  .comparison(id)
                  .pipe(
                    catchError((error) =>
                      error instanceof HttpErrorResponse && error.status === 404
                        ? of(null)
                        : throwError(() => error),
                    ),
                  ),
              }).pipe(
                map((result) => ({ result, error: null })),
                catchError((error) => of({ result: null, error })),
              );
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ result, error }) => {
        if (error) {
          this.state.set(
            error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
          );

          return;
        }
        if (!result) {
          this.state.set('error');

          return;
        }
        try {
          this.gross.set(formatInvoiceAmount(result.invoice.grossAmount, result.invoice.currency));
          this.invoice.set(result.invoice);
          this.view.set(result.comparison ? detailView(result.invoice, result.comparison) : null);
          this.state.set('ready');
        } catch {
          this.state.set('error');
        }
      });
  }

  protected load(): void {
    this.retry.next();
  }
}
