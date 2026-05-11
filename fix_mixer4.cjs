const fs = require('fs');
let c = fs.readFileSync('src/components/MixerTab.tsx', 'utf8');

c = c.replace(/<div className="flex justify-between items-center"><span className="text-pink-400(.*?)<\/span><\/div>\s*<div className="flex justify-between items-center"><span className="text-blue-400(.*?)<\/span><\/div>\s*<div className="flex justify-between items-center"><span className="text-yellow-400(.*?)<\/span><\/div>\s*<div className="flex justify-between items-center"><span className="text-green-400(.*?)<\/span><\/div>/, 
`<div className="flex justify-between items-center"><span className="text-pink-400 font-bold uppercase tracking-widest text-[9px]">Very Short:</span> <span>{Math.round((aiSettings?.complexityMultipliers?.['Very Short'] ?? 1) * lowestMin * 3)} - {Math.round((aiSettings?.complexityMultipliers?.['Very Short'] ?? 1) * highestMax * 9)}</span></div>
<div className="flex justify-between items-center"><span className="text-blue-400 font-bold uppercase tracking-widest text-[9px]">Short:</span> <span>{Math.round((aiSettings?.complexityMultipliers?.['Short'] ?? 1.5) * lowestMin * 9)} - {Math.round((aiSettings?.complexityMultipliers?.['Short'] ?? 1.5) * highestMax * 15)}</span></div>
<div className="flex justify-between items-center"><span className="text-yellow-400 font-bold uppercase tracking-widest text-[9px]">Medium:</span> <span>{Math.round((aiSettings?.complexityMultipliers?.['Medium'] ?? 2) * lowestMin * 15)} - {Math.round((aiSettings?.complexityMultipliers?.['Medium'] ?? 2) * highestMax * 21)}</span></div>
<div className="flex justify-between items-center"><span className="text-green-400 font-bold uppercase tracking-widest text-[9px]">Long:</span> <span>{Math.round((aiSettings?.complexityMultipliers?.['Long'] ?? 2.5) * lowestMin * 21)} - {Math.round((aiSettings?.complexityMultipliers?.['Long'] ?? 2.5) * highestMax * 27)}</span></div>`);

fs.writeFileSync('src/components/MixerTab.tsx', c);
