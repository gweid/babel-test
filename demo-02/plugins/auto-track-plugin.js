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
