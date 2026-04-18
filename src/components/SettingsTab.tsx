import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AISettings } from '../types';
import { fetchOpenRouterModels } from '../services/aiService';
import { Settings, Save, Loader2, RefreshCw, Key, Globe, Layers, Volume2, Sparkles, Eye, EyeOff, Copy } from 'lucide-react';

export default function SettingsTab() {
  const [settings, setSettings] = useState<AISettings>({
    endpoint: 'https://openrouter.ai/api/v1',
    apiKey: '',
    primaryModel: 'google/gemini-pro-1.5',
    fallbackModel: 'anthropic/claude-3-haiku',
    elevenLabsApiKey: '',
    elevenLabsModel: 'eleven_multilingual_v2',
    elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
    m2mApiKey: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<any[]>([]);
  const [fetchingVoices, setFetchingVoices] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [previewText, setPreviewText] = useState('Hello, this is a test of the selected voice.');
  const [showM2MKey, setShowM2MKey] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'ai' | 'audio' | 'ohm' | 'api'>('ai');

  useEffect(() => {
    if (!auth.currentUser) return;

    const loadSettings = async () => {
      try {
        const docRef = doc(db, `workspaces/default/settings`, 'ai');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as AISettings;
          // Migration: Update old voice ID if found
          if (data.elevenLabsVoiceId === 'pNInz6obpg8ndclKuztW') {
            data.elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM';
          }
          setSettings(data);
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
      const docRef = doc(db, `workspaces/default/settings`, 'ai');
      await setDoc(docRef, {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        primaryModel: settings.primaryModel,
        fallbackModel: settings.fallbackModel,
      }, { merge: true });
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
      const docRef = doc(db, `workspaces/default/settings`, 'ai');
      await setDoc(docRef, {
        elevenLabsApiKey: settings.elevenLabsApiKey,
        elevenLabsModel: settings.elevenLabsModel,
        elevenLabsVoiceId: settings.elevenLabsVoiceId,
      }, { merge: true });
      alert('Audio Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving audio settings:', error);
      alert('Failed to save audio settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAPI = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const docRef = doc(db, `workspaces/default/settings`, 'ai');
      await setDoc(docRef, {
        m2mApiKey: settings.m2mApiKey,
      }, { merge: true });
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

  const handlePreviewVoice = async () => {
    if (!settings.elevenLabsApiKey || !settings.elevenLabsVoiceId) {
      alert('Please configure API Key and Voice ID first.');
      return;
    }
    setPreviewingVoice(true);
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${settings.elevenLabsVoiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': settings.elevenLabsApiKey,
        },
        body: JSON.stringify({ 
          text: previewText,
          model_id: settings.elevenLabsModel || 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.detail && error.detail.message) {
          throw new Error(error.detail.message);
        } else if (error.error) {
          throw new Error(error.error);
        }
        throw new Error('Failed to generate preview');
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      await audio.play();
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
          </div>
        )}

        {activeSubTab === 'audio' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Volume2 className="w-6 h-6 mr-2 text-red-600" /> Audio Configuration (ElevenLabs)
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

                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Preview Voice
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      placeholder="Text to preview..."
                      className="flex-1 rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-sm bg-white"
                    />
                    <button
                      onClick={handlePreviewVoice}
                      disabled={previewingVoice || !settings.elevenLabsVoiceId}
                      className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:bg-gray-300 transition-colors flex items-center"
                    >
                      {previewingVoice ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'ohm' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Sparkles className="w-6 h-6 mr-2 text-red-600" /> Ohm Configuration
              </h3>
              <button
                onClick={async () => {
                  if (!auth.currentUser) return;
                  setSaving(true);
                  try {
                    const docRef = doc(db, `workspaces/default/settings`, 'ai');
                    await setDoc(docRef, {
                      ohmPromptInstructions: settings.ohmPromptInstructions || null,
                      ohmBaseValues: settings.ohmBaseValues || null,
                    }, { merge: true });
                    alert('Ohm Configuration saved successfully!');
                  } catch (error) {
                    console.error('Error saving Ohm settings:', error);
                    alert('Failed to save Ohm settings.');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="flex items-center px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-100"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Ohm Config
              </button>
            </div>

            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-700 flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-gray-400" /> Custom System Prompt
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultPrompt = `Bạn là một chuyên gia phân tích ngôn ngữ học tiếng Việt. Hãy bóc tách Transcript thành các cụm từ (Semantic Chunks) mang năng lượng Ohm:\n- GREEN ({G} Ohm): Quán ngữ, từ nối, từ lặp, fillers.\n- BLUE ({B} Ohm): Khung câu, mẫu câu giao tiếp.\n- RED ({R} Ohm): Thành ngữ, từ láy, ngôn ngữ hình ảnh.\n- PINK ({P} Ohm): Từ khóa chuyên môn hoặc khái niệm chính.`;
                      if (!settings.ohmPromptInstructions || window.confirm('This will overwrite your custom prompt. Continue?')) {
                        setSettings(prev => ({ ...prev, ohmPromptInstructions: defaultPrompt }));
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Load Default Template
                  </button>
                </div>
                <textarea
                  value={settings.ohmPromptInstructions || ''}
                  onChange={(e) => setSettings({ ...settings, ohmPromptInstructions: e.target.value })}
                  placeholder="Ex: You are an expert linguistic analyzer..."
                  className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50 min-h-[200px]"
                />
              </div>
              
              <div className="pt-6 border-t border-gray-100">
                <label className="block text-sm font-bold text-gray-700 mb-4 flex items-center">
                  <Layers className="w-4 h-4 mr-2 text-gray-400" /> Base Ohm Values
                </label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {['Green', 'Blue', 'Red', 'Pink'].map((color) => (
                    <div key={color} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <label className={`block text-[10px] font-bold uppercase mb-1 ${color === 'Green' ? 'text-green-700' : color === 'Blue' ? 'text-blue-700' : color === 'Red' ? 'text-red-700' : 'text-pink-700'}`}>{color}</label>
                      <input
                        type="number"
                        value={settings.ohmBaseValues?.[color as keyof typeof settings.ohmBaseValues] ?? (color === 'Green' ? 5 : color === 'Blue' ? 7 : color === 'Red' ? 9 : 3)}
                        onChange={(e) => setSettings({ 
                          ...settings, 
                          ohmBaseValues: { 
                            ...(settings.ohmBaseValues || { Green: 5, Blue: 7, Red: 9, Pink: 3 }), 
                            [color]: Number(e.target.value) 
                          } 
                        })}
                        className="w-full bg-transparent border-none p-0 text-xl font-bold focus:ring-0 text-gray-900"
                      />
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
    settings: { ohmBaseValues: { Green: 5, Blue: 7, Red: 9, Pink: 3 } },
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
