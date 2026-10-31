import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OVERVIEW_DEMO_DATA } from '../overview-demo.data';
import { RecentInvoicesTable } from './recent-invoices-table';

describe('RecentInvoicesTable', () => {
  it('should render canonical amount and link every invoice', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [RecentInvoicesTable],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(RecentInvoicesTable);
    fixture.componentRef.setInput('invoices', OVERVIEW_DEMO_DATA.recentInvoices);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelectorAll<HTMLTableRowElement>('tbody tr')).toHaveLength(4);
    const rows = Array.from(view.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    const featured = rows.find((row) => row.cells[0]?.textContent?.trim() === 'INV-2026-1042');
    expect(featured?.cells[3]?.textContent?.trim()).toBe('PLN12,915.00');
    expect(featured?.querySelector('a')?.getAttribute('href')).toBe('/invoices/INV-2026-1042');
    expect(
      rows.every(
        (row) =>
          row.querySelector('a')?.getAttribute('href') ===
          '/invoices/' + row.cells[0]?.textContent?.trim(),
      ),
    ).toBe(true);
  });
});
