import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Chunk, AISettings } from '../types';
import { Trash2, Volume2, Play, Loader2, Sparkles, Download, Filter, ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateAudio } from '../services/audioService';
import Papa from 'papaparse';

export default function ChunksTab() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSettings, setAiSettings] = useState<AISettings | undefined>();
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);

  // Filter state
  interface FilterState {
    categories: Set<string>;
    us: Set<number>;
    rs: Set<number>;
    is: Set<number>;
    audio: 'all' | 'hasAudio' | 'noAudio';
  }
  const defaultFilters: FilterState = {
    categories: new Set(),
    us: new Set(),
    rs: new Set(),
    is: new Set(),
    audio: 'all'
  };
  const [pendingFilters, setPendingFilters] = useState<FilterState>(defaultFilters);
  const [activeFilters, setActiveFilters] = useState<FilterState>(defaultFilters);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGeneratingBulkAudio, setIsGeneratingBulkAudio] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const uniqueCategories = React.useMemo(() => Array.from(new Set(chunks.map(c => c.category))).filter(Boolean).sort(), [chunks]);
  const uniqueUs = React.useMemo(() => (Array.from(new Set(chunks.map(c => Number(c.uTotal)))) as number[]).filter(n => !isNaN(n)).sort((a: number, b: number) => a - b), [chunks]);
  const uniqueRs = React.useMemo(() => (Array.from(new Set(chunks.map(c => Number(c.rTotal)))) as number[]).filter(n => !isNaN(n)).sort((a: number, b: number) => a - b), [chunks]);
  const uniqueIs = React.useMemo(() => (Array.from(new Set(chunks.map(c => Number(c.iValue)))) as number[]).filter(n => !isNaN(n)).sort((a: number, b: number) => a - b), [chunks]);

  const toggleFilter = (type: keyof FilterState, value: any) => {
    setPendingFilters(prev => {
      if (type === 'audio') return { ...prev, audio: value };
      const newSet = new Set(prev[type] as Set<any>);
      if (newSet.has(value)) newSet.delete(value);
      else newSet.add(value);
      return { ...prev, [type]: newSet };
    });
  };

  const applyFilters = () => {
    setActiveFilters(pendingFilters);
    setSelectedIds(new Set());
  };

  const clearFilters = () => {
    setPendingFilters(defaultFilters);
    setActiveFilters(defaultFilters);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    // Load AI Settings for audio generation
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

    const unsubscribe = onSnapshot(
      collection(db, `workspaces/default/chunks`),
      (snapshot) => {
        const chunkData: Chunk[] = [];
        snapshot.forEach((doc) => {
          chunkData.push({ id: doc.id, ...doc.data() } as Chunk);
        });
        setChunks(chunkData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `workspaces/default/chunks`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `workspaces/default/chunks`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workspaces/default/chunks/${id}`);
    }
  };

  const handleBulkDelete = async () => {
    if (!auth.currentUser || selectedIds.size === 0) return;
    
    setConfirmModal({
      title: 'Confirm Bulk Delete',
      message: `Are you sure you want to delete ${selectedIds.size} selected chunks? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setIsDeletingBulk(true);
        try {
          const batchSize = 400;
          let count = 0;
          let currentBatch = writeBatch(db);

          for (const id of selectedIds) {
            const docRef = doc(db, `workspaces/default/chunks`, id);
            currentBatch.delete(docRef);
            count++;

            if (count % batchSize === 0) {
              await currentBatch.commit();
              currentBatch = writeBatch(db);
            }
          }

          if (count % batchSize !== 0) {
            await currentBatch.commit();
          }

          setSelectedIds(new Set());
          showToast(`Successfully deleted ${count} chunks.`);
        } catch (error) {
          console.error("Error bulk deleting chunks:", error);
          showToast("Failed to delete chunks.");
        } finally {
          setIsDeletingBulk(false);
        }
      }
    });
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;

    const chunksToExport = chunks.filter(c => selectedIds.has(c.id)).map(c => ({
      Category: c.category,
      'English Sentence': c.engSentence,
      'Vietnamese Sentence': c.vieSentence,
      'Difficulty': c.difficultyLabel,
      'Ohm (Total)': c.uTotal,
      'Load (Base R)': c.rTotal,
      'Bias (Multiplier)': c.iValue,
      'Audio URL': c.audioUrl || 'N/A',
      'Resources Used': c.resourcesUsed.map(r => typeof r === 'string' ? r : r.name).join(', ')
    }));

    const csv = Papa.unparse(chunksToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `chunks_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePlayAudio = (chunk: Chunk) => {
    if (chunk.audioUrl) {
      const audio = new Audio(chunk.audioUrl);
      audio.play();
    } else {
      // Fallback to basic TTS if no audioUrl is stored
      const utterance = new SpeechSynthesisUtterance(chunk.engSentence);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const getLatestAiSettings = async () => {
    try {
      const docRef = doc(db, `workspaces/default/settings`, 'ai');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as AISettings;
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    }
    return undefined;
  };

  const handleGenerateAudio = async (chunk: Chunk) => {
    if (!auth.currentUser) return;
    setGeneratingAudioId(chunk.id);
    try {
      const currentSettings = await getLatestAiSettings();
      const audioUrl = await generateAudio(chunk.engSentence, currentSettings);
      if (audioUrl) {
        await updateDoc(doc(db, `workspaces/default/chunks`, chunk.id), {
          audioUrl: audioUrl
        });
        showToast("Audio generated successfully");
      }
    } catch (error: any) {
      console.error('Error generating audio:', error);
      showToast(`Generation failed: ${error.message || 'Check ElevenLabs settings'}`);
    } finally {
      setGeneratingAudioId(null);
    }
  };

  const filteredChunks = React.useMemo(() => {
    return chunks.filter(chunk => {
      if (activeFilters.categories.size > 0 && !activeFilters.categories.has(chunk.category)) return false;
      if (activeFilters.us.size > 0 && !activeFilters.us.has(chunk.uTotal)) return false;
      if (activeFilters.rs.size > 0 && !activeFilters.rs.has(chunk.rTotal)) return false;
      if (activeFilters.is.size > 0 && !activeFilters.is.has(chunk.iValue)) return false;
      if (activeFilters.audio === 'hasAudio' && !chunk.audioUrl) return false;
      if (activeFilters.audio === 'noAudio' && chunk.audioUrl) return false;
      return true;
    });
  }, [chunks, activeFilters]);

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredChunks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredChunks.map(c => c.id)));
    }
  };

  const handleBulkGenerateAudio = async () => {
    if (!auth.currentUser || selectedIds.size === 0) return;
    setIsGeneratingBulkAudio(true);
    
    const chunksToProcess = chunks.filter(c => selectedIds.has(c.id) && !c.audioUrl);
    
    if (chunksToProcess.length === 0) {
      showToast("All selected chunks already have audio.");
      setIsGeneratingBulkAudio(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    const currentSettings = await getLatestAiSettings();

    for (const chunk of chunksToProcess) {
      setGeneratingAudioId(chunk.id);
      try {
        const audioUrl = await generateAudio(chunk.engSentence, currentSettings);
        if (audioUrl) {
          await updateDoc(doc(db, `workspaces/default/chunks`, chunk.id), {
            audioUrl: audioUrl
          });
          successCount++;
        }
      } catch (error: any) {
        console.error('Error generating audio for chunk', chunk.id, error);
        failCount++;
        lastError = error.message || 'Unknown error';
      }
    }

    setGeneratingAudioId(null);
    setIsGeneratingBulkAudio(false);
    setSelectedIds(new Set());
    
    if (failCount > 0) {
      showToast(`Partial bulk generation complete. Success: ${successCount}, Failed: ${failCount}. Last error: ${lastError}`);
    } else {
      showToast(`Bulk audio generation successful. Processed ${successCount} items.`);
    }
  };

  return (
    <div className="space-y-6 relative">
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

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100"
            >
              <h3 className="text-lg font-black text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">{confirmModal.message}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg shadow-red-200 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">Database</h3>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                showFilters 
                ? 'bg-red-600 text-white shadow-lg shadow-red-100' 
                : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
              {Object.values(activeFilters).some(v => v instanceof Set ? v.size > 0 : v !== 'all') && (
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              )}
            </button>
          </div>
          <span className="bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
            {filteredChunks.length} / {chunks.length} Total
          </span>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden bg-white border-b border-gray-100"
            >
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-6">
                  {/* Categories */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Category</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      {uniqueCategories.map(cat => (
                        <label key={cat} className="flex items-center gap-3 text-sm cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={pendingFilters.categories.has(cat)} 
                            onChange={() => toggleFilter('categories', cat)} 
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 transition-colors" 
                          />
                          <span className={`font-medium transition-colors ${pendingFilters.categories.has(cat) ? 'text-red-700' : 'text-gray-600 group-hover:text-gray-900'}`}>{cat}</span>
                        </label>
                      ))}
                      {uniqueCategories.length === 0 && <span className="text-xs text-gray-400 italic">No categories</span>}
                    </div>
                  </div>
                  {/* U Values */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Total Ohm</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      {uniqueUs.map(u => (
                        <label key={u} className="flex items-center gap-3 text-sm cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={pendingFilters.us.has(u)} 
                            onChange={() => toggleFilter('us', u)} 
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 transition-colors" 
                          />
                          <span className={`font-medium transition-colors ${pendingFilters.us.has(u) ? 'text-red-700' : 'text-gray-600 group-hover:text-gray-900'}`}>{u.toFixed(1)}</span>
                        </label>
                      ))}
                      {uniqueUs.length === 0 && <span className="text-xs text-gray-400 italic">No data</span>}
                    </div>
                  </div>
                  {/* R Values */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Load (Base)</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      {uniqueRs.map(r => (
                        <label key={r} className="flex items-center gap-3 text-sm cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={pendingFilters.rs.has(r)} 
                            onChange={() => toggleFilter('rs', r)} 
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 transition-colors" 
                          />
                          <span className={`font-medium transition-colors ${pendingFilters.rs.has(r) ? 'text-red-700' : 'text-gray-600 group-hover:text-gray-900'}`}>{r.toFixed(1)}</span>
                        </label>
                      ))}
                      {uniqueRs.length === 0 && <span className="text-xs text-gray-400 italic">No data</span>}
                    </div>
                  </div>
                  {/* I Values */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Bias (Multiplier)</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      {uniqueIs.map(i => (
                        <label key={i} className="flex items-center gap-3 text-sm cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={pendingFilters.is.has(i)} 
                            onChange={() => toggleFilter('is', i)} 
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 transition-colors" 
                          />
                          <span className={`font-medium transition-colors ${pendingFilters.is.has(i) ? 'text-red-700' : 'text-gray-600 group-hover:text-gray-900'}`}>{i.toFixed(1)}</span>
                        </label>
                      ))}
                      {uniqueIs.length === 0 && <span className="text-xs text-gray-400 italic">No data</span>}
                    </div>
                  </div>
                  {/* Audio Status */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Audio Status</label>
                    <div className="space-y-2">
                       {['all', 'hasAudio', 'noAudio'].map((option) => (
                         <button
                           key={option}
                           onClick={() => toggleFilter('audio', option as any)}
                           className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                             pendingFilters.audio === option 
                             ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                             : 'bg-white border-gray-200 text-gray-500 hover:border-red-200'
                           }`}
                         >
                           {option === 'all' ? 'Show All' : option === 'hasAudio' ? 'Has Audio File' : 'No Audio File'}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                  <button onClick={clearFilters} className="px-6 py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-600 transition-colors">
                    Reset
                  </button>
                  <button onClick={() => { applyFilters(); setShowFilters(false); }} className="px-8 py-2 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95">
                    Apply Pulse
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 px-6 py-3 flex items-center justify-between border-b border-blue-100">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} items selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkGenerateAudio}
                disabled={isGeneratingBulkAudio || isDeletingBulk}
                className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isGeneratingBulkAudio ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generate Audio
              </button>
              <button
                onClick={handleBulkExport}
                disabled={isGeneratingBulkAudio || isDeletingBulk}
                className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isGeneratingBulkAudio || isDeletingBulk}
                className="flex items-center px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeletingBulk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </button>
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading chunks...</div>
        ) : filteredChunks.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No chunks found matching your criteria.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            <div className="p-4 bg-gray-50 flex items-center gap-4 border-b border-gray-200">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredChunks.length && filteredChunks.length > 0}
                onChange={handleToggleSelectAll}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">Select All</span>
            </div>
            {filteredChunks.map((chunk) => (
               <div key={chunk.id} className={`p-6 hover:bg-gray-50 transition-colors ${selectedIds.has(chunk.id) ? 'bg-red-50/30' : ''}`}>
                 <div className="flex justify-between items-start gap-4">
                   <div className="pt-1">
                     <input
                       type="checkbox"
                       checked={selectedIds.has(chunk.id)}
                       onChange={() => handleToggleSelect(chunk.id)}
                       className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                     />
                   </div>
                   <div className="flex-1">
                     <div className="flex items-center gap-3 mb-2">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 uppercase tracking-tight">
                         {chunk.difficultyLabel} • {chunk.uTotal.toFixed(0)}Ω
                       </span>
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 uppercase tracking-tight">
                         {chunk.category}
                       </span>
                       <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                         Load: {chunk.rTotal.toFixed(0)}Ω • Bias: ×{chunk.iValue.toFixed(1)}
                       </div>
                     </div>
                     
                     <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-2 mt-1">
                          <button 
                            onClick={() => handlePlayAudio(chunk)}
                            className={`p-1.5 rounded-full transition-colors ${
                              chunk.audioUrl 
                                ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                            title={chunk.audioUrl ? "Play Saved Audio" : "Play Basic TTS"}
                          >
                            {chunk.audioUrl ? <Play className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleGenerateAudio(chunk)}
                            disabled={generatingAudioId === chunk.id}
                            className={`p-1.5 rounded-full transition-colors ${
                              generatingAudioId === chunk.id
                                ? 'bg-gray-100 text-gray-400'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                            }`}
                            title={chunk.audioUrl ? "Regenerate Audio" : "Generate ElevenLabs Audio"}
                          >
                            {generatingAudioId === chunk.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                       <div>
                         <p className="text-lg font-medium text-gray-900">{chunk.engSentence}</p>
                         <p className="text-md text-gray-600 mt-1">{chunk.vieSentence}</p>
                       </div>
                     </div>
                     
                     <div className="mt-4 flex flex-wrap gap-2">
                       {chunk.resourcesUsed.map((resource, idx) => (
                         <span key={idx} className={`px-2 py-1 text-[10px] rounded border font-medium ${
                              typeof resource === 'string' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                              resource.color === 'Green' ? 'bg-green-50 text-green-700 border-green-100' :
                              resource.color === 'Blue' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              resource.color === 'Red' ? 'bg-red-50 text-red-700 border-red-100' :
                              'bg-pink-50 text-pink-700 border-pink-100'
                            }`}>
                           {typeof resource === 'string' ? resource : resource.name}
                         </span>
                       ))}
                     </div>
                   </div>
                   
                   <button 
                     onClick={() => handleDelete(chunk.id)} 
                     className="text-red-400 hover:text-red-600 p-2"
                     title="Delete Chunk"
                   >
                     <Trash2 className="w-5 h-5" />
                   </button>
                 </div>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
