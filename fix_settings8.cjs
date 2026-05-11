const fs = require('fs');
let c = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');

c = c.replace(/\\n/g, '\n');

fs.writeFileSync('src/components/SettingsTab.tsx', c);
console.log('Fixed newlines');
