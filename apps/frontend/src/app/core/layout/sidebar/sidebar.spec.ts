import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  it('should mark the invoice workspace link active for the featured invoice', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideRouter([{ path: 'invoices/:id', component: Sidebar }])],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Sidebar);

    // Act
    await router.navigateByUrl('/invoices/INV-2026-1042');

    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelector('nav a[aria-current="page"]')?.textContent).toContain(
      'Invoice workspace',
    );
  });

  it('should show the InvoiceAI brand and navigation links', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Sidebar);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelector('a[aria-label="InvoiceAI overview"]')?.textContent).toContain(
      'InvoiceAI',
    );
    expect(view.querySelectorAll('nav a')).toHaveLength(3);
  });
});
