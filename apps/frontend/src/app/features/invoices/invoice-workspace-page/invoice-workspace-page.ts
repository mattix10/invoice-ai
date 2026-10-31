import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, throwError } from 'rxjs';
import { InvoiceApi } from '../data-access/invoice-api';
import { detailView, formatInvoiceAmount, statusLabels } from '../data-access/invoice-adapter';
import { InvoiceDocument } from '../invoice-document/invoice-document';
import { InvoiceFields } from '../invoice-fields/invoice-fields';
import { InvoiceComparison } from '../invoice-comparison/invoice-comparison';
import { LoadError } from '../../../shared/ui/load-error/load-error';
import { PurchaseOrderLinkComponent } from '../purchase-order-link/purchase-order-link';

@Component({
  selector: 'app-invoice-workspace-page',
  imports: [
    RouterLink,
    InvoiceDocument,
    InvoiceFields,
    InvoiceComparison,
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
  private readonly routeParams = toSignal(this.route.paramMap);
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
        map(({ invoice, comparison }) => ({
          invoice,
          view: comparison ? detailView(invoice, comparison) : null,
          gross: formatInvoiceAmount(invoice.grossAmount, invoice.currency),
        })),
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

  protected load(): void {
    this.workspace.reload();
  }
}
