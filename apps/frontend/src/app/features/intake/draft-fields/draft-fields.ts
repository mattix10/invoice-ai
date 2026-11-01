import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { Draft, SuggestionDecisionBatch, SuggestionProposal } from '../data-access/intake-api';
import { SuggestionsPanel } from '../suggestions-panel/suggestions-panel';

@Component({
  selector: 'app-draft-fields',
  imports: [FormsModule, SuggestionsPanel],
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(NgForm, { optional: true, skipSelf: true }),
    },
  ],
  templateUrl: './draft-fields.html',
  styleUrl: './draft-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftFields {
  readonly draft = input.required<Draft>();
  readonly documentId = input('');
  readonly busy = input(false);
  readonly changed = output<Partial<Draft>>();
  readonly apply = output<SuggestionProposal[]>();
  readonly decide = output<SuggestionDecisionBatch>();
  private readonly suggestionsDetails =
    viewChild<ElementRef<HTMLDetailsElement>>('suggestionsDetails');

  protected openSuggestions(field: SuggestionProposal['field']): void {
    const details = this.suggestionsDetails()?.nativeElement;
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    (
      details.querySelector<HTMLInputElement>(`[data-field="${field}"] input[type="checkbox"]`) ??
      details.querySelector<HTMLElement>('summary')
    )?.focus();
  }
}
