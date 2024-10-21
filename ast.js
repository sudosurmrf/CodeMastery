const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const walk = require("acorn-walk");

// add any files or folders you want the code-check to ignore
const ignoreList = ["node_modules", "dist", "build", "package-lock.json", "package.json", ".gitignore", "README.md"];

// function to recursively read and log the issues in .js, .jsx, and .cjs files
const analyzeDirectory = (dirPath) => {
  console.log(`Analyzing directory: ${dirPath}`);
  fs.readdirSync(dirPath).forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stats = fs.statSync(fullPath);

    if (ignoreList.some(ignore => fullPath.includes(ignore))) {
      console.log(`Ignoring: ${fullPath}`);
      return;
    }

    if (stats.isDirectory()) {
      // Recursively analyze subdirectories
      analyzeDirectory(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.cjs')) {
      console.log(`Analyzing file: ${fullPath}`);
      analyzeFile(fullPath);
    }
  });
};

// used for each individual file
const analyzeFile = (filePath) => {
  try {
    console.log(`Starting analysis on file: ${filePath}`);
    const code = fs.readFileSync(filePath, 'utf-8');
    const ast = acorn.parse(code, { ecmaVersion: 2020, locations: true });
    const declaredVariables = new Map();

    // using an ast, find each issue by node
    walk.simple(ast, {
      VariableDeclarator: (node) => {
        // adds vars to the map before usage
        const variableName = node.id.name;
        declaredVariables.set(variableName, false);
      },
      Identifier: (node) => {
        // marks the vars as used
        if (declaredVariables.has(node.name)) {
          declaredVariables.set(node.name, true);
        }
      },
      BinaryExpression: (node) => {
        //checks weak equality (==)
        if (node.operator === '==') {
          console.log(`Weak equality found in file ${filePath} at line ${node.loc ? node.loc.start.line : 'unknown'}`);
        }
      },
      CallExpression: (node) => {
        // checks common issues with function calls, like missing arguments
        const calleeName = node.callee.name;
        if (calleeName) {
          const args = node.arguments;
          if (args.length === 0) {
            console.log(`Function call to ${calleeName} in file ${filePath} at line ${node.loc ? node.loc.start.line : 'unknown'} might be missing arguments.`);
          }
        }
      },
      IfStatement: (node) => {
        // check for complex or always true/false conditions
        if (node.test.type === 'Literal') {
          console.log(`Potentially redundant conditional in file ${filePath} at line ${node.loc ? node.loc.start.line : 'unknown'}`);
        }
      },
      ForStatement: (node) => {
        // check for potential infinite loops
        if (!node.test) {
          console.log(`Potential infinite loop in file ${filePath} at line ${node.loc ? node.loc.start.line : 'unknown'}`);
        }
      }
    });

    // logs the unused vars
    declaredVariables.forEach((isUsed, variableName) => {
      if (!isUsed) {
        console.log(`Unused variable: ${variableName} in file ${filePath}`);
      }
    });
  } catch (error) {
    console.error(`Failed to parse code in file ${filePath}: ${error.message}`);
  }
};

// example test path
const exampleFilePath = path.resolve(__dirname, "../codemastery/example-test-file.js");

// if the --test flag is thrown, the example file will run, otherwise root dir will run recurisvely.
if (process.argv.includes('--test')) {
  console.log(`Running analysis on example test file: ${exampleFilePath}`);
  if (!fs.existsSync(exampleFilePath)) {
    console.error(`Test file not found: ${exampleFilePath}`);
    process.exit(1);
  }
  analyzeFile(exampleFilePath);
} else {
  console.log(`Running analysis on user's project starting from: ${path.resolve(".")}`);
  const rootDir = path.resolve(".");
  analyzeDirectory(rootDir);
}