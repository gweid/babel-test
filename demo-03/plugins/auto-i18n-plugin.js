const importModule = require('@babel/helper-module-imports');

let intlIndex = 0;
const nextGI18nKey = () => {
  ++intlIndex;
  return `gi18n${intlIndex}`;
}

/**
 * 自动国际化
 *  1、如果没有引入 gi18n 模块，就自动引入，并且生成唯一的标识符，不和作用域的其他声明冲突
 *  2、把字符串和模版字符串替换为 gi18n.t 的函数调用的形式
 *  3、把收集到的值收集起来，输出到一个资源文件中
 */
const autoI18nPlugin = (api, options) => {
  const { template } = api;

  const getReplaceExpression = (value, intlUid) => {
    let replaceExpression = template.ast(`${intlUid}.t('${value}')`);
    return replaceExpression;
  }

  const save = (file, key, value) => {
    const allText = file.get('allText');
    allText.push({ key, value });
    file.set('allText', allText);
  }

  return {
    pre(file) {
      file.set('allText', []);
    },
    visitor: {
      Program: {
        enter(path, state) {
          let isImport;
          // 判断是否有引入过 gi18n，没有就先引入
          path.traverse({
            ImportDeclaration(curPath) {
              const moduleName = curPath.node.source.value;

              if (moduleName === 'gi18n') {
                isImport = true;
              }
            }
          });

          if (!isImport) {
            const uid = path.scope.generateUid('gi18n');
            const importAst = template.ast(`import ${uid} from 'gi18n';`);
            path.node.body.unshift(importAst);

            state.intlUid = uid;
          }

          // 对所有的有 /*i18n-disable*/ 注释的字符串和模版字符串节点打个标记，用于之后跳过处理。然后把这个注释节点从 ast 中去掉。
          path.traverse({
            'TemplateLiteral|StringLiteral'(path2) {
              if (path2.node.leadingComments) {
                path2.node.leadingComments = path2.node.leadingComments.filter(item => {
                  if (item.value.includes('i18n-disable')) {
                    path2.node.skipTransform = true;
                    return false;
                  }
                  return true;
                })
              }
            }
          });
        }
      },
      TemplateLiteral: {
        enter(path, state) {
          if (path.node.skipTransform) {
            return
          }

          // const key = nextGI18nKey();
        }
      },
      StringLiteral: {
        enter(path, state) {
          if (path.node.skipTransform) {
            return
          }

          const key = nextGI18nKey();

          save(state.file, key, path.node.value);
        }
      }
    },
  }
}

module.exports = autoI18nPlugin;
