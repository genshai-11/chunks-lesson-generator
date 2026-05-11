const fs = require('fs');
let c = fs.readFileSync('src/components/MixerTab.tsx', 'utf8');

c = c.replace(/const currentMinCVR = [\s\S]*?currentMaxTC\);/, 
`  const defaultTiers = [
    { maxCvr: 10, min: 1.0, max: 1.2 },
    { maxCvr: 20, min: 1.0, max: 1.7 },
    { maxCvr: 9999, min: 1.4, max: 2.0 }
  ];
  const tiers = (aiSettings?.dynamicTLTiers && aiSettings.dynamicTLTiers.length > 0) 
    ? [...aiSettings.dynamicTLTiers].sort((a,b) => a.maxCvr - b.maxCvr) 
    : defaultTiers;
  const lowestMin = tiers.length > 0 ? Math.min(...tiers.map(t => t.min)) : 1.0;
  const highestMax = tiers.length > 0 ? Math.max(...tiers.map(t => t.max)) : 2.0;

  const currentMinCVR = Math.round(currentLC * lowestMin * currentMinTC);
  const currentMaxCVR = Math.round(currentLC * highestMax * currentMaxTC);`);

fs.writeFileSync('src/components/MixerTab.tsx', c);
