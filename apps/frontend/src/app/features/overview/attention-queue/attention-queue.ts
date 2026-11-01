import { Panel } from '../../../shared/ui/panel/panel';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatMinorAmount } from '../../invoices/data-access/invoice-adapter';
import { DemoInvoice } from '../../invoices/invoice-demo.data';

@Component({
  selector: 'app-attention-queue',
  imports: [Panel, RouterLink],
  templateUrl: './attention-queue.html',
  styleUrl: './attention-queue.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttentionQueue {
  protected readonly amount = formatMinorAmount;
  readonly mode = input.required<'banner' | 'list'>();
  readonly invoice = input.required<DemoInvoice>();
  readonly differencePercent = input.required<string>();
  readonly additionalReviewCount = input.required<number>();
  readonly investigationLink = input.required<readonly string[]>();
}
