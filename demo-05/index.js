const path = require('path');
const generateDependencyGraph = require('./generateDependencyGraph');

const dependencyGraph = generateDependencyGraph(path.join(__dirname, './project/index.js'));

console.log(dependencyGraph);
