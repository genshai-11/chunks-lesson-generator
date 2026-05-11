const fs = require('fs');
let c = fs.readFileSync('src/components/MixerTab.tsx', 'utf8');

c = c.replace(/if \(aiTargetCVR < 10\) \{[\s\S]*?\} else \{[\s\S]*?\}/, 
`            const defaultTiers = [
              { maxCvr: 10, min: 1.0, max: 1.2 },
              { maxCvr: 20, min: 1.0, max: 1.7 },
              { maxCvr: 9999, min: 1.4, max: 2.0 }
            ];
            const tiers = (aiSettings?.dynamicTLTiers && aiSettings.dynamicTLTiers.length > 0) 
              ? [...aiSettings.dynamicTLTiers].sort((a,b) => a.maxCvr - b.maxCvr) 
              : defaultTiers;
            
            let matchedTier = tiers[tiers.length - 1];
            for (const tier of tiers) {
              if (aiTargetCVR < tier.maxCvr) {
                matchedTier = tier;
                break;
              }
            }
            expectedMinTL = matchedTier.min;
            expectedMaxTL = matchedTier.max;`);

fs.writeFileSync('src/components/MixerTab.tsx', c);
