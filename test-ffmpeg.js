const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const envVars = envFile.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, value] = line.split('=');
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {});
  
  console.log('Loaded environment variables from .env.local:');
  console.log(envVars);
  
  // Set the FFMPEG_PATH environment variable
  if (envVars.FFMPEG_PATH) {
    process.env.FFMPEG_PATH = envVars.FFMPEG_PATH;
    console.log(`Set FFMPEG_PATH to: ${process.env.FFMPEG_PATH}`);
  }
} catch (err) {
  console.error(`Error loading .env.local: ${err.message}`);
}

// Possible FFmpeg paths to check
const possiblePaths = [
  // Path from env variable (if set)
  process.env.FFMPEG_PATH,
  
  // Common Windows paths
  'D:/EmmanuelChurchLondon/ffmpeg/bin/ffmpeg.exe',
  'D:/EmmanuelChurchLondon/ffmpeg/ffmpeg.exe',
  'C:/ffmpeg/bin/ffmpeg.exe',
  'C:/Program Files/ffmpeg/bin/ffmpeg.exe',
  
  // Look in PATH (just the name, will search PATH)
  'ffmpeg',
  'ffmpeg.exe'
].filter(Boolean); // Filter out nulls/undefineds

console.log('\nChecking the following FFmpeg paths:');
console.log(possiblePaths);

// Check each path
possiblePaths.forEach(pathToCheck => {
  console.log(`\nChecking: ${pathToCheck}`);
  
  // Check if file exists (for full paths)
  if (pathToCheck.includes('/') || pathToCheck.includes('\\')) {
    try {
      const exists = fs.existsSync(pathToCheck);
      console.log(`File exists: ${exists}`);
      
      if (exists) {
        // Try to run the command
        const cmd = pathToCheck.includes(' ') ? `"${pathToCheck}" -version` : `${pathToCheck} -version`;
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error running FFmpeg: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`FFmpeg stderr: ${stderr}`);
          }
          console.log(`FFmpeg version output: ${stdout.substring(0, 100)}...`);
        });
      }
    } catch (err) {
      console.error(`Error checking path: ${err.message}`);
    }
  } else {
    // Try running the command directly (for PATH entries)
    exec(`${pathToCheck} -version`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running FFmpeg: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`FFmpeg stderr: ${stderr}`);
      }
      console.log(`FFmpeg version output: ${stdout.substring(0, 100)}...`);
    });
  }
});

// Print environment variables
console.log('\nEnvironment variables:');
console.log(`FFMPEG_PATH: ${process.env.FFMPEG_PATH}`);
console.log(`Current working directory: ${process.cwd()}`); 