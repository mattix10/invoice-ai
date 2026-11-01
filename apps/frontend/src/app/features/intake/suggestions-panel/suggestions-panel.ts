import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Draft,
  IntakeApi,
  SuggestionDecisionBatch,
  SuggestionProposal,
  SuggestionsResponse,
} from '../data-access/intake-api';

@Component({
  selector: 'app-suggestions-panel',
  templateUrl: './suggestions-panel.html',
  styleUrl: './suggestions-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionsPanel {
  readonly documentId = input.required<string>();
  readonly draft = input.required<Draft>();
  readonly disabled = input(false);
  readonly apply = output<SuggestionProposal[]>();
  readonly decide = output<SuggestionDecisionBatch>();
  private readonly api = inject(IntakeApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly suggestions = linkedSignal(() => {
    this.documentId();

    return null as SuggestionsResponse | null;
  });
  protected readonly selected = linkedSignal(() => {
    this.documentId();

    return [] as number[];
  });
  protected readonly busy = linkedSignal(() => {
    this.documentId();

    return false;
  });
  protected readonly error = linkedSignal(() => {
    this.documentId();

    return '';
  });

  protected load(rerun: boolean): void {
    if (this.busy() || this.disabled()) return;
    const documentId = this.documentId();
    this.busy.set(true);
    this.error.set('');
    const request = rerun
      ? this.api.rerunSuggestions(documentId)
      : this.api.latestSuggestions(documentId);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (suggestions) => {
        if (documentId !== this.documentId()) return;
        this.suggestions.set(suggestions);
        this.selected.set([]);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        if (documentId !== this.documentId()) return;
        this.busy.set(false);
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'No suggestions are available yet.'
            : 'Suggestions are unavailable. Extract document text first, or continue editing manually.',
        );
      },
    });
  }

  protected available(proposal: SuggestionProposal): boolean {
    const source = proposal.source;

    return (
      proposal.value !== null &&
      !!source &&
      source.pageNumber > 0 &&
      source.start >= 0 &&
      source.end > source.start &&
      !!source.excerpt &&
      source.end - source.start === Array.from(source.excerpt).length
    );
  }

  protected display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) {
      return value.length ? value.map((item) => this.display(item)).join('\n') : '—';
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([key, entry]) => `${this.fieldLabel(key)}: ${this.display(entry)}`)
        .join(' · ');
    }

    return String(value);
  }

  protected fieldLabel(field: string): string {
    const labels: Record<string, string> = {
      vendor: 'Vendor',
      supplierInvoiceNumber: 'Invoice number',
      issued: 'Issue date',
      due: 'Due date',
      currency: 'Currency',
      vatRate: 'VAT rate',
      items: 'Line items',
      declaredTotals: 'Declared totals',
      position: 'Position',
      name: 'Description',
      quantity: 'Quantity',
      unitNet: 'Unit net',
      net: 'Net',
      vat: 'VAT',
      gross: 'Gross',
    };

    return labels[field] ?? field;
  }

  protected toggle(index: number, checked: boolean): void {
    this.selected.update((selected) =>
      checked ? [...selected, index] : selected.filter((entry) => entry !== index),
    );
  }

  protected applySelected(): void {
    const proposals = this.suggestions()?.proposals ?? [];
    const chosen = this.selected()
      .map((index) => proposals[index])
      .filter(
        (proposal): proposal is SuggestionProposal =>
          proposal !== undefined && this.available(proposal),
      );
    this.apply.emit(chosen);
    this.recordDecision(chosen, 'applied');
    this.selected.set([]);
  }

  protected rejectSelected(): void {
    const proposals = this.suggestions()?.proposals ?? [];
    const chosen = this.selected()
      .map((index) => proposals[index])
      .filter(
        (proposal): proposal is SuggestionProposal =>
          proposal !== undefined && this.available(proposal),
      );
    this.recordDecision(chosen, 'rejected');
    this.selected.set([]);
  }

  private recordDecision(proposals: SuggestionProposal[], decision: 'applied' | 'rejected'): void {
    const version = this.suggestions()?.version;
    if (version && proposals.length)
      this.decide.emit({
        suggestionVersion: version,
        decisions: proposals.map(({ field, value }) => ({ field, value, decision })),
      });
  }
}
