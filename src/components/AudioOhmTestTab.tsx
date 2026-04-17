import React, { useState, useRef } from 'react';
import { Mic, Square, Upload, Play, Loader2, RefreshCw, Edit2, Check } from 'lucide-react';
import { transcribeAudio, analyzeTranscript, OhmAnalysisResult } from '../services/aiService';
import { AISettings } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function AudioOhmTestTab() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'transcribing' | 'analyzing' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OhmAnalysisResult | null>(null);
  const [expertMode, setExpertMode] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        handleTranscription(blob);
      };

      mediaRecorder.current.start();
      setRecording(true);
      setStatus('recording');
      setError(null);
      setResult(null);
      setTranscript('');
    } catch (err: any) {
      setError('Could not access microphone: ' + err.message);
      setStatus('failed');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && recording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setError(null);
    setResult(null);
    setTranscript('');
    handleTranscription(file);
  };

  const getSettings = async (): Promise<AISettings | undefined> => {
    if (!auth.currentUser) return undefined;
    try {
      const docRef = doc(db, `workspaces/default/settings`, 'ai');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as AISettings;
      }
    } catch (e) {
      console.error(e);
    }
    return undefined;
  };

  const getBaseOhms = async (): Promise<Record<string, number> | undefined> => {
    if (!auth.currentUser) return undefined;
    try {
      const docRef = doc(db, `workspaces/default/settings`, 'baseOhms');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as Record<string, number>;
      }
    } catch (e) {
      console.error("Failed to load baseOhms", e);
    }
    return undefined;
  };

  const handleTranscription = async (blob: Blob) => {
    setStatus('transcribing');
    try {
      const text = await transcribeAudio(blob);
      setTranscript(text);
      setEditedTranscript(text);
      await handleAnalysis(text);
    } catch (err: any) {
      setError('Transcription failed: ' + err.message);
      setStatus('failed');
    }
  };

  const handleAnalysis = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) {
      setError('Transcript is empty.');
      setStatus('failed');
      return;
    }
    setStatus('analyzing');
    try {
      const settings = await getSettings();
      const baseOhms = await getBaseOhms();
      const analysisResult = await analyzeTranscript(textToAnalyze, settings, baseOhms);
      setResult(analysisResult);
      setStatus('completed');
    } catch (err: any) {
      setError('Analysis failed: ' + err.message);
      setStatus('failed');
    }
  };

  const handleManualAnalyze = () => {
    setTranscript(editedTranscript);
    setIsEditingTranscript(false);
    handleAnalysis(editedTranscript);
  };

  const getCategoryColor = (label: string) => {
    switch (label) {
      case 'GREEN': return 'bg-green-100 text-green-800 border-green-200';
      case 'BLUE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'RED': return 'bg-red-100 text-red-800 border-red-200';
      case 'PINK': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Audio Ohm Test</h2>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600 flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={expertMode} 
                onChange={(e) => setExpertMode(e.target.checked)}
                className="mr-2 rounded text-red-600 focus:ring-red-500"
              />
              Expert Mode
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 flex flex-col items-center justify-center min-h-[200px]">
              {recording ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-8 h-8 text-red-600" />
                  </div>
                  <span className="text-red-600 font-medium animate-pulse">Recording...</span>
                  <button
                    onClick={stopRecording}
                    className="px-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center shadow-lg"
                  >
                    <Square className="w-4 h-4 mr-2" /> Stop
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <button
                    onClick={startRecording}
                    className="w-16 h-16 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                  >
                    <Mic className="w-8 h-8" />
                  </button>
                  <span className="text-gray-600 font-medium">Click to Record</span>
                  
                  <div className="flex items-center w-full max-w-xs my-2">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-3 text-xs text-gray-400 uppercase">or</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  <label className="cursor-pointer px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-sm font-medium">
                    <Upload className="w-4 h-4 mr-2" /> Upload Audio
                    <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}
            </div>

            {audioUrl && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <audio src={audioUrl} controls className="w-full" />
              </div>
            )}

            {/* Status & Error */}
            {status !== 'idle' && status !== 'completed' && status !== 'failed' && (
              <div className="flex items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                <span className="font-medium capitalize">{status}...</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Transcript Section */}
          <div className="space-y-4">
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 h-full flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800">Transcript</h3>
                {transcript && !isEditingTranscript && (
                  <button 
                    onClick={() => setIsEditingTranscript(true)}
                    className="text-xs flex items-center text-gray-500 hover:text-gray-900"
                  >
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </button>
                )}
              </div>

              {isEditingTranscript ? (
                <div className="flex-1 flex flex-col">
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="flex-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm resize-none mb-3"
                    rows={5}
                  />
                  <div className="flex justify-end space-x-2">
                    <button 
                      onClick={() => {
                        setIsEditingTranscript(false);
                        setEditedTranscript(transcript);
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleManualAnalyze}
                      className="px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-800 rounded-lg flex items-center"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Analyze
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  {transcript ? (
                    <p className="text-gray-700 text-lg leading-relaxed">{transcript}</p>
                  ) : (
                    <p className="text-gray-400 italic text-sm text-center mt-10">No transcript yet. Record or upload audio.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chunks List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Semantic Chunks</h3>
            {result.chunks.length > 0 ? (
              <div className="space-y-3">
                {result.chunks.map((chunk, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${getCategoryColor(chunk.label)}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-lg">{chunk.text}</span>
                        {expertMode && (
                          <p className="text-xs mt-1 opacity-80">Reason: {chunk.reason}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="px-2 py-1 bg-white/50 rounded text-xs font-bold uppercase tracking-wider mb-1">
                          {chunk.label}
                        </span>
                        <span className="font-mono font-bold">{chunk.ohm} Ω</span>
                        {expertMode && (
                          <span className="text-[10px] mt-1 opacity-70">Conf: {chunk.confidence.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
                No semantic chunks detected in this transcript.
              </div>
            )}
            
            {expertMode && (
              <div className="mt-6 p-4 bg-gray-900 text-gray-300 rounded-xl font-mono text-xs overflow-auto">
                <p className="text-gray-500 mb-2">// Normalized Transcript</p>
                <p>{result.transcriptNormalized}</p>
              </div>
            )}
          </div>

          {/* Ohm Calculation */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ohm Calculation</h3>
            
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-sm font-mono text-gray-500 mb-2">Formula</div>
              <div className="text-2xl font-bold text-gray-800 mb-8 tracking-widest">
                {result.formula || '0'}
              </div>
              
              <div className="text-sm font-mono text-gray-500 mb-2">Total Ohm</div>
              <div className="text-6xl font-black text-red-600">
                {result.totalOhm}
              </div>
            </div>

            <div className="mt-6 space-y-2 text-xs text-gray-500">
              <p><strong>Rules:</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>GREEN = 5 Ω (Gap fillers)</li>
                <li>BLUE = 7 Ω (Sentence frames)</li>
                <li>RED = 9 Ω (Idioms/Expressions)</li>
                <li>PINK = 3 Ω (Key terms)</li>
                <li>Same group → Add (+)</li>
                <li>Different groups → Multiply (×)</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
