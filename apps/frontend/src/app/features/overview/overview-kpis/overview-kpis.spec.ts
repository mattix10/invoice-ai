import { TestBed } from '@angular/core/testing';
import { OVERVIEW_DEMO_DATA } from '../overview-demo.data';
import { OverviewKpis } from './overview-kpis';

describe('OverviewKpis', () => {
  it.each([
    ['Awaiting review', '8'],
    ['Approved this month', '96'],
    ['Processed this month', '124'],
    ['Invoice value', '318\u00a0740,00\u00a0zł'],
  ])('should show the value %s: %s in its metric', async (label, expected) => {
    // Arrange
    const fixture = TestBed.createComponent(OverviewKpis);
    fixture.componentRef.setInput('kpis', OVERVIEW_DEMO_DATA.kpis);

    // Act
    await fixture.whenStable();

    // Assert
    const metrics = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('article'));
    const metric = metrics.find((item) => item.querySelector('h2')?.textContent?.includes(label));
    expect(metric?.querySelector('p')?.textContent?.trim()).toBe(expected);
  });

  it('should emphasize the metric for invoices awaiting review', async () => {
    // Arrange
    const fixture = TestBed.createComponent(OverviewKpis);
    fixture.componentRef.setInput('kpis', OVERVIEW_DEMO_DATA.kpis);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelectorAll('article')).toHaveLength(4);
    expect(view.querySelector('.emphasis h2')?.textContent).toContain('Awaiting review');
  });
});
