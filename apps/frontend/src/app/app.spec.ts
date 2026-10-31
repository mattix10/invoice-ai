import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('shared shell routing', () => {
  it.each([
    ['/', 'Overview'],
    ['/invoices/INV-2026-1042', 'Invoice workspace'],
    ['/invoices/INV-2026-1042/investigation', 'AI investigation'],
  ])('should display %s with its active navigation and a single shell', async (url, title) => {
    // Arrange
    const fixture = TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).createComponent(App);
    const router = TestBed.inject(Router);

    // Act
    await router.navigateByUrl(url);
    await fixture.whenStable();

    // Assert
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('app-sidebar')).toHaveLength(1);
    expect(element.querySelectorAll('app-topbar')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toContain(title);
    expect(element.querySelector('nav a[aria-current="page"]')?.textContent).toContain(title);
  });
});
