import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Chunk, AISettings } from '../types';
import { Trash2, Volume2, Play, Loader2, Sparkles } from 'lucide-react';
import { generateAudio } from '../services/audioService';

export default function ChunksTab() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSettings, setAiSettings] = useState<AISettings | undefined>();
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Load AI Settings for audio generation
    const loadSettings = async () => {
      try {
        const docRef = doc(db, `users/${auth.currentUser!.uid}/settings`, 'ai');
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
      collection(db, `users/${auth.currentUser.uid}/chunks`),
      (snapshot) => {
        const chunkData: Chunk[] = [];
        snapshot.forEach((doc) => {
          chunkData.push({ id: doc.id, ...doc.data() } as Chunk);
        });
        setChunks(chunkData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/chunks`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/chunks`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/chunks/${id}`);
    }
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
        await updateDoc(doc(db, `users/${auth.currentUser.uid}/chunks`, chunk.id), {
          audioUrl: audioUrl
        });
        // Audio will be updated via onSnapshot
      } else {
        alert('Failed to generate audio. Please check your ElevenLabs settings.');
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      alert('Error generating audio.');
    } finally {
      setGeneratingAudioId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Generated Chunks Database</h3>
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {chunks.length} Total
          </span>
        </div>
        
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading chunks...</div>
        ) : chunks.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No chunks found. Generate some in the Mixer tab.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {chunks.map((chunk) => (
               <div key={chunk.id} className="p-6 hover:bg-gray-50 transition-colors">
                 <div className="flex justify-between items-start">
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
