import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable, Signal } from '@angular/core';

import { components } from '../../../core/api/schema';

export type DraftItem = components['schemas']['DraftItem'];
export type Draft = components['schemas']['Draft'];
export type Validation = components['schemas']['Validation'];
export type Document = components['schemas']['DocumentResponse'];
export type SavedDraft = components['schemas']['DraftResponse'];

const INTAKE_DOCUMENTS_URL = '/api/v1/intake/documents';

@Injectable({ providedIn: 'root' })
export class IntakeApi {
  private readonly http = inject(HttpClient);

  documentResource(documentId: Signal<string>) {
    return httpResource<Document>(() => this.documentUrl(documentId()));
  }

  documentFileResource(documentId: Signal<string>) {
    return httpResource.blob(() => `${this.documentUrl(documentId())}/file`);
  }

  uploadDocument(file: File, allowDuplicate = false) {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    if (allowDuplicate) uploadForm.append('allow_duplicate', 'true');
    return this.http.post<components['schemas']['UploadResponse']>(
      INTAKE_DOCUMENTS_URL,
      uploadForm,
    );
  }

  saveDraft(documentId: string, expectedRevision: number, draft: Draft) {
    return this.http.put<SavedDraft>(`${this.documentUrl(documentId)}/draft`, {
      expected_revision: expectedRevision,
      draft,
    });
  }

  confirmInvoice(documentId: string, expectedRevision: number) {
    return this.http.post<components['schemas']['ConfirmResponse']>(
      `${this.documentUrl(documentId)}/confirm`,
      { expected_revision: expectedRevision },
    );
  }

  private documentUrl(documentId: string): string {
    return `${INTAKE_DOCUMENTS_URL}/${encodeURIComponent(documentId)}`;
  }
}
