import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  templateUrl: './placeholder.html',
  styleUrl: './placeholder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Placeholder {
  protected readonly title = inject(ActivatedRoute).snapshot.data['title'] as string;
}
