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

  const uniqueCategories = useMemo(() => Array.from(new Set(chunks.map(c => c.category))).filter(Boolean).sort(), [chunks]);

  const filteredChunks = useMemo(() => {
    if (selectedCategory === 'all') return chunks;
    return chunks.filter(c => c.category === selectedCategory);
  }, [chunks, selectedCategory]);

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
      <div className="w-full md:w-80 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden shrink-0 h-1/3 md:h-full">
        <div className="p-3 md:p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 mb-2 md:mb-4 flex items-center text-sm md:text-base">
            <Filter className="w-4 h-4 mr-2" />
            Database Filters
          </h3>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 md:mt-4 text-xs font-medium text-gray-500 flex justify-between">
            <span>Showing {filteredChunks.length} chunks</span>
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
                <span className={`text-xs ${idx === currentIndex ? 'text-red-600' : 'text-gray-500'}`}>U: {chunk.uTotal}</span>
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
      <div className="flex-1 h-2/3 md:h-full rounded-2xl overflow-hidden bg-gray-900 relative shadow-2xl flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px]">
        
        {/* Header overlays */}
        <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start z-10 pointer-events-none">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter bg-red-600 inline-block px-2 py-0.5 md:py-1 mb-1">CHUNKS</h1>
            <p className="text-[10px] md:text-xs font-medium text-gray-300 tracking-widest uppercase">Voice Energy Trainer</p>
          </div>
          <button 
            onClick={toggleCamera}
            className="pointer-events-auto p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors border border-white/10"
          >
            {cameraActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
        </div>

        {/* Video feed */}
        <div className="absolute inset-0 bg-gray-900 overflow-hidden flex items-center justify-center">
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

        {/* Content Overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-gray-950 via-gray-900/90 to-transparent pt-24 md:pt-32 pb-4 md:pb-8 px-4 md:px-6 flex flex-col items-center text-center z-10">
          
          <AnimatePresence mode="wait">
            {currentChunk ? (
              <motion.div
                key={currentChunk.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-3xl flex flex-col items-center"
              >
                <h3 className="text-lg sm:text-xl md:text-3xl font-bold text-white mb-4 md:mb-6 leading-tight drop-shadow-lg">
                  {currentChunk.vieSentence}
                </h3>
                
                <button
                  onClick={playVietnamese}
                  className="flex items-center space-x-2 px-4 py-2 md:px-6 md:py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-white transition-all duration-200 mb-3 md:mb-4"
                >
                  <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-semibold text-xs md:text-sm">Nghe tiếng Việt</span>
                </button>

                <div className="min-h-[50px] md:min-h-[60px] flex items-center justify-center mb-4 md:mb-6 w-full">
                  {showEnglish ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-red-500/20 border border-red-500/30 px-4 py-3 md:px-6 md:py-4 rounded-xl w-full"
                    >
                      <p className="text-base md:text-xl font-bold text-white mb-2">{currentChunk.engSentence}</p>
                      <button 
                        onClick={() => setShowEnglish(false)}
                        className="text-white/50 hover:text-white/80 text-xs font-medium flex items-center justify-center mx-auto transition-colors"
                      >
                        <EyeOff className="w-3 h-3 mr-1" /> Hide English
                      </button>
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => setShowEnglish(true)}
                      className="text-sm md:text-md font-medium text-gray-400 hover:text-white flex items-center transition-colors px-4 py-2 md:px-6 md:py-3"
                    >
                      Say it in English <Eye className="w-4 h-4 ml-2 opacity-50" />
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="text-gray-400 font-medium text-sm md:text-base">No sentence selected.</div>
            )}
          </AnimatePresence>
          
          {/* Navigation */}
          <div className="flex items-center space-x-4 md:space-x-8 mt-2 md:mt-4 border-t border-white/10 pt-4 md:pt-6 w-full max-w-md justify-center">
            <button
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="p-2 text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <span className="text-xs md:text-sm font-medium text-white/60 min-w-[100px] md:min-w-[120px]">
              Change sentence
            </span>
            <button
              onClick={handleNext}
              disabled={currentIndex >= filteredChunks.length - 1}
              className="p-2 text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
          <div className="text-[10px] md:text-xs text-white/30 mt-2 md:mt-4 font-mono">
            {currentIndex + 1} / {filteredChunks.length}
          </div>
        </div>

      </div>
    </div>
  );
}
