import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const checker = path.resolve('scripts/check-angular-architecture.mjs');
const base = mkdtempSync(path.join(os.tmpdir(), 'invoiceai-architecture-'));
const componentDirectory = path.join(base, 'src/app/example');
const componentFile = path.join(componentDirectory, 'example.ts');
const templateFile = path.join(componentDirectory, 'example.html');
const styleFile = path.join(componentDirectory, 'example.scss');
const specFile = path.join(componentDirectory, 'example.spec.ts');
const config = JSON.parse(readFileSync('angular.json', 'utf8'));
mkdirSync(componentDirectory, { recursive: true });
writeFileSync(path.join(base, 'angular.json'), JSON.stringify(config));
const validSource =
  "import { Component, ChangeDetectionStrategy } from '@angular/core';\n@Component({selector:'app-example',templateUrl:'./example.html',styleUrl:'./example.scss',changeDetection:ChangeDetectionStrategy.OnPush}) export class Example {}";
writeFileSync(componentFile, validSource);
writeFileSync(templateFile, '<p>Example</p>');
writeFileSync(styleFile, 'p { color: black; }');
writeFileSync(specFile, "it('renders a value', () => { expect(true).toBe(true); });");
const rootComponentFile = path.join(base, 'src/app/app.ts');
const rootSource = validSource.replaceAll('example', 'app');
writeFileSync(rootComponentFile, rootSource);
writeFileSync(path.join(base, 'src/app/app.html'), '<p>App</p>');
writeFileSync(path.join(base, 'src/app/app.scss'), 'p { color: black; }');
writeFileSync(
  path.join(base, 'src/app/app.spec.ts'),
  "it('renders', () => { expect(true).toBe(true); });",
);
const run = () => spawnSync(process.execPath, [checker, base], { encoding: 'utf8' });
after(() => rmSync(base, { recursive: true, force: true }));
test('accepts a root component directly in src/app alongside a component in its own folder', () =>
  assert.equal(run().status, 0));
test('still checks external styles on the root component', () => {
  writeFileSync(
    rootComponentFile,
    rootSource.replace("styleUrl:'./app.scss'", "styleUrl:'./missing.scss'"),
  );
  assert.match(run().stderr, /app\.ts: styleUrl/);
  writeFileSync(rootComponentFile, rootSource);
});
test('rejects inline templates', () => {
  writeFileSync(
    componentFile,
    validSource.replace("templateUrl:'./example.html'", "template:'<p>Example</p>'"),
  );
  assert.match(run().stderr, /inline template\/styles/);
  writeFileSync(componentFile, validSource);
});
test('rejects missing OnPush', () => {
  writeFileSync(
    componentFile,
    validSource.replace('changeDetection:ChangeDetectionStrategy.OnPush', ''),
  );
  assert.match(run().stderr, /OnPush/);
  writeFileSync(componentFile, validSource);
});
test('rejects missing colocated tests', () => {
  rmSync(specFile);
  assert.match(run().stderr, /colocated unit test/);
  writeFileSync(specFile, "it('renders a value', () => { expect(true).toBe(true); });");
});
test('accepts parameterized tests with assertions', () => {
  writeFileSync(specFile, "it.each([[1]])('renders %s', (value) => { expect(value).toBe(1); });");
  assert.equal(run().status, 0);
  writeFileSync(specFile, "it('renders a value', () => { expect(true).toBe(true); });");
});
test('rejects tests without an assertion', () => {
  writeFileSync(specFile, "it('creates', () => {});");
  assert.match(run().stderr, /colocated unit test/);
  writeFileSync(specFile, "it('renders a value', () => { expect(true).toBe(true); });");
});
test('rejects components outside a dedicated folder', () => {
  const misplaced = path.join(base, 'src/app/example.ts');
  renameSync(componentFile, misplaced);
  assert.match(run().stderr, /matching directory/);
  renameSync(misplaced, componentFile);
});
test('rejects missing external styles', () => {
  rmSync(styleFile);
  assert.match(run().stderr, /styleUrl/);
  writeFileSync(styleFile, 'p { color: black; }');
});
test('rejects incorrect CLI schematics', () => {
  const invalid = structuredClone(config);
  invalid.projects.invoiceai.schematics['@schematics/angular:component'].flat = true;
  writeFileSync(path.join(base, 'angular.json'), JSON.stringify(invalid));
  assert.match(run().stderr, /schematic flat/);
  writeFileSync(path.join(base, 'angular.json'), JSON.stringify(config));
});
test('rejects widget internals in the Overview page', () => {
  const page = path.join(base, 'src/app/features/overview/overview-page');
  mkdirSync(page, { recursive: true });
  const template = path.join(page, 'overview-page.html');
  writeFileSync(
    template,
    '<table></table><app-overview-kpis/><app-processing-volume-chart/><app-invoice-status-chart/><app-recent-invoices-table/><app-attention-queue/>',
  );
  assert.match(run().stderr, /compose widgets/);
});
