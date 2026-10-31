import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

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
  protected selectFile(event: Event): void {
    if (this.busy()) return;
    this.selectedFile.set((event.target as HTMLInputElement).files?.[0] ?? null);
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
    if (!file || !this.isSupportedPdf(file)) {
      this.validation.set('Select a non-empty PDF no larger than 10 MiB.');
      return;
    }
    this.validation.set('');
    this.upload.emit(file);
  }

  private isSupportedPdf(file: File): boolean {
    const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
    const hasSupportedMediaType = !file.type || file.type === 'application/pdf';
    const hasSupportedSize = file.size > 0 && file.size <= MAX_PDF_SIZE_BYTES;

    return hasPdfExtension && hasSupportedMediaType && hasSupportedSize;
  }
}
