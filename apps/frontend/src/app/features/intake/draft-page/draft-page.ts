import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, switchMap, tap } from 'rxjs';
import { DocumentPreview } from '../document-preview/document-preview';
import { DraftEditor } from '../draft-editor/draft-editor';
import { Draft, IntakeApi } from '../data-access/intake-api';
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
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly id = computed(() => this.params().get('documentId') ?? '');
  protected readonly document = this.api.document(this.id);
  protected readonly file = this.api.file(this.id);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly conflict = signal(false);
  protected save(draft: Draft, confirm = false) {
    const doc = this.document.hasValue() ? this.document.value() : null;
    if (!doc || this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    let confirming = false;
    const save = this.api
      .save(this.id(), doc.revision, {
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
      })
      .pipe(
        tap((result) =>
          this.document.update((value) =>
            value ? { ...value, ...result, status: 'draft' } : value,
          ),
        ),
      );
    const operation: Observable<
      { invoice_id: string; status: 'confirmed' } | import('../data-access/intake-api').SavedDraft
    > = confirm
      ? save.pipe(
          switchMap((result) => {
            confirming = true;
            return this.api.confirm(this.id(), result.revision);
          }),
        )
      : save;
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy.set(false);
        if ('invoice_id' in result) {
          void this.router.navigate(['/invoices', result.invoice_id]);
        } else {
          this.message.set('Draft saved.');
        }
      },
      error: (error: unknown) => {
        this.busy.set(false);
        if (
          error instanceof HttpErrorResponse &&
          error.error?.error?.code === 'draft_revision_conflict'
        ) {
          this.conflict.set(true);
          this.message.set(
            'The document changed elsewhere. Reload the latest version before trying again. Your unsaved changes remain visible until you reload.',
          );
        } else {
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
          const action = confirming
            ? 'Could not confirm the invoice.'
            : 'Could not save the draft.';
          this.message.set(`${action} ${detail || fields || 'Check the fields and try again.'}`);
        }
      },
    });
  }
  protected reload() {
    this.conflict.set(false);
    this.message.set('');
    this.document.reload();
  }
}
