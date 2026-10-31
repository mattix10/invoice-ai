import { Panel } from '../../../shared/ui/panel/panel';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoInvoice } from '../../invoices/invoice-demo.data';

@Component({
  selector: 'app-attention-queue',
  imports: [Panel, CurrencyPipe, RouterLink],
  templateUrl: './attention-queue.html',
  styleUrl: './attention-queue.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttentionQueue {
  readonly mode = input.required<'banner' | 'list'>();
  readonly invoice = input.required<DemoInvoice>();
  readonly differencePercent = input.required<string>();
  readonly additionalReviewCount = input.required<number>();
  readonly investigationLink = input.required<readonly string[]>();
}
