import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-document-preview',
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPreview {
  readonly file = input.required<Blob>();
  readonly name = input.required<string>();
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly url = signal<SafeResourceUrl | null>(null);

  constructor() {
    effect((onCleanup) => {
      const url = URL.createObjectURL(this.file());
      this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }
}
