import { Panel } from '../../../shared/ui/panel/panel';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  imports: [Panel],
  selector: 'app-invoice-document',
  templateUrl: './invoice-document.html',
  styleUrl: './invoice-document.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDocument {}
