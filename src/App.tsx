/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Sparkles, 
  Type, 
  Image as ImageIcon, 
  History, 
  Send, 
  Copy, 
  Download, 
  Trash2, 
  ChevronRight,
  Loader2,
  PenTool,
  Share2,
  Layout,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

type ContentType = 'text' | 'image';

interface GeneratedItem {
  id: string;
  type: ContentType;
  prompt: string;
  result: string;
  timestamp: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ContentType>('text');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<GeneratedItem[]>([]);
  const [currentResult, setCurrentResult] = useState<string | null>(null);

  // Load history from local storage
  useEffect(() => {
    const saved = localStorage.getItem('aicontentpro_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to local storage
  useEffect(() => {
    localStorage.setItem('aicontentpro_history', JSON.stringify(history));
  }, [history]);

  const generateText = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setCurrentResult(null);

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      const text = response.text;
      
      const newItem: GeneratedItem = {
        id: Date.now().toString(),
        type: 'text',
        prompt,
        result: text || '',
        timestamp: Date.now()
      };
      
      setHistory(prev => [newItem, ...prev]);
      setCurrentResult(text || '');
      setPrompt('');
    } catch (error) {
      console.error("Text generation failed", error);
      setCurrentResult("Error: Failed to generate content. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setCurrentResult(null);

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
      });
      
      let imageUrl = '';
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        const newItem: GeneratedItem = {
          id: Date.now().toString(),
          type: 'image',
          prompt,
          result: imageUrl,
          timestamp: Date.now()
        };
        setHistory(prev => [newItem, ...prev]);
        setCurrentResult(imageUrl);
        setPrompt('');
      } else {
        setCurrentResult("Error: No image was generated.");
      }
    } catch (error) {
      console.error("Image generation failed", error);
      setCurrentResult("Error: Failed to generate image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    if (activeTab === 'text') generateText();
    else generateImage();
  };

  const copyToClipboard = (text: string) => {
    if ((window as any).AndroidBridge) {
      (window as any).AndroidBridge.copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  const deleteItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-emerald-500/30">
      {/* Navigation Rail */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 border-r border-white/10 flex flex-col items-center py-8 gap-8 bg-[#0A0A0A] z-50">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
          <Zap className="text-black fill-current" size={24} />
        </div>
        
        <button 
          onClick={() => setActiveTab('text')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200",
            activeTab === 'text' ? "bg-white/10 text-emerald-400" : "text-white/40 hover:text-white/60"
          )}
        >
          <Type size={24} />
        </button>
        
        <button 
          onClick={() => setActiveTab('image')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200",
            activeTab === 'image' ? "bg-white/10 text-emerald-400" : "text-white/40 hover:text-white/60"
          )}
        >
          <ImageIcon size={24} />
        </button>

        <div className="mt-auto">
          <button className="p-3 text-white/40 hover:text-white/60">
            <Layout size={24} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pl-20 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-8 border-b border-white/10 flex justify-between items-center bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-40">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              AI Content Pro <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">BETA</span>
            </h1>
            <p className="text-white/40 text-sm mt-1">Professional generation suite</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-sm transition-colors border border-white/10">
              <History size={16} />
              History
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 p-[1px]">
              <div className="w-full h-full rounded-full bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Mehedi`} alt="User" referrerPolicy="no-referrer" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Editor Section */}
          <section className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-8">
              {/* Prompt Input */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center gap-2 mb-4 text-emerald-400">
                    <Sparkles size={18} />
                    <span className="text-xs font-semibold uppercase tracking-widest">Prompt</span>
                  </div>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={activeTab === 'text' ? "Describe the content you want to generate..." : "Describe the image you want to create..."}
                    className="w-full bg-transparent border-none focus:ring-0 text-xl resize-none min-h-[120px] placeholder:text-white/20"
                  />
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/60 hover:text-white transition-colors">
                        Creative
                      </button>
                      <button className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/60 hover:text-white transition-colors">
                        Professional
                      </button>
                    </div>
                    <button 
                      onClick={handleGenerate}
                      disabled={isLoading || !prompt.trim()}
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/20 text-black px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all active:scale-95"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                      {isLoading ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Result Area */}
              <AnimatePresence mode="wait">
                {currentResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="relative bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                  >
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                      <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Result</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => copyToClipboard(currentResult)}
                          className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                        >
                          <Copy size={18} />
                        </button>
                        <button className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="p-8 prose prose-invert max-w-none">
                      {activeTab === 'text' ? (
                        <div className="markdown-body">
                          <Markdown>{currentResult}</Markdown>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <img 
                            src={currentResult} 
                            alt="Generated" 
                            className="rounded-xl max-h-[500px] object-contain shadow-2xl"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Sidebar / History */}
          <aside className="w-full lg:w-80 border-l border-white/10 bg-[#0A0A0A] flex flex-col">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 flex items-center gap-2">
                <History size={14} />
                Recent Generations
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-white/20 gap-2">
                  <PenTool size={32} />
                  <p className="text-xs">No history yet</p>
                </div>
              ) : (
                history.map((item) => (
                  <motion.div 
                    layout
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group relative bg-white/5 border border-white/5 rounded-xl p-4 hover:border-emerald-500/30 transition-all cursor-pointer"
                    onClick={() => {
                      setActiveTab(item.type);
                      setCurrentResult(item.result);
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        item.type === 'text' ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"
                      )}>
                        {item.type === 'text' ? <Type size={14} /> : <ImageIcon size={14} />}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-sm text-white/80 line-clamp-2 leading-relaxed">
                      {item.prompt}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-white/20">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <ChevronRight size={14} className="text-white/20 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
            <div className="p-6 border-t border-white/10 bg-white/5">
              <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-all">
                <Share2 size={16} />
                Export Project
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* Background Accents */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
}
