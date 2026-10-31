import { HttpErrorResponse } from '@angular/common/http';
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
import { Draft, IntakeApi, SavedDraft } from '../data-access/intake-api';

interface PendingConfirmation {
  documentId: string;
  revision: number;
}

@Component({
  selector: 'app-draft-page',
  imports: [DocumentPreview, DraftEditor, RouterLink],
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
  protected readonly document = this.api.documentResource(this.documentId);
  protected readonly file = this.api.documentFileResource(this.documentId);
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
    this.api
      .saveDraft(documentId, document.revision, normalizeDraft(draft))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (savedDraft) => {
          if (this.routeVisit() !== visit) return;
          this.document.update((current) =>
            current ? { ...current, ...savedDraft, status: 'draft' } : current,
          );
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
          void this.router.navigate(['/invoices', confirmation.invoice_id]);
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
    vat_rate: draft.vat_rate || null,
    items: draft.items.map((item) => ({ ...item, unit_net: item.unit_net || null })),
    declared_totals: draft.declared_totals
      ? {
          net: draft.declared_totals.net || null,
          vat: draft.declared_totals.vat || null,
          gross: draft.declared_totals.gross || null,
        }
      : null,
  };
}
