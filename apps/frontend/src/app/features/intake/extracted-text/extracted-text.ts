import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { TextExtractionResponse } from '../../../core/api/schema';

@Component({
  selector: 'app-extracted-text',
  imports: [],
  templateUrl: './extracted-text.html',
  styleUrl: './extracted-text.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtractedText {
  readonly extraction = input<TextExtractionResponse | null>(null);
  readonly busy = input(false);
  readonly error = input('');
  readonly extract = output<void>();
  readonly loadLatest = output<void>();
}
