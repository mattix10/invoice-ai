import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, forkJoin, map, of, throwError } from 'rxjs';
import { InvoiceApi } from '../data-access/invoice-api';
import { detailView, formatInvoiceAmount, statusLabels } from '../data-access/invoice-adapter';
import { InvoiceDocument } from '../invoice-document/invoice-document';
import { InvoiceFields } from '../invoice-fields/invoice-fields';
import { InvoiceComparison } from '../invoice-comparison/invoice-comparison';
import { InvoiceDifference } from '../invoice-difference/invoice-difference';
import { LoadError } from '../../../shared/ui/load-error/load-error';
import { PurchaseOrderLinkComponent } from '../purchase-order-link/purchase-order-link';

@Component({
  selector: 'app-invoice-workspace-page',
  imports: [
    RouterLink,
    InvoiceDocument,
    InvoiceFields,
    InvoiceComparison,
    InvoiceDifference,
    LoadError,
    PurchaseOrderLinkComponent,
  ],
  templateUrl: './invoice-workspace-page.html',
  styleUrl: './invoice-workspace-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceWorkspacePage {
  private readonly api = inject(InvoiceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly routeParams = toSignal(this.route.paramMap);
  protected readonly previewFailed = signal<string | null>(null);
  protected readonly documentSection = signal<'document' | 'invoice'>('document');
  protected readonly section = signal<'purchase-order' | 'comparison'>(
    this.route.snapshot?.fragment?.startsWith('comparison') ? 'comparison' : 'purchase-order',
  );
  protected readonly workspace = rxResource({
    params: () => this.routeParams()?.get('id') ?? '',
    stream: ({ params: invoiceId }) =>
      forkJoin({
        invoice: this.api.detail(invoiceId),
        comparison: this.api
          .comparison(invoiceId)
          .pipe(
            catchError((error: unknown) =>
              error instanceof HttpErrorResponse && error.status === 404
                ? of(null)
                : throwError(() => error),
            ),
          ),
      }).pipe(
        map(({ invoice, comparison }) => {
          this.navigateToComparison(
            comparison,
            this.route.snapshot?.fragment,
            this.route.snapshot?.queryParamMap.get('line'),
          );

          return {
            invoice,
            view: comparison ? detailView(invoice, comparison) : null,
            gross: formatInvoiceAmount(invoice.grossAmount, invoice.currency),
          };
        }),
      ),
  });

  protected readonly invoiceNotFound = computed(() => {
    const error = this.workspace.error();

    return error instanceof HttpErrorResponse && error.status === 404;
  });
  private readonly workspaceData = computed(() =>
    this.workspace.hasValue() ? this.workspace.value() : null,
  );
  protected readonly invoice = computed(() => this.workspaceData()?.invoice ?? null);
  protected readonly view = computed(() => this.workspaceData()?.view ?? null);
  protected readonly gross = computed(() => this.workspaceData()?.gross ?? '');
  protected readonly statusLabels = statusLabels;

  constructor() {
    if (!this.route.fragment || !this.route.queryParamMap) return;
    combineLatest([this.route.fragment, this.route.queryParamMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([fragment, query]) => {
        this.navigateToComparison(this.view(), fragment, query.get('line'));
      });
  }

  private navigateToComparison(
    comparison: { items: readonly { position: number }[] } | null,
    fragment: string | null | undefined,
    line: string | null | undefined,
  ): void {
    if (!comparison || !fragment?.startsWith('comparison')) return;

    this.section.set('comparison');
    if (fragment === 'comparison') {
      afterNextRender(() => this.document.getElementById(fragment)?.scrollIntoView(), {
        injector: this.injector,
      });

      return;
    }

    if (
      line &&
      /^[1-9]\d*$/.test(line) &&
      fragment === `comparison-line-${line}` &&
      comparison.items.some((item) => item.position === Number(line))
    ) {
      afterNextRender(() => this.document.getElementById(fragment)?.focus(), {
        injector: this.injector,
      });
    }
  }

  protected load(): void {
    this.workspace.reload();
  }
}
