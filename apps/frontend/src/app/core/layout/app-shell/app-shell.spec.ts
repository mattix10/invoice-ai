import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('should render one shared sidebar, topbar, and route outlet', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppShell);

    // Act
    await fixture.whenStable();

    // Assert
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelectorAll('app-sidebar')).toHaveLength(1);
    expect(view.querySelectorAll('app-topbar')).toHaveLength(1);
    expect(view.querySelector('main router-outlet')).toBeTruthy();
  });
});
