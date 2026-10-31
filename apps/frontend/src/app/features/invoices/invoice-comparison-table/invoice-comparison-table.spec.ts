import { TestBed } from '@angular/core/testing';
import { InvoiceComparisonTable } from './invoice-comparison-table';

describe('InvoiceComparisonTable', () => {
  it('should retain headings without data rows when rows are empty', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceComparisonTable);
    fixture.componentRef.setInput('label', 'Empty comparison');
    fixture.componentRef.setInput('headers', ['Item', 'Amount']);
    fixture.componentRef.setInput('rows', []);

    // Act
    await fixture.whenStable();

    // Assert
    const table = (fixture.nativeElement as HTMLElement).querySelector('table');
    expect(table?.getAttribute('aria-label')).toBe('Empty comparison');
    expect(table?.querySelectorAll('th[scope="col"]')).toHaveLength(2);
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(0);
  });

  it('should replace displayed rows when the input changes', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceComparisonTable);
    fixture.componentRef.setInput('label', 'Example comparison');
    fixture.componentRef.setInput('headers', ['Item', 'Amount']);
    fixture.componentRef.setInput('rows', [['Monitor', 'PLN820.00']]);

    await fixture.whenStable();

    // Act
    fixture.componentRef.setInput('rows', [['Keyboard', 'PLN110.00']]);

    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelector('tbody')?.textContent).toContain('Keyboard');
    expect(view.querySelector('tbody')?.textContent).not.toContain('Monitor');
  });
});
