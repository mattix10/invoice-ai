import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-document-preview',
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPreview {
  readonly file = input.required<Blob>();
  readonly name = input.required<string>();
  protected readonly url = signal<string | null>(null);
  protected readonly zoom = signal(100);

  protected changeZoom(amount: number): void {
    this.zoom.update((current) => Math.max(75, Math.min(200, current + amount)));
  }

  constructor() {
    effect((onCleanup) => {
      const url = URL.createObjectURL(this.file());
      this.url.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }
}
