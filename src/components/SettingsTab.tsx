import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AISettings } from '../types';
import { fetchOpenRouterModels } from '../services/aiService';
import { Settings, Save, Loader2, RefreshCw, Key, Globe, Layers, Volume2, Sparkles } from 'lucide-react';

export default function SettingsTab() {
  const [settings, setSettings] = useState<AISettings>({
    endpoint: 'https://openrouter.ai/api/v1',
    apiKey: '',
    primaryModel: 'google/gemini-pro-1.5',
    fallbackModel: 'anthropic/claude-3-haiku',
    elevenLabsApiKey: '',
    elevenLabsModel: 'eleven_monolingual_v1',
    elevenLabsVoiceId: 'pNInz6obpg8ndclKuztW',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const loadSettings = async () => {
      try {
        const docRef = doc(db, `users/${auth.currentUser!.uid}/settings`, 'ai');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AISettings);
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
      const docRef = doc(db, `users/${auth.currentUser.uid}/settings`, 'ai');
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
      const docRef = doc(db, `users/${auth.currentUser.uid}/settings`, 'ai');
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

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
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
              <p className="mt-1.5 text-[11px] text-gray-400 italic">Your keys are stored securely in your private database.</p>
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
                {availableModels.length > 0 && (
                  <select
                    onChange={(e) => setSettings({ ...settings, fallbackModel: e.target.value })}
                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2 text-xs bg-white"
                    value={settings.fallbackModel}
                  >
                    <option value="">Select from list...</option>
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || m.id}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
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
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                <Key className="w-4 h-4 mr-2 text-gray-400" /> ElevenLabs API Key
              </label>
              <input
                type="password"
                value={settings.elevenLabsApiKey || ''}
                onChange={(e) => setSettings({ ...settings, elevenLabsApiKey: e.target.value })}
                placeholder="Enter ElevenLabs API Key"
                className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                <Layers className="w-4 h-4 mr-2 text-gray-400" /> TTS Model ID
              </label>
              <input
                type="text"
                value={settings.elevenLabsModel || ''}
                onChange={(e) => setSettings({ ...settings, elevenLabsModel: e.target.value })}
                placeholder="e.g., eleven_monolingual_v1"
                className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                <Volume2 className="w-4 h-4 mr-2 text-gray-400" /> Voice ID
              </label>
              <input
                type="text"
                value={settings.elevenLabsVoiceId || ''}
                onChange={(e) => setSettings({ ...settings, elevenLabsVoiceId: e.target.value })}
                placeholder="e.g., pNInz6obpg8ndclKuztW"
                className="w-full rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 border p-3 text-sm bg-gray-50/50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
