import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
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
  protected readonly file = signal<File | null>(null);
  protected readonly validation = signal('');
  protected select(event: Event) {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
    this.validation.set('');
    this.selectionChanged.emit();
  }
  protected duplicateSubmit() {
    const file = this.file();
    if (file) this.uploadDuplicate.emit(file);
  }
  protected submit() {
    const file = this.file();
    if (
      !file ||
      !file.name.toLowerCase().endsWith('.pdf') ||
      (file.type && file.type !== 'application/pdf') ||
      file.size === 0 ||
      file.size > 10 * 1024 * 1024
    ) {
      this.validation.set('Select a non-empty PDF no larger than 10 MiB.');
      return;
    }
    this.validation.set('');
    this.upload.emit(file);
  }
}
