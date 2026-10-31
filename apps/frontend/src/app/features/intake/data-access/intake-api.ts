import { HttpClient, HttpResourceRef, httpResource } from '@angular/common/http';
import { inject, Injectable, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ConfirmResponse,
  DocumentResponse,
  Draft,
  DraftResponse,
  UploadResponse,
  TextExtractionResponse,
  SuggestionsResponse,
  FieldProposal as SuggestionProposal,
  SuggestionDecisions,
} from '../../../core/api/schema';

export type {
  Draft,
  DraftItem,
  Validation,
  DraftResponse as SavedDraft,
  FieldProposal as SuggestionProposal,
  SuggestionsResponse,
} from '../../../core/api/schema';

const INTAKE_DOCUMENTS_URL = '/api/v1/intake/documents';

export interface SuggestionDecisionBatch {
  suggestionVersion: number;
  decisions: {
    field: SuggestionProposal['field'];
    decision: 'applied' | 'rejected';
    value: SuggestionProposal['value'];
  }[];
}

@Injectable({ providedIn: 'root' })
export class IntakeApi {
  private readonly http = inject(HttpClient);

  documentResource(documentId: Signal<string>): HttpResourceRef<DocumentResponse | undefined> {
    return httpResource<DocumentResponse>(() => this.documentUrl(documentId()));
  }

  getDocument(documentId: string): Observable<DocumentResponse> {
    return this.http.get<DocumentResponse>(this.documentUrl(documentId));
  }

  documentFileResource(documentId: Signal<string>): HttpResourceRef<Blob | undefined> {
    return httpResource.blob(() => `${this.documentUrl(documentId())}/preview`);
  }

  originalFileUrl(documentId: string): string {
    return `${this.documentUrl(documentId)}/file`;
  }

  uploadDocument(file: File, allowDuplicate = false): Observable<UploadResponse> {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    if (allowDuplicate) uploadForm.append('allowDuplicate', 'true');

    return this.http.post<UploadResponse>(INTAKE_DOCUMENTS_URL, uploadForm);
  }

  extractText(documentId: string): Observable<TextExtractionResponse> {
    return this.http.post<TextExtractionResponse>(
      `${this.documentUrl(documentId)}/text-extractions`,
      {},
    );
  }

  latestText(documentId: string): Observable<TextExtractionResponse> {
    return this.http.get<TextExtractionResponse>(
      `${this.documentUrl(documentId)}/text-extractions/latest`,
    );
  }

  latestSuggestions(documentId: string): Observable<SuggestionsResponse> {
    return this.http.get<SuggestionsResponse>(`${this.documentUrl(documentId)}/suggestions/latest`);
  }

  rerunSuggestions(documentId: string): Observable<SuggestionsResponse> {
    return this.http.post<SuggestionsResponse>(`${this.documentUrl(documentId)}/suggestions`, {});
  }

  saveDraft(
    documentId: string,
    expectedRevision: number,
    draft: Draft,
    suggestionDecisionBatches?: SuggestionDecisions[],
  ): Observable<DraftResponse> {
    return this.http.put<DraftResponse>(`${this.documentUrl(documentId)}/draft`, {
      expectedRevision: expectedRevision,
      draft,
      ...(suggestionDecisionBatches?.length ? { suggestionDecisionBatches } : {}),
    });
  }

  confirmInvoice(documentId: string, expectedRevision: number): Observable<ConfirmResponse> {
    return this.http.post<ConfirmResponse>(`${this.documentUrl(documentId)}/confirm`, {
      expectedRevision: expectedRevision,
    });
  }

  private documentUrl(documentId: string): string {
    return `${INTAKE_DOCUMENTS_URL}/${encodeURIComponent(documentId)}`;
  }
}
