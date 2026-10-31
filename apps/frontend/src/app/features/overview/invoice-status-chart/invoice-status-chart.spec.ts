import { TestBed } from '@angular/core/testing';
import { OVERVIEW_DEMO_DATA } from '../overview-demo.data';
import { InvoiceStatusChart } from './invoice-status-chart';

describe('InvoiceStatusChart', () => {
  it('should describe all visible invoice statuses and counts accessibly', async () => {
    // Arrange
    const fixture = TestBed.createComponent(InvoiceStatusChart);
    fixture.componentRef.setInput('statuses', OVERVIEW_DEMO_DATA.invoiceStatuses);
    fixture.componentRef.setInput('chartLabel', OVERVIEW_DEMO_DATA.statusChartLabel);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    const chart = view.querySelector('[role="img"]');
    expect(chart?.getAttribute('aria-label')).toContain('2 needs review');
    expect(chart?.getAttribute('aria-label')).toContain('1 approved');
    expect(chart?.getAttribute('aria-label')).toContain('1 processing');
    expect(chart?.textContent).toContain('Needs review');
  });
});
