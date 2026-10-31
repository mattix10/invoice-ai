import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEMO_INVOICE } from '../../invoices/invoice-demo.data';
import { OverviewPage } from './overview-page';

describe('OverviewPage', () => {
  it('should show dashboard sections and links for the featured invoice', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [OverviewPage],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(OverviewPage);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    const headings = Array.from(view.querySelectorAll('h1, h2'), (heading) =>
      heading.textContent?.trim(),
    );
    expect(headings).toEqual(
      expect.arrayContaining([
        'Overview',
        'Review queue',
        'Processing volume',
        'Invoice status',
        'Attention required',
      ]),
    );
    expect(view.querySelector(`a[href="/invoices/${DEMO_INVOICE.id}"]`)).toBeTruthy();
    expect(view.querySelector(`a[href="/invoices/${DEMO_INVOICE.id}/investigation"]`)).toBeTruthy();
  });
});
