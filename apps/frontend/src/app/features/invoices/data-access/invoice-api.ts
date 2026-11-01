import { HttpClient, HttpParams, HttpResourceRef, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  InvoiceComparison as InvoiceComparisonDto,
  InvoiceDetail as InvoiceDetailDto,
  InvoicePage as InvoicePageDto,
  LinkRead as PurchaseOrderLink,
  LinkRequest as PurchaseOrderLinkRequest,
  PoFields as PurchaseOrderFields,
  PoRead as PurchaseOrder,
  ReconciliationRead,
  ReconciliationResult,
  CopilotAnswer,
  CopilotQuery,
  SupplierInquiryRequest,
  SupplierInquiryDraft,
  operations,
} from '../../../core/api/schema';

export type {
  InvoiceComparison as InvoiceComparisonDto,
  InvoiceDetail as InvoiceDetailDto,
  InvoiceSummary as InvoiceSummaryDto,
  InvoicePage as InvoicePageDto,
  LinkRead as PurchaseOrderLink,
  LinkRequest as PurchaseOrderLinkRequest,
  PoFields as PurchaseOrderFields,
  PoRead as PurchaseOrder,
} from '../../../core/api/schema';

export type InvoiceListQuery = NonNullable<operations['listInvoices']['parameters']['query']>;

function invoiceListParams(query: InvoiceListQuery): HttpParams {
  let params = new HttpParams();
  for (const [parameter, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params = params.set(parameter, String(value));
  }

  return params;
}

@Injectable({ providedIn: 'root' })
export class InvoiceApi {
  private readonly http = inject(HttpClient);

  invoiceListResource<T>(
    query: InvoiceListQuery,
    parsePage: (page: InvoicePageDto) => T,
  ): HttpResourceRef<T | undefined> {
    return httpResource(() => ({ url: '/api/v1/invoices', params: invoiceListParams(query) }), {
      parse: (response) => parsePage(response as InvoicePageDto),
    });
  }

  list(query: InvoiceListQuery = {}): Observable<InvoicePageDto> {
    return this.http.get<InvoicePageDto>('/api/v1/invoices', {
      params: invoiceListParams(query),
    });
  }

  detail(id: string): Observable<InvoiceDetailDto> {
    return this.http.get<InvoiceDetailDto>(`/api/v1/invoices/${encodeURIComponent(id)}`);
  }

  purchaseOrders(): Observable<PurchaseOrder[]> {
    return this.http.get<PurchaseOrder[]>('/api/v1/purchase-orders');
  }

  purchaseOrderLink(id: string): Observable<PurchaseOrderLink> {
    return this.http.get<PurchaseOrderLink>(
      `/api/v1/invoices/${encodeURIComponent(id)}/purchase-order-link`,
    );
  }

  savePurchaseOrder(
    order: PurchaseOrderFields,
    existing?: PurchaseOrder,
  ): Observable<PurchaseOrder> {
    return existing
      ? this.http.put<PurchaseOrder>(`/api/v1/purchase-orders/${encodeURIComponent(existing.id)}`, {
          ...order,
          expectedVersion: existing.version,
        })
      : this.http.post<PurchaseOrder>('/api/v1/purchase-orders', order);
  }

  linkPurchaseOrder(id: string, request: PurchaseOrderLinkRequest): Observable<PurchaseOrderLink> {
    return this.http.put<PurchaseOrderLink>(
      `/api/v1/invoices/${encodeURIComponent(id)}/purchase-order-link`,
      request,
    );
  }

  reconcile(id: string): Observable<ReconciliationResult> {
    return this.http.post<ReconciliationResult>(
      `/api/v1/invoices/${encodeURIComponent(id)}/reconciliation`,
      {},
    );
  }

  latestReconciliation(id: string): Observable<ReconciliationRead> {
    return this.http.get<ReconciliationRead>(
      `/api/v1/invoices/${encodeURIComponent(id)}/reconciliations/latest`,
    );
  }

  reconciliationRevision(id: string, revision: number): Observable<ReconciliationRead> {
    return this.http.get<ReconciliationRead>(
      `/api/v1/invoices/${encodeURIComponent(id)}/reconciliations/${revision}`,
    );
  }

  queryCopilot(query: CopilotQuery): Observable<CopilotAnswer> {
    return this.http.post<CopilotAnswer>('/api/v1/copilot/queries', query);
  }

  draftSupplierInquiry(
    id: string,
    request: SupplierInquiryRequest,
  ): Observable<SupplierInquiryDraft> {
    return this.http.post<SupplierInquiryDraft>(
      `/api/v1/invoices/${encodeURIComponent(id)}/supplier-inquiry-drafts`,
      request,
    );
  }

  comparison(id: string): Observable<InvoiceComparisonDto> {
    return this.http.get<InvoiceComparisonDto>(
      `/api/v1/invoices/${encodeURIComponent(id)}/comparison`,
    );
  }
}
