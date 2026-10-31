import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IntakeApi } from '../data-access/intake-api';
import { UploadForm } from '../upload-form/upload-form';
@Component({
  selector: 'app-upload-page',
  imports: [UploadForm],
  templateUrl: './upload-page.html',
  styleUrl: './upload-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadPage {
  private readonly api = inject(IntakeApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly duplicate = signal('');
  protected upload(file: File, allowDuplicate = false) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.duplicate.set('');
    this.api
      .upload(file, allowDuplicate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          void this.router.navigate(['/intake', result.document_id]);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          if (
            error instanceof HttpErrorResponse &&
            error.error?.error?.code === 'duplicate_document'
          ) {
            this.duplicate.set(error.error.error.existing_document_id);
          }
          this.error.set(
            (error instanceof HttpErrorResponse && error.error?.error?.message) ||
              'Upload failed. Check the PDF and try again.',
          );
        },
      });
  }
}
