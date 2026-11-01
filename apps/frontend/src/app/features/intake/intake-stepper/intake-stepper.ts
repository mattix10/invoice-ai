import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-intake-stepper',
  templateUrl: './intake-stepper.html',
  styleUrl: './intake-stepper.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntakeStepper {
  readonly step = input.required<number>();
  protected readonly steps = ['Upload', 'Review fields', 'Line items', 'Confirm'];
}
