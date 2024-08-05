const path = require('path');
const { transformFileSync } = require('@babel/core');
const consoleInsertPlugin = require('./plugins/console-insert-plugin');

const { code } = transformFileSync(path.join(__dirname, './sourceCode.js'), {
  plugins: [consoleInsertPlugin],
  parserOpts: {
    sourceType: 'unambiguous',
    plugins: ['jsx']
  }
})

console.log(code);
