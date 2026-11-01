import { JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { DocumentResponse, SuggestionDecisions } from '../../../core/api/schema';
import { Draft, IntakeApi, SavedDraft, SuggestionDecisionBatch } from '../data-access/intake-api';
import { canonicalAmount } from '../data-access/intake-money';
import { DraftEditor } from '../draft-editor/draft-editor';

export interface DraftVisit {
  documentId: string;
}
interface PendingConfirmation {
  documentId: string;
  revision: number;
}

@Component({
  selector: 'app-draft-review',
  imports: [DraftEditor, JsonPipe],
  templateUrl: './draft-review.html',
  styleUrl: './draft-review.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftReview {
  readonly visit = input.required<DraftVisit>();
  readonly document = input.required<DocumentResponse>();
  readonly step = input(2);
  readonly stepChange = output<number>();
  readonly saved = output<SavedDraft>();
  readonly reload = output<void>();

  private readonly api = inject(IntakeApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editor = viewChild(DraftEditor);

  hasPendingChanges(): boolean {
    return (
      this.busy() ||
      this.pendingConfirmation() !== null ||
      (this.editor()?.hasPendingChanges() ?? false)
    );
  }

  protected readonly documentId = computed(() => this.visit().documentId);
  protected readonly busy = linkedSignal(() => this.resetForVisit(false));
  protected readonly message = linkedSignal(() => this.resetForVisit(''));
  protected readonly conflict = linkedSignal(() => this.resetForVisit(false));
  protected readonly serverConflictDraft = linkedSignal(() =>
    this.resetForVisit<Draft | null>(null),
  );
  protected readonly decisions = linkedSignal(() =>
    this.resetForVisit<SuggestionDecisionBatch[]>([]),
  );
  protected readonly pendingConfirmation = linkedSignal(() =>
    this.resetForVisit<PendingConfirmation | null>(null),
  );

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

  protected saveDraft(draft: Draft): void {
    this.persistDraft(draft, () => {
      this.busy.set(false);
      this.message.set('Draft saved.');
    });
  }

  protected confirmInvoice(draft: Draft): void {
    this.persistDraft(draft, (savedDraft) => {
      this.sendConfirmation({ documentId: this.documentId(), revision: savedDraft.revision });
    });
  }

  protected retryConfirmation(): void {
    const pending = this.pendingConfirmation();
    if (!pending || this.busy() || pending.documentId !== this.documentId()) return;
    this.busy.set(true);
    this.message.set('');
    this.sendConfirmation(pending);
  }

  protected reloadDocument(): void {
    this.pendingConfirmation.set(null);
    this.conflict.set(false);
    this.serverConflictDraft.set(null);
    this.decisions.set([]);
    this.message.set('');
    this.reload.emit();
  }

  private persistDraft(draft: Draft, afterSave: (savedDraft: SavedDraft) => void): void {
    if (this.busy() || this.pendingConfirmation()) return;
    const visit = this.visit();
    this.busy.set(true);
    this.message.set('');
    let normalizedDraft: Draft;
    try {
      normalizedDraft = this.normalizeDraft(draft);
    } catch {
      this.busy.set(false);
      this.message.set('Enter amounts with at most two decimal places.');

      return;
    }
    const batches = this.decisionBatchesFor(normalizedDraft);

    this.api
      .saveDraft(visit.documentId, this.document().revision, normalizedDraft, batches)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (savedDraft) => {
          if (this.visit() !== visit) return;
          this.editor()?.markSaved(savedDraft.draft);
          this.saved.emit(savedDraft);
          this.decisions.set([]);
          afterSave(savedDraft);
        },
        error: (error: unknown) => {
          if (this.visit() === visit) this.showError(error, 'Could not save the draft.');
        },
      });
  }

  private decisionBatchesFor(draft: Draft): SuggestionDecisions[] {
    const recorded = [...this.decisions()].sort(
      (a, b) => a.suggestionVersion - b.suggestionVersion,
    );
    const latestApplied = new Map<string, unknown>();
    for (const batch of recorded) {
      for (const decision of batch.decisions) {
        if (decision.decision === 'applied') latestApplied.set(decision.field, decision.value);
      }
    }

    return recorded
      .map((batch) => ({
        suggestionVersion: batch.suggestionVersion,
        decisions: batch.decisions
          .filter(
            (decision) =>
              decision.decision === 'rejected' ||
              JSON.stringify(draft[decision.field]) ===
                JSON.stringify(latestApplied.get(decision.field)),
          )
          .map(({ field, decision }) => ({ field, decision })),
      }))
      .filter((batch) => batch.decisions.length > 0);
  }

  private normalizeDraft(draft: Draft): Draft {
    return {
      ...draft,
      issued: draft.issued || null,
      due: draft.due || null,
      currency: draft.currency || null,
      vatRate: draft.vatRate || null,
      items: draft.items.map((item) => ({ ...item, unitNet: canonicalAmount(item.unitNet) })),
      declaredTotals: draft.declaredTotals
        ? {
            net: canonicalAmount(draft.declaredTotals.net),
            vat: canonicalAmount(draft.declaredTotals.vat),
            gross: canonicalAmount(draft.declaredTotals.gross),
          }
        : null,
    };
  }

  private sendConfirmation(pending: PendingConfirmation): void {
    const visit = this.visit();
    this.api
      .confirmInvoice(pending.documentId, pending.revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (confirmation) => {
          if (this.visit() !== visit) return;
          this.busy.set(false);
          this.pendingConfirmation.set(null);
          void this.router.navigate(['/invoices', confirmation.invoiceId]);
        },
        error: (error: unknown) => {
          if (this.visit() !== visit) return;
          this.pendingConfirmation.set(
            error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)
              ? pending
              : null,
          );
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
      this.loadConflictingDraft();

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

  private loadConflictingDraft(): void {
    const visit = this.visit();
    this.api
      .getDocument(visit.documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (document) => {
          if (this.visit() === visit && this.conflict())
            this.serverConflictDraft.set(document.draft);
        },
        error: () => {
          if (this.visit() === visit && this.conflict())
            this.message.set('Could not load the server draft. Your local edits remain visible.');
        },
      });
  }

  private resetForVisit<T>(value: T): T {
    this.visit();

    return value;
  }
}
