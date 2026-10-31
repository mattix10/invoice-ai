import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InvoiceDocument } from '../invoice-document/invoice-document';
import { InvoiceFields } from '../invoice-fields/invoice-fields';
import { InvoiceComparison } from '../invoice-comparison/invoice-comparison';
import { INVOICE_WORKSPACE_DATA } from '../invoice-demo.data';

@Component({
  selector: 'app-invoice-workspace-page',
  imports: [CurrencyPipe, RouterLink, InvoiceDocument, InvoiceFields, InvoiceComparison],
  templateUrl: './invoice-workspace-page.html',
  styleUrl: './invoice-workspace-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceWorkspacePage {
  protected readonly data = INVOICE_WORKSPACE_DATA;
  protected readonly investigationLink = ['/invoices', this.data.invoice.id, 'investigation'];
}
