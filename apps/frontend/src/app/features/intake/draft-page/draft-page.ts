import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, Observable } from 'rxjs';
import type { TextExtractionResponse } from '../../../core/api/schema';
import { IntakeApi, SavedDraft } from '../data-access/intake-api';
import { DocumentPreview } from '../document-preview/document-preview';
import { DraftReview } from '../draft-review/draft-review';
import { ExtractedText } from '../extracted-text/extracted-text';

@Component({
  selector: 'app-draft-page',
  imports: [DocumentPreview, DraftReview, ExtractedText, RouterLink],
  templateUrl: './draft-page.html',
  styleUrl: './draft-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftPage {
  private readonly api = inject(IntakeApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly routeVisit = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get('documentId') ?? ''),
      distinctUntilChanged(),
      map((documentId) => ({ documentId })),
    ),
    { initialValue: { documentId: this.route.snapshot.paramMap.get('documentId') ?? '' } },
  );

  protected readonly documentId = computed(() => this.routeVisit().documentId);
  protected readonly originalFileUrl = computed(() => this.api.originalFileUrl(this.documentId()));
  protected readonly document = this.api.documentResource(this.documentId);
  protected readonly file = this.api.documentFileResource(this.documentId);
  protected readonly extraction = linkedSignal(() =>
    this.resetForVisit<TextExtractionResponse | null>(null),
  );
  protected readonly extractionBusy = linkedSignal(() => this.resetForVisit(false));
  protected readonly extractionError = linkedSignal(() => this.resetForVisit(''));

  protected saveDraft(saved: SavedDraft): void {
    this.document.update((current) =>
      current ? { ...current, ...saved, status: 'draft' } : current,
    );
  }

  protected extractText(): void {
    this.requestText(this.api.extractText(this.documentId()));
  }

  protected loadLatestText(): void {
    this.requestText(this.api.latestText(this.documentId()));
  }

  private requestText(request: Observable<TextExtractionResponse>): void {
    if (this.extractionBusy()) return;
    const visit = this.routeVisit();
    this.extractionBusy.set(true);
    this.extractionError.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        if (this.routeVisit() !== visit) return;
        this.extraction.set(result);
        this.extractionBusy.set(false);
      },
      error: () => {
        if (this.routeVisit() !== visit) return;
        this.extractionBusy.set(false);
        this.extractionError.set(
          'Text is unavailable. You can continue entering the draft manually.',
        );
      },
    });
  }

  private resetForVisit<T>(value: T): T {
    this.routeVisit();

    return value;
  }
}
