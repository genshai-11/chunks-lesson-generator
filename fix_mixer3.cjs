const fs = require('fs');
let c = fs.readFileSync('src/components/MixerTab.tsx', 'utf8');

c = c.replace(/const minTargetOhm = [\s\S]*?maxTC\);/, 
`  const defaultTiers = [
    { maxCvr: 10, min: 1.0, max: 1.2 },
    { maxCvr: 20, min: 1.0, max: 1.7 },
    { maxCvr: 9999, min: 1.4, max: 2.0 }
  ];
  const itemTiers = (aiSettings?.dynamicTLTiers && aiSettings.dynamicTLTiers.length > 0) 
    ? [...aiSettings.dynamicTLTiers].sort((a,b) => a.maxCvr - b.maxCvr) 
    : defaultTiers;
  const tMin = itemTiers.length > 0 ? Math.min(...itemTiers.map(t => t.min)) : 1.0;
  const tMax = itemTiers.length > 0 ? Math.max(...itemTiers.map(t => t.max)) : 2.0;

  const minTargetOhm = Math.round(lc * tMin * minTC);
  const maxTargetOhm = Math.round(lc * tMax * maxTC);`);

fs.writeFileSync('src/components/MixerTab.tsx', c);
