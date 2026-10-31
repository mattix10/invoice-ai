import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable, Signal } from '@angular/core';

import { components } from '../../../core/api/schema';

export type DraftItem = components['schemas']['DraftItem'];
export type Draft = components['schemas']['Draft'];
export type Validation = components['schemas']['Validation'];
export type Document = components['schemas']['DocumentResponse'];
export type SavedDraft = components['schemas']['DraftResponse'];
@Injectable({ providedIn: 'root' })
export class IntakeApi {
  private readonly http = inject(HttpClient);
  document(id: Signal<string>) {
    return httpResource<Document>(() => `/api/v1/intake/documents/${encodeURIComponent(id())}`);
  }
  file(id: Signal<string>) {
    return httpResource.blob(() => `/api/v1/intake/documents/${encodeURIComponent(id())}/file`);
  }
  upload(file: File, allowDuplicate = false) {
    const body = new FormData();
    body.append('file', file);
    if (allowDuplicate) body.append('allow_duplicate', 'true');
    return this.http.post<components['schemas']['UploadResponse']>(
      '/api/v1/intake/documents',
      body,
    );
  }
  save(id: string, expected_revision: number, draft: Draft) {
    return this.http.put<SavedDraft>(`/api/v1/intake/documents/${encodeURIComponent(id)}/draft`, {
      expected_revision,
      draft,
    });
  }
  confirm(id: string, expected_revision: number) {
    return this.http.post<components['schemas']['ConfirmResponse']>(
      `/api/v1/intake/documents/${encodeURIComponent(id)}/confirm`,
      { expected_revision },
    );
  }
}
