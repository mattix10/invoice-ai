import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-upload-form',
  imports: [RouterLink],
  templateUrl: './upload-form.html',
  styleUrl: './upload-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadForm {
  readonly busy = input(false);
  readonly error = input('');
  readonly duplicate = input('');
  readonly uploadDuplicate = output<File>();
  readonly selectionChanged = output<void>();
  readonly upload = output<File>();
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly validation = signal('');
  protected readonly dragging = signal(false);

  protected selectFile(event: Event): void {
    if (this.busy()) return;
    this.selectDocument((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.busy()) this.dragging.set(true);
  }

  protected dragLeave(event: DragEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
      this.dragging.set(false);
    }
  }

  protected dropFile(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.busy()) return;
    if (event.dataTransfer?.files.length !== 1) {
      this.validation.set('Drop one file at a time.');

      return;
    }
    this.selectDocument(event.dataTransfer?.files[0] ?? null);
  }

  private selectDocument(file: File | null): void {
    this.selectedFile.set(file);
    this.validation.set('');
    this.selectionChanged.emit();
    if (this.selectedFile()) this.submitUpload();
  }

  protected uploadSeparateDocument(): void {
    const file = this.selectedFile();
    if (file) this.uploadDuplicate.emit(file);
  }

  protected submitUpload(): void {
    const file = this.selectedFile();
    if (!file || !this.isSupportedDocument(file)) {
      this.validation.set('Select a non-empty PDF, JPEG or PNG no larger than 10 MiB.');

      return;
    }
    this.validation.set('');
    this.upload.emit(file);
  }

  private isSupportedDocument(file: File): boolean {
    const extension = file.name.toLowerCase().split('.').pop();
    const mediaTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };
    const expectedType = extension ? mediaTypes[extension] : undefined;
    const hasSupportedMediaType = expectedType && (!file.type || file.type === expectedType);
    const hasSupportedSize = file.size > 0 && file.size <= MAX_DOCUMENT_SIZE_BYTES;

    return !!hasSupportedMediaType && hasSupportedSize;
  }
}
