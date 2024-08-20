const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const DependencyNode = require('./dependencyNode');

// 导入的类型
const IMPORT_TYPE = {
  deconstruct: 'deconstruct',
  default: 'default',
  namespace: 'namespace'
};

// 导出的类型
const EXPORT_TYPE = {
  all: 'all',
  default: 'default',
  named: 'named'
}

// ts、jsx 用的 babel 插件不同，要根据 文件后缀 来做不同的插件的引入
const resolveBabelPlugins = (modulePath) => {
  if (!modulePath) return;

  const plugins = [];

  if (['.jsx', '.tsx'].some(ext => modulePath.endsWith(ext))) {
    plugins.push('jsx');
  }

  if (['.ts', '.tsx'].some(ext => modulePath.endsWith(ext))) {
    plugins.push('typescript');
  }

  return plugins;
}

// 用来存储引入过的模块，避免重复处理同一个模块
const visitedModules = new Set();

// 判断是否是目录
const isDirectory = (path) => {
  let flag = false;
  try {
    flag = fs.statSync(path).isDirectory()
  } catch (error) {

  }

  return flag;
}

// 模块路径补全
const completeModulePath = (modulePath) => {
  // 如果路径是 .xxx 结尾，那么认为不需要做路径补全处理
  if (modulePath.match(/\.[a-zA-Z]+$/)) return modulePath;

  const etxs = ['.js', '.jsx', '.ts', '.tsx'];

  const tryCompletePath = (modulePath, isDirectory) => {
    for(let i = 0; i < etxs.length; i++) {
      let tryPath;
      if (isDirectory) {
        tryPath = `${modulePath}/index${etxs[i]}`
      } else {
        tryPath = `${modulePath}${etxs[i]}`;
      }
      if (fs.existsSync(tryPath)) {
        return tryPath;
      }
    }
  }

  let tryModulePath;
  if (isDirectory(modulePath)) {
    // 如果是目录
    tryModulePath = tryCompletePath(modulePath, true);
  } else {
    // 如果是文件
    tryModulePath = tryCompletePath(modulePath, false);
  }

  if (!tryModulePath) throw 'module not found: ' + modulePath;

  return tryModulePath;
}

// 生成模块路径
const moduleResolver = (curModulePath, requirePath) => {
  // 拼接得到引入模块的绝对路径
  let modulePath = path.resolve(path.dirname(curModulePath), requirePath);

  // 过滤第三方模块
  if (modulePath.includes('node_modules')) return '';

  // 对路径进行补全
  modulePath = completeModulePath(modulePath);

  if (visitedModules.has(modulePath)) {
    return '';
  } else {
    visitedModules.add(modulePath);
  }

  return modulePath;
}


const traverseModule = (curModulePath, dependencyGrapthNode, allModules) => {
  dependencyGrapthNode.path = curModulePath;

  const moduleFileContent = fs.readFileSync(curModulePath, 'utf-8');

  const ast = parser.parse(moduleFileContent, {
    sourceType: 'unambiguous',
    plugins: resolveBabelPlugins(curModulePath)
  });

  traverse(ast, {
    // 处理导入
    ImportDeclaration(path) {
      const requirePath = path.node.source.value;
      const subModulePath = moduleResolver(curModulePath, requirePath);

      if (!subModulePath) return;

      // 对不同导入方式处理
      const specifierPaths = path.get('specifiers');
      dependencyGrapthNode.imports[subModulePath] = specifierPaths.map(item => {
        if (item.isImportSpecifier()) {
          return {
            type: IMPORT_TYPE.deconstruct,
            imported: item.get('imported').node.name,
            local: item.get('local').node.name
          }
        } else if (item.isImportDefaultSpecifier()) {
          return {
            type: IMPORT_TYPE.default,
            local: item.get('local').node.name
          }
        } else {
          return {
            type: IMPORT_TYPE.namespace,
            local: item.get('local').node.name
          }
        }
      });

      const subModule = new DependencyNode();

      traverseModule(subModulePath, subModule, allModules);

      dependencyGrapthNode.subModules[subModule.path] = subModule;
    },
    // 处理导出
    ExportDeclaration(path) {
      if (path.isExportNamedDeclaration()) {
        const specifiers = path.get('specifiers');
        dependencyGrapthNode.exports = specifiers.map(item => {
          return {
            type: EXPORT_TYPE.named,
            exported: item.get('exported').node.name,
            local: item.get('local').node.name
          };
        })
      } else if (path.isExportDefaultDeclaration()) {
        let exportName;
        const declarationPath = path.get('declaration');
        if(declarationPath.isAssignmentExpression()) {
            exportName = declarationPath.get('left').toString();
        } else {
            exportName = declarationPath.toString()
        }
        dependencyGrapthNode.exports.push({
            type: EXPORT_TYPE.default,
            exported: exportName
        });
      } else {
        dependencyGrapthNode.exports.push({
          type: EXPORT_TYPE.all,
          exported: item.get('exported').node.name,
          source: item.get('source').node.name,
        });
      }
    }
  });

  allModules[curModulePath] = dependencyGrapthNode;
}

const generateDependencyGraph = (curModulePath) => {
  const dependencyGraph = {
    root: new DependencyNode(),
    allModules: {}
  };

  traverseModule(curModulePath, dependencyGraph.root, dependencyGraph.allModules);

  return dependencyGraph;
}

module.exports = generateDependencyGraph;
