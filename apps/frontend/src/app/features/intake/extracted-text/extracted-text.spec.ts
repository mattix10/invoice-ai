import { TestBed } from '@angular/core/testing';
import { ExtractedText } from './extracted-text';

describe('ExtractedText', () => {
  it('shows page provenance and text without interpreting markup', async () => {
    const fixture = TestBed.createComponent(ExtractedText);
    fixture.componentRef.setInput('extraction', {
      documentId: 'doc-1',
      version: 1,
      status: 'completed',
      pages: [
        {
          documentId: 'doc-1',
          pageNumber: 1,
          extractionMethod: 'ocr',
          extractionVersion: 1,
          text: '<script>example</script>',
        },
      ],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Page 1 · ocr · version 1');
    expect(fixture.nativeElement.querySelector('pre').textContent).toBe('<script>example</script>');
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
  });

  it('disables processing actions and displays an unavailable message', async () => {
    const fixture = TestBed.createComponent(ExtractedText);
    fixture.componentRef.setInput('busy', true);
    fixture.componentRef.setInput('error', 'Text is unavailable.');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Text is unavailable.',
    );
  });
});
