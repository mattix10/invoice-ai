// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const testBlockNames = new Set([
  'describe',
  'it',
  'test',
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',
]);
const testBlockSpacing = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: { spacing: 'Separate test blocks with a blank line.' },
  },
  create(context) {
    function isTestBlock(statement) {
      if (
        statement.type !== 'ExpressionStatement' ||
        statement.expression.type !== 'CallExpression'
      )
        return false;
      let callee = statement.expression.callee;
      while (callee.type === 'MemberExpression' || callee.type === 'CallExpression') {
        callee = callee.type === 'MemberExpression' ? callee.object : callee.callee;
      }
      return callee.type === 'Identifier' && testBlockNames.has(callee.name);
    }
    return {
      BlockStatement(node) {
        for (let i = 1; i < node.body.length; i++) {
          const previous = node.body[i - 1];
          const current = node.body[i];
          if (
            (!isTestBlock(previous) && !isTestBlock(current)) ||
            current.loc.start.line - previous.loc.end.line !== 1
          )
            continue;
          const between = context.sourceCode.text.slice(previous.range[1], current.range[0]);
          if (between.trim()) continue;
          context.report({
            node: current,
            messageId: 'spacing',
            fix: (fixer) => fixer.insertTextAfter(previous, '\n'),
          });
        }
      },
    };
  },
};

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      'lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: '*', next: 'method' },
            { blankLine: 'always', prev: 'method', next: '*' },
          ],
        },
      ],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'never', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    plugins: { local: { rules: { 'test-block-spacing': testBlockSpacing } } },
    rules: {
      'local/test-block-spacing': 'error',
      'lines-around-comment': ['error', { beforeLineComment: true, allowBlockStart: true }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
