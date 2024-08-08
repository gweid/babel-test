const fs = require('fs');
const path = require('path');
const { transformFromAstSync } = require('@babel/core');
const parser = require('@babel/parser');
const AutoTrackPlugin = require('./plugins/auto-track-plugin');

const sourceCode = fs.readFileSync(path.join(__dirname, './sourceCode.js'), 'utf-8');

const ast = parser.parse(sourceCode, {
  sourceType: 'unambiguous'
});

const code = transformFromAstSync(ast, sourceCode, {
  plugins: [[AutoTrackPlugin, {
    trackerPath: 'tracker'
  }]]
});

console.log(code);