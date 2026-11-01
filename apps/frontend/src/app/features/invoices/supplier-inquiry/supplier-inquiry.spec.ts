import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { ReconciliationRead } from '../../../core/api/schema';
import { SupplierInquiry } from './supplier-inquiry';

describe('SupplierInquiry', () => {
  let fixture: ComponentFixture<SupplierInquiry>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplierInquiry],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(SupplierInquiry);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('invoiceId', 'INV-2026-1042');
    fixture.componentRef.setInput('record', { isCurrent: true, revision: 1 } as ReconciliationRead);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('allows editing and copying an explicitly unsent draft', async () => {
    // Arrange
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    // Act
    element.querySelector('button')!.click();
    TestBed.tick();
    const request = http.expectOne('/api/v1/invoices/INV-2026-1042/supplier-inquiry-drafts');
    request.flush({
      subject: 'Question',
      body: 'Please clarify',
      generationMode: 'demo',
      draftOnly: true,
      requiresHumanReview: true,
      evidenceRefs: [],
      provider: 'demo',
      promptVersion: 'v1',
    });
    await fixture.whenStable();
    const message = element.querySelector('textarea')!;
    message.value = 'Edited message';
    message.dispatchEvent(new Event('input'));
    [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Copy'))!
      .click();
    await fixture.whenStable();

    // Assert
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reconciliationRevision: 1, style: 'neutral' });
    expect(writeText).toHaveBeenCalledWith('Question\n\nEdited message');
    expect(element.textContent).toContain('Not sent');
    expect(element.textContent).toContain('Copied');
  });

  it('shows a retryable error when the draft request fails', async () => {
    // Arrange
    const button = element.querySelector('button')!;

    // Act
    button.click();
    TestBed.tick();
    http
      .expectOne('/api/v1/invoices/INV-2026-1042/supplier-inquiry-drafts')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Assert
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('unavailable');
    expect(button.disabled).toBe(false);
  });

  it.each([
    {
      name: 'clipboard access is denied',
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    },
    { name: 'clipboard is unavailable', clipboard: undefined },
  ])('offers manual copying when $name', async ({ clipboard }) => {
    // Arrange
    vi.stubGlobal('navigator', { clipboard });
    element.querySelector('button')!.click();
    TestBed.tick();
    http.expectOne('/api/v1/invoices/INV-2026-1042/supplier-inquiry-drafts').flush({
      subject: 'Question',
      body: 'Please clarify',
      generationMode: 'demo',
      draftOnly: true,
      requiresHumanReview: true,
      evidenceRefs: [],
      provider: 'demo',
      promptVersion: 'v1',
    });
    await fixture.whenStable();

    // Act
    [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Copy'))!
      .click();
    await fixture.whenStable();

    // Assert
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'copy the subject and message manually',
    );
    expect(element.textContent).not.toContain('Copied');
    expect(element.querySelector('textarea')?.value).toBe('Please clarify');
  });

  it('cancels the old request when the invoice changes', async () => {
    // Arrange
    element.querySelector('button')!.click();
    TestBed.tick();
    const request = http.expectOne('/api/v1/invoices/INV-2026-1042/supplier-inquiry-drafts');

    // Act
    fixture.componentRef.setInput('invoiceId', 'INV-2026-1041');
    fixture.componentRef.setInput('record', null);
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();

    // Assert
    expect(request.cancelled).toBe(true);
    expect(element.querySelector('textarea')).toBeNull();
  });
});
