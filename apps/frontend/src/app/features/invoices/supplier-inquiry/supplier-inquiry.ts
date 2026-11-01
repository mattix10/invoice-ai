import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import type { ReconciliationRead } from '../../../core/api/schema';
import { InvoiceApi } from '../data-access/invoice-api';

@Component({
  selector: 'app-supplier-inquiry',
  templateUrl: './supplier-inquiry.html',
  styleUrl: './supplier-inquiry.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierInquiry {
  readonly invoiceId = input.required<string>();
  readonly record = input<ReconciliationRead | null>(null);
  private readonly api = inject(InvoiceApi);
  private sequence = 0;
  private readonly request = linkedSignal(() => {
    this.invoiceId();
    this.record();

    return undefined as { id: string; revision: number; sequence: number } | undefined;
  });
  protected readonly draft = rxResource({
    params: () => {
      const request = this.request();
      const record = this.record();

      return request &&
        request.id === this.invoiceId() &&
        record?.isCurrent &&
        record.revision === request.revision
        ? request
        : null;
    },
    stream: ({ params }) =>
      params
        ? this.api.draftSupplierInquiry(params.id, {
            reconciliationRevision: params.revision,
            style: 'neutral',
          })
        : of(null),
  });
  protected readonly draftValue = computed(() =>
    this.draft.hasValue() ? this.draft.value() : null,
  );
  protected readonly subject = linkedSignal(() => this.draftValue()?.subject ?? '');
  protected readonly body = linkedSignal(() => this.draftValue()?.body ?? '');
  protected readonly copied = signal(false);

  protected generate(): void {
    const record = this.record();
    if (!record?.isCurrent || this.draft.isLoading()) return;
    this.copied.set(false);
    this.request.set({
      id: this.invoiceId(),
      revision: record.revision,
      sequence: ++this.sequence,
    });
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${this.subject()}\n\n${this.body()}`);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }
}
