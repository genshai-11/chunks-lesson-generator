import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, onSnapshot, addDoc, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Resource, AISettings } from '../types';
import { Send, Loader2, Sparkles, ChevronDown, MessageSquare } from 'lucide-react';
import { generateAutoChunks } from '../services/aiService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Chào bạn! Mình có thể giúp tạo các chunk học tập. Vd: "Tạo 10 câu 5 ohm chủ đề giáo dục"' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, `workspaces/default/settings`, 'ai'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as AISettings);
      } else {
        setSettings({ enableChatbot: true } as AISettings);
      }
    });

    const unsubResources = onSnapshot(query(collection(db, `workspaces/default/resources`), limit(100)), (snapshot) => {
      const res: Resource[] = [];
      snapshot.forEach(d => res.push({ id: d.id, ...d.data() } as Resource));
      setResources(res);
    });

    return () => {
      unsubSettings();
      unsubResources();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (settings && settings.enableChatbot === false) return null; // Default to true if undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMsg: Message = { id: Date.now().toString(), role: 'user', content: userMessage };
    setMessages(prev => [...prev, newMsg]);
    setIsLoading(true);

    try {
      if (!settings.apiKey && !settings.geminiApiKey) {
         throw new Error('API key is missing in AI Settings.');
      }

      const prompt = `You are a helpful assistant for the CHUNKS app.
The user is asking you something in Vietnamese or English. If they want to generate sentences/chunks, output a JSON block ONLY like this:
\`\`\`json
{
  "action": "generate_chunks",
  "params": {
    "theme": "giáo dục",
    "targetU": 10,
    "quantity": 10
  }
}
\`\`\`
If they just want to chat or it is ambiguous, output normal text response (no JSON).
NOTE: If they specify ohm value, map it to targetU. Quantity to quantity. Topic to theme. Use their language.
User: ${userMessage}`;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey || settings.geminiApiKey || 'default'}`,
        },
        body: JSON.stringify({
          endpoint: settings.endpoint || 'https://openrouter.ai/api/v1',
          model: settings.primaryModel || 'google/gemini-2.5-flash',
          stream: false,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error('API error: ' + response.status + ' - ' + JSON.stringify(data.error || data));

      let aiText = '';
      if (data.choices && data.choices[0] && data.choices[0].message) {
        aiText = data.choices[0].message.content;
      } else if (data.response) {
        aiText = data.response;
      } else if (data.content && Array.isArray(data.content)) {
        aiText = data.content[0].text;
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) { aiText = data.candidates[0].content.parts[0].text; } else if (data.error) {
        throw new Error('API returned an error: ' + JSON.stringify(data.error)); } else { throw new Error('Unexpected format: ' + JSON.stringify(data).substring(0, 100));
      }

      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || aiText.match(/\{[\s\S]*\}/);
      const possibleJson = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiText;
      let parsed = null;
      try {
        if (possibleJson.includes('{')) {
           parsed = JSON.parse(possibleJson.substring(possibleJson.indexOf('{'), possibleJson.lastIndexOf('}') + 1));
        }
      } catch (e) {}

      if (parsed && parsed.action === 'generate_chunks') {
        const { theme, targetU, quantity } = parsed.params;
        const qty = quantity || 5;
        const u = targetU || 5;
        const th = theme || 'general';

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Đang tạo ${qty} chunks với mức năng lượng ${u} Ohm về chủ đề "${th}"... Vui lòng đợi.`
        }]);

        const generated = await generateAutoChunks({
          theme: th,
          targetU: u,
          quantity: qty,
          sentenceLength: 'Medium',
          colorPreferences: [],
          availableResources: resources,
          settings
        });

        let successCount = 0;
        for (const chunk of generated) {
          try {
            await addDoc(collection(db, `workspaces/default/chunks`), {
              ...chunk,
              createdAt: Date.now(),
              reviewed: false
            });
            successCount++;
          } catch (e) {
            console.error('Failed to save chunk', e);
          }
        }

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Đã tạo thành công ${successCount} chunks! Hãy vào tab Chunks DB để xem và đánh giá nhé.`
        }]);

      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: aiText
        }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen ? (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 md:w-96 h-[500px] flex flex-col animate-in slide-in-from-bottom-2 mb-4">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-red-600 text-white rounded-t-2xl">
            <div className="flex items-center">
              <Sparkles className="w-5 h-5 mr-2" />
              <h3 className="font-bold">Chunks AI</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-red-700 rounded-full transition-colors">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-red-600 text-white rounded-tr-sm' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                 <div className="max-w-[80%] p-3 rounded-2xl bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin text-red-600 mr-2" /> Suy nghĩ...
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 bg-white rounded-b-2xl flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Hỏi AI để tạo chunks..."
              disabled={isLoading}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-0 focus:border-red-500 transition-colors disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-red-600"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-xl shadow-red-200 transition-transform hover:scale-105 active:scale-95"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
