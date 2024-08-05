const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const types = require('@babel/types');
const template = require('@babel/template').default;


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

const calleeNameArr = ['log', 'info', 'error', 'debug'].map(item => `console.${item}`);

// 2、遍历转换
traverse(ast, {
  CallExpression(path, state) {
    if (path.node.isNew) {
      return;
    }

    const calleeName = path.get('callee').toString();

    if (calleeNameArr.includes(calleeName)) {
      // 获取代码行数
      const { line, column } = path.node.loc.start;

      // 新代码
      const newNode = template.expression(`console.log("index.js: (${line}, ${column})")`)();
      newNode.isNew = true; // 进行标记，新插入代码，不需要遍历修改

      if (path.findParent(path => path.isJSXElement())) {
        // 如果是 jsx 模式
        path.replaceWith(types.arrayExpression([newNode, path.node]));
        path.skip();
      } else {
        // 其它，直接往前面插入即可
        path.insertBefore(newNode);
      }
    }
  }
})

// 3、将转换后的代码重新生成
const { code, map } = generator(ast);

console.log(code);