import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Resource, Chunk, AISettings } from '../types';
import { generateChunk } from '../services/aiService';
import { Wand2, Save, Loader2, Sparkles, Settings2, Trash2, CheckCircle2, RefreshCw } from 'lucide-react';
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
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [resources, setResources] = useState<Resource[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings | undefined>();
  
  // Manual Mode State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [iValue, setIValue] = useState<number>(1);
  const [manualQuantity, setManualQuantity] = useState<number>(1);
  const [generatedChunks, setGeneratedChunks] = useState<Partial<Chunk>[]>([]);
  const [manualSavedIndices, setManualSavedIndices] = useState<Set<number>>(new Set());
  const [regeneratingManualIdx, setRegeneratingManualIdx] = useState<number | null>(null);
  
  // AI Mode State
  const [aiTheme, setAiTheme] = useState('');
  const [blueprintMode, setBlueprintMode] = useState<'targetOhm' | 'recipe'>('targetOhm');
  const [aiTargetOhm, setAiTargetOhm] = useState<number>(30);
  const [aiQuantity, setAiQuantity] = useState<number>(3);
  const [aiMaxPerColor, setAiMaxPerColor] = useState<number>(1);
  const [aiRecipe, setAiRecipe] = useState<Record<ColorCategory, number>>({ Green: 0, Blue: 0, Pink: 0, Red: 0, Yellow: 0, Orange: 0, Purple: 0 });
  const [aiSentenceLength, setAiSentenceLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [aiColors, setAiColors] = useState<ColorCategory[]>(['Green', 'Blue', 'Red', 'Pink']);
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

  const selectedResources = useMemo(() => {
    return resources.filter(r => selectedIds.has(r.id));
  }, [resources, selectedIds]);

  const rTotal = useMemo(() => {
    if (selectedResources.length === 0) return 0;

    // Group by color
    const groups: Record<string, number[]> = {};
    selectedResources.forEach(r => {
      if (!groups[r.color]) groups[r.color] = [];
      groups[r.color].push(r.ohm);
    });

    // Series (Same color): R_total = Sum(R)
    const seriesTotals = Object.values(groups).map(group => 
      group.reduce((sum, ohm) => sum + ohm, 0)
    );

    // Parallel/Amplification (Different color): R_total = Product(R)
    if (seriesTotals.length === 0) return 0;
    return seriesTotals.reduce((prod, val) => prod * val, 1);
  }, [selectedResources]);

  const uTotal = useMemo(() => {
    return iValue * rTotal;
  }, [iValue, rTotal]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleGenerate = async () => {
    if (selectedResources.length === 0) return;
    setLoading(true);
    setGeneratedChunks([]);
    setManualSavedIndices(new Set());

    try {
      const newChunks: Partial<Chunk>[] = [];
      for (let i = 0; i < manualQuantity; i++) {
        const result = await generateChunk({
          resources: selectedResources,
          rTotal,
          iValue,
          uTotal,
          settings: aiSettings
        });

        let difficultyLabel = 'Beginner';
        if (uTotal > 20) difficultyLabel = 'Intermediate';
        if (uTotal > 50) difficultyLabel = 'Advanced';
        if (uTotal > 100) difficultyLabel = 'Master';

        newChunks.push({
          resourcesUsed: selectedResources,
          engSentence: result.engSentence,
          vieSentence: result.vieSentence,
          category: result.category,
          evaluation: (result as any).evaluation,
          rTotal,
          iValue,
          uTotal,
          difficultyLabel
        });
      }
      setGeneratedChunks(newChunks);
    } catch (error) {
      alert("Failed to generate chunks. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualChunk = async (chunk: Partial<Chunk>, index: number) => {
    if (!auth.currentUser) return;
    setSavingIndex(index + 1000); // Offset for manual
    try {
      await addDoc(collection(db, `workspaces/default/chunks`), {
        ...chunk,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      setManualSavedIndices(prev => new Set(prev).add(index));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `workspaces/default/chunks`);
    } finally {
      setSavingIndex(null);
    }
  };

  const handleRegenerate = async (index: number, type: 'manual' | 'auto') => {
    const chunk = type === 'manual' ? generatedChunks[index] : draftChunks[index];
    if (!chunk || !chunk.resourcesUsed || !aiSettings) return;

    if (type === 'manual') setRegeneratingManualIdx(index);
    else {
      setRegeneratingAutoIdx(index);
      setDraftChunks(prev => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'loading' };
        return next;
      });
    }

    try {
      const result = await generateChunk({
        resources: chunk.resourcesUsed,
        rTotal: chunk.rTotal || 0,
        iValue: chunk.iValue || 1,
        uTotal: chunk.uTotal || 0,
        settings: aiSettings
      });

      if (type === 'manual') {
        const newChunkData = {
          ...chunk,
          engSentence: result.engSentence,
          vieSentence: result.vieSentence,
          category: result.category,
          evaluation: (result as any).evaluation
        };
        setGeneratedChunks(prev => {
          const next = [...prev];
          next[index] = newChunkData;
          return next;
        });
        setManualSavedIndices(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      } else {
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
      }
    } catch (error) {
      alert("Failed to regenerate chunk. See console for details.");
      if (type === 'auto') {
        setDraftChunks(prev => {
          const next = [...prev];
          next[index] = { ...next[index], status: 'error' };
          return next;
        });
      }
    } finally {
      if (type === 'manual') setRegeneratingManualIdx(null);
      else setRegeneratingAutoIdx(null);
    }
  };

  const calculateU = (usedResources: Resource[], i: number) => {
    if (usedResources.length === 0) return 0;
    const groups: Record<string, number[]> = {};
    usedResources.forEach(r => {
      if (!groups[r.color]) groups[r.color] = [];
      groups[r.color].push(r.ohm);
    });
    const seriesTotals = Object.values(groups).map(group => 
      group.reduce((sum, ohm) => sum + ohm, 0)
    );
    const r = seriesTotals.reduce((prod, val) => prod * val, 1);
    return i * r;
  };

  const calculateOhm = (usedResources: Resource[]) => {
    if (usedResources.length === 0) return 0;
    const groups: Record<string, number[]> = {};
    usedResources.forEach(r => {
      if (!groups[r.color]) groups[r.color] = [];
      groups[r.color].push(r.ohm);
    });
    const seriesTotals = Object.values(groups).map(group => 
      group.reduce((sum, ohm) => sum + ohm, 0)
    );
    return seriesTotals.reduce((prod, val) => prod * val, 1);
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
          if (i === 0) alert("No resources match your color preferences.");
          return;
        }

        const resourcesByColor: Record<string, Resource[]> = {};
        filteredResources.forEach(r => {
          if (!resourcesByColor[r.color]) resourcesByColor[r.color] = [];
          resourcesByColor[r.color].push(r);
        });
        const availableColors = Object.keys(resourcesByColor);

        let attempts = 0;
        
        // Try to find a good combo
        while (attempts < 100) {
          let testCombo: Resource[] = [];
          
          const maxColors = availableColors.length;
          const minColors = Math.min(2, maxColors);
          const numColorsToMix = Math.floor(Math.random() * (maxColors - minColors + 1)) + minColors;
          const shuffledColors = [...availableColors].sort(() => 0.5 - Math.random()).slice(0, numColorsToMix);

          shuffledColors.forEach(color => {
            const itemsInColor = resourcesByColor[color];
            const maxItemsForThisColor = Math.min(aiMaxPerColor, itemsInColor.length);
            const numItems = Math.floor(Math.random() * maxItemsForThisColor) + 1;
            const shuffledItems = [...itemsInColor].sort(() => 0.5 - Math.random()).slice(0, numItems);
            testCombo.push(...shuffledItems);
          });

          const testOhm = calculateOhm(testCombo);
          
          // If it's the first attempt or this combo is closer to target than the previous best
          if (attempts === 0 || Math.abs(testOhm - aiTargetOhm) < Math.abs(currentOhm - aiTargetOhm)) {
            currentCombo = testCombo;
            currentOhm = testOhm;
          }
          
          // If we found a really close match, stop trying
          if (Math.abs(currentOhm - aiTargetOhm) <= 2) break;
          attempts++;
        }
      }

      if (currentCombo.length > 0) {
        newDrafts.push({
          id: `draft-${Date.now()}-${i}`,
          resourcesUsed: currentCombo,
          rTotal: currentOhm,
          iValue: 1, // Default I
          uTotal: currentOhm * 1,
          status: 'draft'
        });
      }
    }

    if (newDrafts.length > 0) {
      setDraftChunks(newDrafts);
      setSavedIndices(new Set());
    } else if (blueprintMode === 'recipe') {
      alert("Could not generate drafts. Please check your recipe and ensure you have resources for the selected colors.");
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

  const groupedResources = useMemo(() => {
    const groups: Record<string, Resource[]> = {};
    resources.forEach(r => {
      if (!groups[r.color]) groups[r.color] = [];
      groups[r.color].push(r);
    });
    return groups;
  }, [resources]);

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('manual')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Settings2 className="w-4 h-4 mr-2" /> Manual Mixer
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'ai' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Sparkles className="w-4 h-4 mr-2" /> AI Generator
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* Left Column: Mixer Controls */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">1. Select Resources</h3>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
              {resources.length === 0 ? (
                <p className="text-sm text-gray-500 p-4 border border-dashed rounded-md text-center">No resources available. Add some in the Resources tab.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
                  {(Object.entries(groupedResources) as [string, Resource[]][]).map(([color, resList]) => (
                    <div key={color} className="space-y-2">
                      <h4 className={`text-xs font-bold uppercase tracking-wider sticky top-0 py-1 bg-white z-10 ${COLOR_STYLES[color]?.text || 'text-gray-700'}`}>
                        {color} ({resList.length})
                      </h4>
                      <div className="space-y-1.5">
                        {resList.map(r => (
                          <label key={r.id} className={`flex items-start p-2 rounded cursor-pointer border transition-colors ${
                            selectedIds.has(r.id) 
                              ? `${COLOR_STYLES[color]?.bg || 'bg-gray-50'} ${COLOR_STYLES[color]?.border || 'border-gray-200'}`
                              : 'bg-white border-gray-100 hover:bg-gray-50'
                          }`}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelection(r.id)}
                              className="mt-0.5 h-3.5 w-3.5 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                            />
                            <div className="ml-2 flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{r.name}</p>
                              <p className="text-[10px] text-gray-500">{r.ohm}Ω</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-medium text-gray-900 mb-4">2. Set Context & Quantity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current / MSE (I)</label>
                  <input
                    type="number"
                    value={iValue}
                    onChange={(e) => setIValue(Number(e.target.value))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
                    min="0.1"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={manualQuantity}
                    onChange={(e) => setManualQuantity(Number(e.target.value))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
                    min="1"
                    max="10"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">Adjust complexity and how many variations to generate.</p>
            </div>

            <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100">
              <h3 className="text-lg font-medium text-red-900 mb-4">3. The Semantic Circuit</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Resistance (R)</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{rTotal.toFixed(1)}Ω</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Current (I)</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{iValue.toFixed(1)}A</div>
                </div>
                <div className="bg-red-600 p-3 rounded-lg shadow-sm text-white">
                  <div className="text-xs text-red-200 font-medium uppercase tracking-wider">Voltage (U)</div>
                  <div className="mt-1 text-2xl font-bold">{uTotal.toFixed(1)}V</div>
                </div>
              </div>
              
              <button
                onClick={handleGenerate}
                disabled={selectedResources.length === 0 || loading}
                className="mt-6 w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" /> Generating...</>
                ) : (
                  <><Wand2 className="-ml-1 mr-2 h-5 w-5" /> Generate Chunk</>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Generated Output ({generatedChunks.length})</h3>
              {generatedChunks.length > 0 && (
                <button
                  onClick={() => setGeneratedChunks([])}
                  className="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors flex items-center"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Results
                </button>
              )}
            </div>
            
            {generatedChunks.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-6 pr-2 max-h-[800px]">
                {generatedChunks.map((chunk, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-4 relative group">
                    <div className="absolute top-4 right-4 flex space-x-2">
                      <button 
                        onClick={() => handleRegenerate(idx, 'manual')}
                        disabled={regeneratingManualIdx === idx}
                        className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm disabled:opacity-50"
                        title="Regenerate this chunk"
                      >
                        <RefreshCw className={`w-4 h-4 ${regeneratingManualIdx === idx ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">English</h4>
                      <p className="text-md text-gray-900 font-medium leading-relaxed">
                        {chunk.engSentence}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vietnamese</h4>
                      <p className="text-sm text-gray-600 italic">
                        {chunk.vieSentence}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {chunk.resourcesUsed?.map((resource, rIdx) => (
                        <span 
                          key={rIdx} 
                          className={`px-1.5 py-0.5 text-[10px] rounded border font-bold uppercase ${COLOR_STYLES[resource.color]?.tagBg || 'bg-gray-50'} ${COLOR_STYLES[resource.color]?.tagText || 'text-gray-700'} ${COLOR_STYLES[resource.color]?.tagBorder || 'border-gray-200'}`}
                        >
                          {resource.name}
                        </span>
                      ))}
                    </div>

                    {(chunk as any).evaluation && (
                      <div className="bg-green-50 border border-green-100 p-2 rounded text-xs text-green-800 flex items-start">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 mt-0.5 flex-shrink-0 text-green-600" />
                        <span><span className="font-bold">AI Eval:</span> {(chunk as any).evaluation}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 uppercase">
                          {chunk.category}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 uppercase">
                          {chunk.difficultyLabel} (U={chunk.uTotal?.toFixed(1)})
                        </span>
                      </div>
                      
                      {manualSavedIndices.has(idx) ? (
                        <span className="text-[10px] font-bold text-green-600 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Saved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSaveManualChunk(chunk, idx)}
                          disabled={savingIndex === idx + 1000}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center transition-colors"
                        >
                          {savingIndex === idx + 1000 ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3 mr-1" />
                          )}
                          Save to DB
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                <div className="text-center p-6">
                  <Wand2 className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">Select resources and click generate to see the AI output here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* AI Generator Controls */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-red-600" /> AI Generation Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Ohm (R)</label>
                      <input
                        type="number"
                        value={aiTargetOhm}
                        onChange={(e) => setAiTargetOhm(Number(e.target.value))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
                        min="5"
                      />
                    </div>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Items/Color</label>
                      <input
                        type="number"
                        value={aiMaxPerColor}
                        onChange={(e) => setAiMaxPerColor(Number(e.target.value))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
                        min="1"
                        max="5"
                      />
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sentence Length</label>
                  <div className="flex bg-gray-100 p-1 rounded-md">
                    {(['Short', 'Medium', 'Long'] as const).map((len) => (
                      <button
                        key={len}
                        onClick={() => setAiSentenceLength(len)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                          aiSentenceLength === len ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {blueprintMode === 'targetOhm' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color Preferences</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Green', 'Blue', 'Red', 'Pink'].map((color) => (
                      <button
                        key={color}
                        onClick={() => toggleAiColor(color as ColorCategory)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-all ${
                          aiColors.includes(color as ColorCategory)
                            ? 'bg-red-50 border-red-200 text-red-700 font-medium'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {color}
                        {aiColors.includes(color as ColorCategory) && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">The AI will prioritize resources from these categories.</p>
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

          {/* AI Results List */}
          {draftChunks.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-lg font-medium text-gray-900">Draft Chunks ({draftChunks.length})</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleExecuteAllPending}
                    disabled={loading || draftChunks.every(d => d.status === 'success')}
                    className="flex items-center px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-300"
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    2. Generate All Pending
                  </button>
                  <button
                    onClick={handleSaveAll}
                    disabled={saving || draftChunks.filter(d => d.status === 'success' && !savedIndices.has(draftChunks.indexOf(d))).length === 0}
                    className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save All Unsaved
                  </button>
                </div>
              </div>
              
              {loading && generationProgress.total > 0 && (
                <div className="mt-2 animate-in fade-in duration-300 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between text-xs font-medium text-gray-500 mb-1.5">
                    <span>Generation Progress</span>
                    <span>{Math.round((generationProgress.current / generationProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {draftChunks.map((draft, idx) => (
                  <div key={draft.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow relative group">
                    <div className="flex flex-col md:flex-row gap-6">
                      
                      {/* Left: Blueprint / Resources */}
                      <div className="md:w-1/3 space-y-3 border-r border-gray-100 pr-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Draft #{idx + 1}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                            {draft.rTotal.toFixed(1)} Ω
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {draft.resourcesUsed.map((resource, rIdx) => (
                            <span 
                              key={rIdx} 
                              className={`px-2 py-1 text-[10px] rounded border font-bold uppercase flex items-center ${
                                resource.color === 'Green' ? 'bg-green-50 text-green-700 border-green-100' :
                                resource.color === 'Blue' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                resource.color === 'Red' ? 'bg-red-50 text-red-700 border-red-100' :
                                resource.color === 'Pink' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                                resource.color === 'Yellow' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                resource.color === 'Orange' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                'bg-purple-50 text-purple-700 border-purple-100'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: resource.color.toLowerCase() }}></span>
                              {resource.name} ({resource.ohm}Ω)
                            </span>
                          ))}
                        </div>
                        
                        {draft.status === 'draft' || draft.status === 'error' ? (
                          <button
                            onClick={() => handleExecuteDraft(idx)}
                            disabled={draft.status === 'loading'}
                            className="w-full mt-4 flex justify-center items-center py-2 px-4 border border-red-200 rounded-md text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate
                          </button>
                        ) : null}
                      </div>

                      {/* Right: Result */}
                      <div className="md:w-2/3 flex flex-col justify-center">
                        {draft.status === 'draft' ? (
                          <div className="text-center text-gray-400 py-8">
                            <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Waiting to generate...</p>
                          </div>
                        ) : draft.status === 'loading' ? (
                          <div className="text-center text-red-500 py-8">
                            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                            <p className="text-sm font-medium">AI is thinking...</p>
                          </div>
                        ) : draft.status === 'error' ? (
                          <div className="text-center text-red-500 py-8 bg-red-50 rounded-lg border border-red-100">
                            <p className="text-sm font-medium">Failed to generate.</p>
                            <p className="text-xs mt-1">Please try again.</p>
                          </div>
                        ) : draft.result ? (
                          <div className="space-y-4 relative">
                            <div className="absolute top-0 right-0 flex space-x-2">
                              <button 
                                onClick={() => handleRegenerate(idx, 'auto')}
                                disabled={regeneratingAutoIdx === idx}
                                className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm disabled:opacity-50"
                                title="Regenerate this chunk"
                              >
                                <RefreshCw className={`w-4 h-4 ${regeneratingAutoIdx === idx ? 'animate-spin' : ''}`} />
                              </button>
                            </div>

                            <div className="pr-16">
                              {editingIndex === idx ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={draft.result.engSentence}
                                    onChange={(e) => handleUpdateResult(idx, 'engSentence', e.target.value)}
                                    className="w-full text-sm border-gray-200 rounded-md focus:ring-red-500 focus:border-red-500 p-2"
                                    rows={2}
                                  />
                                  <textarea
                                    value={draft.result.vieSentence}
                                    onChange={(e) => handleUpdateResult(idx, 'vieSentence', e.target.value)}
                                    className="w-full text-xs text-gray-500 border-gray-200 rounded-md focus:ring-red-500 focus:border-red-500 p-2"
                                    rows={2}
                                  />
                                  <button 
                                    onClick={() => setEditingIndex(null)}
                                    className="text-[10px] font-bold text-red-600 hover:underline"
                                  >
                                    Done Editing
                                  </button>
                                </div>
                              ) : (
                                <div onClick={() => setEditingIndex(idx)} className="cursor-text hover:bg-gray-50 p-1 rounded transition-colors">
                                  <p className="text-md font-medium text-gray-900 leading-relaxed">{draft.result.engSentence}</p>
                                  <p className="text-sm text-gray-500 mt-1 italic">{draft.result.vieSentence}</p>
                                </div>
                              )}
                            </div>

                            {draft.result.evaluation && (
                              <div className="bg-green-50 border border-green-100 p-2 rounded text-xs text-green-800 flex items-start">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 mt-0.5 flex-shrink-0 text-green-600" />
                                <span><span className="font-bold">AI Eval:</span> {draft.result.evaluation}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                              <div className="flex space-x-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 uppercase">
                                  {draft.result.category}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  draft.result.difficultyLabel === 'Beginner' ? 'bg-green-100 text-green-700' :
                                  draft.result.difficultyLabel === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
                                  draft.result.difficultyLabel === 'Advanced' ? 'bg-orange-100 text-orange-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {draft.result.difficultyLabel}
                                </span>
                              </div>
                              
                              {savedIndices.has(idx) ? (
                                <span className="text-[10px] font-bold text-green-600 flex items-center">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Saved
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSaveAIChunk(draft, idx)}
                                  disabled={savingIndex === idx}
                                  className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center transition-colors"
                                >
                                  {savingIndex === idx ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Save className="w-3 h-3 mr-1" />
                                  )}
                                  Save to DB
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
