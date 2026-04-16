import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Chunk, AISettings } from '../types';
import { Trash2, Volume2, Play, Loader2, Sparkles, Download } from 'lucide-react';
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
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedIds.size} selected chunks?`);
    if (!confirmDelete) return;

    setIsDeletingBulk(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        await deleteDoc(doc(db, `workspaces/default/chunks`, id));
        successCount++;
      } catch (error) {
        console.error('Error deleting chunk', id, error);
        failCount++;
      }
    }

    setIsDeletingBulk(false);
    setSelectedIds(new Set());
    alert(`Bulk delete complete.\nSuccess: ${successCount}\nFailed: ${failCount}`);
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;

    const chunksToExport = chunks.filter(c => selectedIds.has(c.id)).map(c => ({
      Category: c.category,
      'English Sentence': c.engSentence,
      'Vietnamese Sentence': c.vieSentence,
      'Difficulty': c.difficultyLabel,
      'U (Total)': c.uTotal,
      'R (Ohm)': c.rTotal,
      'I (Intensity)': c.iValue,
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

  const handleGenerateAudio = async (chunk: Chunk) => {
    if (!auth.currentUser) return;
    setGeneratingAudioId(chunk.id);
    try {
      const audioUrl = await generateAudio(chunk.engSentence, aiSettings);
      if (audioUrl) {
        await updateDoc(doc(db, `workspaces/default/chunks`, chunk.id), {
          audioUrl: audioUrl
        });
        // Audio will be updated via onSnapshot
      }
    } catch (error: any) {
      console.error('Error generating audio:', error);
      alert(`Failed to generate audio. ${error.message || 'Please check your ElevenLabs settings.'}`);
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
      alert("All selected chunks already have audio.");
      setIsGeneratingBulkAudio(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    for (const chunk of chunksToProcess) {
      setGeneratingAudioId(chunk.id);
      try {
        const audioUrl = await generateAudio(chunk.engSentence, aiSettings);
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
      alert(`Bulk generation complete.\nSuccess: ${successCount}\nFailed: ${failCount}\nLast Error: ${lastError}`);
    } else {
      alert(`Bulk generation complete.\nSuccess: ${successCount}\nFailed: ${failCount}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Generated Chunks Database</h3>
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {filteredChunks.length} / {chunks.length} Total
          </span>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            {/* Categories */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Category</label>
              <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-gray-50">
                {uniqueCategories.map(cat => (
                  <label key={cat} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pendingFilters.categories.has(cat)} onChange={() => toggleFilter('categories', cat)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    {cat}
                  </label>
                ))}
                {uniqueCategories.length === 0 && <span className="text-xs text-gray-400">No categories</span>}
              </div>
            </div>
            {/* U Values */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">U (Difficulty)</label>
              <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-gray-50">
                {uniqueUs.map(u => (
                  <label key={u} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pendingFilters.us.has(u)} onChange={() => toggleFilter('us', u)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    {u.toFixed(1)}
                  </label>
                ))}
                {uniqueUs.length === 0 && <span className="text-xs text-gray-400">No data</span>}
              </div>
            </div>
            {/* R Values */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">R (Ohm)</label>
              <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-gray-50">
                {uniqueRs.map(r => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pendingFilters.rs.has(r)} onChange={() => toggleFilter('rs', r)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    {r.toFixed(1)}
                  </label>
                ))}
                {uniqueRs.length === 0 && <span className="text-xs text-gray-400">No data</span>}
              </div>
            </div>
            {/* I Values */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">I (Intensity)</label>
              <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-gray-50">
                {uniqueIs.map(i => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pendingFilters.is.has(i)} onChange={() => toggleFilter('is', i)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    {i.toFixed(1)}
                  </label>
                ))}
                {uniqueIs.length === 0 && <span className="text-xs text-gray-400">No data</span>}
              </div>
            </div>
            {/* Audio Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Audio Status</label>
              <select
                value={pendingFilters.audio}
                onChange={(e) => toggleFilter('audio', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm"
              >
                <option value="all">All</option>
                <option value="hasAudio">Has Audio</option>
                <option value="noAudio">No Audio</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={clearFilters} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Clear Filters
            </button>
            <button onClick={applyFilters} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700">
              Apply Filters
            </button>
          </div>
        </div>

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
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                         {chunk.difficultyLabel} (U={chunk.uTotal.toFixed(1)})
                       </span>
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                         {chunk.category}
                       </span>
                       <div className="text-xs text-gray-500">
                         R={chunk.rTotal.toFixed(1)} • I={chunk.iValue.toFixed(1)}
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
