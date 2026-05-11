const fs = require('fs');
let c = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');

// 1. Remove the entire "Dynamic TL Bounds" block
let start = c.indexOf('<div className="mt-8 pt-6 border-t border-gray-100">\\n                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">\\n                      <div className="flex items-center"><Sparkles className="w-4 h-4 mr-2" /> Dynamic TL Bounds</div>');
if (start === -1) {
    // maybe spaces differ?
    start = c.indexOf('Dynamic TL Bounds');
    start = c.lastIndexOf('<div className="mt-8 pt-6 border-t border-gray-100">', start);
}

// Find where this block ends.
// In the current file, after the loop:
let endMarker = '))}';
let mapEnd = c.indexOf(endMarker, start);
let endBlock = c.indexOf('</div>', mapEnd);
endBlock = c.indexOf('</div>', endBlock + 6);
endBlock = c.indexOf('</div>', endBlock + 6) + 6; // Three </div> tags

// remove it
let withoutBounds = c.substring(0, start) + c.substring(endBlock);

// 2. Now let's just make sure the `audio` tab ends correctly.
// Right after the deepgram block, it should be just:
//          </div>
//        )}
// Let's replace the corrupted ending.
let audioEndMarker = "{activeSubTab === 'api' && (";
let audioEndIdx = withoutBounds.indexOf(audioEndMarker);

let sub1 = withoutBounds.substring(0, audioEndIdx);
// find deepgram end
let dgEnd = sub1.lastIndexOf(')}'); // this is `            )}` of deepgram block
let cleanSub1 = sub1.substring(0, dgEnd + 2) + '\\n          </div>\\n        )}\\n\\n        ';

let sub2 = withoutBounds.substring(audioEndIdx);

let rebuilt = cleanSub1 + sub2;

// 3. Now let's insert the Dynamic TL Bounds block safely at the end of the `ai` tab block.
let aiEndMarker = "{activeSubTab === 'audio' && (";
let aiEndIdx = rebuilt.indexOf(aiEndMarker);

// Find the last </div> before aiEndMarker
let lastDivAi = rebuilt.lastIndexOf('</div>', aiEndIdx);
let beforeLastDiv = rebuilt.substring(0, lastDivAi);
let afterLastDiv = rebuilt.substring(lastDivAi);

const dynamicTLBoundsHTML = `<div className="mt-8 pt-6 border-t border-gray-100">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                      <div className="flex items-center"><Sparkles className="w-4 h-4 mr-2" /> Dynamic TL Bounds</div>
                      <button 
                        onClick={() => {
                          const current = [...(settings.dynamicTLTiers || [
                            { maxCvr: 10, min: 1.0, max: 1.2 },
                            { maxCvr: 20, min: 1.0, max: 1.7 },
                            { maxCvr: 9999, min: 1.4, max: 2.0 }
                          ])];
                          current.push({ maxCvr: 30, min: 1.0, max: 2.0 });
                          current.sort((a,b) => a.maxCvr - b.maxCvr);
                          setSettings({ ...settings, dynamicTLTiers: current });
                        }}
                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                      >
                        + Add Tier
                      </button>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {(settings.dynamicTLTiers || [
                        { maxCvr: 10, min: 1.0, max: 1.2 },
                        { maxCvr: 20, min: 1.0, max: 1.7 },
                        { maxCvr: 9999, min: 1.4, max: 2.0 }
                      ]).map((tier, idx, arr) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1 relative group">
                          <button 
                            onClick={() => {
                              const current = [...(settings.dynamicTLTiers || [
                                { maxCvr: 10, min: 1.0, max: 1.2 },
                                { maxCvr: 20, min: 1.0, max: 1.7 },
                                { maxCvr: 9999, min: 1.4, max: 2.0 }
                              ])];
                              current.splice(idx, 1);
                              setSettings({ ...settings, dynamicTLTiers: current });
                            }}
                            className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[10px] font-bold z-10 hover:bg-red-200 transition-opacity"
                            title="Remove tier"
                          >
                            ×
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">CVR &lt; </span>
                            <input 
                              type="number" 
                              value={tier.maxCvr === 9999 ? '' : tier.maxCvr} 
                              placeholder="Any"
                              onChange={(e) => {
                                const current = [...(settings.dynamicTLTiers || [
                                  { maxCvr: 10, min: 1.0, max: 1.2 },
                                  { maxCvr: 20, min: 1.0, max: 1.7 },
                                  { maxCvr: 9999, min: 1.4, max: 2.0 }
                                ])];
                                current[idx].maxCvr = e.target.value ? Number(e.target.value) : 9999;
                                setSettings({ ...settings, dynamicTLTiers: current });
                              }}
                              className="w-16 text-center bg-white border border-gray-200 rounded p-0.5 text-[10px] font-bold focus:ring-0 focus:border-red-500 text-gray-700" 
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Min</label>
                              <input 
                                type="number" step="0.1" 
                                value={tier.min} 
                                onChange={(e) => {
                                  const current = [...(settings.dynamicTLTiers || [
                                    { maxCvr: 10, min: 1.0, max: 1.2 },
                                    { maxCvr: 20, min: 1.0, max: 1.7 },
                                    { maxCvr: 9999, min: 1.4, max: 2.0 }
                                  ])];
                                  current[idx].min = Number(e.target.value);
                                  setSettings({ ...settings, dynamicTLTiers: current });
                                }}
                                className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" 
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Max</label>
                              <input 
                                type="number" step="0.1" 
                                value={tier.max} 
                                onChange={(e) => {
                                  const current = [...(settings.dynamicTLTiers || [
                                    { maxCvr: 10, min: 1.0, max: 1.2 },
                                    { maxCvr: 20, min: 1.0, max: 1.7 },
                                    { maxCvr: 9999, min: 1.4, max: 2.0 }
                                  ])];
                                  current[idx].max = Number(e.target.value);
                                  setSettings({ ...settings, dynamicTLTiers: current });
                                }}
                                className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>`;

rebuilt = beforeLastDiv + dynamicTLBoundsHTML + afterLastDiv;

fs.writeFileSync('src/components/SettingsTab.tsx', rebuilt);
console.log('Fixed SettingsTab.tsx!');
