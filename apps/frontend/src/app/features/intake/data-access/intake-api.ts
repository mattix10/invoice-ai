import { HttpClient, HttpResourceRef, httpResource } from '@angular/common/http';
import { inject, Injectable, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ConfirmResponse,
  DocumentResponse,
  Draft,
  DraftResponse,
  UploadResponse,
} from '../../../core/api/schema';

export type {
  Draft,
  DraftItem,
  Validation,
  DraftResponse as SavedDraft,
} from '../../../core/api/schema';

const INTAKE_DOCUMENTS_URL = '/api/v1/intake/documents';

@Injectable({ providedIn: 'root' })
export class IntakeApi {
  private readonly http = inject(HttpClient);

  documentResource(documentId: Signal<string>): HttpResourceRef<DocumentResponse | undefined> {
    return httpResource<DocumentResponse>(() => this.documentUrl(documentId()));
  }

  documentFileResource(documentId: Signal<string>): HttpResourceRef<Blob | undefined> {
    return httpResource.blob(() => `${this.documentUrl(documentId())}/file`);
  }

  uploadDocument(file: File, allowDuplicate = false): Observable<UploadResponse> {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    if (allowDuplicate) uploadForm.append('allow_duplicate', 'true');

    return this.http.post<UploadResponse>(INTAKE_DOCUMENTS_URL, uploadForm);
  }

  saveDraft(documentId: string, expectedRevision: number, draft: Draft): Observable<DraftResponse> {
    return this.http.put<DraftResponse>(`${this.documentUrl(documentId)}/draft`, {
      expected_revision: expectedRevision,
      draft,
    });
  }

  confirmInvoice(documentId: string, expectedRevision: number): Observable<ConfirmResponse> {
    return this.http.post<ConfirmResponse>(`${this.documentUrl(documentId)}/confirm`, {
      expected_revision: expectedRevision,
    });
  }

  private documentUrl(documentId: string): string {
    return `${INTAKE_DOCUMENTS_URL}/${encodeURIComponent(documentId)}`;
  }
}
