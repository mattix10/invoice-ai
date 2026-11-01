import { TestBed } from '@angular/core/testing';
import { IntakeStepper } from './intake-stepper';

describe('IntakeStepper', () => {
  it('marks the current step and updates it when the input changes', async () => {
    const fixture = TestBed.createComponent(IntakeStepper);
    fixture.componentRef.setInput('step', 2);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[aria-current="step"]').textContent).toContain(
      'Review fields',
    );
    fixture.componentRef.setInput('step', 3);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[aria-current="step"]').textContent).toContain(
      'Line items',
    );
  });
});
