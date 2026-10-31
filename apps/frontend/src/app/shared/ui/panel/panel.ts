import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-panel',
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panel {}
