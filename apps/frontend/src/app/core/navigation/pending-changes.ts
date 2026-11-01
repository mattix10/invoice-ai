import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

export interface EditablePage {
  hasPendingChanges(): boolean;
}

export const confirmPendingChanges: CanDeactivateFn<EditablePage> = (component) =>
  !component.hasPendingChanges() ||
  inject(DOCUMENT).defaultView?.confirm(
    'You have unsaved changes or a save in progress. Leave this page and discard local changes?',
  ) === true;

export function protectPendingChanges(hasChanges: () => boolean): void {
  const browser = inject(DOCUMENT).defaultView;
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    if (!hasChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  };
  browser?.addEventListener('beforeunload', beforeUnload);
  inject(DestroyRef).onDestroy(() => browser?.removeEventListener('beforeunload', beforeUnload));
}
