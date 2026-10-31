import { HttpErrorResponse } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { DocumentPreview } from '../document-preview/document-preview';
import { DraftEditor } from '../draft-editor/draft-editor';
import { Draft, IntakeApi, SavedDraft, SuggestionDecisionBatch } from '../data-access/intake-api';
import { ExtractedText } from '../extracted-text/extracted-text';
import type { TextExtractionResponse } from '../../../core/api/schema';
import { Observable } from 'rxjs';

interface PendingConfirmation {
  documentId: string;
  revision: number;
}

@Component({
  selector: 'app-draft-page',
  imports: [DocumentPreview, DraftEditor, ExtractedText, RouterLink, JsonPipe],
  templateUrl: './draft-page.html',
  styleUrl: './draft-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftPage {
  private readonly api = inject(IntakeApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly routeVisit = toSignal(
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
  protected readonly extraction = linkedSignal(() => {
    this.routeVisit();

    return null as TextExtractionResponse | null;
  });
  protected readonly extractionBusy = linkedSignal(() => {
    this.routeVisit();

    return false;
  });
  protected readonly extractionError = linkedSignal(() => {
    this.routeVisit();

    return '';
  });
  protected readonly busy = linkedSignal(() => {
    this.routeVisit();

    return false;
  });

  protected readonly message = linkedSignal(() => {
    this.routeVisit();

    return '';
  });

  protected readonly conflict = linkedSignal(() => {
    this.routeVisit();

    return false;
  });

  protected readonly serverConflictDraft = linkedSignal(() => {
    this.routeVisit();

    return null as Draft | null;
  });

  protected readonly decisions = linkedSignal(() => {
    this.routeVisit();

    return [] as SuggestionDecisionBatch[];
  });

  protected recordDecisions(batch: SuggestionDecisionBatch): void {
    this.decisions.update((current) => {
      const previous =
        current.find((entry) => entry.suggestionVersion === batch.suggestionVersion)?.decisions ??
        [];
      const fields = new Set(batch.decisions.map((decision) => decision.field));

      return [
        ...current.filter((entry) => entry.suggestionVersion !== batch.suggestionVersion),
        {
          suggestionVersion: batch.suggestionVersion,
          decisions: [
            ...previous.filter((decision) => !fields.has(decision.field)),
            ...batch.decisions,
          ],
        },
      ];
    });
  }

  protected readonly pendingConfirmation = linkedSignal(() => {
    this.routeVisit();

    return null as PendingConfirmation | null;
  });

  protected saveDraft(draft: Draft): void {
    this.persistDraft(draft, () => {
      this.busy.set(false);
      this.message.set('Draft saved.');
    });
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

  protected confirmInvoice(draft: Draft): void {
    this.persistDraft(draft, (documentId, savedDraft) => {
      this.sendConfirmation({ documentId, revision: savedDraft.revision });
    });
  }

  protected retryConfirmation(): void {
    const pending = this.pendingConfirmation();
    if (!pending || this.busy() || pending.documentId !== this.documentId()) return;
    this.busy.set(true);
    this.message.set('');
    this.sendConfirmation(pending);
  }

  protected reload(): void {
    this.pendingConfirmation.set(null);
    this.conflict.set(false);
    this.serverConflictDraft.set(null);
    this.decisions.set([]);
    this.message.set('');
    this.document.reload();
  }

  private persistDraft(
    draft: Draft,
    afterSave: (documentId: string, savedDraft: SavedDraft) => void,
  ): void {
    const document = this.document.hasValue() ? this.document.value() : null;
    if (!document || this.busy() || this.pendingConfirmation()) return;
    const visit = this.routeVisit();
    const documentId = visit.documentId;
    this.busy.set(true);
    this.message.set('');
    const normalized = normalizeDraft(draft);
    const recorded = [...this.decisions()].sort(
      (a, b) => a.suggestionVersion - b.suggestionVersion,
    );
    const latestApplied = new Map<string, unknown>();
    for (const batch of recorded) {
      for (const decision of batch.decisions) {
        if (decision.decision === 'applied') latestApplied.set(decision.field, decision.value);
      }
    }
    const batches = recorded
      .map((batch) => ({
        suggestionVersion: batch.suggestionVersion,
        decisions: batch.decisions
          .filter(
            (decision) =>
              decision.decision === 'rejected' ||
              JSON.stringify(normalized[decision.field]) ===
                JSON.stringify(latestApplied.get(decision.field)),
          )
          .map(({ field, decision }) => ({ field, decision })),
      }))
      .filter((batch) => batch.decisions.length);
    this.api
      .saveDraft(documentId, document.revision, normalized, batches)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (savedDraft) => {
          if (this.routeVisit() !== visit) return;
          this.document.update((current) =>
            current ? { ...current, ...savedDraft, status: 'draft' } : current,
          );
          this.decisions.set([]);
          afterSave(documentId, savedDraft);
        },
        error: (error: unknown) => {
          if (this.routeVisit() === visit) this.showError(error, 'Could not save the draft.');
        },
      });
  }

  private sendConfirmation(pending: PendingConfirmation): void {
    const visit = this.routeVisit();
    this.api
      .confirmInvoice(pending.documentId, pending.revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (confirmation) => {
          if (this.routeVisit() !== visit) return;
          this.busy.set(false);
          this.pendingConfirmation.set(null);
          void this.router.navigate(['/invoices', confirmation.invoiceId]);
        },
        error: (error: unknown) => {
          if (this.routeVisit() !== visit) return;
          if (error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)) {
            this.pendingConfirmation.set(pending);
          } else {
            this.pendingConfirmation.set(null);
          }
          this.showError(error, 'Could not confirm the invoice.');
        },
      });
  }

  private showError(error: unknown, action: string): void {
    this.busy.set(false);
    if (
      error instanceof HttpErrorResponse &&
      error.error?.error?.code === 'draft_revision_conflict'
    ) {
      this.conflict.set(true);
      this.message.set(
        'The document changed elsewhere. Reload the latest version before trying again. Your unsaved changes remain visible until you reload.',
      );

      const visit = this.routeVisit();
      this.api
        .getDocument(visit.documentId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (document) => {
            if (this.routeVisit() === visit && this.conflict())
              this.serverConflictDraft.set(document.draft);
          },
          error: () => {
            if (this.routeVisit() === visit && this.conflict())
              this.message.set('Could not load the server draft. Your local edits remain visible.');
          },
        });

      return;
    }
    const detail = error instanceof HttpErrorResponse ? error.error?.error?.message : null;
    const fields =
      error instanceof HttpErrorResponse && Array.isArray(error.error?.detail)
        ? error.error.detail
            .map(
              (issue: { loc?: (string | number)[]; msg?: string }) =>
                `${issue.loc?.slice(2).join('.')}: ${issue.msg}`,
            )
            .join('; ')
        : '';
    this.message.set(`${action} ${detail || fields || 'Check the fields and try again.'}`);
  }
}

function normalizeDraft(draft: Draft): Draft {
  return {
    ...draft,
    issued: draft.issued || null,
    due: draft.due || null,
    currency: draft.currency || null,
    vatRate: draft.vatRate || null,
    items: draft.items.map((item) => ({ ...item, unitNet: item.unitNet || null })),
    declaredTotals: draft.declaredTotals
      ? {
          net: draft.declaredTotals.net || null,
          vat: draft.declaredTotals.vat || null,
          gross: draft.declaredTotals.gross || null,
        }
      : null,
  };
}
