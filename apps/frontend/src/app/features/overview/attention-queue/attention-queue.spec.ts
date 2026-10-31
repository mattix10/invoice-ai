import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OVERVIEW_DEMO_DATA } from '../overview-demo.data';
import { AttentionQueue } from './attention-queue';

describe('AttentionQueue', () => {
  async function create(mode: 'banner' | 'list'): Promise<ComponentFixture<AttentionQueue>> {
    await TestBed.configureTestingModule({
      imports: [AttentionQueue],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(AttentionQueue);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('invoice', OVERVIEW_DEMO_DATA.invoice);
    fixture.componentRef.setInput('differencePercent', OVERVIEW_DEMO_DATA.differencePercent);
    fixture.componentRef.setInput(
      'additionalReviewCount',
      OVERVIEW_DEMO_DATA.additionalReviewCount,
    );
    fixture.componentRef.setInput('investigationLink', [
      '/invoices',
      OVERVIEW_DEMO_DATA.invoice.id,
      'investigation',
    ]);

    return fixture;
  }

  it('should show the exact discrepancy and an investigation link in the warning', async () => {
    // Arrange
    const fixture = await create('banner');

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    const warning = view.querySelector('section[aria-label="Invoice requiring attention"]');
    expect(warning?.querySelector('p')?.textContent).toContain('615.00');
    expect(warning?.querySelector('p')?.textContent).toContain('5.0%');
    expect(warning?.querySelector('a')?.getAttribute('href')).toBe(
      '/invoices/INV-2026-1042/investigation',
    );
  });

  it('should show the remaining review count in the attention list', async () => {
    // Arrange
    const fixture = await create('list');

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    const entries = Array.from(view.querySelectorAll('section strong'));
    expect(
      entries.some((entry) => entry.textContent?.includes('7 more invoices await review')),
    ).toBe(true);
    const featured = entries.find((entry) => entry.textContent?.includes('INV-2026-1042'));
    expect(featured?.nextElementSibling?.textContent).toContain('615.00');
  });
});
