import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, type ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { InvestigationPage } from '../investigation-page/investigation-page';
import { InvestigationSession } from './investigation-session';

describe('InvestigationSession', () => {
  const invoiceId = 'INV-2026-1042';
  const latestUrl = `/api/v1/invoices/${invoiceId}/reconciliations/latest`;
  const record = {
    revision: 1,
    isCurrent: true,
    algorithmVersion: 'deterministic-v2',
    evidenceRefs: [],
    result: {
      invoiceId,
      lines: [],
      inputs: { purchaseOrder: 'PO-1', currency: 'PLN', deliveryReceiptId: null },
      invoiceTotals: { gross: '123.00' },
      poTotals: { gross: '110.70' },
      difference: { net: '10.00', vat: '2.30', gross: '12.30' },
    },
  };

  function setup(): {
    fixture: ComponentFixture<InvestigationPage>;
    http: HttpTestingController;
    query: BehaviorSubject<ParamMap>;
  } {
    const query = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ id: invoiceId })),
            queryParamMap: query,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvestigationPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    return { fixture, http, query };
  }

  it('cancels pending evidence and answer requests when the revision changes', async () => {
    // Arrange
    const { fixture, http, query } = setup();
    const pendingEvidence = http.expectOne(latestUrl);

    // Act
    fixture.debugElement.injector.get(InvestigationSession).ask('Explain this discrepancy');
    const pendingAnswer = http.expectOne('/api/v1/copilot/queries');

    query.next(convertToParamMap({ revision: '2' }));

    // Assert
    expect(pendingEvidence.cancelled).toBe(true);
    expect(pendingAnswer.cancelled).toBe(true);

    // Act
    http
      .expectOne(`/api/v1/invoices/${invoiceId}/reconciliations/2`)
      .flush({ ...record, revision: 2, isCurrent: false });
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('Historical snapshot');
    expect(fixture.nativeElement.textContent).not.toContain('Investigating');
    expect(fixture.nativeElement.querySelector('.bubble.user')).toBeNull();
    http.verify({ ignoreCancelled: true });
  });

  it('disables questions when the latest reconciliation is historical', async () => {
    // Arrange
    const { fixture, http } = setup();

    // Act
    http.expectOne(latestUrl).flush({ ...record, isCurrent: false });
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;

    // Assert
    expect(element.querySelector<HTMLTextAreaElement>('textarea')?.disabled).toBe(true);
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(element.textContent).toContain('Questions use current evidence');
    http.expectNone('/api/v1/copilot/queries');
    http.verify();
  });

  it('retries loading evidence and displays the recovered reconciliation', async () => {
    // Arrange
    const { fixture, http } = setup();

    // Act
    http.expectOne(latestUrl).flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('Evidence unavailable');

    const retry = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'Retry');

    // Act
    retry!.click();
    http.expectOne(latestUrl).flush(record);
    await fixture.whenStable();

    // Assert
    expect(fixture.nativeElement.textContent).not.toContain('Evidence unavailable');
    expect(fixture.nativeElement.textContent).toContain('PLN12.30');
    http.verify();
  });
});
