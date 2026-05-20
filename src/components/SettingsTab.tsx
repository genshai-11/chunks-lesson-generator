import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { AISettings } from '../types';
import { fetchOpenRouterModels } from '../services/aiService';
import { generateAudio } from '../services/audioService';
import { dataClient } from '../services/dataClient';
import { exportFirebaseWorkspace } from '../services/firebaseMigrationService';
import { Settings, Save, Loader2, RefreshCw, Key, Globe, Layers, Volume2, Sparkles, Eye, EyeOff, Copy, Mic, Calculator, Scale, Bot, Play } from 'lucide-react';

export default function SettingsTab() {
  const [settings, setSettings] = useState<AISettings>({
    endpoint: 'https://openrouter.ai/api/v1',
    apiKey: '',
    primaryModel: 'google/gemini-pro-1.5',
    fallbackModel: 'anthropic/claude-3-haiku',
    elevenLabsApiKey: '',
    elevenLabsModel: 'eleven_multilingual_v2',
    elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
    ttsProvider: 'elevenlabs',
    deepgramApiKey: '',
    deepgramModel: 'aura-asteria-en',
    m2mApiKey: '',
    sentenceConstraints: {
      'Very Short': { maxSentences: 1, maxWords: 15 },
      'Short': { maxSentences: 2, maxWords: 30 },
      'Medium': { maxSentences: 3, maxWords: 60 },
      'Long': { maxSentences: 5, maxWords: 100 }
    },
    formulaType: 'sum',
    complexityMultipliers: {
      'Very Short': 1,
      'Short': 1.5,
      'Medium': 2,
      'Long': 2.5
    },
    ohmBaseValues: { Green: 5, Blue: 7, Red: 9, Pink: 3 }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<any[]>([]);
  const [nineRouterVoices, setNineRouterVoices] = useState<any[]>([]);
  const [nineRouterFilterProvider, setNineRouterFilterProvider] = useState<string>('edge-tts');
  const [fetchingVoices, setFetchingVoices] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [previewText, setPreviewText] = useState('Hello, this is a test of the selected voice.');
  const [previewLang, setPreviewLang] = useState<'eng' | 'vie'>('eng');
  const [showM2MKey, setShowM2MKey] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string>('');

  const [activeSubTab, setActiveSubTab] = useState<'ai' | 'audio' | 'ohm' | 'api'>('ai');

  useEffect(() => {
    if (!auth.currentUser) return;

    const loadSettings = async () => {
      try {
        const data = await dataClient.getSetting<AISettings>('ai');
        if (data) {
          if (data.elevenLabsVoiceId === 'pNInz6obpg8ndclKuztW') {
            data.elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM';
          }
          if (!data.sentenceConstraints) {
            data.sentenceConstraints = {
              'Very Short': { maxSentences: 1, maxWords: 15 },
              'Short': { maxSentences: 2, maxWords: 30 },
              'Medium': { maxSentences: 3, maxWords: 60 },
              'Long': { maxSentences: 5, maxWords: 100 }
            };
          }
          if (!data.formulaType) {
            data.formulaType = 'sum';
          }
          if (!data.complexityMultipliers) {
            data.complexityMultipliers = {
              'Very Short': 1,
              'Short': 1.5,
              'Medium': 2,
              'Long': 2.5
            };
          }
          if (!data.ohmBaseValues) {
            data.ohmBaseValues = { Green: 5, Blue: 7, Red: 9, Pink: 3 };
          }
          setSettings((prev) => ({ ...prev, ...data }));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSaveAI = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await dataClient.setSetting('ai', { ...settings, enableChatbot: !!settings.enableChatbot });
      alert('AI Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving AI settings:', error);
      alert('Failed to save AI settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAudio = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await dataClient.setSetting('ai', { ...settings, ttsProvider: settings.ttsProvider || 'elevenlabs' });
      alert('Audio Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving audio settings:', error);
      alert('Failed to save audio settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOhm = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await dataClient.setSetting('ai', {
        ...settings,
        formulaType: settings.formulaType || 'sum',
        ohmBaseValues: settings.ohmBaseValues || { Green: 5, Blue: 7, Red: 9, Pink: 3 },
        complexityMultipliers: settings.complexityMultipliers || {
          'Very Short': 1,
          'Short': 1.5,
          'Medium': 2,
          'Long': 2.5
        },
        dynamicTLTiers: settings.dynamicTLTiers || [
          { maxCvr: 10, min: 1.0, max: 1.2 },
          { maxCvr: 20, min: 1.0, max: 1.7 },
          { maxCvr: 9999, min: 1.4, max: 2.0 }
        ]
      });
      alert('Ohm Rules Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving Ohm Rules settings:', error);
      alert('Failed to save Ohm Rules settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAPI = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await dataClient.setSetting('ai', { ...settings, m2mApiKey: settings.m2mApiKey });
      alert('API Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving API settings:', error);
      alert('Failed to save API settings.');
    } finally {
      setSaving(false);
    }
  };

  const generateM2MKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomKey = Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    setSettings({ ...settings, m2mApiKey: `m2m_${randomKey}` });
  };

  const handleImportFirebaseToSupabase = async () => {
    if (!auth.currentUser) return;
    setMigrationStatus('Reading Firebase workspace...');
    try {
      const payload = await exportFirebaseWorkspace();
      setMigrationStatus('Importing into Supabase...');
      const result = await dataClient.importFirebasePayload(payload);
      setMigrationStatus(`Import completed. Resources: ${result.resources || 0}, Chunks: ${result.chunks || 0}, History: ${result.cvrHistory || 0}`);
      alert('Firebase data imported into Supabase successfully.');
    } catch (error) {
      console.error('Firebase import failed:', error);
      setMigrationStatus(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      alert(`Firebase import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFetchModels = async () => {
    if (!settings.apiKey) {
      alert('Please enter an API key first.');
      return;
    }
    setFetchingModels(true);
    try {
      const models = await fetchOpenRouterModels(settings.apiKey, settings.endpoint);
      setAvailableModels(models);
    } catch (error) {
      console.error('Error fetching models:', error);
      alert('Failed to fetch models.');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleFetchVoices = async () => {
    if (!settings.elevenLabsApiKey) {
      alert('Please enter an ElevenLabs API key first.');
      return;
    }
    setFetchingVoices(true);
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': settings.elevenLabsApiKey,
        },
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch voices';
        try {
          const errorData = await response.json();
          if (errorData.detail && errorData.detail.message) {
            errorMessage = errorData.detail.message;
          } else if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Ignore JSON parse errors if response is not JSON
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setElevenLabsVoices(data.voices || []);
    } catch (error: any) {
      console.error('Error fetching voices:', error);
      alert(`Failed to fetch voices: ${error.message}`);
    } finally {
      setFetchingVoices(false);
    }
  };

  const handleFetch9RouterVoices = async () => {
    if (!settings.nineRouterUrl) {
      alert('Please enter a 9Router URL first.');
      return;
    }
    setFetchingVoices(true);
    try {
      // Endpoint normalization logic
      let endpoint = settings.nineRouterUrl.trim().replace(/\/+$/, '');
      if (endpoint.endsWith('/v1')) {
        endpoint = endpoint.slice(0, -3);
      }
      
      const providerParam = nineRouterFilterProvider ? `?provider=${nineRouterFilterProvider}` : '';
      const authHeader = settings.nineRouterApiKey ? { 'Authorization': `Bearer ${settings.nineRouterApiKey}` } : {};
      
      let targetUrl = `${endpoint}/v1/audio/voices${providerParam}`;
      let response = await fetch(targetUrl, { headers: authHeader });
      let usedFallback = false;

      if (!response.ok) {
        // Fallback to /v1/models/tts
        let fallbackUrl = `${endpoint}/v1/models/tts`;
        let fbResponse = await fetch(fallbackUrl, { headers: authHeader });
        
        if (fbResponse.ok) {
           response = fbResponse;
           usedFallback = true;
        } else {
           // Fallback to /v1/models
           fallbackUrl = `${endpoint}/v1/models`;
           fbResponse = await fetch(fallbackUrl, { headers: authHeader });
           
           if (fbResponse.ok) {
             response = fbResponse;
             usedFallback = true;
           }
        }
      }

      if (!response.ok) {
        let errMessage = response.statusText;
        try {
          const errData = await response.json();
          if (errData.error) errMessage = errData.error;
        } catch (e) {}
        throw new Error(`Failed to fetch 9Router voices: ${errMessage}`);
      }
      
      const data = await response.json();
      let voices = data.data || [];

      // Adapt the models array to our voice expected format if the fallback was used
      if (usedFallback && Array.isArray(voices)) {
        voices = voices.map((m: any) => ({
          model: m.id || m.model || '',
          name: m.name || m.id || m.model || 'Default Voice',
          provider: m.provider || (m.id && m.id.includes('/') ? m.id.split('/')[0] : 'unknown')
        }));
      }

      setNineRouterVoices(voices);
    } catch (error: any) {
      console.error('Error fetching 9Router voices:', error);
      const isFailedToFetch = error.message === 'Failed to fetch';
      alert(`Failed to fetch voices: ${error.message}${isFailedToFetch ? '. This often indicates a CORS missing on the server, an invalid URL, or the server is down.' : ''}`);
    } finally {
      setFetchingVoices(false);
    }
  };

  const handlePreviewVoice = async (textToSpeak: string, lang: 'eng' | 'vie') => {
    if (settings.ttsProvider === 'elevenlabs' && (!settings.elevenLabsApiKey || !settings.elevenLabsVoiceId)) {
      alert('Please configure ElevenLabs API Key and Voice ID first.');
      return;
    }
    if (settings.ttsProvider === 'deepgram' && !settings.deepgramApiKey) {
      alert('Please configure Deepgram API Key first.');
      return;
    }
    if (settings.ttsProvider === '9router' && (!settings.nineRouterUrl || (lang === 'eng' ? !settings.nineRouterEngVoice : !settings.nineRouterVieVoice))) {
      alert(`Please configure 9Router URL and ${lang === 'eng' ? 'English' : 'Vietnamese'} Voice first.`);
      return;
    }
    
    setPreviewingVoice(true);
    try {
      const audioUrl = await generateAudio(textToSpeak, settings, lang);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        await audio.play();
      } else {
        throw new Error('Failed to generate audio URL');
      }
    } catch (error: any) {
      console.error('Error previewing voice:', error);
      alert(`Preview failed: ${error.message}`);
    } finally {
      setPreviewingVoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Summary Section */}
      <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl border border-gray-800">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center">
          <Sparkles className="w-4 h-4 mr-2 text-yellow-400" /> Active Configuration Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase">Primary AI Model</p>
            <p className="text-sm font-mono text-blue-400 truncate">{settings.primaryModel || 'Not Set'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase">Fallback AI Model</p>
            <p className="text-sm font-mono text-purple-400 truncate">{settings.fallbackModel || 'Not Set'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase">ElevenLabs Model</p>
            <p className="text-sm font-mono text-green-400 truncate">{settings.elevenLabsModel || 'Not Set'}</p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex p-1 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <button
          onClick={() => setActiveSubTab('ai')}
          className={`flex-1 flex items-center justify-center py-2.5 px-4 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'ai' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Settings className="w-4 h-4 mr-2" />
          AI & LLM
        </button>
        <button
          onClick={() => setActiveSubTab('audio')}
          className={`flex-1 flex items-center justify-center py-2.5 px-4 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'audio' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Volume2 className="w-4 h-4 mr-2" />
          Audio (TTS)
        </button>
        <button
          onClick={() => setActiveSubTab('ohm')}
          className={`flex-1 flex items-center justify-center py-2.5 px-4 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'ohm' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Ohm Rules
        </button>
        <button
          onClick={() => setActiveSubTab('api')}
          className={`flex-1 flex items-center justify-center py-2.5 px-4 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'api' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Globe className="w-4 h-4 mr-2" />
          API (3rd Party)
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeSubTab === 'ai' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Settings className="w-6 h-6 mr-2 text-red-600" /> AI Configuration
              </h3>
              <button
                onClick={handleSaveAI}
                disabled={saving}
                className="flex items-center px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:bg-red-300 shadow-lg shadow-red-100"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save AI Config
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-gray-400" /> API Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.endpoint}
                    onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
                    placeholder="https://openrouter.ai/api/v1"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-400 italic">Default: OpenRouter API</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Key className="w-4 h-4 mr-2 text-gray-400" /> API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={settings.apiKey}
                      onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                      placeholder="sk-or-..."
                      className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50 pr-10"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400 italic">Your keys are stored securely.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center"><Layers className="w-4 h-4 mr-2 text-gray-400" /> Primary Model</span>
                    <button 
                      onClick={handleFetchModels}
                      disabled={fetchingModels}
                      className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center uppercase tracking-wider"
                    >
                      {fetchingModels ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Fetch Models
                    </button>
                  </label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={settings.primaryModel}
                      onChange={(e) => setSettings({ ...settings, primaryModel: e.target.value })}
                      placeholder="e.g., google/gemini-pro-1.5"
                      className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                    />
                    {availableModels.length > 0 && (
                      <select
                        onChange={(e) => setSettings({ ...settings, primaryModel: e.target.value })}
                        className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-xs bg-white"
                        value={settings.primaryModel}
                      >
                        <option value="">Select from list...</option>
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.name || m.id}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-gray-400" /> Fallback Model
                  </label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={settings.fallbackModel}
                      onChange={(e) => setSettings({ ...settings, fallbackModel: e.target.value })}
                      placeholder="e.g., anthropic/claude-3-haiku"
                      className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Audio Transcript Constraints */}
            <div className="mt-8 pt-8 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <Mic className="w-4 h-4 mr-2 text-gray-400" /> Audio Ohm / Transcription (Gemini)
              </h4>
              <p className="text-xs text-gray-500 mb-4">
                These settings specifically control the Whisper/Gemini model used during the recording phase in the Audio Ohm tab. Use this to circumvent rate limits (Code 429) on the default free tier.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Key className="w-4 h-4 mr-2 text-gray-400" /> Gemini Custom API Key
                  </label>
                  <input
                    type="password"
                    value={settings.geminiApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-400 italic">Leave empty to use the system default key.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-gray-400" /> Model Name
                  </label>
                  <input
                    type="text"
                    value={settings.audioTranscriptModel || ''}
                    onChange={(e) => setSettings({ ...settings, audioTranscriptModel: e.target.value })}
                    placeholder="e.g., gemini-2.5-flash or gemini-1.5-pro"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-400 italic">Default: gemini-2.5-flash</p>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <Bot className="w-4 h-4 mr-2 text-gray-400" /> AI AI Assistant / Chatbot
                </h4>
                <div className="flex items-center space-x-3">
                  <input type="checkbox" id="enableChatbot" className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300" checked={!!settings.enableChatbot} onChange={e => setSettings({...settings, enableChatbot: e.target.checked})} />
                  <label htmlFor="enableChatbot" className="text-sm font-bold text-gray-700">Enable Floating Chatbot</label>
                </div>
                <p className="text-xs text-gray-500 mt-2">Allows a floating AI assistant across all tabs that can generate chunks dynamically via natural language.</p>
              </div>
            </div>

            {/* Sentence Constraints */}
            <div className="mt-8 pt-8 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <Layers className="w-4 h-4 mr-2 text-gray-400" /> Sentence Length Constraints
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {(['Very Short', 'Short', 'Medium', 'Long'] as const).map((len) => (
                  <div key={len} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <label className="block text-[10px] font-bold uppercase mb-2 text-gray-700">{len}</label>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase">Max Sentences</span>
                        <input
                          type="number"
                          value={settings.sentenceConstraints?.[len]?.maxSentences ?? 1}
                          onChange={(e) => setSettings({
                            ...settings,
                            sentenceConstraints: {
                              ...(settings.sentenceConstraints || {
                                'Very Short': { maxSentences: 1, maxWords: 15 },
                                'Short': { maxSentences: 2, maxWords: 30 },
                                'Medium': { maxSentences: 3, maxWords: 60 },
                                'Long': { maxSentences: 5, maxWords: 100 }
                              }),
                              [len]: { ...(settings.sentenceConstraints?.[len] || {}), maxSentences: Number(e.target.value) }
                            }
                          })}
                          className="w-full mt-1 rounded-lg border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase">Max Words</span>
                        <input
                          type="number"
                          value={settings.sentenceConstraints?.[len]?.maxWords ?? 15}
                          onChange={(e) => setSettings({
                            ...settings,
                            sentenceConstraints: {
                              ...(settings.sentenceConstraints || {
                                'Very Short': { maxSentences: 1, maxWords: 15 },
                                'Short': { maxSentences: 2, maxWords: 30 },
                                'Medium': { maxSentences: 3, maxWords: 60 },
                                'Long': { maxSentences: 5, maxWords: 100 }
                              }),
                              [len]: { ...(settings.sentenceConstraints?.[len] || {}), maxWords: Number(e.target.value) }
                            }
                          })}
                          className="w-full mt-1 rounded-lg border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                      <div className="flex items-center"><Sparkles className="w-4 h-4 mr-2" /> Dynamic TL Bounds</div>
                      <button 
                        onClick={() => {
                          const current = [...(settings.dynamicTLTiers || [
                            { maxCvr: 10, min: 1.0, max: 1.2 },
                            { maxCvr: 20, min: 1.0, max: 1.7 },
                            { maxCvr: 9999, min: 1.4, max: 2.0 }
                          ])];
                          current.push({ maxCvr: 30, min: 1.0, max: 2.0 });
                          current.sort((a,b) => a.maxCvr - b.maxCvr);
                          setSettings({ ...settings, dynamicTLTiers: current });
                        }}
                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                      >
                        + Add Tier
                      </button>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {(settings.dynamicTLTiers || [
                        { maxCvr: 10, min: 1.0, max: 1.2 },
                        { maxCvr: 20, min: 1.0, max: 1.7 },
                        { maxCvr: 9999, min: 1.4, max: 2.0 }
                      ]).map((tier, idx, arr) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1 relative group">
                          <button 
                            onClick={() => {
                              const current = [...(settings.dynamicTLTiers || [
                                { maxCvr: 10, min: 1.0, max: 1.2 },
                                { maxCvr: 20, min: 1.0, max: 1.7 },
                                { maxCvr: 9999, min: 1.4, max: 2.0 }
                              ])];
                              current.splice(idx, 1);
                              setSettings({ ...settings, dynamicTLTiers: current });
                            }}
                            className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[10px] font-bold z-10 hover:bg-red-200 transition-opacity"
                            title="Remove tier"
                          >
                            ×
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">CVR &lt; </span>
                            <input 
                              type="number" 
                              value={tier.maxCvr === 9999 ? '' : tier.maxCvr} 
                              placeholder="Any"
                              onChange={(e) => {
                                const current = [...(settings.dynamicTLTiers || [
                                  { maxCvr: 10, min: 1.0, max: 1.2 },
                                  { maxCvr: 20, min: 1.0, max: 1.7 },
                                  { maxCvr: 9999, min: 1.4, max: 2.0 }
                                ])];
                                current[idx].maxCvr = e.target.value ? Number(e.target.value) : 9999;
                                setSettings({ ...settings, dynamicTLTiers: current });
                              }}
                              className="w-16 text-center bg-white border border-gray-200 rounded p-0.5 text-[10px] font-bold focus:ring-0 focus:border-red-500 text-gray-700" 
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Min</label>
                              <input 
                                type="number" step="0.1" 
                                value={tier.min} 
                                onChange={(e) => {
                                  const current = [...(settings.dynamicTLTiers || [
                                    { maxCvr: 10, min: 1.0, max: 1.2 },
                                    { maxCvr: 20, min: 1.0, max: 1.7 },
                                    { maxCvr: 9999, min: 1.4, max: 2.0 }
                                  ])];
                                  current[idx].min = Number(e.target.value);
                                  setSettings({ ...settings, dynamicTLTiers: current });
                                }}
                                className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" 
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Max</label>
                              <input 
                                type="number" step="0.1" 
                                value={tier.max} 
                                onChange={(e) => {
                                  const current = [...(settings.dynamicTLTiers || [
                                    { maxCvr: 10, min: 1.0, max: 1.2 },
                                    { maxCvr: 20, min: 1.0, max: 1.7 },
                                    { maxCvr: 9999, min: 1.4, max: 2.0 }
                                  ])];
                                  current[idx].max = Number(e.target.value);
                                  setSettings({ ...settings, dynamicTLTiers: current });
                                }}
                                className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div></div>
        )}

        {activeSubTab === 'audio' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Volume2 className="w-6 h-6 mr-2 text-red-600" /> Audio Configuration (TTS)
              </h3>
              <button
                onClick={handleSaveAudio}
                disabled={saving}
                className="flex items-center px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:bg-red-300 shadow-lg shadow-red-100"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Audio Config
              </button>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                TTS Provider
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ttsProvider"
                    value="elevenlabs"
                    checked={settings.ttsProvider === 'elevenlabs'}
                    onChange={() => setSettings({ ...settings, ttsProvider: 'elevenlabs' })}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium">ElevenLabs</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ttsProvider"
                    value="deepgram"
                    checked={settings.ttsProvider === 'deepgram'}
                    onChange={() => setSettings({ ...settings, ttsProvider: 'deepgram' })}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium">Deepgram</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ttsProvider"
                    value="9router"
                    checked={settings.ttsProvider === '9router'}
                    onChange={() => setSettings({ ...settings, ttsProvider: '9router' })}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium">9Router</span>
                </label>
              </div>
            </div>

            {settings.ttsProvider === 'elevenlabs' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center">
                      <Key className="w-4 h-4 mr-2 text-gray-400" /> ElevenLabs API Key
                    </span>
                    <button
                      onClick={handleFetchVoices}
                      disabled={fetchingVoices || !settings.elevenLabsApiKey}
                      className="text-xs flex items-center text-red-600 hover:text-red-700 font-medium disabled:text-gray-400"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${fetchingVoices ? 'animate-spin' : ''}`} />
                      Load Voices
                    </button>
                  </label>
                  <input
                    type="password"
                    value={settings.elevenLabsApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, elevenLabsApiKey: e.target.value })}
                    placeholder="Enter ElevenLabs API Key"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50 mb-3"
                  />
                  {elevenLabsVoices.length > 0 && (
                    <select
                      onChange={(e) => setSettings({ ...settings, elevenLabsVoiceId: e.target.value })}
                      className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm bg-white"
                      value={settings.elevenLabsVoiceId}
                    >
                      <option value="">Select a voice...</option>
                      {elevenLabsVoices.map((v) => (
                        <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-gray-400" /> TTS Model ID
                  </label>
                  <input
                    type="text"
                    value={settings.elevenLabsModel || ''}
                    onChange={(e) => setSettings({ ...settings, elevenLabsModel: e.target.value })}
                    placeholder="e.g., eleven_multilingual_v2"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Volume2 className="w-4 h-4 mr-2 text-gray-400" /> Voice ID
                  </label>
                  <input
                    type="text"
                    value={settings.elevenLabsVoiceId || ''}
                    onChange={(e) => setSettings({ ...settings, elevenLabsVoiceId: e.target.value })}
                    placeholder="e.g., 21m00Tcm4TlvDq8ikWAM"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  />
                </div>
              </div>
            </div>
            )}

            {settings.ttsProvider === 'deepgram' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Key className="w-4 h-4 mr-2 text-gray-400" /> Deepgram API Key
                  </label>
                  <input
                    type="password"
                    value={settings.deepgramApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, deepgramApiKey: e.target.value })}
                    placeholder="Enter Deepgram API Key"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-gray-400" /> Voice Model
                  </label>
                  <select
                    value={settings.deepgramModel || 'aura-asteria-en'}
                    onChange={(e) => setSettings({ ...settings, deepgramModel: e.target.value })}
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  >
                    <option value="aura-asteria-en">Aura Asteria (English Female)</option>
                    <option value="aura-luna-en">Aura Luna (English Female)</option>
                    <option value="aura-stella-en">Aura Stella (English Female)</option>
                    <option value="aura-athena-en">Aura Athena (English Female)</option>
                    <option value="aura-hera-en">Aura Hera (English Female)</option>
                    <option value="aura-orion-en">Aura Orion (English Male)</option>
                    <option value="aura-arcas-en">Aura Arcas (English Male)</option>
                    <option value="aura-perseus-en">Aura Perseus (English Male)</option>
                    <option value="aura-angus-en">Aura Angus (English Male)</option>
                    <option value="aura-orpheus-en">Aura Orpheus (English Male)</option>
                    <option value="aura-2-zeus-en">Aura 2 Zeus (American English)</option>
                  </select>
                </div>
              </div>
            </div>
            )}

            {settings.ttsProvider === '9router' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-gray-400" /> 9Router URL
                  </label>
                  <input
                    type="text"
                    value={settings.nineRouterUrl || ''}
                    onChange={(e) => setSettings({ ...settings, nineRouterUrl: e.target.value })}
                    placeholder="https://api.9router.com"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <Key className="w-4 h-4 mr-2 text-gray-400" /> API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={settings.nineRouterApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, nineRouterApiKey: e.target.value })}
                    placeholder="Enter API Key"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center">
                      <Layers className="w-4 h-4 mr-2 text-gray-400" /> English Voice Model
                    </span>
                    <div className="flex items-center space-x-2">
                       <select 
                         value={nineRouterFilterProvider}
                         onChange={(e) => setNineRouterFilterProvider(e.target.value)}
                         className="text-xs border border-gray-300 rounded p-1"
                       >
                         <option value="">All</option>
                         <option value="edge-tts">edge-tts</option>
                         <option value="elevenlabs">elevenlabs</option>
                         <option value="openai">openai</option>
                         <option value="deepgram">deepgram</option>
                         <option value="google-tts">google-tts</option>
                       </select>
                       <button
                         onClick={handleFetch9RouterVoices}
                         disabled={fetchingVoices || !settings.nineRouterUrl}
                         className="text-xs flex items-center text-red-600 hover:text-red-700 font-medium disabled:text-gray-400"
                       >
                         <RefreshCw className={`w-3 h-3 mr-1 ${fetchingVoices ? 'animate-spin' : ''}`} />
                         Load
                       </button>
                    </div>
                  </label>
                  <input
                    type="text"
                    value={settings.nineRouterEngVoice || ''}
                    onChange={(e) => setSettings({ ...settings, nineRouterEngVoice: e.target.value })}
                    placeholder="e.g., edge-tts/en-US-AriaNeural"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50 mb-3"
                  />
                  {nineRouterVoices.length > 0 && (
                    <select
                      onChange={(e) => setSettings({ ...settings, nineRouterEngVoice: e.target.value })}
                      className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm bg-white"
                      value={settings.nineRouterEngVoice}
                    >
                      <option value="">Select English voice...</option>
                      {nineRouterVoices.map((v) => (
                        <option key={v.model} value={v.model}>{v.name || v.model}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center">
                      <Layers className="w-4 h-4 mr-2 text-gray-400" /> Vietnamese Voice Model
                    </span>
                  </label>
                  <input
                    type="text"
                    value={settings.nineRouterVieVoice || ''}
                    onChange={(e) => setSettings({ ...settings, nineRouterVieVoice: e.target.value })}
                    placeholder="e.g., edge-tts/vi-VN-HoaiMyNeural"
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50 mb-3"
                  />
                  {nineRouterVoices.length > 0 && (
                    <select
                      onChange={(e) => setSettings({ ...settings, nineRouterVieVoice: e.target.value })}
                      className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm bg-white"
                      value={settings.nineRouterVieVoice}
                    >
                      <option value="">Select Vietnamese voice...</option>
                      {nineRouterVoices.map((v) => (
                        <option key={v.model} value={v.model}>{v.name || v.model}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
            )}
            
            {/* Test Voice Section */}
            <div className="mt-8 pt-8 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <Play className="w-4 h-4 mr-2 text-gray-400" /> Test Current Voice Settings
              </h4>
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="flex-1 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                  placeholder="Enter text to preview..."
                />
                <select
                  value={previewLang}
                  onChange={(e) => setPreviewLang(e.target.value as 'eng' | 'vie')}
                  className="rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-white"
                >
                  <option value="eng">English</option>
                  <option value="vie">Vietnamese</option>
                </select>
                <button
                  onClick={() => handlePreviewVoice(previewText, previewLang)}
                  disabled={previewingVoice || !previewText}
                  className="flex items-center px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {previewingVoice ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                  Test Voice
                </button>
              </div>
            </div>
            
          </div>
        )}

        {activeSubTab === 'ohm' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Sparkles className="w-6 h-6 mr-3 text-red-600" /> Ohm Rules Configuration
              </h3>
              <button
                onClick={handleSaveOhm}
                disabled={saving}
                className="flex items-center px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-red-100"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save Ohm Rules
                  </>
                )}
              </button>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                  <Calculator className="w-4 h-4 mr-2 text-gray-400" /> Formula Type
                </label>
                <select
                  value={settings.formulaType || 'sum'}
                  onChange={(e) => setSettings({ ...settings, formulaType: e.target.value as any })}
                  className="w-full max-w-xs rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
                >
                  <option value="sum">Sum (Characters)</option>
                  <option value="words">Words</option>
                </select>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  <Layers className="w-4 h-4 mr-2 text-gray-400" /> Base Ohm Values
                </h4>
                <p className="text-xs text-gray-400 mb-4">Điểm ohm gốc cho từng màu chunk. Giá trị này được dùng làm nền tảng tính toán ohm score.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {([
                    { key: 'Green', default: 5, bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-500', text: 'text-green-700', focus: 'focus:border-green-500 focus:ring-green-500', label: '🟢 Green' },
                    { key: 'Blue',  default: 7, bg: 'bg-blue-50',  border: 'border-blue-200',  badge: 'bg-blue-500',  text: 'text-blue-700',  focus: 'focus:border-blue-500 focus:ring-blue-500',   label: '🔵 Blue' },
                    { key: 'Red',   default: 9, bg: 'bg-red-50',   border: 'border-red-200',   badge: 'bg-red-500',   text: 'text-red-700',   focus: 'focus:border-red-500 focus:ring-red-500',     label: '🔴 Red' },
                    { key: 'Pink',  default: 3, bg: 'bg-pink-50',  border: 'border-pink-200',  badge: 'bg-pink-400',  text: 'text-pink-700',  focus: 'focus:border-pink-500 focus:ring-pink-500',   label: '🩷 Pink' },
                  ] as const).map(({ key, default: def, bg, border, badge, text, focus, label }) => (
                    <div key={key} className={`p-4 rounded-xl border-2 ${border} ${bg} flex flex-col items-center gap-2`}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${badge}`}>{label}</span>
                      <input
                        type="number"
                        min={1}
                        value={settings.ohmBaseValues?.[key] ?? def}
                        onChange={(e) => setSettings({
                          ...settings,
                          ohmBaseValues: {
                            ...(settings.ohmBaseValues || { Green: 5, Blue: 7, Red: 9, Pink: 3 }),
                            [key]: Number(e.target.value)
                          }
                        })}
                        className={`w-full text-center rounded-lg border ${border} shadow-sm ${focus} p-2 text-2xl font-black ${text} bg-white`}
                      />
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest">Base Ohm</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <Scale className="w-4 h-4 mr-2 text-gray-400" /> Complexity Multipliers
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {('Very Short,Short,Medium,Long'.split(',')).map(len => (
                    <div key={len}>
                      <label className="block text-[10px] font-bold uppercase mb-1 text-gray-700">{len}</label>
                      <input
                        type="number" step="0.1"
                        value={settings.complexityMultipliers?.[len] ?? 1}
                        onChange={(e) => setSettings({
                          ...settings,
                          complexityMultipliers: {
                            ...(settings.complexityMultipliers || {}),
                            [len]: Number(e.target.value)
                          }
                        })}
                        className="w-full rounded-lg border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                      <div className="flex items-center"><Sparkles className="w-4 h-4 mr-2" /> Dynamic TL Bounds</div>
                      <button 
                        onClick={() => {
                          const current = [...(settings.dynamicTLTiers || [
                            { maxCvr: 10, min: 1.0, max: 1.2 },
                            { maxCvr: 20, min: 1.0, max: 1.7 },
                            { maxCvr: 9999, min: 1.4, max: 2.0 }
                          ])];
                          current.push({ maxCvr: 30, min: 1.0, max: 2.0 });
                          current.sort((a,b) => a.maxCvr - b.maxCvr);
                          setSettings({ ...settings, dynamicTLTiers: current });
                        }}
                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                      >
                        + Add Tier
                      </button>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {(settings.dynamicTLTiers || [
                        { maxCvr: 10, min: 1.0, max: 1.2 },
                        { maxCvr: 20, min: 1.0, max: 1.7 },
                        { maxCvr: 9999, min: 1.4, max: 2.0 }
                      ]).map((tier, idx, arr) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1 relative group">
                          <button 
                            onClick={() => {
                              const current = [...(settings.dynamicTLTiers || [
                                { maxCvr: 10, min: 1.0, max: 1.2 },
                                { maxCvr: 20, min: 1.0, max: 1.7 },
                                { maxCvr: 9999, min: 1.4, max: 2.0 }
                              ])];
                              current.splice(idx, 1);
                              setSettings({ ...settings, dynamicTLTiers: current });
                            }}
                            className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[10px] font-bold z-10 hover:bg-red-200 transition-opacity"
                            title="Remove tier"
                          >
                            ×
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">CVR &lt; </span>
                            <input 
                              type="number" 
                              value={tier.maxCvr === 9999 ? '' : tier.maxCvr} 
                              placeholder="Any"
                              onChange={(e) => {
                                const current = [...(settings.dynamicTLTiers || [
                                  { maxCvr: 10, min: 1.0, max: 1.2 },
                                  { maxCvr: 20, min: 1.0, max: 1.7 },
                                  { maxCvr: 9999, min: 1.4, max: 2.0 }
                                ])];
                                current[idx].maxCvr = e.target.value ? Number(e.target.value) : 9999;
                                setSettings({ ...settings, dynamicTLTiers: current });
                              }}
                              className="w-16 text-center bg-white border border-gray-200 rounded p-0.5 text-[10px] font-bold focus:ring-0 focus:border-red-500 text-gray-700" 
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Min</label>
                              <input 
                                type="number" step="0.1" 
                                value={tier.min} 
                                onChange={(e) => {
                                  const current = [...(settings.dynamicTLTiers || [
                                    { maxCvr: 10, min: 1.0, max: 1.2 },
                                    { maxCvr: 20, min: 1.0, max: 1.7 },
                                    { maxCvr: 9999, min: 1.4, max: 2.0 }
                                  ])];
                                  current[idx].min = Number(e.target.value);
                                  setSettings({ ...settings, dynamicTLTiers: current });
                                }}
                                className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" 
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Max</label>
                              <input 
                                type="number" step="0.1" 
                                value={tier.max} 
                                onChange={(e) => {
                                  const current = [...(settings.dynamicTLTiers || [
                                    { maxCvr: 10, min: 1.0, max: 1.2 },
                                    { maxCvr: 20, min: 1.0, max: 1.7 },
                                    { maxCvr: 9999, min: 1.4, max: 2.0 }
                                  ])];
                                  current[idx].max = Number(e.target.value);
                                  setSettings({ ...settings, dynamicTLTiers: current });
                                }}
                                className="w-full text-right bg-transparent border-b border-gray-200 p-1 text-[11px] font-bold focus:ring-0 focus:border-red-500 max-w-[50px] text-red-600" 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
            </div>
          </div>
        )}

        {activeSubTab === 'api' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Globe className="w-6 h-6 mr-3 text-blue-600" /> API Integration (REST)
              </h3>
              <button
                onClick={handleSaveAPI}
                disabled={saving}
                className="flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>

            {/* M2M API Key Configuration */}
            <div className="mb-12 p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Key className="w-5 h-5 text-blue-600 mr-2" />
                  <h4 className="font-bold text-gray-900">M2M Security Settings</h4>
                </div>
                {!settings.m2mApiKey && (
                  <button
                    onClick={generateM2MKey}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                  >
                    Auto-generate Key
                  </button>
                )}
              </div>
              <p className="text-xs text-blue-700 mb-6 bg-white/50 p-3 rounded-lg border border-blue-100 leading-relaxed">
                <strong>Machine-to-Machine Setup:</strong> Use the API Key below to bypass cookie gates for external server requests. 
                Always include the <code className="bg-blue-100 px-1 rounded font-bold">X-API-Key</code> header in your requests.
              </p>
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Machine API Key (X-API-Key)</label>
                  <div className="relative group">
                    <input
                      type={showM2MKey ? 'text' : 'password'}
                      value={settings.m2mApiKey || ''}
                      onChange={(e) => setSettings({ ...settings, m2mApiKey: e.target.value })}
                      className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                      placeholder="M2M Key for server-to-server auth..."
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                      <button
                        onClick={() => setShowM2MKey(!showM2MKey)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title={showM2MKey ? "Hide" : "Show"}
                      >
                        {showM2MKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          if (settings.m2mApiKey) {
                            navigator.clipboard.writeText(settings.m2mApiKey);
                            alert('API Key copied to clipboard!');
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Copy"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {!settings.m2mApiKey && (
                    <p className="mt-2 text-[10px] text-amber-600 font-medium">
                      ⚠️ No API key set. The API is currently not fully secured for M2M.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-12 p-6 bg-amber-50/70 rounded-2xl border border-amber-100">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h4 className="font-bold text-gray-900">Firebase → Supabase Migration</h4>
                  <p className="text-xs text-amber-700 mt-1">
                    One-time import of Firebase workspace data into the new Supabase compatibility tables.
                  </p>
                </div>
                <button
                  onClick={handleImportFirebaseToSupabase}
                  disabled={saving || !auth.currentUser}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
                >
                  Import Firebase Data
                </button>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                This reads <code>workspaces/default</code> from Firebase using your current session and imports
                <code> resources</code>, <code>chunks</code>, <code>cvr_history</code>, <code>settings/ai</code>, and <code>settings/baseOhms</code> into Supabase.
              </p>
              {migrationStatus && (
                <div className="mt-4 px-4 py-3 bg-white border border-amber-200 rounded-xl text-xs text-gray-700 font-medium">
                  {migrationStatus}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-12">
              {/* Capability 1: Transcription API */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3 text-blue-600">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Transcription API</h4>
                    <p className="text-xs text-gray-500">Audio/video input (base64) → Text transcript</p>
                  </div>
                </div>
                
                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto relative group">
                  <button 
                    onClick={() => {
                      const snippet = `fetch('${window.location.origin}/api/transcribe', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': '${settings.m2mApiKey || "YOUR_API_KEY"}',
    'X-Requested-With': 'XMLHttpRequest'
  },
  body: JSON.stringify({ audioData: "BASE64_STRING", mimeType: "audio/webm" })
})`;
                      navigator.clipboard.writeText(snippet);
                      alert('Transcription API snippet copied!');
                    }}
                    className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-[10px] uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Copy Request
                  </button>
                  <pre className="text-xs text-green-400 font-mono leading-relaxed">
{`// POST /api/transcribe
fetch('${window.location.origin.replace('-dev', '')}/api/transcribe', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': '${settings.m2mApiKey || "YOUR_API_KEY"}',
    'X-Requested-With': 'XMLHttpRequest'
  },
  body: JSON.stringify({ 
    audioData: "...", 
    mimeType: "audio/webm" 
  })
})`}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Success</span>
                    <pre className="text-[10px] text-gray-700 font-mono">{`{"status":"success","transcript":"..."}`}</pre>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Error</span>
                    <pre className="text-[10px] text-red-600 font-mono">{`{"status":"error","error":"..."}`}</pre>
                  </div>
                </div>
              </div>

              {/* Capability 2: Analysis API */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg mr-3 text-red-600">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Analysis API (Ohm & Chunks)</h4>
                    <p className="text-xs text-gray-500">Transcript text → Semantic Chunks & Ohm Calculation</p>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto relative group">
                  <button 
                    onClick={() => {
                      const apiSnippet = `fetch('${window.location.origin}/api/analyze-ohm', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': '${settings.m2mApiKey || "YOUR_API_KEY"}',
    'X-Requested-With': 'XMLHttpRequest'
  },
  body: JSON.stringify({
    transcript: "Text to analyze...",
    settings: { 
      ohmBaseValues: { Green: 5, Blue: 7, Red: 9, Pink: 3 },
      formulaType: "sum",
      complexityMultipliers: { "Very Short": 1, "Short": 1.5, "Medium": 2, "Long": 2.5 }
    },
    webhookUrl: "https://your-server.com/callback" // Optional
  })
})`;
                      navigator.clipboard.writeText(apiSnippet);
                      alert('Analysis API snippet copied!');
                    }}
                    className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-[10px] uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Copy Request
                  </button>
                  <pre className="text-xs text-green-400 font-mono leading-relaxed">
{`// POST /api/analyze-ohm
fetch('${window.location.origin.replace('-dev', '')}/api/analyze-ohm', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': '${settings.m2mApiKey || "YOUR_API_KEY"}',
    'X-Requested-With': 'XMLHttpRequest'
  },
  body: JSON.stringify({
    transcript: "...",
    settings: { ... },
    webhookUrl: "..."
  })
})`}
                  </pre>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Data Model (Success)</span>
                  <pre className="text-[10px] text-gray-700 font-mono leading-tight whitespace-pre-wrap">
{`{
  "status": "success",
  "data": {
    "transcriptRaw": "...",
    "chunks": [{ "text": "...", "label": "RED", "ohm": 9 }],
    "formula": "9 x ...",
    "totalOhm": 81
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
