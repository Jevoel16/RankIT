const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'node_modules', 'webpack-dev-server', 'lib', 'Server.js');

if (!fs.existsSync(serverFile)) {
  console.log('fix-wds-path: webpack-dev-server not found, skipping.');
  process.exit(0);
}

const before = fs.readFileSync(serverFile, 'utf8');
const absoluteNeedle = '${require.resolve("../client/index.js")}?${webSocketURLStr}';
const encodedNeedle = '${require.resolve("../client/index.js").replace(/#/g, "%23")}?${webSocketURLStr}';
const moduleSafeReplacement = 'webpack-dev-server/client/index.js?${webSocketURLStr}';

if (before.includes(moduleSafeReplacement)) {
  console.log('fix-wds-path: module-safe patch already applied.');
  process.exit(0);
}

if (!before.includes(absoluteNeedle) && !before.includes(encodedNeedle)) {
  console.log('fix-wds-path: target string not found, skipping.');
  process.exit(0);
}

let after = before;
after = after.replace(absoluteNeedle, moduleSafeReplacement);
after = after.replace(encodedNeedle, moduleSafeReplacement);

fs.writeFileSync(serverFile, after, 'utf8');
console.log('fix-wds-path: module-safe patch applied.');
