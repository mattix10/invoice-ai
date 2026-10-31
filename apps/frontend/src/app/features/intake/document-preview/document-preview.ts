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

  constructor() {
    effect((onCleanup) => {
      const url = URL.createObjectURL(this.file());
      this.url.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }
}
