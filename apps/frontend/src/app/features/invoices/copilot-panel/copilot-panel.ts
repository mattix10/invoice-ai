import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CopilotAnswerView } from '../copilot-answer/copilot-answer';
import type { ConversationTurn } from '../data-access/conversation-turn';

@Component({
  selector: 'app-copilot-panel',
  imports: [CopilotAnswerView],
  templateUrl: './copilot-panel.html',
  styleUrl: './copilot-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopilotPanel {
  readonly turns = input<readonly ConversationTurn[]>([]);
  readonly state = input<'idle' | 'loading' | 'error' | 'ready'>('idle');
  readonly historical = input(false);
  readonly evidenceLoading = input(false);
  readonly submitted = output<string>();
  readonly retry = output<void>();
  protected readonly question = signal('');
  private readonly conversation = viewChild.required<ElementRef<HTMLDivElement>>('conversation');

  constructor() {
    afterRenderEffect({
      mixedReadWrite: () => {
        if (this.turns().length === 0) return;
        const conversation = this.conversation().nativeElement;
        conversation.scrollTop = conversation.scrollHeight;
      },
    });
  }

  protected send(): void {
    const question = this.question().trim();
    if (
      question &&
      question.length <= 500 &&
      this.state() !== 'loading' &&
      !this.historical() &&
      !this.evidenceLoading()
    ) {
      this.submitted.emit(question);
      this.question.set('');
    }
  }

  protected suggest(question: string): void {
    this.question.set(question);
    this.send();
  }
}
