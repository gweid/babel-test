const path = require('path');
const fse = require('fs-extra');
const doctrine = require('doctrine');
const generateDocs = require('./generate-docs/index');

// 解析类型
const resolveType = (tsType) => {
  if (!tsType) return

  switch (tsType) {
    case 'TSStringKeyword':
      return 'string';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBooleanKeyword':
      return 'boolean';
  }
}

// 解析函数注释
const parseComment = (commentStr) => {
  if (!commentStr) return

  // 使用 doctrine 来解析注释里的 @xxx 信息
  return doctrine.parse(commentStr, {
    unwrap: true
  })
}

const generate = (docs, format = 'markdown') => {
  switch(format) {
    case 'markdown':
      return { ext: 'md', content: generateDocs.markdown(docs) };
    // case 'json':
    //   return { ext, content: generateDocs.json(docs) };
    // case 'html':
    //   return { ext, content: generateDocs.html(docs) };
  }
}

const autoDocsPlugin = (api, options) => {
  const { template } = api;
  const { format = 'markdown', outputDir } = options;

  return {
    pre(file) {
      // 全局的 file 中，存进一个空数组，用于信息收集
      file.set('docs', [])
    },
    visitor: {
      FunctionDeclaration: {
        enter(path, state) {
          const docs = state.file.get('docs');

          docs.push({
            type: 'function',
            name: path.get('id').toString(),
            params: path.get('params').map(param => {
              return {
                name: param.toString(),
                type: resolveType(param.getTypeAnnotation().type)
              }
            }),
            return: resolveType(path.get('returnType').getTypeAnnotation().type),
            // 函数的注释
            doc: path.node.leadingComments && parseComment(path.node.leadingComments[0].value)
          });

          state.file.set('docs', docs);
        }
      },
      // ClassDeclaration: {
      //   enter(path, state) {
      //     const docs = state.file.get('docs');

      //     const classInfo = {
      //       type: 'class',
      //       name: path.get('id').toString(),
      //       constructorInfo: {},
      //       methodInfo: [],
      //       propertyInfo: []
      //     };

      //     docs.push(classInfo);
      //     state.file.set('docs', docs);
      //   }
      // }
    },
    post(file) {
      const docs = file.get('docs');

      const { ext, content } = generate(docs, format);

      fse.ensureDirSync(outputDir);
      fse.writeFileSync(path.join(outputDir, `docs.${ext}`), content);
    }
  }
}

module.exports = autoDocsPlugin;
