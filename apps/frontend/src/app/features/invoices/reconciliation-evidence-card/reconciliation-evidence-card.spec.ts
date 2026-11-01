import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReconciliationEvidenceCard } from './reconciliation-evidence-card';

describe('ReconciliationEvidenceCard', () => {
  it('offers the invoice workspace and retry when evidence is unavailable', () => {
    // Arrange
    TestBed.configureTestingModule({
      imports: [ReconciliationEvidenceCard],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ReconciliationEvidenceCard);
    fixture.componentRef.setInput('invoiceId', 'INV-1');
    fixture.componentRef.setInput('state', 'error');
    let retries = 0;

    // Act
    fixture.componentInstance.retry.subscribe(() => retries++);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    // Assert
    expect(element.textContent).toContain('Evidence unavailable');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/invoices/INV-1');

    // Act
    element.querySelector('button')?.click();

    // Assert
    expect(retries).toBe(1);
  });
});
