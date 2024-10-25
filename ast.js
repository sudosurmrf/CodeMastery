const fs = require('fs').promises;
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const jsx = require('acorn-jsx');
const { extractDeclaredVariables } = require('./utils.js');
const { wrappedWalker } = require('./customWalker.js');
const eslintScope = require('eslint-scope');

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
  ".git"
];

// ANSI color codes for console logs
const COLOR_GREEN = "\x1b[32m";
const COLOR_RESET = "\x1b[0m";

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

    if (sourceType === 'script') {
      // Use regular Acorn for .cjs "script"
      ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType, locations: true });
    } else {
      // Use the JSX extension for module files
      const Parser = acorn.Parser.extend(jsx());
      ast = Parser.parse(code, { ecmaVersion: 'latest', sourceType, locations: true });
    }

    const scopeStack = [new Map()]; // Initialize with a global scope
    const functionDefinitions = new Map();
    const issues = [];
    const dataFlowEdges = [];

    // Use eslint-scope to analyze scopes and variables (optional)
    const scopeManager = eslintScope.analyze(ast, {
      ecmaVersion: 2020,
      sourceType: 'module',
    });

    // Traverse the AST
    walk.fullAncestor(ast, (node, state, ancestors) => {
      // Track variable declarations and references

      // Handle AssignmentExpression
      if (node.type === 'AssignmentExpression') {
        // Left side (variable being assigned)
        const assignedVar = getNodeDescription(node.left);
        // Right side (expression assigned to the variable)
        const expression = node.right;
        // Record the data flow
        dataFlowEdges.push({
          from: expression,
          to: assignedVar,
          loc: node.loc,
        });
      }

      // Handle variable declarations
      if (node.type === 'VariableDeclarator') {
        const currentScope = scopeStack[scopeStack.length - 1];
        const declaredVariables = extractDeclaredVariables(node.id);
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
          });
        }
      }

      // Handle variable usages
      if (node.type === 'Identifier') {
        const parent = ancestors[ancestors.length - 1];

        if (
          (parent.type === 'VariableDeclarator' && parent.id === node) ||
          (parent.type === 'FunctionDeclaration' && parent.id === node) ||
          (parent.type === 'FunctionExpression' && parent.id === node) ||
          (parent.type === 'ArrowFunctionExpression' && parent.id === node)
        ) {
          // Declaration identifier, skip
        } else if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) {
          // Property access, skip
        } else {
          // Variable usage
          for (let i = scopeStack.length - 1; i >= 0; i--) {
            if (scopeStack[i].has(node.name)) {
              scopeStack[i].set(node.name, true);
              break;
            }
          }
        }
      }

      // Handle function declarations
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        scopeStack.push(new Map()); // Enter new function scope
        if (node.id && node.id.name) {
          const functionName = node.id.name;
          functionDefinitions.set(functionName, {
            params: node.params.length,
            used: false,
            loc: node.loc,
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
            for (let i = 0; i < args.length; i++) {
              const arg = args[i];
              const param = params[i];
              if (param && param.type === 'Identifier') {
                dataFlowEdges.push({
                  from: arg,
                  to: param.name,
                  loc: arg.loc,
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
      }
    }, null, wrappedWalker);

    // After traversal, check for unused variables in the global scope
    const globalScope = scopeStack[0];
    for (const [variableName, isUsed] of globalScope.entries()) {
      if (!isUsed) {
        issues.push(`Unused variable: ${variableName} in file ${filePath}`);
      }
    }

    // Check for unused functions after traversal
    functionDefinitions.forEach((info, functionName) => {
      if (!info.used) {
        issues.push(
          `Unused function: ${functionName} in file ${filePath} at line ${info.loc.start.line}`
        );
      }
    });

    // Output the data flow edges
    for (const edge of dataFlowEdges) {
      console.log(`Data flows from ${getNodeDescription(edge.from)} to ${edge.to} at line ${edge.loc.start.line}`);
    }

    // Output the issues
    for (const issue of issues) {
      console.log(`${COLOR_GREEN}${issue}${COLOR_RESET}`);
    }

    // Generate data flow graph
    const outputFilePath = process.cwd() + '/outputFile.dot';
    console.log(outputFilePath);
    await generateDotFile(dataFlowEdges, outputFilePath);
    console.log(`Data flow graph saved to ${outputFilePath}`);

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

// Function to generate the DOT file for Graphviz
async function generateDotFile(dataFlowEdges, outputFilePath) {
  let dotContent = 'digraph DataFlow {\n';
  for (const edge of dataFlowEdges) {
    const from = sanitizeNodeLabel(getNodeDescription(edge.from));
    const to = sanitizeNodeLabel(edge.to);
    dotContent += `  "${from}" -> "${to}" [label="Line ${edge.loc.start.line}"];\n`;
  }
  dotContent += '}\n';

  await fs.writeFile(outputFilePath, dotContent, 'utf8');
}

// Helper function to sanitize node labels for DOT format
function sanitizeNodeLabel(label) {
  return label.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// Test path for the example file
const exampleFilePath = path.resolve(__dirname, "../codemastery/example-test-file.js");

// Main execution
(async () => {
  if (process.argv.includes('--test')) {
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
  }
})();
