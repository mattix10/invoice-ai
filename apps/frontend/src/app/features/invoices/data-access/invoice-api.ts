import { HttpClient, HttpParams, HttpResourceRef, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  InvoiceComparison as InvoiceComparisonDto,
  InvoiceDetail as InvoiceDetailDto,
  InvoicePage as InvoicePageDto,
  operations,
} from '../../../core/api/schema';

export type {
  InvoiceComparison as InvoiceComparisonDto,
  InvoiceDetail as InvoiceDetailDto,
  InvoiceSummary as InvoiceSummaryDto,
  InvoicePage as InvoicePageDto,
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

  comparison(id: string): Observable<InvoiceComparisonDto> {
    return this.http.get<InvoiceComparisonDto>(
      `/api/v1/invoices/${encodeURIComponent(id)}/comparison`,
    );
  }
}
