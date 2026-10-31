import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { components, operations } from '../../../core/api/schema';

export type InvoiceDetailDto = components['schemas']['InvoiceDetail'];
export type InvoiceComparisonDto = components['schemas']['InvoiceComparison'];
export type InvoiceSummaryDto = components['schemas']['InvoiceSummary'];
export type InvoiceListQuery = NonNullable<operations['listInvoices']['parameters']['query']>;

@Injectable({ providedIn: 'root' })
export class InvoiceApi {
  private readonly http = inject(HttpClient);

  list(query: InvoiceListQuery = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params = params.set(key, String(value));
    }
    return this.http.get<components['schemas']['InvoicePage']>('/api/v1/invoices', { params });
  }

  detail(id: string) {
    return this.http.get<InvoiceDetailDto>(`/api/v1/invoices/${encodeURIComponent(id)}`);
  }

  comparison(id: string) {
    return this.http.get<InvoiceComparisonDto>(
      `/api/v1/invoices/${encodeURIComponent(id)}/comparison`,
    );
  }
}
