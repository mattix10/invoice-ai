import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CopilotAnswerView } from './copilot-answer';

describe('CopilotAnswerView', () => {
  it('shows an answer and makes missing sources explicit', () => {
    TestBed.configureTestingModule({
      imports: [CopilotAnswerView],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(CopilotAnswerView);
    fixture.componentRef.setInput('response', {
      answer: 'Review this difference',
      generationMode: 'demo',
      incompleteContext: false,
      unavailableReason: null,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Review this difference');
    expect(fixture.nativeElement.textContent).toContain('No sources were supplied');
  });
});
