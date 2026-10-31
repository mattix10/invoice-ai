import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Placeholder } from './placeholder';

describe('Placeholder', () => {
  it('should render the title supplied by its route', async () => {
    // Arrange
    await TestBed.configureTestingModule({
      imports: [Placeholder],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { title: 'Invoice workspace' } } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Placeholder);

    // Act
    await fixture.whenStable();

    // Assert
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toBe(
      'Invoice workspace',
    );
  });
});
