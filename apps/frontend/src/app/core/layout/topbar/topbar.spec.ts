import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Topbar } from './topbar';

describe('Topbar', () => {
  it('should update its breadcrumb when navigation reaches investigation', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [Topbar],
      providers: [
        provideRouter([
          { path: 'invoices/:id/investigation', component: Topbar, title: 'AI investigation' },
        ]),
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Topbar);

    // Act
    await router.navigateByUrl('/invoices/INV-2026-1042/investigation');

    await fixture.whenStable();

    // Assert
    expect((fixture.nativeElement as HTMLElement).querySelector('.crumb strong')?.textContent).toBe(
      'AI investigation',
    );
  });
});
