const fs = require('fs');
const path = require('path');

const userPackageJsonPath = path.resolve(process.cwd(), '..', '..', 'package.json');

const MAX_RETRIES = 20;
let retries = 0;

const tryAddScript = () => {
  if (fs.existsSync(userPackageJsonPath)) {
    try {
      let userPackageJson = require(userPackageJsonPath);

      // Adds the codemastery script to the user's package.json for simplicity
      userPackageJson.scripts = userPackageJson.scripts || {};
      userPackageJson.scripts['codemastery'] = 'node ./node_modules/codemastery/bin/cmScript.cjs';
      userPackageJson.scripts['codemastery:scan'] = 'node ./node_modules/codemastery/ast.js';
      userPackageJson.scripts['codemastery:test'] = 'node ./node_modules/codemastery/ast.js --test';

      // Write back the updated package.json with the new script included
      fs.writeFileSync(userPackageJsonPath, JSON.stringify(userPackageJson, null, 2));

      console.log('codemastery start script added to package.json');
    } catch (error) {
      console.error('Error while modifying package.json:', error);
    }
  } else if (retries < MAX_RETRIES) {
    retries++;
    setTimeout(tryAddScript, 500); 
  } else {
    console.error('package.json not found after multiple attempts. Skipping script addition.');
  }
}

tryAddScript();
