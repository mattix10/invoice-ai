import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(process.argv[2] ?? process.cwd());
const errors = [];
const configPath = path.join(root, 'angular.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
for (const [projectName, project] of Object.entries(config.projects ?? {})) {
  if (project.projectType !== 'application') continue;
  const schematic = project.schematics?.['@schematics/angular:component'] ?? {};
  const required = {
    standalone: true,
    flat: false,
    inlineTemplate: false,
    inlineStyle: false,
    style: 'scss',
    skipTests: false,
    changeDetection: 'OnPush',
  };
  for (const [key, expected] of Object.entries(required)) {
    if (schematic[key] !== expected)
      errors.push(`${projectName}: component schematic ${key} must be ${JSON.stringify(expected)}`);
  }
}

function visit(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) inspect(fullPath);
  }
}
function inspect(filename) {
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement)) continue;
    const decorator = ts
      .getDecorators(statement)
      ?.find(
        (item) =>
          ts.isCallExpression(item.expression) &&
          item.expression.expression.getText(source) === 'Component',
      );
    if (!decorator) continue;
    const metadata = decorator.expression.arguments[0];
    const name = path.basename(filename, '.ts');
    const relative = path.relative(root, filename).replaceAll('\\', '/');
    if (relative !== 'src/app/app.ts' && path.basename(path.dirname(filename)) !== name)
      errors.push(`${relative}: component must have its own matching directory`);
    if (!ts.isObjectLiteralExpression(metadata)) {
      errors.push(`${relative}: component metadata must be an object`);
      continue;
    }
    const fields = new Map(
      metadata.properties
        .filter(ts.isPropertyAssignment)
        .map((item) => [item.name.getText(source), item.initializer]),
    );
    if (fields.has('template') || fields.has('styles'))
      errors.push(`${relative}: inline template/styles are forbidden`);
    for (const [key, extension] of [
      ['templateUrl', 'html'],
      ['styleUrl', 'scss'],
    ]) {
      const value = fields.get(key);
      const expected = `./${name}.${extension}`;
      if (
        !value ||
        !ts.isStringLiteral(value) ||
        value.text !== expected ||
        !existsSync(path.join(path.dirname(filename), `${name}.${extension}`))
      ) {
        errors.push(`${relative}: ${key} must reference the colocated ${name}.${extension}`);
      }
    }
    if (fields.get('changeDetection')?.getText(source) !== 'ChangeDetectionStrategy.OnPush')
      errors.push(`${relative}: use OnPush change detection`);
    const spec = path.join(path.dirname(filename), `${name}.spec.ts`);
    if (
      !existsSync(spec) ||
      !/\b(?:it|test)(?:\s*\.\s*each)?\s*\(/.test(readFileSync(spec, 'utf8')) ||
      !/\b(?:expect|assert)\s*\(/.test(readFileSync(spec, 'utf8'))
    )
      errors.push(`${relative}: colocated unit test with assertions is required`);
  }
}
visit(path.join(root, 'src/app'));
const overviewTemplate = path.join(
  root,
  'src/app/features/overview/overview-page/overview-page.html',
);
if (existsSync(overviewTemplate)) {
  const html = readFileSync(overviewTemplate, 'utf8');
  if (/<(?:section|article|table|svg)\b|@for\s*\(/i.test(html))
    errors.push('overview-page: compose widgets instead of rendering widget internals');
  for (const selector of [
    'app-overview-kpis',
    'app-processing-volume-chart',
    'app-invoice-status-chart',
    'app-recent-invoices-table',
    'app-attention-queue',
  ]) {
    if (!html.includes(`<${selector}`)) errors.push(`overview-page: missing ${selector}`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log('Angular architecture check passed.');
}
