const fs = require('fs');
const content = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');

const anchorStr = `                        />
                      </div>
                    ))}
                    </div>
                  </div>`;
                  
const uiContent = `
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                      <Sparkles className="w-4 h-4 mr-2" /> Dynamic TL Bounds
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                        <span className="text-[9px] font-bold text-gray-500 uppercase block">CVR &lt; 10</span>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Min</label>
                            <input type="number" step="0.1" value={settings.dynamicTLBounds?.cvrUnder10.min ?? 1.0} onChange={e => setSettings({...settings, dynamicTLBounds: {...(settings.dynamicTLBounds || { cvrUnder10: { min: 1.0, max: 1.2 }, cvrUnder20: { min: 1.0, max: 1.7 }, cvr20Plus: { min: 1.4, max: 2.0 } }), cvrUnder10: { ...settings.dynamicTLBounds?.cvrUnder10, min: Number(e.target.value) }}})} className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Max</label>
                            <input type="number" step="0.1" value={settings.dynamicTLBounds?.cvrUnder10.max ?? 1.2} onChange={e => setSettings({...settings, dynamicTLBounds: {...(settings.dynamicTLBounds || { cvrUnder10: { min: 1.0, max: 1.2 }, cvrUnder20: { min: 1.0, max: 1.7 }, cvr20Plus: { min: 1.4, max: 2.0 } }), cvrUnder10: { ...settings.dynamicTLBounds?.cvrUnder10, max: Number(e.target.value) }}})} className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                        <span className="text-[9px] font-bold text-gray-500 uppercase block">CVR &lt; 20</span>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Min</label>
                            <input type="number" step="0.1" value={settings.dynamicTLBounds?.cvrUnder20.min ?? 1.0} onChange={e => setSettings({...settings, dynamicTLBounds: {...(settings.dynamicTLBounds || { cvrUnder10: { min: 1.0, max: 1.2 }, cvrUnder20: { min: 1.0, max: 1.7 }, cvr20Plus: { min: 1.4, max: 2.0 } }), cvrUnder20: { ...settings.dynamicTLBounds?.cvrUnder20, min: Number(e.target.value) }}})} className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Max</label>
                            <input type="number" step="0.1" value={settings.dynamicTLBounds?.cvrUnder20.max ?? 1.7} onChange={e => setSettings({...settings, dynamicTLBounds: {...(settings.dynamicTLBounds || { cvrUnder10: { min: 1.0, max: 1.2 }, cvrUnder20: { min: 1.0, max: 1.7 }, cvr20Plus: { min: 1.4, max: 2.0 } }), cvrUnder20: { ...settings.dynamicTLBounds?.cvrUnder20, max: Number(e.target.value) }}})} className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" />
                          </div>
                        </div>
                      </div>

                      <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                        <span className="text-[9px] font-bold text-gray-500 uppercase block">CVR &gt;= 20</span>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Min</label>
                            <input type="number" step="0.1" value={settings.dynamicTLBounds?.cvr20Plus.min ?? 1.4} onChange={e => setSettings({...settings, dynamicTLBounds: {...(settings.dynamicTLBounds || { cvrUnder10: { min: 1.0, max: 1.2 }, cvrUnder20: { min: 1.0, max: 1.7 }, cvr20Plus: { min: 1.4, max: 2.0 } }), cvr20Plus: { ...settings.dynamicTLBounds?.cvr20Plus, min: Number(e.target.value) }}})} className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Max</label>
                            <input type="number" step="0.1" value={settings.dynamicTLBounds?.cvr20Plus.max ?? 2.0} onChange={e => setSettings({...settings, dynamicTLBounds: {...(settings.dynamicTLBounds || { cvrUnder10: { min: 1.0, max: 1.2 }, cvrUnder20: { min: 1.0, max: 1.7 }, cvr20Plus: { min: 1.4, max: 2.0 } }), cvr20Plus: { ...settings.dynamicTLBounds?.cvr20Plus, max: Number(e.target.value) }}})} className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>`;

if(content.includes(anchorStr)) {
  fs.writeFileSync('src/components/SettingsTab.tsx', content.replace(anchorStr, anchorStr + uiContent));
  console.log('SUCCESS');
} else {
  console.log('FAILED');
}
