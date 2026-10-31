import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OVERVIEW_DEMO_DATA } from '../overview-demo.data';
import { RecentInvoicesTable } from './recent-invoices-table';

describe('RecentInvoicesTable', () => {
  it('should render canonical amount and only links the featured demo invoice', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [RecentInvoicesTable],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(RecentInvoicesTable);
    fixture.componentRef.setInput('invoices', OVERVIEW_DEMO_DATA.recentInvoices);
    fixture.componentRef.setInput('featuredInvoiceId', OVERVIEW_DEMO_DATA.invoice.id);
    fixture.componentRef.setInput('invoiceLink', ['/invoices', OVERVIEW_DEMO_DATA.invoice.id]);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelectorAll<HTMLTableRowElement>('tbody tr')).toHaveLength(4);
    const rows = Array.from(view.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    const featured = rows.find((row) => row.cells[0]?.textContent?.trim() === 'INV-2026-1042');
    expect(featured?.cells[3]?.textContent?.trim()).toBe('PLN12,915.00');
    expect(featured?.querySelector('a')?.getAttribute('href')).toBe('/invoices/INV-2026-1042');
    expect(rows.filter((row) => row !== featured).every((row) => !row.querySelector('a'))).toBe(
      true,
    );
  });
});
