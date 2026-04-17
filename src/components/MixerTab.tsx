import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Resource, Chunk, AISettings } from '../types';
import { generateChunk } from '../services/aiService';
import { Wand2, Save, Loader2, Sparkles, Settings2, Trash2, CheckCircle2, RefreshCw, Activity, Zap, Cpu, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MultiMeter = ({ label, value, unit, colorClass, icon: Icon, description }: { label: string, value: string | number, unit: string, colorClass: string, icon: any, description?: string }) => (
  <div className="relative group overflow-hidden">
    <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-5 group-hover:opacity-10 transition-opacity`} />
    <div className="relative p-5 rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500">
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</span>
          {description && <span className="text-[10px] text-gray-400 font-medium">{description}</span>}
        </div>
        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
          <Icon className={`w-4 h-4 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
      </div>
      <div className="flex items-baseline space-x-1">
        <span className="text-4xl font-black text-gray-900 tabular-nums tracking-tighter">{value}</span>
        <span className="text-sm font-bold text-gray-400 uppercase tracking-wide">{unit}</span>
      </div>
      <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden shadow-inner">
        <div 
          className={`h-full ${colorClass} transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(0,0,0,0.1)]`} 
          style={{ width: `${Math.min(100, (Number(value) / 200) * 100)}%` }} 
        />
      </div>
    </div>
  </div>
);
import { ColorCategory } from '../types';
import { doc, getDoc } from 'firebase/firestore';

interface DraftChunk {
  id: string;
  resourcesUsed: Resource[];
  rTotal: number;
  iValue: number;
  uTotal: number;
  status: 'draft' | 'loading' | 'success' | 'error';
  result?: {
    engSentence: string;
    vieSentence: string;
    category: string;
    evaluation?: string;
    difficultyLabel: string;
  };
}

const COLOR_STYLES: Record<string, { text: string, bg: string, border: string, tagBg: string, tagText: string, tagBorder: string }> = {
  Green: { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', tagBg: 'bg-green-50', tagText: 'text-green-700', tagBorder: 'border-green-100' },
  Blue: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', tagBg: 'bg-blue-50', tagText: 'text-blue-700', tagBorder: 'border-blue-100' },
  Red: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', tagBg: 'bg-red-50', tagText: 'text-red-700', tagBorder: 'border-red-100' },
  Pink: { text: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', tagBg: 'bg-pink-50', tagText: 'text-pink-700', tagBorder: 'border-pink-100' },
  Yellow: { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', tagBg: 'bg-yellow-50', tagText: 'text-yellow-700', tagBorder: 'border-yellow-100' },
  Orange: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', tagBg: 'bg-orange-50', tagText: 'text-orange-700', tagBorder: 'border-orange-100' },
  Purple: { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', tagBg: 'bg-purple-50', tagText: 'text-purple-700', tagBorder: 'border-purple-100' },
};

export default function MixerTab() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings | undefined>();
  
  // Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  // AI Mode State
  const [aiTheme, setAiTheme] = useState('');
  const [blueprintMode, setBlueprintMode] = useState<'targetOhm' | 'recipe'>('targetOhm');
  const [aiTargetOhm, setAiTargetOhm] = useState<number>(30);
  const [aiQuantity, setAiQuantity] = useState<number>(3);
  const [aiMaxPerColor, setAiMaxPerColor] = useState<number>(1);
  const [aiRecipe, setAiRecipe] = useState<Record<ColorCategory, number>>({ Green: 0, Blue: 0, Pink: 0, Red: 0, Yellow: 0, Orange: 0, Purple: 0 });
  const [aiSentenceLength, setAiSentenceLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [aiColors, setAiColors] = useState<ColorCategory[]>(['Green', 'Blue', 'Red', 'Pink']);
  const [rFormulaMode, setRFormulaMode] = useState<'circuit' | 'linear'>('circuit');
  const [draftChunks, setDraftChunks] = useState<DraftChunk[]>([]);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [regeneratingAutoIdx, setRegeneratingAutoIdx] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      collection(db, `workspaces/default/resources`),
      (snapshot) => {
        const resData: Resource[] = [];
        snapshot.forEach((doc) => {
          resData.push({ id: doc.id, ...doc.data() } as Resource);
        });
        setResources(resData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `workspaces/default/resources`);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const loadSettings = async () => {
      try {
        const docRef = doc(db, `workspaces/default/settings`, 'ai');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAiSettings(docSnap.data() as AISettings);
        }
      } catch (error) {
        console.error('Error loading AI settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleRegenerate = async (index: number) => {
    const chunk = draftChunks[index];
    if (!chunk || !chunk.resourcesUsed || !aiSettings) return;

    setRegeneratingAutoIdx(index);
    setDraftChunks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], status: 'loading' };
      return next;
    });

    try {
      const result = await generateChunk({
        resources: chunk.resourcesUsed,
        rTotal: chunk.rTotal || 0,
        iValue: chunk.iValue || 1,
        uTotal: chunk.uTotal || 0,
        settings: aiSettings
      });

      setDraftChunks(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          status: 'success',
          result: {
            engSentence: result.engSentence,
            vieSentence: result.vieSentence,
            category: result.category,
            evaluation: (result as any).evaluation,
            difficultyLabel: next[index].result?.difficultyLabel || 'Beginner'
          }
        };
        return next;
      });
      
      setSavedIndices(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    } catch (error) {
      console.error("Failed to regenerate chunk:", error);
      setDraftChunks(prev => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error' };
        return next;
      });
    } finally {
      setRegeneratingAutoIdx(null);
    }
  };

  const calculateOhm = (usedResources: Resource[]) => {
    if (usedResources.length === 0) return 0;
    
    // Correct Circuit Formula (must match aiService / Audio test):
    // Same color = ADD (Series)
    // Different colors = MULTIPLY (Parallel)
    const groups: Record<string, number[]> = {};
    usedResources.forEach(r => {
      if (!groups[r.color]) groups[r.color] = [];
      groups[r.color].push(r.ohm);
    });
    
    // Sum within each color group
    const colorSums = Object.values(groups).map(group => 
      group.reduce((sum, ohm) => sum + ohm, 0)
    );
    
    // Multiply the sums of different colors
    const totalOhm = colorSums.reduce((prod, val) => prod * val, 1);
    
    return Math.round(totalOhm * 10) / 10;
  };

  const handlePrepareBlueprint = () => {
    if (!aiTheme || resources.length === 0) return;
    
    // Group by color (all resources)
    const allResourcesByColor: Record<string, Resource[]> = {};
    resources.forEach(r => {
      if (!allResourcesByColor[r.color]) allResourcesByColor[r.color] = [];
      allResourcesByColor[r.color].push(r);
    });

    const newDrafts: DraftChunk[] = [];
    
    for (let i = 0; i < aiQuantity; i++) {
      let currentCombo: Resource[] = [];
      let currentOhm = 0;

      if (blueprintMode === 'recipe') {
        // Recipe Mode: Pick exactly the number of items specified for each color
        Object.entries(aiRecipe).forEach(([color, countValue]) => {
          const count = countValue as number;
          if (count > 0) {
            const itemsInColor = allResourcesByColor[color] || [];
            if (itemsInColor.length > 0) {
              const numItems = Math.min(count, itemsInColor.length);
              const shuffledItems = [...itemsInColor].sort(() => 0.5 - Math.random()).slice(0, numItems);
              currentCombo.push(...shuffledItems);
            }
          }
        });
        currentOhm = calculateOhm(currentCombo);
      } else {
        // Target Ohm Mode: Use existing logic
        // Filter by color preferences
        const filteredResources = resources.filter(r => aiColors.length === 0 || aiColors.includes(r.color));
        if (filteredResources.length === 0) {
          if (i === 0) showToast("No resources match your color preferences.");
          return;
        }

        const resourcesByColor: Record<string, Resource[]> = {};
        filteredResources.forEach(r => {
          if (!resourcesByColor[r.color]) resourcesByColor[r.color] = [];
          resourcesByColor[r.color].push(r);
        });
        const availableColors = Object.keys(resourcesByColor);

        let bestCombo: Resource[] = [];
        let bestOhm = 0;
        let attempts = 0;
        const maxAttempts = 300; // Increased search depth
        
        while (attempts < maxAttempts) {
          let testCombo: Resource[] = [];
          
          const numColorsToMix = Math.min(
            availableColors.length, 
            Math.max(2, Math.floor(Math.random() * availableColors.length) + 1)
          );
          const shuffledColors = [...availableColors].sort(() => 0.5 - Math.random()).slice(0, numColorsToMix);

          shuffledColors.forEach(color => {
            const itemsInColor = resourcesByColor[color];
            // If target is high, temporarily allow more keywords to reach the Ohm goal
            const effectiveMax = aiTargetOhm > 50 ? Math.max(aiMaxPerColor, 4) : aiMaxPerColor;
            const limit = Math.min(effectiveMax, itemsInColor.length);
            const numItems = Math.floor(Math.random() * limit) + 1;
            const shuffledItems = [...itemsInColor].sort(() => 0.5 - Math.random()).slice(0, numItems);
            testCombo.push(...shuffledItems);
          });

          const testOhm = calculateOhm(testCombo);
          
          if (attempts === 0 || Math.abs(testOhm - aiTargetOhm) < Math.abs(bestOhm - aiTargetOhm)) {
            bestCombo = testCombo;
            bestOhm = testOhm;
          }
          
          if (Math.abs(bestOhm - aiTargetOhm) <= (aiTargetOhm * 0.05)) break; // 5% tolerance
          attempts++;
        }
        currentCombo = bestCombo;
        currentOhm = bestOhm;
      }

      if (currentCombo.length > 0) {
        // Dynamic Load (I) calculation based on sentence length
        let baseI = 1.0;
        if (aiSentenceLength === 'Short') baseI = 0.8;
        if (aiSentenceLength === 'Medium') baseI = 1.5;
        if (aiSentenceLength === 'Long') baseI = 2.5;
        
        // Add minimal jitter (+/- 0.2)
        const jitter = (Math.random() * 0.4) - 0.2;
        const finalI = Math.max(0.5, Math.round((baseI + jitter) * 10) / 10);
        const finalU = Math.round((currentOhm * finalI) * 10) / 10;

        newDrafts.push({
          id: `draft-${Date.now()}-${i}`,
          resourcesUsed: currentCombo,
          rTotal: currentOhm,
          iValue: finalI,
          uTotal: finalU,
          status: 'draft'
        });
      }
    }

    if (newDrafts.length > 0) {
      setDraftChunks(newDrafts);
      setSavedIndices(new Set());
    } else if (blueprintMode === 'recipe') {
      showToast("Could not generate drafts. Please check your recipe and ensure you have resources for the selected colors.");
    }
  };

  const handleExecuteDraft = async (index: number) => {
    const draft = draftChunks[index];
    if (!draft || draft.status === 'loading') return;

    setDraftChunks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], status: 'loading' };
      return next;
    });

    try {
      const result = await generateChunk({
        resources: draft.resourcesUsed,
        rTotal: draft.rTotal,
        iValue: draft.iValue,
        uTotal: draft.uTotal,
        theme: aiTheme,
        sentenceLength: aiSentenceLength,
        settings: aiSettings
      });

      let difficultyLabel = 'Beginner';
      if (draft.uTotal > 20) difficultyLabel = 'Intermediate';
      if (draft.uTotal > 50) difficultyLabel = 'Advanced';
      if (draft.uTotal > 100) difficultyLabel = 'Master';

      setDraftChunks(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          status: 'success',
          result: {
            engSentence: result.engSentence,
            vieSentence: result.vieSentence,
            category: result.category,
            evaluation: (result as any).evaluation,
            difficultyLabel
          }
        };
        return next;
      });
    } catch (error) {
      console.error(error);
      setDraftChunks(prev => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error' };
        return next;
      });
    }
  };

  const handleExecuteAllPending = async () => {
    const pendingIndices = draftChunks
      .map((d, idx) => d.status === 'draft' || d.status === 'error' ? idx : -1)
      .filter(idx => idx !== -1);
      
    if (pendingIndices.length === 0) return;
    
    setLoading(true);
    setGenerationProgress({ current: 0, total: pendingIndices.length });
    
    // Execute sequentially to avoid rate limits
    for (let i = 0; i < pendingIndices.length; i++) {
      await handleExecuteDraft(pendingIndices[i]);
      setGenerationProgress(prev => ({ ...prev, current: i + 1 }));
    }
    
    setLoading(false);
    setGenerationProgress({ current: 0, total: 0 });
  };

  const handleSaveAll = async () => {
    if (!auth.currentUser || draftChunks.length === 0) return;
    setSaving(true);
    try {
      const unsaved = draftChunks.filter((d, idx) => d.status === 'success' && !savedIndices.has(idx));
      await Promise.all(unsaved.map(async (draft) => {
        const originalIdx = draftChunks.indexOf(draft);
        if (!draft.result) return;
        
        const chunkData = {
          resourcesUsed: draft.resourcesUsed,
          rTotal: draft.rTotal,
          iValue: draft.iValue,
          uTotal: draft.uTotal,
          engSentence: draft.result.engSentence,
          vieSentence: draft.result.vieSentence,
          category: draft.result.category,
          evaluation: draft.result.evaluation,
          difficultyLabel: draft.result.difficultyLabel,
          userId: auth.currentUser!.uid,
          createdAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, `workspaces/default/chunks`), chunkData);
        setSavedIndices(prev => new Set(prev).add(originalIdx));
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `workspaces/default/chunks`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateResult = (index: number, field: 'engSentence' | 'vieSentence', value: string) => {
    setDraftChunks(prev => {
      const next = [...prev];
      if (next[index].result) {
        next[index] = {
          ...next[index],
          result: {
            ...next[index].result!,
            [field]: value
          }
        };
      }
      return next;
    });
  };

  const handleSaveAIChunk = async (draft: DraftChunk, index: number) => {
    if (!auth.currentUser || !draft.result) return;
    setSavingIndex(index);
    try {
      const chunkData = {
        resourcesUsed: draft.resourcesUsed,
        rTotal: draft.rTotal,
        iValue: draft.iValue,
        uTotal: draft.uTotal,
        engSentence: draft.result.engSentence,
        vieSentence: draft.result.vieSentence,
        category: draft.result.category,
        evaluation: draft.result.evaluation,
        difficultyLabel: draft.result.difficultyLabel,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, `workspaces/default/chunks`), chunkData);
      setSavedIndices(prev => new Set(prev).add(index));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `workspaces/default/chunks`);
    } finally {
      setSavingIndex(null);
    }
  };

  const toggleAiColor = (color: ColorCategory) => {
    setAiColors(prev => 
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-20 left-1/2 z-50 px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-full shadow-2xl"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

        <div className="space-y-6 animate-in fade-in duration-300">
          {/* AI Generator Controls */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-900 flex items-center">
                <Sparkles className="w-6 h-6 mr-3 text-red-600" />
                AI Linguistic Blueprinting
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={handlePrepareBlueprint}
                  disabled={loading || !aiTheme}
                  className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-30 flex items-center"
                >
                  <Cpu className="w-4 h-4 mr-2" /> 1. Calculate Blueprints
                </button>
                {draftChunks.length > 0 && (
                  <button
                    onClick={handleExecuteAllPending}
                    disabled={loading}
                    className="px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-30 flex items-center shadow-lg shadow-red-200"
                  >
                    <Zap className="w-4 h-4 mr-2" /> 2. Execute {draftChunks.filter(d => d.status === 'draft').length} Pulses
                  </button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic / Theme</label>
                  <input
                    type="text"
                    value={aiTheme}
                    onChange={(e) => setAiTheme(e.target.value)}
                    placeholder="e.g., Business meeting, Travel, Daily life"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blueprint Mode</label>
                  <div className="flex bg-gray-100 p-1 rounded-md mb-4">
                    <button
                      onClick={() => setBlueprintMode('targetOhm')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                        blueprintMode === 'targetOhm' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Target Ohm
                    </button>
                    <button
                      onClick={() => setBlueprintMode('recipe')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                        blueprintMode === 'recipe' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Custom Recipe
                    </button>
                  </div>
                </div>

                {blueprintMode === 'targetOhm' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Target Ohm (R)</label>
                        <input
                          type="number"
                          value={aiTargetOhm}
                          onChange={(e) => setAiTargetOhm(Number(e.target.value))}
                          className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm font-bold"
                          min="5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Quantity</label>
                        <input
                          type="number"
                          value={aiQuantity}
                          onChange={(e) => setAiQuantity(Number(e.target.value))}
                          className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm font-bold"
                          min="1"
                          max="50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Items/Color</label>
                        <input
                          type="number"
                          value={aiMaxPerColor}
                          onChange={(e) => setAiMaxPerColor(Number(e.target.value))}
                          className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm font-bold"
                          min="1"
                          max="5"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Calculation Formula</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setRFormulaMode('circuit')}
                          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            rFormulaMode === 'circuit'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          Series-Parallel
                        </button>
                        <button
                          onClick={() => setRFormulaMode('linear')}
                          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            rFormulaMode === 'linear'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-emerald-300'
                          }`}
                        >
                          Linear Sum
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={aiQuantity}
                        onChange={(e) => setAiQuantity(Number(e.target.value))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
                        min="1"
                        max="50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Items per Color</label>
                      <div className="grid grid-cols-4 gap-2">
                        {['Green', 'Blue', 'Pink', 'Red'].map((color) => (
                          <div key={color}>
                            <label className={`block text-xs font-medium mb-1 ${
                              color === 'Green' ? 'text-green-700' :
                              color === 'Blue' ? 'text-blue-700' :
                              color === 'Pink' ? 'text-pink-700' :
                              'text-red-700'
                            }`}>{color}</label>
                            <input
                              type="number"
                              value={aiRecipe[color as ColorCategory]}
                              onChange={(e) => setAiRecipe(prev => ({ ...prev, [color]: Number(e.target.value) }))}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm text-center"
                              min="0"
                              max="5"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="flex items-center text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                    Sentence Length
                    <div className="group relative ml-2">
                       <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-[10px] rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-medium normal-case tracking-normal">
                         <div className="space-y-2">
                           <div><span className="font-bold text-blue-400 uppercase tracking-wide text-[9px]">Short</span><br/>1-2 clauses, direct and concise. Focuses purely on embedding the keywords.</div>
                           <div><span className="font-bold text-yellow-400 uppercase tracking-wide text-[9px]">Medium</span><br/>Standard conversational sentence, balanced context and detail.</div>
                           <div><span className="font-bold text-green-400 uppercase tracking-wide text-[9px]">Long</span><br/>Complex structures, multiple clauses, storytelling, rich context.</div>
                         </div>
                         <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                       </div>
                    </div>
                  </label>
                  <div className="flex bg-gray-100/50 p-1 rounded-xl">
                    {(['Short', 'Medium', 'Long'] as const).map((len) => (
                      <button
                        key={len}
                        onClick={() => setAiSentenceLength(len)}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          aiSentenceLength === len ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {blueprintMode === 'targetOhm' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Color Focus Preferences</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Green', 'Blue', 'Red', 'Pink'].map((color) => (
                        <button
                          key={color}
                          onClick={() => toggleAiColor(color as ColorCategory)}
                          className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                            aiColors.includes(color as ColorCategory)
                              ? 'bg-red-50 border-red-200 text-red-600'
                              : 'bg-white border-gray-200 text-gray-400 hover:border-red-200 shadow-sm'
                          }`}
                        >
                          {color}
                          {aiColors.includes(color as ColorCategory) && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-gray-400 font-bold uppercase tracking-wide italic">The AI will prioritize resources from these color groups.</p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center space-x-3 mb-2">
                      <Zap className="w-4 h-4 text-red-600" />
                      <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Logic Engine</span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                      Topic, colors, and R-values are combined to generate precise linguistic blueprints before execution.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handlePrepareBlueprint}
              disabled={!aiTheme || resources.length === 0}
              className="mt-8 w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              <Settings2 className="-ml-1 mr-2 h-5 w-5" /> 1. Prepare Blueprint
            </button>
          </div>

          {/* AI Results Pipeline */}
          {draftChunks.length > 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-center justify-between px-2">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black text-gray-900 flex items-center">
                    <Cpu className="w-5 h-5 mr-3 text-gray-400" />
                    Blueprint Selection Pipeline
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Measurable Semantic Loads Ready for Execution
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleExecuteAllPending}
                    disabled={loading || draftChunks.every(d => d.status === 'success')}
                    className="flex items-center px-6 py-2.5 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 disabled:opacity-30"
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    Ignite Pipeline
                  </button>
                  <button
                    onClick={handleSaveAll}
                    disabled={saving || draftChunks.filter(d => d.status === 'success' && !savedIndices.has(draftChunks.indexOf(d))).length === 0}
                    className="flex items-center px-4 py-2.5 bg-green-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-green-700 transition-all disabled:opacity-30 shadow-lg shadow-green-100"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save All
                  </button>
                  <button
                    onClick={() => setDraftChunks([])}
                    className="p-2.5 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {loading && generationProgress.total > 0 && (
                <div className="animate-in fade-in duration-300 bg-white p-6 rounded-2xl border border-gray-100 shadow-xl overflow-hidden relative">
                  <div className="absolute top-0 left-0 h-1 bg-red-600 transition-all duration-500" style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }} />
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black text-gray-900 uppercase">Mass Calibrating...</span>
                    <span className="text-xs font-black text-red-600">{Math.round((generationProgress.current / generationProgress.total) * 100)}%</span>
                  </div>
                  <div className="flex space-x-1">
                    {Array.from({ length: generationProgress.total }).map((_, i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < generationProgress.current ? 'bg-red-600' : 'bg-gray-100'}`} />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                {draftChunks.map((draft, idx) => (
                  <div key={draft.id} className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-red-200 transition-all duration-500 hover:shadow-2xl">
                    <div className="flex">
                      {/* Left Sidebar: Metrics */}
                      <div className="w-24 bg-gray-50/50 border-r border-gray-100 p-4 flex flex-col items-center justify-center space-y-4">
                        <div className="text-center">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Load</span>
                          <div className="text-sm font-black text-gray-900">{draft.rTotal.toFixed(0)}Ω</div>
                        </div>
                        <div className="w-full h-px bg-gray-200" />
                        <div className="flex flex-col space-y-1">
                          {Array.from(new Set(draft.resourcesUsed.map(r => r.color))).map((color: any) => (
                            <div 
                              key={color} 
                              className={`w-2 h-2 mx-auto rounded-full shadow-sm border border-white/50 ${
                                color === 'Green' ? 'bg-green-500' :
                                color === 'Blue' ? 'bg-blue-500' :
                                color === 'Red' ? 'bg-red-500' :
                                color === 'Pink' ? 'bg-pink-500' :
                                color === 'Yellow' ? 'bg-yellow-500' :
                                color === 'Orange' ? 'bg-orange-500' :
                                color === 'Purple' ? 'bg-purple-500' :
                                'bg-gray-400'
                              }`} 
                              title={color} 
                            />
                          ))}
                        </div>
                      </div>

                      {/* Main Area */}
                      <div className="flex-1 p-6">
                        <div className="flex flex-wrap gap-1.5 mb-6">
  {draft.resourcesUsed.map((r, ri) => (
    <span 
      key={ri} 
      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight border ${
        COLOR_STYLES[r.color]?.tagBg || 'bg-gray-100'
      } ${
        COLOR_STYLES[r.color]?.tagText || 'text-gray-500'
      } ${
        COLOR_STYLES[r.color]?.tagBorder || 'border-gray-200'
      }`}
    >
      {r.name}
    </span>
  ))}
</div>

                        <div className="min-h-[140px] flex flex-col justify-center">
                          {draft.status === 'draft' ? (
                            <button 
                              onClick={() => handleExecuteDraft(idx)}
                              className="w-full py-10 border-2 border-dashed border-gray-100 rounded-2xl hover:bg-red-50/30 hover:border-red-200 transition-all flex flex-col items-center group/btn"
                            >
                              <Zap className="w-8 h-8 text-gray-200 group-hover/btn:text-red-500 mb-3 transition-colors" />
                              <span className="text-[10px] font-black text-gray-400 group-hover/btn:text-red-600 uppercase tracking-widest">Execute Pulse</span>
                            </button>
                          ) : draft.status === 'loading' ? (
                            <div className="text-center py-10">
                              <Loader2 className="w-10 h-10 mx-auto text-red-500 animate-spin mb-4" />
                              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest animate-pulse">Computing...</span>
                            </div>
                          ) : draft.status === 'error' ? (
                            <div className="text-center py-10 bg-red-50 rounded-2xl">
                              <Activity className="w-8 h-8 mx-auto text-red-400 mb-2" />
                              <p className="text-xs font-black text-red-600 uppercase">Input Failed</p>
                              <button onClick={() => handleExecuteDraft(idx)} className="text-[8px] font-bold text-red-400 underline mt-2 uppercase tracking-widest">Retry Pulse</button>
                            </div>
                          ) : draft.result ? (
                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                              <div className="relative">
                                <p className="text-lg font-bold text-gray-900 leading-tight">
                                  {draft.result.engSentence}
                                </p>
                                <p className="text-sm text-gray-400 mt-2 font-medium italic">
                                  {draft.result.vieSentence}
                                </p>
                              </div>

                              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <div className="flex space-x-2">
                                  <span className="px-2 py-0.5 rounded text-[8px] font-black bg-blue-50 text-blue-600 uppercase tracking-widest border border-blue-100">
                                    {draft.result.category}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                    draft.result.difficultyLabel === 'Beginner' ? 'bg-green-50 text-green-600 border-green-100' :
                                    draft.result.difficultyLabel === 'Intermediate' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    draft.result.difficultyLabel === 'Advanced' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                    'bg-red-50 text-red-600 border-red-100'
                                  }`}>
                                    {draft.result.difficultyLabel}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <button onClick={() => handleRegenerate(idx)} className="text-gray-400 hover:text-red-600 transition-colors">
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  {savedIndices.has(idx) ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                  ) : (
                                    <button 
                                      onClick={() => handleSaveAIChunk(draft, idx)} 
                                      disabled={savingIndex === idx}
                                      className="flex items-center text-[10px] font-black text-red-600 uppercase hover:underline disabled:opacity-30"
                                    >
                                      {savingIndex === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
