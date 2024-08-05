## 插入函数调用参数




### 功能描述

开发过程中，经常需要打印一些日志来辅助调试，但是有的时候会不知道日志是在哪个地方打印的。希望通过 babel 能够自动在 console.log 等 api 中插入文件名和行列号的参数，方便定位到代码。

也就是把

```js
console.log('调试');
```

转换成

```js
console.log('文件名（行号，列号）：', '调试');
```



#### 代码实现

```js
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

// 2、遍历转换
traverse(ast, {
  CallExpression(path, state) {
    const callee = path.node.callee

    if (types.isMemberExpression(callee)
      && callee.object.name === 'console'
      && ['log', 'info', 'error', 'debug'].includes(callee.property.name)
    ) {
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

```



#### 优化版本

上面的 if 判断的条件写的太长了，可以简化一下，比如把 callee 的 AST 打印成字符串，然后再去判断

path 有一个 toString 的 api，就是把 AST 打印成代码输出的。所以优化后代码：

```js
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

const targetCalleeName = ['log', 'info', 'error', 'debug'].map(item => `console.${item}`)

// 2、遍历转换
traverse(ast, {
  CallExpression(path, state) {
    const calleeName = path.get('callee').toString()

    if (targetCalleeName.includes(calleeName)) {
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

```



### 功能变更

后来觉得在同一行打印会影响原本的参数的展示，所以想改为在 console.xx 节点之前打印的方式

比如原来是：

```js
console.log('文件名（行号，列号）：', '调试');
```

现在要改为：

```js
console.log('文件名（行号，列号）：');
console.log('调试');
```



#### 代码实现

这里的改造点：

- JSX 中的 console 代码不能简单的在前面插入一个节点，而要把整体替换成一个数组表达式，因为 JSX 中只支持写单个表达式。

  ```jsx
  <div>{console.log(111)}</div>
  
  
  // 也就是上面的，要换成下面这种形式，才能执行
  <div>{[console.log('filename.js(11,22)'), console.log(111)]}</div>
  ```

- 用新的节点替换了旧的节点之后或者插入的节点也是 console.log，这是没必要处理的，所以要跳过新生成的节点的处理。



```js
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
```

- 这里需要插入 AST，会用到 path.insertBefore 的 api。

- 也需要替换整体的 AST，会用到 path.replaceWith 的 api。

- 然后还要判断要替换的节点是否在 JSXElement 下，所以要用 findParent 的 api 顺着 path 查找是否有 JSXElement 节点。

- 还有，replace 后，要调用 path.skip 跳过新节点的遍历。对于插入的新节点要跳过，可以在节点上加一个标记，如果有这个标记的就跳过



### 封装成 babel 插件



#### 封装插件代码

```js
const paramInsertPlugin = ({ types, template }) => {
  const calleeNameArr = ['log', 'info', 'error', 'debug'].map(item => `console.${item}`);

  return {
    visitor: {
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
    }
  }
}

module.exports = paramInsertPlugin;

```

这里，插件函数的第一个参数，可以拿到 types、template 等常用包的 api，这样，就不需要通过引入的方式了，而是可以直接解构第一个参数



#### 使用插件

```js
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
```