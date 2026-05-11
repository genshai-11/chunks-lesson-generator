const fs = require('fs');
let c = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');

c = c.replace(/\{\('Very Short,Short,Medium,Long'\.split\(,'\)\)\.map/, "{('Very Short,Short,Medium,Long'.split(',')).map");
fs.writeFileSync('src/components/SettingsTab.tsx', c);
