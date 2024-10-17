const fs = require('fs');
const path = require('path');

const userPackageJsonPath = path.join(process.cwd(), 'package.json');


let userPackageJson = require(userPackageJsonPath);

// Adds the codemastery script to the user's package.json for simplicity
userPackageJson.scripts = userPackageJson.scripts || {};
userPackageJson.scripts['codemastery'] = 'node cmScript.cjs';

// Write back the updated package.json
fs.writeFileSync(userPackageJsonPath, JSON.stringify(userPackageJson, null, 2));

console.log('codemastery start script added to package.json');
