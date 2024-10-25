const fs = require('fs').promises;
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const jsx = require('acorn-jsx');
const { extractDeclaredVariables } = require('./utils.js');
const { wrappedWalker } = require('./customWalker.js');

// Add any ignores here
const ignoreList = [
  "node_modules",
  "dist",
  "build",
  "package-lock.json",
  "package.json",
  ".gitignore",
  "README.md",
  "tmpnodejsnpm",
  ".git",
  "codeMasteryGraph.html",
  "outputFile.dot",
  "codeMasteryGraph.js"
];

// ANSI color codes for console logs
const COLOR_GREEN = "\x1b[32m";
const COLOR_RESET = "\x1b[0m";

let functionParamStack = [];
const allIssues = [];
const allDataFlowEdges = [];
// Function to recursively read and log issues in .js, .jsx, and .cjs files
const analyzeDirectory = async (dirPath) => {
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stats = await fs.stat(fullPath);

      // Ignore list check
      if (ignoreList.some(ignore => fullPath.includes(ignore))) {
        console.log(`Ignoring: ${fullPath}`);
        continue;
      }

      if (stats.isDirectory()) {
        // Recursively analyze subdirectories
        await analyzeDirectory(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.cjs')) {
        await analyzeFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error analyzing directory ${dirPath}: ${error.message}`);
  }
};

// Function to analyze individual files
const analyzeFile = async (filePath) => {
  try {
    console.log(`Starting analysis on file: ${filePath}`);
    const code = await fs.readFile(filePath, 'utf-8');
    const sourceType = filePath.endsWith('.cjs') ? 'script' : 'module';
    let ast;

    // Use Acorn parser with necessary plugins
    const Parser = acorn.Parser.extend(jsx());
    ast = Parser.parse(code, { ecmaVersion: 'latest', sourceType, locations: true });

    const scopeStack = [new Map()]; // Initialize with a global scope
    const functionDefinitions = new Map();
    const issues = [];
    const dataFlowEdges = [];

    // Traverse the AST
    walk.fullAncestor(ast, (node, state, ancestors) => {
      // Handle variable declarations and initializations
      if (node.type === 'VariableDeclarator') {
        const declaredVariables = extractDeclaredVariables(node.id);
        const currentScope = scopeStack[scopeStack.length - 1];
        for (const variableName of declaredVariables) {
          if (variableName === undefined) {
            console.warn(`Warning: undefined variable at line ${node.loc.start.line} in the file ${filePath}`);
          } else {
            currentScope.set(variableName, false); // Mark as not used yet
          }
        }
        // Handle initialization (e.g., const x = expr;)
        if (node.init) {
          dataFlowEdges.push({
            from: node.init,
            to: declaredVariables.join(', '),
            loc: node.loc,
            file: filePath,
            type: 'declaration',
            fromType: getNodeType(node.init),
            toType: 'variable',
          });
        }
      }

      // Handle assignments
      if (node.type === 'AssignmentExpression') {
        const assignedVar = getNodeDescription(node.left);
        const expression = node.right;
        dataFlowEdges.push({
          from: expression,
          to: assignedVar,
          loc: node.loc,
          file: filePath,
          type: 'assignment',
          fromType: getNodeType(expression),
          toType: 'variable',
        });
      }

      // Handle function declarations
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        // Enter new function scope
        scopeStack.push(new Map());
        const params = node.params.map(param => {
          if (param.type === 'Identifier') {
            return param.name;
          }else {
            return getNodeDescription(param);
          }
        });
        functionParamStack.push(params);
        if (node.id && node.id.name) {
          const functionName = node.id.name;
          functionDefinitions.set(functionName, {
            params: node.params.length,
            used: false,
            loc: node.loc,
            file: filePath,
          });
        }
      }
      // Handle function calls
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        const args = node.arguments;
        let calleeName = null;
      
        if (callee.type === 'Identifier') {
          calleeName = callee.name;
        } else if (callee.type === 'MemberExpression') {
          calleeName = getNodeDescription(callee);
        }
      
        // Record data flow from arguments to function parameters
        if (callee.type === 'Identifier') {
          const functionName = callee.name;
          // Find the function declaration
          const functionDeclaration = findFunctionDeclaration(ast, functionName);
          if (functionDeclaration) {
            const params = functionDeclaration.params;
            const functionInfo = functionDefinitions.get(functionName);
            const functionFile = functionInfo ? functionInfo.file : filePath; // Use the file from function definition
            for (let i = 0; i < args.length; i++) {
              const arg = args[i];
              const param = params[i];
              if (param && param.type === 'Identifier') {
                dataFlowEdges.push({
                  from: arg,
                  to: param.name,
                  loc: arg.loc,
                  file: functionFile,
                  type: 'parameter',
                  fromType: getNodeType(arg),
                  toType: 'parameter',
                });
              }
            }
          }
        }
      
        if (calleeName) {
          if (functionDefinitions.has(calleeName)) {
            const functionInfo = functionDefinitions.get(calleeName);
            const argsPassed = node.arguments.length;
            if (argsPassed < functionInfo.params) {
              issues.push(
                `Function call to ${calleeName} in file ${filePath} at line ${node.loc.start.line} might be missing arguments. Expected ${functionInfo.params}, got ${argsPassed}.`
              );
            }
            // Mark function as used
            functionInfo.used = true;
          }
        }
      }

      // Handle variable usages
      
      if (node.type === 'Identifier') {
        const parent = ancestors[ancestors.length - 1];
      
        // Skip declarations and property accesses
        if (
          (parent.type === 'VariableDeclarator' && parent.id === node) ||
          (parent.type === 'FunctionDeclaration' && parent.id === node) ||
          (parent.type === 'FunctionExpression' && parent.id === node) ||
          (parent.type === 'ArrowFunctionExpression' && parent.id === node) ||
          (parent.type === 'MemberExpression' && parent.property === node && !parent.computed)
        ) {
          // Declaration identifier or property access, skip
        } else {
          // Variable usage
          const currentFunctionParams = functionParamStack[functionParamStack.length - 1] || [];
          if (currentFunctionParams.includes(node.name)) {
            // Identifier is a function parameter
            dataFlowEdges.push({
              from: node.name, // Parameter name
              to: getNodeDescription(node),
              loc: node.loc,
              file: filePath,
            });
          }}}

      // Handle exiting scopes
if (
  node.type === 'FunctionDeclaration' ||
  node.type === 'FunctionExpression' ||
  node.type === 'ArrowFunctionExpression' ||
  node.type === 'BlockStatement'
) {
  if (scopeStack.length > 1) { // Don't pop the global scope
    const scope = scopeStack.pop();

    // Check for unused variables in this scope
    for (const [variableName, isUsed] of scope.entries()) {
      if (!isUsed) {
        issues.push(`Unused variable: ${variableName} in file ${filePath}`);
      }
    }
  }

  // If exiting a function, pop the function parameter stack
  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  ) {
    functionParamStack.pop();
  }
}

// Check for weak equality operators
if (node.type === 'BinaryExpression') {
  if (node.operator === '==' || node.operator === '!=') {
    issues.push(
      `Weak equality operator '${node.operator}' found in file ${filePath} at line ${node.loc.start.line}`
    );
  }
}

// Check for redundant conditionals
if (node.type === 'IfStatement') {
  if (node.test.type === 'Literal') {
    issues.push(
      `Potentially redundant conditional in file ${filePath} at line ${node.loc.start.line}`
    );
  }
}

// Check for potential infinite loops
if (node.type === 'ForStatement') {
  if (!node.test) {
    issues.push(
      `Potential infinite loop in file ${filePath} at line ${node.loc.start.line}`
    );
  }
}

// Check for deeply nested member expressions
if (node.type === 'MemberExpression') {
  let depth = 0;
  let current = node;
  while (current && current.type === 'MemberExpression') {
    depth++;
    current = current.object;
  }
  if (depth > 3) {
    issues.push(
      `Deeply nested member expression found in file ${filePath} at line ${node.loc.start.line}`
    );
  }
}
}, null, wrappedWalker);


    // After traversal, check for unused variables in the global scope
    const globalScope = scopeStack[0];
    for (const [variableName, isUsed] of globalScope.entries()) {
      if (!isUsed) {
        issues.push(`Unused variable: ${variableName} in file ${filePath}`);
      }
    }
    allIssues.push(...issues);
    allDataFlowEdges.push(...dataFlowEdges);
    // Check for unused functions after traversal
    functionDefinitions.forEach((info, functionName) => {
      if (!info.used) {
        issues.push(
          `Unused function: ${functionName} in file ${filePath} at line ${info.loc.start.line}`
        );
      }
    });
    // Output the issues
    for (const issue of issues) {
      console.log(`${COLOR_GREEN}${issue}${COLOR_RESET}`);
    }

  } catch (error) {
    console.error(`Failed to parse file ${filePath}: ${error.message}`);
  }
};

// Helper function to find a function declaration by name
function findFunctionDeclaration(ast, functionName) {
  let found = null;
  walk.simple(ast, {
    FunctionDeclaration(node) {
      if (node.id && node.id.name === functionName) {
        found = node;
      }
    },
  });
  return found;
}

// Helper function to describe a node
function getNodeDescription(node) {
  if (!node) {
    return 'undefined';
  } else if (typeof node === 'string') {
    return node;
  } else if (node.type === 'Identifier') {
    return node.name;
  } else if (node.type === 'Literal') {
    return node.raw;
  } else if (node.type === 'MemberExpression') {
    return `${getNodeDescription(node.object)}.${getNodeDescription(node.property)}`;
  } else if (node.type === 'CallExpression') {
    return `${getNodeDescription(node.callee)}(${node.arguments.map(arg => getNodeDescription(arg)).join(', ')})`;
  } else if (node.type === 'BinaryExpression') {
    return `(${getNodeDescription(node.left)} ${node.operator} ${getNodeDescription(node.right)})`;
  } else if (node.type === 'ThisExpression') {
    return 'this';
  } else if (node.type === 'AssignmentPattern') {
    return `${getNodeDescription(node.left)} = ${getNodeDescription(node.right)}`;
  } else if (node.type === 'ArrayExpression') {
    return `[${node.elements.map(elem => getNodeDescription(elem)).join(', ')}]`;
  } else if (node.type === 'ObjectExpression') {
    return `{${node.properties.map(prop => `${getNodeDescription(prop.key)}: ${getNodeDescription(prop.value)}`).join(', ')}}`;
  } else {
    return node.type;
  }
}

function getShortFileName(filePath) {
  return path.basename(filePath);
}

function getNodeLabel(node, fileName) {
  const nodeDesc = getNodeDescription(node);
  return sanitizeNodeLabel(`${fileName}:${nodeDesc}`);
}

function getNodeType(node) {
  if (!node) return 'unknown';
  if (typeof node === 'string') return 'variable';
  switch (node.type) {
    case 'Literal':
      return 'literal';
    case 'Identifier':
      return 'variable';
    case 'CallExpression':
      return 'functionCall';
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return 'function';
    case 'BinaryExpression':
      return 'expression';
    default:
      return 'expression';
  }
}

function transformDataForD3(dataFlowEdges) {
  const nodesMap = new Map(); // init nodes map
  const links = [];

  function addNode(name, type) {
    if (!nodesMap.has(name)) {
      nodesMap.set(name, { name, type });
    }
  }

  dataFlowEdges.forEach(edge => {
    const sourceName = getNodeDescription(edge.from);
    const targetName = getNodeDescription(edge.to);

    // **Add nodes to nodesMap with their types**
    addNode(sourceName, edge.fromType);
    addNode(targetName, edge.toType);

    // Add link for graph
    links.push({
      source: sourceName,
      target: targetName,
      type: edge.type || 'dataFlow',
      loc: edge.loc,
      file: edge.file,
    });
  });

  // converts nodes object to array
  const nodes = Array.from(nodesMap.values());

  return { nodes, links };
}

// Function to generate the DOT file for Graphviz
async function generateDotFile(dataFlowEdges, outputFilePath) {
  let dotContent = 'digraph DataFlow {\n';
  dotContent += '  rankdir=TB;\n';
  dotContent += '  node [shape=box, fontsize=12];\n';
  dotContent += '  edge [fontsize=10];\n';
  dotContent += '  concentrate=true;\n';
  // Group edges by file
  const edgesByFile = {};
  for (const edge of dataFlowEdges) {
    if (!edge.file) {
      console.warn('Edge missing file property:', edge);
      continue;
    }
    const fileName = edge.file ? getShortFileName(edge.file) : 'unknown';
    if (!edgesByFile[fileName]) {
      edgesByFile[fileName] = [];
    }
    edgesByFile[fileName].push(edge);
  }

  // Create subgraphs (clusters) for each file
  let clusterIndex = 0;
  for (const [fileName, edges] of Object.entries(edgesByFile)) {
    dotContent += `  subgraph cluster_${clusterIndex} {\n`;
    dotContent += `    label="${fileName}";\n`;
    dotContent += '    style=filled;\n';
    dotContent += '    color=lightgrey;\n';

    for (const edge of edges) {
      const fromLabel = getNodeLabel(edge.from, fileName);
    const toLabel = getNodeLabel(edge.to, fileName);
    dotContent += `    "${fromLabel}" -> "${toLabel}" [label="Line ${edge.loc.start.line}"];\n`;
  }

    dotContent += '  }\n';
    clusterIndex++;
  }

  dotContent += '}\n';

  await fs.writeFile(outputFilePath, dotContent, 'utf8');
}

// Helper function to sanitize node labels for DOT format
function sanitizeNodeLabel(label) {
  return label.replace(/"/g, '\\"').replace(/\n/g, ' ');
}
// Main execution
(async () => {
  if (process.argv.includes('--test')) {
    const exampleFilePath = path.resolve(__dirname, "../codemastery/example-test-file.js");
    console.log(`Running analysis on example test file: ${exampleFilePath}`);
    try {
      await fs.access(exampleFilePath);
      await analyzeFile(exampleFilePath);
    } catch {
      console.error(`Test file not found: ${exampleFilePath}`);
      process.exit(1);
    }
  } else {
    console.log(`Running analysis on user's project starting from: ${path.resolve(".")}`);
    const rootDir = path.resolve(".");
    await analyzeDirectory(rootDir);

    const transformedData = transformDataForD3(allDataFlowEdges);
    const outputFilePath = process.cwd() + '/data_flow.json';
    await fs.writeFile(outputFilePath, JSON.stringify(transformedData, null, 2), 'utf8');
    console.log(`Data flow JSON saved to ${outputFilePath}`);

    const outputFilePathDot = process.cwd() + '/outputFile.dot';
    await generateDotFile(allDataFlowEdges, outputFilePathDot);
    console.log(`Combined data flow graph saved to ${outputFilePathDot}`);
  }
})();
