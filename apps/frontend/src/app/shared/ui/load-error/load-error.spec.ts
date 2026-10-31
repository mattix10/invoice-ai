import { TestBed } from '@angular/core/testing';
import { LoadError } from './load-error';

describe('LoadError', () => {
  it('shows the message and emits retry when the button is clicked', async () => {
    const fixture = TestBed.createComponent(LoadError);
    const retry = vi.fn();
    fixture.componentRef.setInput('message', 'Invoices could not be loaded.');
    fixture.componentInstance.retry.subscribe(retry);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Invoices could not be loaded.',
    );
    fixture.nativeElement.querySelector('button').click();
    expect(retry).toHaveBeenCalledOnce();
  });
});
