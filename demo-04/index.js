const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { transformFromAstSync } = require('@babel/core');
const autoDocsPlugin = require('./plugins/auto-docs-plugin');

const sourceCode = fs.readFileSync(path.join(__dirname, './sourceCode.ts'), 'utf-8');

const ast = parser.parse(sourceCode, {
  sourceType: 'unambiguous',
  plugins: ['typescript']
});

const { code } = transformFromAstSync(ast, sourceCode, {
  plugins: [[autoDocsPlugin, {
    outputDir: path.resolve(__dirname, './docs'),
    format: 'markdown'// html | json
  }]]
});

console.log(code);
