import { TestBed } from '@angular/core/testing';
import { OVERVIEW_DEMO_DATA } from '../overview-demo.data';
import { ProcessingVolumeChart } from './processing-volume-chart';

describe('ProcessingVolumeChart', () => {
  it('should display the latest period and an accessible description of the synthetic chart', async () => {
    // Arrange
    const fixture = TestBed.createComponent(ProcessingVolumeChart);
    fixture.componentRef.setInput('volume', OVERVIEW_DEMO_DATA.processingVolume);
    fixture.componentRef.setInput('chartLabel', OVERVIEW_DEMO_DATA.processingVolumeLabel);
    fixture.componentRef.setInput('note', OVERVIEW_DEMO_DATA.processingVolumeNote);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.textContent).toContain('Oct 2026');
    expect(view.querySelector('[role=img]')?.getAttribute('aria-label')).toContain('Oct 124');
  });
});
