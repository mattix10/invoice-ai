import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Panel } from './panel';

@Component({
  imports: [Panel],
  template:
    '<app-panel><section aria-labelledby="panel-title"><h2 id="panel-title">Projected title</h2><p>Projected content</p></section></app-panel>',
})
class TestHost {}
describe('Panel', () => {
  it('should preserve the semantic section and projects its content', async () => {
    // Arrange
    const fixture = TestBed.createComponent(TestHost);

    // Act
    await fixture.whenStable();

    // Assert
    const section = (fixture.nativeElement as HTMLElement).querySelector('section');
    expect(section?.getAttribute('aria-labelledby')).toBe('panel-title');
    expect(section?.querySelector('h2')?.textContent).toBe('Projected title');
    expect(section?.querySelector('p')?.textContent).toBe('Projected content');
  });
});
