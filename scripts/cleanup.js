const fs = require('fs');
const path = require('path');

const dirsToDelete = ['__tests__', 'stitch_pocketflow_expense_tracker_pwa'];
const filesToDelete = ['vitest.config.ts'];

dirsToDelete.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Deleted directory: ${dir}`);
  }
});

filesToDelete.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
    console.log(`Deleted file: ${file}`);
  }
});

console.log("Cleanup complete!");
