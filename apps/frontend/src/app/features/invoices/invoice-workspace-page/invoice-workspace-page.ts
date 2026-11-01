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
          const fragment = this.route.snapshot?.fragment;
          const line = this.route.snapshot?.queryParamMap.get('line');
          if (comparison && fragment?.startsWith('comparison')) {
            this.section.set('comparison');
          }
          if (comparison && fragment === 'comparison') {
            afterNextRender(() => this.document.getElementById('comparison')?.scrollIntoView(), {
              injector: this.injector,
            });
          }
          if (
            comparison &&
            line &&
            /^[1-9]\d*$/.test(line) &&
            comparison.items.some((item) => item.position === Number(line)) &&
            fragment === `comparison-line-${line}`
          ) {
            afterNextRender(
              () => this.document.getElementById(`comparison-line-${line}`)?.focus(),
              { injector: this.injector },
            );
          }

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
        const comparison = this.view();
        if (!comparison || !fragment?.startsWith('comparison')) return;
        this.section.set('comparison');
        const line = query.get('line');
        if (
          line &&
          /^[1-9]\d*$/.test(line) &&
          fragment === `comparison-line-${line}` &&
          comparison.items.some((item) => item.position === Number(line))
        ) {
          afterNextRender(() => this.document.getElementById(fragment)?.focus(), {
            injector: this.injector,
          });
        } else if (fragment === 'comparison') {
          afterNextRender(() => this.document.getElementById('comparison')?.scrollIntoView(), {
            injector: this.injector,
          });
        }
      });
  }

  protected load(): void {
    this.workspace.reload();
  }
}
