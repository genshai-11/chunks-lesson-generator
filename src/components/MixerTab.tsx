import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, query, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Resource, Chunk, AISettings, SentenceLength, ColorCategory } from '../types';
import { generateChunk } from '../services/aiService';
import { Wand2, Save, Loader2, Sparkles, Settings2, Trash2, CheckCircle2, RefreshCw, Activity, Zap, Cpu, Info, ChevronDown } from 'lucide-react';
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
import { doc, getDoc } from 'firebase/firestore';

interface DraftChunk {
  id: string;
  resourcesUsed: Resource[];
  rTotal: number;
  iValue: number;
  tl?: number;
  lc?: number;
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

const TOPIC_PRESETS = [
  // Easy (1.0 - 1.3)
  { label: '☕ Daily Life & Routines', value: 'Daily Life', tl: 1.0 },
  { label: '🍳 Food & Cooking', value: 'Food & Cooking', tl: 1.1 },
  { label: '🎨 Hobbies & Interests', value: 'Hobbies', tl: 1.2 },
  { label: '✈️ Travel & Tourism', value: 'Travel', tl: 1.2 },
  { label: '🍿 Entertainment & Pop Culture', value: 'Entertainment', tl: 1.3 },
  { label: '⚽ Sports & Fitness', value: 'Sports', tl: 1.3 },
  
  // Medium (1.4 - 1.7)
  { label: '🧘 Health & Wellness', value: 'Health & Wellness', tl: 1.4 },
  { label: '💼 Workplace & Career', value: 'Workplace', tl: 1.5 },
  { label: '📚 Education & Learning', value: 'Education', tl: 1.5 },
  { label: '💻 Technology & Gadgets', value: 'Technology', tl: 1.6 },
  { label: '🌿 Environment & Nature', value: 'Environment', tl: 1.6 },
  { label: '🎭 Arts & Culture', value: 'Arts & Culture', tl: 1.7 },
  { label: '🗺️ History & Geography', value: 'History', tl: 1.7 },
  
  // Hard (1.8 - 2.0)
  { label: '📈 Business & Economics', value: 'Business & Economics', tl: 1.8 },
  { label: '🏛️ Politics & Society', value: 'Politics', tl: 1.8 },
  { label: '🔬 Science & Research', value: 'Science', tl: 1.9 },
  { label: '🤔 Philosophy & Ethics', value: 'Philosophy', tl: 1.9 },
  { label: '🧠 Psychology & Behavior', value: 'Psychology', tl: 2.0 },
  { label: '⚖️ Law & Justice', value: 'Law', tl: 2.0 },
  { label: '📖 Literature & Poetry', value: 'Literature', tl: 2.0 },
];

export default function MixerTab({ resources, aiSettings }: { resources: Resource[], aiSettings?: AISettings }) {
  // Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  // AI Mode State
  const [topicMode, setTopicMode] = useState<'preset' | 'infer' | 'random'>('infer');
  const [aiTheme, setAiTheme] = useState('Daily Life');
  const [blueprintMode, setBlueprintMode] = useState<'targetOhm' | 'recipe'>('targetOhm');
  const [aiTargetCVR, setAiTargetCVR] = useState<number>(10);
  const [aiQuantity, setAiQuantity] = useState<number>(5);
  const [aiMaxPerColor, setAiMaxPerColor] = useState<number>(1);
  const [aiRecipe, setAiRecipe] = useState<Record<ColorCategory, number>>({ Green: 0, Blue: 0, Pink: 0, Red: 0, Yellow: 0, Orange: 0, Purple: 0 });
  const [aiSentenceLength, setAiSentenceLength] = useState<SentenceLength>('Very Short');
  const [aiTopicLevel, setAiTopicLevel] = useState<number>(1.0);
  const [aiTopic, setAiTopic] = useState<string>('');
  const [isColorFocusOn, setIsColorFocusOn] = useState<boolean>(false);
  const [aiColors, setAiColors] = useState<ColorCategory[]>(['Green', 'Blue', 'Red', 'Pink']);
  const [draftChunks, setDraftChunks] = useState<DraftChunk[]>([]);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [regeneratingAutoIdx, setRegeneratingAutoIdx] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });

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
        settings: aiSettings,
        theme: topicMode === 'preset' ? aiTheme : '',
        topicLevel: chunk.tl || aiTopicLevel,
        sentenceLength: aiSentenceLength
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
    
    const formulaType = aiSettings?.formulaType || 'sum';

    if (formulaType === 'sum') {
      // Linear Sum Formula: R1 + R2 + R3...
      const totalOhm = usedResources.reduce((sum, r) => sum + r.ohm, 0);
      return Math.round(totalOhm * 10) / 10;
    } else {
      // Circuit Formula (Series-Parallel):
      // Same color = ADD (Series)
      // Different colors = MULTIPLY (Parallel)
      const groups: Record<string, number[]> = {};
      usedResources.forEach(r => {
        if (!groups[r.color]) groups[r.color] = [];
        groups[r.color].push(r.ohm);
      });
      
      const colorSums = Object.values(groups).map(group => 
        group.reduce((sum, ohm) => sum + ohm, 0)
      );
      
      const totalOhm = colorSums.reduce((prod, val) => prod * val, 1);
      return Math.round(totalOhm * 10) / 10;
    }
  };

  const handleSentenceLengthSelect = (len: SentenceLength) => {
    setAiSentenceLength(len);
    
    if (blueprintMode === 'targetOhm') {
      let minTC = 3;
      let maxTC = 9;
      if (len === 'Short') { minTC = 9; maxTC = 15; }
      else if (len === 'Medium') { minTC = 15; maxTC = 21; }
      else if (len === 'Long') { minTC = 21; maxTC = 27; }
      
      const lc = aiSettings?.complexityMultipliers?.[len] ?? (len === 'Very Short' ? 1 : len === 'Short' ? 1.5 : len === 'Medium' ? 2 : 2.5);
      const minCVR = Math.round(lc * aiTopicLevel * minTC);
      const maxCVR = Math.round(lc * aiTopicLevel * maxTC);
      
      if (aiTargetCVR < minCVR || aiTargetCVR > maxCVR) {
        showToast(`Warning: Target CVR (${aiTargetCVR}) might not be optimal for ${len} chunks. Recommended: ${minCVR}-${maxCVR}.`);
      }
    }
  };

  const handlePrepareBlueprint = () => {
    if (resources.length === 0) return;
    
    // Group by color (all resources)
    const allResourcesByColor: Record<string, Resource[]> = {};
    resources.forEach(r => {
      if (!allResourcesByColor[r.color]) allResourcesByColor[r.color] = [];
      allResourcesByColor[r.color].push(r);
    });

    const newDrafts: DraftChunk[] = [];
    
    // Calculate exact base multiplier needed for this sentence length
    const baseMultiplier = aiSettings?.complexityMultipliers?.[aiSentenceLength] ?? 
      (aiSentenceLength === 'Very Short' ? 1 : aiSentenceLength === 'Short' ? 1.5 : aiSentenceLength === 'Medium' ? 2 : 2.5);
    
    for (let i = 0; i < aiQuantity; i++) {
      let currentCombo: Resource[] = [];
      let currentTC = 0; // This is the TC (Base R)
      let currentTL = aiTopicLevel;
      
      const lc = Math.max(0.1, Math.round(baseMultiplier * 10) / 10);
      let finalI = lc * currentTL; // The total multiplier

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
        currentTC = calculateOhm(currentCombo);
      } else {
        // Target CVR Mode: Dynamically adjust TL for exact targeting

        // Filter by color preferences if ON, otherwise use all available resources
        const filteredResources = resources.filter(r => (!isColorFocusOn || aiColors.length === 0 || aiColors.includes(r.color)));
        if (filteredResources.length === 0) {
          if (i === 0) showToast("No resources match your color preferences.");
          return;
        }

        let bestCombo: Resource[] = [];
        let bestBaseTC = 0;
        let bestTL = aiTopicLevel;
        let attempts = 0;
        const maxAttempts = 500; 
        
        let targetItemCount = 1;
        if (aiSentenceLength === 'Short') targetItemCount = 2;
        if (aiSentenceLength === 'Medium') targetItemCount = 3;
        if (aiSentenceLength === 'Long') targetItemCount = 4;

        while (attempts < maxAttempts) {
          let testCombo: Resource[] = [];
          
          const tempResources = [...filteredResources].sort(() => 0.5 - Math.random());
          const colorCounts: Record<string, number> = {};
          
          for (const r of tempResources) {
            if (testCombo.length >= targetItemCount) break;
            const count = colorCounts[r.color] || 0;
            if (count < aiMaxPerColor) {
              testCombo.push(r);
              colorCounts[r.color] = count + 1;
            }
          }

          const testBaseTC = calculateOhm(testCombo);
          
          if (testBaseTC > 0) {
            let expectedMinTL = 1.0;
            let expectedMaxTL = 2.0;

                        const defaultTiers = [
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
            expectedMaxTL = matchedTier.max;

            let requiredTL = aiTargetCVR / (testBaseTC * lc);
            requiredTL = Math.max(expectedMinTL, Math.min(expectedMaxTL, requiredTL));
            
            const testFinalCVR = testBaseTC * lc * requiredTL;
            const currentDiff = Math.abs(testFinalCVR - aiTargetCVR);
            const bestDiff = Math.abs(bestBaseTC * lc * bestTL - aiTargetCVR);
            
            if (attempts === 0 || currentDiff < bestDiff) {
              bestCombo = testCombo;
              bestBaseTC = testBaseTC;
              bestTL = requiredTL;
            }
            
            if (currentDiff <= 1) break; 
          }
          attempts++;
        }
        currentCombo = bestCombo;
        currentTC = bestBaseTC;
        currentTL = bestTL;
        finalI = lc * currentTL; // Recalculate with dynamic TL
      }

      if (currentCombo.length > 0) {
        const finalCVR = Math.round((currentTC * finalI) * 10) / 10;

        newDrafts.push({
          id: `draft-${Date.now()}-${i}`,
          resourcesUsed: currentCombo,
          rTotal: currentTC,
          iValue: finalI,
          tl: currentTL,
          lc,
          uTotal: finalCVR,
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
        theme: topicMode === 'infer' ? 'INFER_FROM_RESOURCES' : (topicMode === 'preset' ? aiTheme : ''),
        topicLevel: draft.tl || aiTopicLevel,
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
          tl: draft.tl,
          lc: draft.lc,
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
        tl: draft.tl,
        lc: draft.lc,
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

  // Calculate current CVR safety zone
  let currentMinTC = 3;
  let currentMaxTC = 9;
  if (aiSentenceLength === 'Short') { currentMinTC = 9; currentMaxTC = 15; }
  else if (aiSentenceLength === 'Medium') { currentMinTC = 15; currentMaxTC = 21; }
  else if (aiSentenceLength === 'Long') { currentMinTC = 21; currentMaxTC = 27; }
  
  const currentLC = aiSettings?.complexityMultipliers?.[aiSentenceLength] ?? (aiSentenceLength === 'Very Short' ? 1 : aiSentenceLength === 'Short' ? 1.5 : aiSentenceLength === 'Medium' ? 2 : 2.5);
    const defaultTiers = [
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
  const currentMaxCVR = Math.round(currentLC * highestMax * currentMaxTC);

  const isCVRSafe = aiTargetCVR >= currentMinCVR && aiTargetCVR <= currentMaxCVR;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }}
            className="fixed top-1/2 left-1/2 z-[100] px-6 py-4 bg-gray-900 border border-gray-700 text-white text-sm font-bold rounded-2xl shadow-2xl max-w-sm text-center"
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
                {draftChunks.filter(d => d.status === 'draft').length > 0 && (
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
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-bold text-gray-800">Topic Configuration</label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 bg-gray-200 rounded-lg p-1">
                    <button
                      onClick={() => setTopicMode('preset')}
                      className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded shadow-sm transition-colors ${topicMode === 'preset' ? 'bg-white text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                      title="Select a specific Topic"
                    >
                      Selected
                    </button>
                    <button
                      onClick={() => setTopicMode('infer')}
                      className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded shadow-sm transition-colors ${topicMode === 'infer' ? 'bg-white text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                      title="AI will infer the topic from chosen resources (labeled as Random)"
                    >
                      Random
                    </button>
                  </div>

                  {topicMode === 'preset' && (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Preset Topic</label>
                        <select
                          value={!TOPIC_PRESETS.find(p => p.value === aiTheme) ? 'Custom' : aiTheme}
                          onChange={(e) => {
                            const selected = e.target.value;
                            if (selected === 'Custom') {
                              setAiTheme('');
                            } else {
                              setAiTheme(selected);
                              const presetInfo = TOPIC_PRESETS.find(p => p.value === selected);
                              if (presetInfo) {
                                setAiTopicLevel(presetInfo.tl);
                              }
                            }
                          }}
                          className="w-full rounded-lg border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm font-medium bg-white"
                        >
                          {TOPIC_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>{preset.label}</option>
                          ))}
                          <option value="Custom">✨ Custom Topic...</option>
                        </select>
                      </div>

                      {!TOPIC_PRESETS.find(p => p.value === aiTheme) && (
                        <div className="flex-1 animate-in fade-in slide-in-from-top-1">
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Custom Topic</label>
                          <input 
                            type="text" 
                            value={aiTheme} 
                            onChange={(e) => setAiTheme(e.target.value)} 
                            placeholder="E.g., Crypto Trading, Pet Grooming..."
                            className="w-full rounded-lg border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm font-medium bg-white"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {topicMode === 'infer' && (
                    <div className="text-xs text-gray-500 italic mt-2 p-2 bg-white rounded-lg border border-gray-100/50">
                      The AI will dynamically build a topic that fits the calculated structural difficulty.
                    </div>
                  )}
                </div>
                 <div>
                  <label className="flex items-center text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                    Sentence Length
                    <div className="group relative ml-2">
                       <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-[10px] rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-medium normal-case tracking-normal">
                         <div className="space-y-2">
                           <div><span className="font-bold text-pink-400 uppercase tracking-wide text-[9px]">Very Short</span> <span className="text-[9px] text-gray-400">- Single sentence</span><br/>Max {aiSettings?.sentenceConstraints?.['Very Short']?.maxSentences ?? 1} sentence(s) • Max {aiSettings?.sentenceConstraints?.['Very Short']?.maxWords ?? 15} words<br/><span className="text-pink-300">Target TC: 1 Term</span></div>
                           <div><span className="font-bold text-blue-400 uppercase tracking-wide text-[9px]">Short</span> <span className="text-[9px] text-gray-400">- Two sentences</span><br/>Max {aiSettings?.sentenceConstraints?.['Short']?.maxSentences ?? 2} sentence(s) • Max {aiSettings?.sentenceConstraints?.['Short']?.maxWords ?? 30} words<br/><span className="text-blue-300">Target TC: 2 Terms</span></div>
                           <div><span className="font-bold text-yellow-400 uppercase tracking-wide text-[9px]">Medium</span> <span className="text-[9px] text-gray-400">- Paragraph</span><br/>Max {aiSettings?.sentenceConstraints?.['Medium']?.maxSentences ?? 3} sentence(s) • Max {aiSettings?.sentenceConstraints?.['Medium']?.maxWords ?? 60} words<br/><span className="text-yellow-300">Target TC: 3 Terms</span></div>
                           <div><span className="font-bold text-green-400 uppercase tracking-wide text-[9px]">Long</span> <span className="text-[9px] text-gray-400">- Short Essay</span><br/>Max {aiSettings?.sentenceConstraints?.['Long']?.maxSentences ?? 5} sentence(s) • Max {aiSettings?.sentenceConstraints?.['Long']?.maxWords ?? 100} words<br/><span className="text-green-300">Target TC: 4 Terms</span></div>
                         </div>
                         <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                       </div>
                    </div>
                  </label>
                  <div className="flex bg-gray-100/50 p-1 rounded-xl mb-4">
                    {(['Very Short', 'Short', 'Medium', 'Long'] as const).map((len) => {
                      let minItems = 1;
                      let maxItems = 1; // Very Short: 1 item
                      let minTC = 3;
                      let maxTC = 9;
                      
                      if (len === 'Short') { minItems = 2; maxItems = 2; minTC = 9; maxTC = 15; }
                      else if (len === 'Medium') { minItems = 3; maxItems = 3; minTC = 15; maxTC = 21; }
                      else if (len === 'Long') { minItems = 4; maxItems = 4; minTC = 21; maxTC = 27; }
                      
                      const lc = aiSettings?.complexityMultipliers?.[len] ?? (len === 'Very Short' ? 1 : len === 'Short' ? 1.5 : len === 'Medium' ? 2 : 2.5);
                      
                        const defaultTiers = [
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
  const maxTargetOhm = Math.round(lc * tMax * maxTC);
                      
                      const suggestedText = `${minTargetOhm}-${maxTargetOhm}`;
                      
                      let isRecommended = true;
                      if (blueprintMode === 'targetOhm') {
                        isRecommended = aiTargetCVR >= minTargetOhm && aiTargetCVR <= maxTargetOhm;
                      } else if (blueprintMode === 'recipe') {
                        let totalRecipeItems = 0; Object.values(aiRecipe).forEach(v => { totalRecipeItems += Number(v); });
                        if (totalRecipeItems > 0) {
                          isRecommended = totalRecipeItems >= minItems && totalRecipeItems <= maxItems;
                        }
                      }

                      return (
                        <button
                          key={len}
                          onClick={() => handleSentenceLengthSelect(len)}
                          className={`flex-1 flex text-xs items-center justify-center flex-col py-2 font-black uppercase tracking-widest rounded-lg transition-all text-center leading-tight ${
                            aiSentenceLength === len 
                              ? 'bg-white text-red-600 shadow-sm'
                              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
                          } ${(!isRecommended && aiSentenceLength !== len) ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : 'opacity-100'}`}
                          title={isRecommended ? "Recommended for current settings" : "Not optimal for current CVR/Recipe"}
                        >
                          <span className="mb-0.5">{len}</span>
                          <span className={`text-[11px] normal-case tracking-normal ${isRecommended ? (aiSentenceLength === len ? 'text-gray-500 font-bold' : 'text-gray-400 font-semibold') : 'text-red-500 font-bold'} block mt-0.5`}>
                            CVR: {suggestedText}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Multiplier Info */}
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none" title="Length Complexity">LC (Length Complexity)</label>
                    <span className="text-xs font-black text-red-600 leading-none">
                      ×{aiSettings?.complexityMultipliers?.[aiSentenceLength] ?? (aiSentenceLength === 'Very Short' ? 1 : aiSentenceLength === 'Short' ? 1.5 : aiSentenceLength === 'Medium' ? 2 : 2.5)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {blueprintMode === 'targetOhm' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative group/cvr">
                        <label className="flex items-center text-xs font-black text-gray-400 uppercase tracking-widest mb-1 cursor-help">
                          Target CVR
                          <Info className="w-3.5 h-3.5 ml-1.5" />
                        </label>
                        <input
                          type="number"
                          value={aiTargetCVR}
                          onChange={(e) => setAiTargetCVR(Number(e.target.value))}
                          className={`w-full rounded-xl shadow-sm border p-3 text-sm font-bold transition-colors ${
                            isCVRSafe 
                              ? 'border-green-300 focus:border-green-500 focus:ring-green-500 bg-green-50 text-green-900' 
                              : 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50 text-red-900'
                          }`}
                          min="5"
                        />
                        {!isCVRSafe && (
                          <div className="absolute top-[28px] right-3 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </div>
                        )}
                        <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900 text-white text-[10px] rounded-lg p-3 opacity-0 group-hover/cvr:opacity-100 transition-opacity pointer-events-none z-50 font-medium normal-case tracking-normal shadow-xl">
                          <div className="space-y-1.5">
                            <div className="font-bold text-gray-300 uppercase tracking-widest mb-2 border-b border-gray-700 pb-1.5 text-[9px]">Absolute CVR Zones</div>
                            <div className="flex justify-between items-center"><span className="text-pink-400 font-bold uppercase tracking-widest text-[9px]">Very Short:</span> <span>{Math.round((aiSettings?.complexityMultipliers?.['Very Short'] ?? 1) * lowestMin * 3)} - {Math.round((aiSettings?.complexityMultipliers?.['Very Short'] ?? 1) * highestMax * 9)}</span></div>
<div className="flex justify-between items-center"><span className="text-blue-400 font-bold uppercase tracking-widest text-[9px]">Short:</span> <span>{Math.round((aiSettings?.complexityMultipliers?.['Short'] ?? 1.5) * lowestMin * 9)} - {Math.round((aiSettings?.complexityMultipliers?.['Short'] ?? 1.5) * highestMax * 15)}</span></div>
<div className="flex justify-between items-center"><span className="text-yellow-400 font-bold uppercase tracking-widest text-[9px]">Medium:</span> <span>{Math.round((aiSettings?.complexityMultipliers?.['Medium'] ?? 2) * lowestMin * 15)} - {Math.round((aiSettings?.complexityMultipliers?.['Medium'] ?? 2) * highestMax * 21)}</span></div>
<div className="flex justify-between items-center"><span className="text-green-400 font-bold uppercase tracking-widest text-[9px]">Long:</span> <span>{Math.round((aiSettings?.complexityMultipliers?.['Long'] ?? 2.5) * lowestMin * 21)} - {Math.round((aiSettings?.complexityMultipliers?.['Long'] ?? 2.5) * highestMax * 27)}</span></div>
                            <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400 leading-tight">
                              Current target <b className={isCVRSafe ? "text-green-400" : "text-red-400"}>{aiTargetCVR}</b> is {isCVRSafe ? 'within' : 'outside'} the allowed absolute boundary for <b className="text-white">{aiSentenceLength}</b>.
                            </div>
                          </div>
                          <div className="absolute bottom-[100%] left-6 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
                        </div>
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
                  </div>
                )}
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blueprint Mode</label>
                    <div className="flex bg-gray-100 p-1 rounded-md mb-4">
                      <button
                        onClick={() => setBlueprintMode('targetOhm')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                          blueprintMode === 'targetOhm' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Target CVR
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

                  <div>
                    {blueprintMode === 'targetOhm' ? (
                      <details className="group">
                    <summary className="flex items-center justify-between mb-3 cursor-pointer list-none">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest cursor-pointer group-hover:text-gray-600 transition-colors">Color Focus Preferences</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400">{isColorFocusOn ? 'ON' : 'OFF'}</span>
                        <ChevronDown className="w-4 h-4 text-gray-400 group-open:-rotate-180 transition-transform" />
                      </div>
                    </summary>

                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Enable Color Filter</span>
                        <button 
                          onClick={() => setIsColorFocusOn(!isColorFocusOn)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isColorFocusOn ? 'bg-red-500' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isColorFocusOn ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {isColorFocusOn && (
                        <>
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
                        </>
                      )}
                    </div>
                  </details>
                    ) : (
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
                    )}
                  </div>
                </div>
                  
                  {blueprintMode === 'targetOhm' && (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center space-x-3 mb-2">
                      <Zap className="w-4 h-4 text-red-600" />
                      <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Logic Engine</span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                      Topic, colors, and R-values are combined to generate precise linguistic blueprints before execution.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handlePrepareBlueprint}
              disabled={resources.length === 0}
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
                  <div key={draft.id} className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-red-200 transition-all duration-500 hover:shadow-2xl flex flex-col">
                    {/* Top Bar: Metrics */}
                    <div className="bg-gray-50/50 border-b border-gray-100 px-4 md:px-6 py-3 flex flex-row flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-row items-center gap-4 md:gap-6">
                        <div className="flex items-center gap-2" title="Final CVR">
                          <span className="text-[10px] md:text-xs font-black text-red-600 uppercase tracking-widest">CVR</span>
                          <div className="text-base md:text-lg font-black text-gray-900 leading-tight">{draft.uTotal.toFixed(0)}</div>
                        </div>
                        <div className="w-px h-5 bg-gray-300" />
                        <div className="flex items-center gap-2" title="Term Count">
                          <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">TC</span>
                          <div className="text-sm font-black text-gray-700">{draft.rTotal.toFixed(0)}</div>
                        </div>
                        <div className="w-px h-5 bg-gray-300" />
                        <div className="flex items-center gap-2" title="Length Complexity">
                          <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest italic">LC</span>
                          <div className="text-sm font-black text-gray-700 leading-none">×{draft.lc?.toFixed(1) || 1.0}</div>
                        </div>
                        <div className="w-px h-5 bg-gray-300" />
                        <div className="flex items-center gap-2" title="Topic Level">
                          <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest italic">TL</span>
                          <div className="text-sm font-black text-gray-700 leading-none">×{draft.tl?.toFixed(1) || 1.0}</div>
                        </div>
                      </div>
                      
                      <div className="flex flex-row items-center gap-1.5 ml-auto">
                        {Array.from(new Set(draft.resourcesUsed.map(r => r.color))).map((color: any) => (
                          <div 
                            key={color} 
                            className={`w-2.5 h-2.5 rounded-full shadow-sm border border-white/50 ${
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

                    <div className="flex flex-col flex-1">
                      {/* Main Area */}
                      <div className="flex-1 p-5 md:p-6">
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
