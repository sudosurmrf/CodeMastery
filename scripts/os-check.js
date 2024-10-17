const { exec } = require('child_process');
const os = require('os');

// checking if the computer is a mac or linux system (UNIX)
const isUnix = os.platform() === 'linux' || os.platform() === 'darwin';

if (isUnix) {
  // Running CHMOD if the system is unix to make the script executable.
  exec('chmod +x bin/cmScript.cjs', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error running chmod: ${error}`);
      return;
    }
    console.log('chmod executed successfully');
  });
} else {
  console.log('Skipping chmod on non-Unix system');
}
