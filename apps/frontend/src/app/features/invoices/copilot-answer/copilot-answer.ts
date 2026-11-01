import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CopilotAnswer } from '../../../core/api/schema';
import type { EvidenceDestination } from '../data-access/evidence-resolver';

@Component({
  selector: 'app-copilot-answer',
  imports: [RouterLink],
  templateUrl: './copilot-answer.html',
  styleUrl: './copilot-answer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopilotAnswerView {
  readonly response = input.required<CopilotAnswer>();
  readonly sources = input<readonly EvidenceDestination[]>([]);
}
