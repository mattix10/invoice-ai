import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEMO_INVOICE } from '../invoice-demo.data';
import { InvoiceWorkspacePage } from './invoice-workspace-page';

describe('InvoiceWorkspacePage', () => {
  it('should link to the featured invoice investigation', async () => {
    // Arrange
    TestBed.configureTestingModule({
      imports: [InvoiceWorkspacePage],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(InvoiceWorkspacePage);

    // Act
    await fixture.whenStable();

    // Assert
    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).find(
      (element) => element.textContent?.trim() === 'Investigate with AI',
    );
    expect(link?.getAttribute('href')).toBe('/invoices/INV-2026-1042/investigation');
  });

  it.each(['Save', 'Export', 'Request clarification'])(
    'should disable the unavailable %s action',
    async (label) => {
      // Arrange
      TestBed.configureTestingModule({
        imports: [InvoiceWorkspacePage],
        providers: [provideRouter([])],
      });
      const fixture = TestBed.createComponent(InvoiceWorkspacePage);

      // Act
      await fixture.whenStable();

      // Assert
      const button = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      ).find((element) => element.textContent?.trim() === label);
      expect(button?.disabled).toBe(true);
    },
  );

  it('should reconcile invoice and purchase order amounts in minor units', () => {
    // Arrange
    const invoice = DEMO_INVOICE;

    // Act
    const invoiceNet = invoice.items.reduce(
      (sum, item) => sum + item.quantity * item.invoiceUnitNetGrosz,
      0,
    );
    const poNet = invoice.items.reduce((sum, item) => sum + item.quantity * item.poUnitNetGrosz, 0);
    const netDifference = invoice.invoiceNetGrosz - invoice.poNetGrosz;
    const vatDifference = invoice.invoiceVatGrosz - invoice.poVatGrosz;
    const grossDifference = invoice.invoiceGrossGrosz - invoice.poGrossGrosz;

    // Assert
    expect(invoiceNet).toBe(1050000);
    expect(invoice.poNetGrosz).toBe(1000000);
    expect(invoiceNet).toBe(invoice.invoiceNetGrosz);
    expect(poNet).toBe(invoice.poNetGrosz);
    expect(netDifference).toBe(50000);
    expect(netDifference).toBe(invoice.differenceNetGrosz);
    expect(vatDifference).toBe(11500);
    expect(vatDifference).toBe(invoice.differenceVatGrosz);
    expect(grossDifference).toBe(61500);
    expect(grossDifference).toBe(invoice.differenceGrossGrosz);
    expect(invoice.differenceNetGrosz + invoice.differenceVatGrosz).toBe(
      invoice.differenceGrossGrosz,
    );
  });

  it('should attribute the variance to monitor prices and express it as 5 percent of the PO', () => {
    // Arrange
    const invoice = DEMO_INVOICE;
    const monitor = invoice.items[0];

    // Act
    const monitorDifference =
      monitor.quantity * (monitor.invoiceUnitNetGrosz - monitor.poUnitNetGrosz);
    const percent = (invoice.differenceGrossGrosz / invoice.poGrossGrosz) * 100;

    // Assert
    expect(monitorDifference).toBe(50000);
    expect(percent).toBe(5);
  });
});
