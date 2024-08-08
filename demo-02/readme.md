## 自动埋点



### 需求描述

埋点是一个常见的需求，比如在函数里面上报一些信息，如果每个函数，都手动引入，那么会很繁琐。

那么，此时可以进行自动埋点，在函数里面插入了一段代码，这段代码不影响其他逻辑，这种函数插入不影响逻辑的代码的手段叫做函数插桩。基于 babel 就可以实现自动的函数插桩。



比如：

```js
import aa from 'aa';
import * as bb from 'bb';
import { cc } from 'cc';
import 'dd';

function funcA() {
  console.log('funcA');
}

class BTest {
  funcB() {
    return 'funcB';
  }
}

const funcC = () => 'funC';

const funcD = function () {
  console.log('funD');
}
```

实现转换成

```js
import trackReport from "tracker";
import aa from 'aa';
import * as bb from 'bb';
import { cc } from 'cc';
import 'dd';

function funcA() {
  trackReport();
  console.log('funcA');
}

class BTest {
  funcB() {
    trackReport();
    return 'funcB';
  }
}

const funcC = () => {
  trackReport();
  return 'funC';
};

const funcD = function () {
  trackReport();
  console.log('funD');
}
```




### 代码实现

实现思路：

- 引入 tracker 模块。需要判断是否引入过，没有的话就引入，并且生成个唯一 id 作为标识符
- 对所有函数在函数体开始插入 tracker 的代码
  - 这里需要注意 `() => 'aa'` 这种形式



首先实现对 tracker 是否引入进行检测

```js
const { declare } = require('@babel/helper-plugin-utils');
const importModule = require('@babel/helper-module-imports');

const autoTrackPlugin = declare((api, options, dirname) => {
  const { template } = api;
  const { trackerPath } = options;

  return {
    visitor: {
      // 对根节点遍历一下，主要处理 import 引入，如果没有引入埋点模块，那么就先引入
      Program: {
        enter(path, state) {
          path.traverse({
            ImportDeclaration(curPath) {
              const moduleName = curPath.node.source.value;

              // 如果引入了 tracker 模块，就记录 id 到 state
              if (moduleName === trackerPath) {
                // 这一步，主要将引入的方法名，保存在 state.trackerImportId 中
                // 比如：import trackReport from "tracker"; 那么 state.trackerImportId 就是 trackReport
                const specifierPath = curPath.node.specifiers[0];
                if (specifierPath.type === 'ImportDefaultSpecifier') {
                  state.trackerImportId = specifierPath.toString();
                } else if(specifierPath.type === 'ImportNamespaceSpecifier') {
                  state.trackerImportId = specifierPath.get('local').toString();
                }
              }
            }
          });

          // 如果没有引入 tracker 模块，那么插入
          if (!state.trackerImportId) {
            const trackerModule = importModule.addDefault(path, 'tracker', {
              nameHint: path.scope.generateUid('trackReport')
            });

            state.trackerImportId = trackerModule.name;
            state.trackerAST = template.statement(`${state.trackerImportId}();`)();
          }
        }
      }
    }
  }
});

module.exports = autoTrackPlugin;
```



然后是实现 trackReport 插入

```js
const { declare } = require('@babel/helper-plugin-utils');
const importModule = require('@babel/helper-module-imports');

const autoTrackPlugin = declare((api, options, dirname) => {
  const { template } = api;
  const { trackerPath } = options;

  return {
    visitor: {
      // 这部分，在函数体内，插入上报函数
      'FunctionDeclaration|ClassMethod|ArrowFunctionExpression|FunctionExpression': {
        enter(path, state) {
          /**
           * path.get('body') 返回的是一个 NodePath 对象。NodePath 是 Babel 提供的一个封装对象，它不仅包含了 AST 节点本身，还包含了许多用于操作和遍历 AST 的方法和属性。
           * path.node.body 返回的是一个纯粹的 AST 节点对象。这个对象是一个普通的 JavaScript 对象，表示 AST 中的一个节点，但不包含 NodePath 提供的那些额外的方法和属性。
           */
          // const bodyPath = path.node.body;
          const bodyPath = path.get('body');

          if (bodyPath.type === 'BlockStatement') {
            bodyPath.node.body.unshift(state.trackerAST);
          } else {
            const ast = template.statement(`{${state.trackerImportId}();return PREV_BODY;}`)({ PREV_BODY: bodyPath.node });
            bodyPath.replaceWith(ast);
          }
        }
      }
    }
  }
});

module.exports = autoTrackPlugin;
```



完整代码：

```js
const { declare } = require('@babel/helper-plugin-utils');
const importModule = require('@babel/helper-module-imports');

const autoTrackPlugin = declare((api, options, dirname) => {
  const { template } = api;
  const { trackerPath } = options;

  return {
    visitor: {
      // 对根节点遍历一下，主要处理 import 引入，如果没有引入埋点模块，那么就先引入
      Program: {
        enter(path, state) {
          path.traverse({
            ImportDeclaration(curPath) {
              const moduleName = curPath.node.source.value;

              // 如果引入了 tracker 模块，就记录 id 到 state
              if (moduleName === trackerPath) {
                // 这一步，主要将引入的方法名，保存在 state.trackerImportId 中
                // 比如：import trackReport from "tracker"; 那么 state.trackerImportId 就是 trackReport
                const specifierPath = curPath.node.specifiers[0];
                if (specifierPath.type === 'ImportDefaultSpecifier') {
                  state.trackerImportId = specifierPath.toString();
                } else if(specifierPath.type === 'ImportNamespaceSpecifier') {
                  state.trackerImportId = specifierPath.get('local').toString();
                }
              }
            }
          });

          // 如果没有引入 tracker 模块，那么插入
          if (!state.trackerImportId) {
            const trackerModule = importModule.addDefault(path, 'tracker', {
              nameHint: path.scope.generateUid('trackReport')
            });

            state.trackerImportId = trackerModule.name;
            state.trackerAST = template.statement(`${state.trackerImportId}();`)();
          }
        }
      },
      // 这部分，在函数体内，插入上报函数
      'FunctionDeclaration|ClassMethod|ArrowFunctionExpression|FunctionExpression': {
        enter(path, state) {
          // const bodyPath = path.node.body;
          const bodyPath = path.get('body');

          if (bodyPath.type === 'BlockStatement') {
            bodyPath.node.body.unshift(state.trackerAST);
          } else {
            const ast = template.statement(`{${state.trackerImportId}();return PREV_BODY;}`)({ PREV_BODY: bodyPath.node });
            bodyPath.replaceWith(ast);
          }
        }
      }
    }
  }
});

module.exports = autoTrackPlugin;
```



这里需要注意下 ，下面两个的区别：

- path.node.body：返回的是一个纯粹的 AST 节点对象。这个对象是一个普通的 JavaScript 对象，表示 AST 中的一个节点，但不包含 NodePath 提供的那些额外的方法和属性。
- path.get('body')：返回的是一个 NodePath 对象。NodePath 是 Babel 提供的一个封装对象，它不仅包含了 AST 节点本身，还包含了许多用于操作和遍历 AST 的方法和属性



