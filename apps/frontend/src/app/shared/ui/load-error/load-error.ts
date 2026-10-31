import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-load-error',
  imports: [],
  templateUrl: './load-error.html',
  styleUrl: './load-error.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadError {
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
