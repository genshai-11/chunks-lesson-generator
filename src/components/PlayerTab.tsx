import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Chunk } from '../types';
import { Filter, ChevronLeft, ChevronRight, Volume2, Eye, EyeOff, VideoOff, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PlayerTab() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRs, setSelectedRs] = useState<Set<number>>(new Set());
  const [audioStatus, setAudioStatus] = useState<'all' | 'hasAudio' | 'noAudio'>('all');
  
  // Player state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showEnglish, setShowEnglish] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
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

  // Extract all unique categories
  const uniqueCategories = useMemo(() => Array.from(new Set(chunks.map(c => c.category))).filter(Boolean).sort(), [chunks]);

  // Extract all unique R Values (rTotal)
  const uniqueRs = useMemo(() => (Array.from(new Set(chunks.map(c => Number(c.rTotal)))) as number[]).filter(n => !isNaN(n)).sort((a: number, b: number) => a - b), [chunks]);

  const toggleRFilter = (r: number) => {
    setSelectedRs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(r)) newSet.delete(r);
      else newSet.add(r);
      return newSet;
    });
  };

  const filteredChunks = useMemo(() => {
    let result = chunks;
    if (selectedCategory !== 'all') {
      result = result.filter(c => c.category === selectedCategory);
    }
    if (selectedRs.size > 0) {
      result = result.filter(c => selectedRs.has(Number(c.rTotal)));
    }
    if (audioStatus === 'hasAudio') {
      result = result.filter(c => !!c.audioUrl);
    } else if (audioStatus === 'noAudio') {
      result = result.filter(c => !c.audioUrl);
    }
    return result;
  }, [chunks, selectedCategory, selectedRs, audioStatus]);

  useEffect(() => {
    setCurrentIndex(0);
    setShowEnglish(false);
  }, [filteredChunks]);

  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const currentChunk = filteredChunks[currentIndex] || null;

  const renderHighlightedSentence = (sentence: string, resourcesUsed: any[]) => {
    if (!resourcesUsed || resourcesUsed.length === 0) return <>{sentence}</>;
    
    // Sort by length descending to match longest phrases first
    const validResources = resourcesUsed
      .filter(r => typeof r !== 'string')
      .sort((a, b) => b.name.length - a.name.length);
      
    if (validResources.length === 0) return <>{sentence}</>;

    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patternStr = validResources.map(r => escapeRegExp(r.name)).join('|');
    const pattern = new RegExp(`(${patternStr})`, 'gi');
    
    const parts = sentence.split(pattern);
    
    return parts.map((part, i) => {
      const lowerPart = part.toLowerCase();
      const matchedRes = validResources.find(r => r.name.toLowerCase() === lowerPart);
      if (matchedRes) {
        const color = matchedRes.color;
        const colorClass = color === 'Green' ? 'text-green-400 font-extrabold bg-green-900/40 px-1 py-0.5 rounded' : 
                           color === 'Blue' ? 'text-blue-400 font-extrabold bg-blue-900/40 px-1 py-0.5 rounded' :
                           color === 'Red' ? 'text-red-400 font-extrabold bg-red-900/40 px-1 py-0.5 rounded' :
                           'text-pink-400 font-extrabold bg-pink-900/40 px-1 py-0.5 rounded';
        return <span key={i} className={colorClass}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const playVietnamese = () => {
    if (!currentChunk) return;
    const utterance = new SpeechSynthesisUtterance(currentChunk.vieSentence);
    utterance.lang = 'vi-VN';
    speechSynthesis.speak(utterance);
  };

  const handleNext = () => {
    if (currentIndex < filteredChunks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowEnglish(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowEnglish(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] animate-in fade-in duration-500">
      
      {/* Sidebar Filters & List */}
      <div className="w-full md:w-80 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden shrink-0 h-[40%] md:h-full">
        <div className="p-3 md:p-4 border-b border-gray-100 shrink-0 flex flex-col gap-3">
          <h3 className="font-bold text-gray-900 flex items-center text-sm md:text-base mb-1">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded p-1.5 text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
              >
                <option value="all">All</option>
                {uniqueCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Audio</label>
              <select
                value={audioStatus}
                onChange={(e) => setAudioStatus(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded p-1.5 text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="hasAudio">Has Audio</option>
                <option value="noAudio">No Audio</option>
              </select>
            </div>
          </div>

          <div>
             <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Load (Sum R)</label>
             <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto w-full pr-1 hide-scrollbar">
                {uniqueRs.length > 0 ? (
                  uniqueRs.map(r => (
                    <label key={r} className={`flex items-center gap-1.5 text-[10px] cursor-pointer px-2 py-1 rounded border transition-colors ${selectedRs.has(r) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                      <input 
                        type="checkbox" 
                        checked={selectedRs.has(r)} 
                        onChange={() => toggleRFilter(r)} 
                        className="w-3 h-3 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer" 
                      />
                      <span className={`font-medium ${selectedRs.has(r) ? 'text-red-700' : 'text-gray-600'}`}>{r.toFixed(0)}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-[10px] text-gray-400 italic">No R data.</p>
                )}
            </div>
          </div>
          
          <div className="text-[10px] font-medium text-gray-500 flex justify-between mt-1">
            <span>Showing {filteredChunks.length} chunks</span>
            {selectedRs.size > 0 && (
              <button onClick={() => setSelectedRs(new Set())} className="text-red-500 hover:text-red-600 font-bold">Clear Load</button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredChunks.map((chunk, idx) => (
            <button
              key={chunk.id}
              onClick={() => {
                setCurrentIndex(idx);
                setShowEnglish(false);
              }}
              className={`w-full text-left p-2 md:p-3 rounded-xl transition-all duration-200 ${
                idx === currentIndex
                  ? 'bg-red-50 border border-red-200 shadow-sm'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <p className={`text-sm line-clamp-2 ${idx === currentIndex ? 'font-bold text-red-900' : 'font-medium text-gray-700'}`}>
                {chunk.vieSentence}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className={`text-xs ${idx === currentIndex ? 'text-red-600' : 'text-gray-500'}`}>Ohm: {chunk.uTotal.toFixed(0)}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${idx === currentIndex ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  {chunk.category || 'Uncategorized'}
                </span>
              </div>
            </button>
          ))}
          {filteredChunks.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              No chunks match the current filter.
            </div>
          )}
        </div>
      </div>

      {/* Player Area */}
      <div className="flex-1 rounded-2xl overflow-hidden bg-gray-900 relative shadow-2xl flex flex-col min-h-[350px]">
        
        {/* Video feed (Background) */}
        <div className="absolute inset-0 bg-gray-900 overflow-hidden flex items-center justify-center pointer-events-none">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`min-w-full min-h-full object-cover transition-opacity duration-700 ${cameraActive ? 'opacity-100' : 'opacity-0'}`} 
          />
          
          {/* Face outline guide */}
          {cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-64 border-2 border-dashed border-cyan-400/40 rounded-[100%] absolute transform -translate-y-16"></div>
              <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full transform -translate-y-16 mt-40">
                <span className="text-white/80 text-xs font-medium">Position your face here</span>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Area - Takes remaining space */}
        <div className="relative z-10 flex-1 flex flex-col px-4 md:px-6 pb-4 md:pb-8 pt-4 md:pt-8 overflow-y-auto min-h-0">
          
          <AnimatePresence mode="wait">
            {currentChunk ? (
              <motion.div
                key={currentChunk.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-4xl mx-auto flex flex-col items-center mt-auto p-4 md:p-8"
              >
                {/* Visual Indicators for Resources inside current chunk */}
                <div className="flex flex-wrap justify-center gap-1.5 mb-4 md:mb-6 w-full">
                  {currentChunk.resourcesUsed.map((res, idx) => {
                    if (typeof res === 'string') return null;
                    return (
                      <span key={idx} className={`px-2.5 py-1 text-[10px] md:text-[11px] font-bold rounded-lg uppercase tracking-wider border whitespace-nowrap ${
                        res.color === 'Green' ? 'bg-green-900/50 text-green-300 border-green-500/30' :
                        res.color === 'Blue' ? 'bg-blue-900/50 text-blue-300 border-blue-500/30' :
                        res.color === 'Red' ? 'bg-red-900/50 text-red-300 border-red-500/30' :
                        'bg-pink-900/50 text-pink-300 border-pink-500/30'
                      }`}>
                         {res.color} Ohm: {res.name}
                      </span>
                    );
                  })}
                </div>

                <div className="w-full text-center">
                  <h3 className="text-sm sm:text-base md:text-lg font-normal text-white mb-6 leading-relaxed tracking-normal break-words">
                    {renderHighlightedSentence(currentChunk.vieSentence, currentChunk.resourcesUsed)}
                  </h3>
                </div>
                

                <div className="relative flex flex-col items-center justify-center w-full shrink-0">
                  <AnimatePresence>
                    {showEnglish && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full mb-4 px-6 py-4 w-full max-w-lg text-center bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl z-20"
                      >
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-black/80 border-r border-b border-white/10 rotate-45"></div>
                        <p className="text-sm md:text-base font-medium text-white/90 leading-relaxed break-words">
                          {renderHighlightedSentence(currentChunk.engSentence, currentChunk.resourcesUsed)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={() => setShowEnglish(!showEnglish)}
                    className={`p-3 rounded-full border border-white/10 hover:bg-white/5 active:scale-95 transition-all group relative ${showEnglish ? 'text-white bg-white/10' : 'text-white/40 hover:text-white'}`}
                    title="Translate to English"
                  >
                    {showEnglish ? <EyeOff className="w-5 h-5 md:w-6 md:h-6" /> : <Eye className="w-5 h-5 md:w-6 md:h-6" />}
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="text-gray-500 font-bold text-sm md:text-lg mt-auto mx-auto pb-12 flex flex-col items-center">
                <Filter className="w-12 h-12 mb-4 opacity-20" />
                No sentence selected.
              </div>
            )}
          </AnimatePresence>
          
          {/* Navigation */}
          <div className="flex items-center space-x-3 md:space-x-8 mt-4 border-t border-white/10 pt-4 w-full max-w-md mx-auto justify-center shrink-0">
            <button
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="p-1.5 md:p-2 text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
            </button>
            <span className="text-[10px] md:text-sm font-medium text-white/60 min-w-[80px] md:min-w-[120px] text-center">
              Change sentence
            </span>
            <button
              onClick={handleNext}
              disabled={currentIndex >= filteredChunks.length - 1}
              className="p-1.5 md:p-2 text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
            </button>
          </div>
          <div className="text-[9px] md:text-xs text-white/30 mt-2 font-mono shrink-0 mx-auto text-center">
            {currentIndex + 1} / {filteredChunks.length}
          </div>
        </div>
      </div>
    </div>
  );
}
