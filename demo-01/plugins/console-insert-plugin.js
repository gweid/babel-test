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
