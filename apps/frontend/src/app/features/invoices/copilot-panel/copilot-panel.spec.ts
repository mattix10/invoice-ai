import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CopilotPanel } from './copilot-panel';

describe('CopilotPanel', () => {
  it('renders answer as text and sends a suggested question', async () => {
    TestBed.configureTestingModule({ imports: [CopilotPanel], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CopilotPanel);
    fixture.componentRef.setInput('answer', {
      answer: '<img src=x onerror=alert(1)>',
      citations: [],
      findings: [],
      suggestedQuestions: [],
      generationMode: 'demo',
      provider: 'demo',
      model: null,
      promptVersion: 'demo-v1',
      incompleteContext: false,
      humanReviewRequired: true,
      unavailableReason: null,
    });
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('Demo');
    expect(element.textContent).toContain('No sources were supplied');
    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Explain this discrepancy'))
      ?.click();
    expect(submitted).toHaveBeenCalledWith('Explain this discrepancy');
    await fixture.whenStable();
  });

  it('shows live mode and makes supplied follow-up questions actionable', () => {
    TestBed.configureTestingModule({ imports: [CopilotPanel], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CopilotPanel);
    fixture.componentRef.setInput('answer', {
      answer: '',
      citations: [],
      findings: [],
      suggestedQuestions: ['Explain the difference'],
      generationMode: 'live',
      provider: 'cloudflare',
      model: 'model',
      promptVersion: 'v1',
      incompleteContext: false,
      humanReviewRequired: true,
      unavailableReason: null,
    });
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Live');
    expect(element.textContent).toContain('No answer was returned');
    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Explain the difference')
      ?.click();
    expect(submitted).toHaveBeenCalledWith('Explain the difference');
  });

  it('renders a verified source destination and leaves unsupported sources as text', () => {
    TestBed.configureTestingModule({ imports: [CopilotPanel], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CopilotPanel);
    fixture.componentRef.setInput('answer', {
      answer: 'Evidence',
      citations: [],
      findings: [],
      suggestedQuestions: [],
      generationMode: 'demo',
      provider: 'demo',
      model: null,
      promptVersion: 'v1',
      incompleteContext: false,
      humanReviewRequired: true,
      unavailableReason: null,
    });
    const reference = {
      kind: 'reconciliation',
      invoiceId: 'INV-2026-1042',
      reconciliationRevision: 2,
      linePosition: null,
      evidenceId: 'invoice:INV-2026-1042:reconciliation:2',
      label: 'Reconciliation',
    };
    fixture.componentRef.setInput('sources', [
      {
        reference,
        commands: ['/invoices', 'INV-2026-1042', 'investigation'],
        queryParams: { revision: 2 },
        fragment: 'reconciliation',
        historical: true,
      },
      { reference: { ...reference, label: 'Unverified' }, commands: null, historical: false },
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/invoices/INV-2026-1042/investigation?revision=2#reconciliation',
    );
    expect(element.querySelectorAll('a')).toHaveLength(1);
    expect(element.textContent).toContain('Unverified (link unavailable)');
    expect(element.textContent).toContain('Historical');
  });
});
