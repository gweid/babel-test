const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const types = require('@babel/types');

const sourceCode = `
  console.log('调试-1')

  function func() {
    console.info('调试-2')
  }

  export default class TestClass {
    say() {
      console.debug('调试-3');
    }

    render() {
      return <div>{console.error('调试-4')}</div>
    }
  }
`;

// 1、将代码解析成 ast
const ast = parser.parse(sourceCode, {
  sourceType: 'unambiguous',
  plugins: ['jsx']
});

const calleeNameArr = ['log', 'info', 'error', 'debug'].map(item => `console.${item}`)

// 2、遍历转换
traverse(ast, {
  CallExpression(path, state) {
    const calleeName = path.get('callee').toString()

    if (calleeNameArr.includes(calleeName)) {
      // 获取代码行数
      const { line, column } = path.node.loc.start

      // 往原来调用前面插入参数
      path.node.arguments.unshift(types.stringLiteral(`index.js: (${line}, ${column})`))
    }
  }
})

// 3、将转换后的代码重新生成
const { code, map } = generator(ast);

console.log(code);
