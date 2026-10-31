import { execFileSync } from 'node:child_process';
import path from 'node:path';
import * as prettier from 'prettier';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const names = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
let failed = false;
for (const name of names) {
  const filename = path.join(root, name);
  const info = await prettier.getFileInfo(filename, {
    ignorePath: [
      path.join(root, '.prettierignore'),
      path.join(root, 'apps/frontend/.prettierignore'),
    ],
  });
  if (info.ignored || !info.inferredParser) continue;
  const content = execFileSync('git', ['show', `:${name}`], { cwd: root, encoding: 'utf8' });
  const config = await prettier.resolveConfig(filename);
  if (!(await prettier.check(content, { ...config, filepath: filename }))) {
    console.error(`Prettier: ${name} is not formatted in the index.`);
    failed = true;
  }
}
if (failed) {
  console.error('Run Prettier on the listed files and stage the formatted changes.');
  process.exitCode = 1;
}
