const fs = require('fs').promises;
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const jsx = require('acorn-jsx');

// add any ignores here (put it the majority I could think of)
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
// ANSI color codes to make the console logs easier to differentiate
const COLOR_GREEN = "\x1b[32m"; //not convinced this is actually green lol, but it achieves what we want
const COLOR_RESET = "\x1b[0m";


// Function to recursively read and log issues in .js, .jsx, and .cjs files
const analyzeDirectory = async (dirPath) => {
  console.log(`Analyzing directory: ${dirPath}`);
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stats = await fs.stat(fullPath); //needed to check if the item is a directory or a file. if file, analyze and if dir then analyzeDir

      // ignore list check
      if (ignoreList.some(ignore => fullPath.includes(ignore))) {
        console.log(`Ignoring: ${fullPath}`);
        continue;
      }

      if (stats.isDirectory()) {
        // Recursively analyze subdirectories
        await analyzeDirectory(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.cjs')) {
        console.log(`Analyzing file: ${fullPath}`);
        await analyzeFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error analyzing directory ${dirPath}: ${error.message}`);
  }
};

// used for each file analyze (basically the real program)
const analyzeFile = async (filePath) => {
  try {
    console.log(`Starting analysis on file: ${filePath}`);
    const code = await fs.readFile(filePath, 'utf-8');
    const sourceType = filePath.endsWith('.cjs') ? 'script' : 'module';
    let ast;

    if (sourceType === 'script') {
      // use regular Acorn for .cjs "script"
      ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType, locations: true });
    } else {
      // use the JSX extension for module files
      const Parser = acorn.Parser.extend(jsx());
      ast = Parser.parse(code, { ecmaVersion: 'latest', sourceType, locations: true });
    }

    const scopeStack = [new Map()]; // this needs a global scoping due to undefined set on first empty list each file. 
    const functionDefinitions = new Map();
    const issues = [];

    walk.fullAncestor(ast, (node, state, ancestors) => { //not certain I need the state still
      // function to walk through scopes
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'BlockStatement'
      ) {
        scopeStack.push(new Map());
      }

      // Handle variable declarations
      if (node.type === 'VariableDeclarator') {
        const currentScope = scopeStack[scopeStack.length - 1]; //for tracking nested scopes and accurately figuring out which scope we are in
        const variableName = node.id.name;
        currentScope.set(variableName, false); //the false identifies it as not being used yet. 
      }

      // Handle variable usages
      if (node.type === 'Identifier') {
        const parent = ancestors[ancestors.length - 1];

        if ( //used to determine if the identifier node represents a usage of a variable and then changes it to true in the scopeStack if so. 
          (parent.type === 'VariableDeclarator' && parent.id === node) ||
          (parent.type === 'FunctionDeclaration' && parent.id === node) ||
          (parent.type === 'FunctionExpression' && parent.id === node) ||
          (parent.type === 'ArrowFunctionExpression' && parent.id === node)
        ) {
          // Declaration identifier, skip
        } else if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) { //means it is accessing an objects property, not a variable
          // Property access, skip
        } else {
          // for variable usage, sets the node to true (it was used)
          for (let i = scopeStack.length - 1; i >= 0; i--) {
            if (scopeStack[i].has(node.name)) {
              scopeStack[i].set(node.name, true);
              break;
            }
          }
        }
      }

      // Handle function declarations which is used to store info about each declaration
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        if (node.id && node.id.name) {
          const functionName = node.id.name;
          functionDefinitions.set(functionName, {
            params: node.params.length, // the amount of arguments or params the fn takes
            used: false, //initial state before the function calls occurs
            loc: node.loc, //its location for console logs about line and place
          });
        }
      }

      // Handle function calls
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        let calleeName = null;

        if (callee.type === 'Identifier') { //gets the name of the fn if id
          calleeName = callee.name;
        } else if (callee.type === 'MemberExpression') { //gets the property.name of the object if MemberExp
          // Handle member expressions if needed
          calleeName = callee.property.name;
        }
        //checks to make sure the number of arguments passed are the correct amount expected by the fn declaration
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

      // Check for deeply nested member expressions (if a nested property is recurisvely nested within a set variable of depth. 3 by default, this can be changed if needed)
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

      // Handle exiting scopes - when a scope is exited it is popped from the list and then any unused vars left inside it are declared as unused. 
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'BlockStatement'
      ) {
        if (scopeStack.length > 1) { //this prevents the global Scope from popping off since global always needs to stay on. 
          const scope = scopeStack.pop();

          // Check for unused variables in this scope
          for (const [variableName, isUsed] of scope.entries()) {
            if (!isUsed) {
              issues.push(`Unused variable: ${variableName} in file ${filePath}`);
            }
          }
        }
      }
    });

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

    // outputs the issues
    for (const issue of issues) {
      console.log(`${COLOR_GREEN}${issue}${COLOR_RESET}`);
    }
  } catch (error) {
    console.error(`Failed to parse file ${filePath}: ${error.message}`);
  }
};

// test path for the example file
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
