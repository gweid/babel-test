const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { transformFromAstSync } = require('@babel/core');
const autoI18nPlugin = require('./plugins/auto-i18n-plugin');

const sourceCode = fs.readFileSync(path.join(__dirname, './sourceCode.js'), 'utf-8');

const ast = parser.parse(sourceCode, {
  plugins: ['jsx'],
  sourceType: 'unambiguous'
});

const { code } = transformFromAstSync(ast, sourceCode, {
  plugins: [[autoI18nPlugin, {}]]
});

console.log(code);
