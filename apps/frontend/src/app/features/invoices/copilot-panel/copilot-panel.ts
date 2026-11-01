import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CopilotAnswerView } from '../copilot-answer/copilot-answer';
import type { CopilotAnswer } from '../../../core/api/schema';
import type { EvidenceDestination } from '../data-access/evidence-resolver';

@Component({
  selector: 'app-copilot-panel',
  imports: [CopilotAnswerView],
  templateUrl: './copilot-panel.html',
  styleUrl: './copilot-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopilotPanel {
  readonly answer = input<CopilotAnswer | null>(null);
  readonly sources = input<readonly EvidenceDestination[]>([]);
  readonly state = input<'idle' | 'loading' | 'error' | 'ready'>('idle');
  readonly error = input('');
  readonly historical = input(false);
  readonly evidenceLoading = input(false);
  readonly lastQuestion = input('');
  readonly submitted = output<string>();
  readonly retry = output<void>();
  protected readonly question = signal('');

  protected send(): void {
    const question = this.question().trim();
    if (
      question &&
      question.length <= 500 &&
      this.state() !== 'loading' &&
      !this.historical() &&
      !this.evidenceLoading()
    )
      this.submitted.emit(question);
  }

  protected suggest(question: string): void {
    this.question.set(question);
    this.send();
  }
}
