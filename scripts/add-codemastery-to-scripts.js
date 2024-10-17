const fs = require('fs');
const path = require('path');

const userPackageJsonPath = path.join(process.cwd(), 'package.json');


let userPackageJson = require(userPackageJsonPath);

// Adds the codemastery script to the users package.json for simplicity
userPackageJson.scripts = userPackageJson.scripts || {};
userPackageJson.scripts['codemastery'] = 'node ./node_modules/codemastery/bin/cmScript.cjs';

// Write back the updated package.json with the new script included
fs.writeFileSync(userPackageJsonPath, JSON.stringify(userPackageJson, null, 2));

console.log('codemastery start script added to package.json');
