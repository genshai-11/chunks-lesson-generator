const fs = require('fs');
let c = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');

c = c.replace(/('Long': 2\.5\n\s*},\n\s*dynamicTLBounds: \{\n\s*cvrUnder10: \{\s*min:\s*1\.0,\s*max:\s*1\.2\s*\},\n\s*cvrUnder20: \{\s*min:\s*1\.0,\s*max:\s*1\.7\s*\},\n\s*cvr20Plus: \{\s*min:\s*1\.4,\s*max:\s*2\.0\s*\}\n\s*\})/g, "'Long': 2.5\n            }");

c = c.replace(/if \(\!data\.complexityMultipliers\) \{[\s\S]*?\n\s*\}/g, match => {
  if (match.includes("dynamicTLBounds")) return match;
  return match + "\n          if (!data.dynamicTLBounds) {\n            data.dynamicTLBounds = {\n              cvrUnder10: { min: 1.0, max: 1.2 },\n              cvrUnder20: { min: 1.0, max: 1.7 },\n              cvr20Plus: { min: 1.4, max: 2.0 }\n            };\n          }";
});

// For setDoc, we can replace the `{ merge: true });` string. Let's find it.
// It's under `complexityMultipliers: settings.complexityMultipliers || { ... }`
// Wait, my previous replace modified it to be:
/*
                      complexityMultipliers: settings.complexityMultipliers || {
                        'Very Short': 1,
                        'Short': 1.5,
                        'Medium': 2,
                        'Long': 2.5
                      },
    dynamicTLBounds: {
      cvrUnder10: { min: 1.0, max: 1.2 },
      cvrUnder20: { min: 1.0, max: 1.7 },
      cvr20Plus: { min: 1.4, max: 2.0 }
    },
                    }, { merge: true });
*/

// Let's replace the whole setDoc block with string replacement:
const badBlock = `                      complexityMultipliers: settings.complexityMultipliers || {
                        'Very Short': 1,
                        'Short': 1.5,
                        'Medium': 2,
                        'Long': 2.5
                      },
    dynamicTLBounds: {
      cvrUnder10: { min: 1.0, max: 1.2 },
      cvrUnder20: { min: 1.0, max: 1.7 },
      cvr20Plus: { min: 1.4, max: 2.0 }
    },
                    }, { merge: true });`;

const goodBlock = `                      complexityMultipliers: settings.complexityMultipliers || {
                        'Very Short': 1,
                        'Short': 1.5,
                        'Medium': 2,
                        'Long': 2.5
                      },
                      dynamicTLBounds: settings.dynamicTLBounds || {
                        cvrUnder10: { min: 1.0, max: 1.2 },
                        cvrUnder20: { min: 1.0, max: 1.7 },
                        cvr20Plus: { min: 1.4, max: 2.0 }
                      }
                    }, { merge: true });`;

c = c.replace(badBlock, goodBlock);

fs.writeFileSync('src/components/SettingsTab.tsx', c);
