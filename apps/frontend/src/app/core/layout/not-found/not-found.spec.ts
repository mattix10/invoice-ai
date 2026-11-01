import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFound } from './not-found';

it('should explain an unknown page and offer the overview', async () => {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(NotFound);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Page not found');
  expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/overview');
});
