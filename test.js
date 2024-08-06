const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const types = require('@babel/types');

const sourceCode = `const a = 1;`;

const ast = parser.parse(sourceCode, {
  sourceType: 'unambiguous'
})

traverse(ast, {
  VariableDeclaration(path, state) {
    const binding = path.scope.bindings
    console.log(binding);
  }
})