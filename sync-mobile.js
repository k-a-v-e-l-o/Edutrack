const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'public', 'index.html');
const destFile = path.join(__dirname, 'frontend', 'www', 'index.html');

try {
  fs.copyFileSync(sourceFile, destFile);
  console.log('✅ Successfully synced index.html to mobile build');
  console.log(`   Source: ${sourceFile}`);
  console.log(`   Destination: ${destFile}`);
} catch (err) {
  console.error('❌ Failed to sync index.html:', err.message);
  process.exit(1);
}
