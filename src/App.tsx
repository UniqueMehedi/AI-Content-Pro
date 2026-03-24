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
  Zap,
  Coins,
  DollarSign,
  ArrowRightLeft,
  Mic,
  MicOff,
  Globe,
  MapPin,
  Brain,
  MessageSquare,
  Volume2,
  VolumeX,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Modality, ThinkingLevel, LiveServerMessage } from "@google/genai";

declare global {
  interface Window {
    bKash: any;
  }
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const STYLES = [
  { id: 'none', label: 'Default' },
  { id: 'photorealistic', label: 'Photorealistic' },
  { id: 'cartoon', label: 'Cartoon' },
  { id: 'digital art', label: 'Digital Art' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: '3d render', label: '3D Render' },
];

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

type ContentType = 'text' | 'image' | 'currency' | 'live';

interface GeneratedItem {
  id: string;
  type: ContentType;
  prompt: string;
  result: string;
  timestamp: number;
  groundingMetadata?: any[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ContentType>('text');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<GeneratedItem[]>([]);
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [currentGrounding, setCurrentGrounding] = useState<any[] | null>(null);
  const [imageStyle, setImageStyle] = useState('none');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [currencyAmount, setCurrencyAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('BDT');
  const [paymentMethod, setPaymentMethod] = useState('standard');
  const [receiver, setReceiver] = useState('');
  const [bkashStatus, setBkashStatus] = useState<null | { success: boolean; message: string; transactionId?: string }>(null);
  const [isListening, setIsListening] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [useHighThinking, setUseHighThinking] = useState(false);
  const [useFastMode, setUseFastMode] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{role: 'user' | 'model', text: string}[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (activeTab === 'currency') {
          // Try to extract number for amount if it's a number
          const numericValue = transcript.replace(/[^0-9.]/g, '');
          if (numericValue && !isNaN(parseFloat(numericValue))) {
            setCurrencyAmount(numericValue);
          } else {
            setReceiver(transcript.replace(/\s/g, ''));
          }
        } else {
          setPrompt(prev => prev + (prev ? ' ' : '') + transcript);
        }
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [activeTab]);

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start speech recognition", e);
      }
    }
  };

  useEffect(() => {
    // Initialize bKash Checkout
    if (window.bKash) {
      window.bKash.init({
        paymentMode: 'checkout',
        paymentRequest: {
          amount: currencyAmount,
          intent: 'sale'
        },
        createRequest: async (request: any) => {
          try {
            const response = await fetch('/api/bkash/pay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: currencyAmount, currency: toCurrency, receiver })
            });
            const data = await response.json();
            if (data && data.paymentID) {
              window.bKash.create().onSuccess(data);
            } else {
              window.bKash.create().onError();
            }
          } catch (e) {
            window.bKash.create().onError();
          }
        },
        executeRequestOnAuthorization: async () => {
          // This would normally call the execute endpoint
          window.bKash.execute().onSuccess();
        }
      });
    }
  }, [currencyAmount, toCurrency, receiver]);

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
    setCurrentGrounding(null);

    try {
      let model = "gemini-3-flash-preview";
      let config: any = {};
      let tools: any[] = [];
      let toolConfig: any = {};

      if (useHighThinking) {
        model = "gemini-3.1-pro-preview";
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else if (useFastMode) {
        model = "gemini-3.1-flash-lite-preview";
      }

      if (useSearch) {
        tools.push({ googleSearch: {} });
      }

      if (useMaps) {
        tools.push({ googleMaps: {} });
        
        // Try to get user location for better maps results
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          toolConfig.retrievalConfig = {
            latLng: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          };
        } catch (e) {
          console.warn("Geolocation failed or denied, proceeding without location context", e);
        }
      }

      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
          ...config,
          tools: tools.length > 0 ? tools : undefined,
          toolConfig: Object.keys(toolConfig).length > 0 ? toolConfig : undefined,
        }
      });
      const text = response.text;
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      const newItem: GeneratedItem = {
        id: Date.now().toString(),
        type: 'text',
        prompt,
        result: text || '',
        timestamp: Date.now(),
        groundingMetadata: groundingMetadata
      };
      
      setHistory(prev => [newItem, ...prev]);
      setCurrentResult(text || '');
      setCurrentGrounding(groundingMetadata || null);
      setPrompt('');
    } catch (error) {
      console.error("Text generation failed", error);
      setCurrentResult("Error: Failed to generate content. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startLiveSession = async () => {
    try {
      setIsLiveActive(true);
      setLiveTranscript([]);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      const session = await genAI.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are a helpful AI assistant in a live voice conversation. Be concise and friendly.",
        },
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              const audioPart = message.serverContent.modelTurn.parts.find(p => p.inlineData);
              if (audioPart?.inlineData?.data) {
                playRawAudio(audioPart.inlineData.data);
              }
              
              const textPart = message.serverContent.modelTurn.parts.find(p => p.text);
              if (textPart?.text) {
                setLiveTranscript(prev => [...prev, { role: 'model', text: textPart.text! }]);
              }
            }
            
            if (message.serverContent?.interrupted) {
              // In a real app we'd stop audio playback here
            }
          },
          onclose: () => {
            setIsLiveActive(false);
          }
        }
      });

      liveSessionRef.current = session;

      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        if (!liveSessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

    } catch (error) {
      console.error("Failed to start live session", error);
      setIsLiveActive(false);
    }
  };

  const stopLiveSession = () => {
    liveSessionRef.current?.close();
    liveSessionRef.current = null;
    setIsLiveActive(false);
  };

  const playRawAudio = (base64Data: string) => {
    if (!audioContextRef.current) return;
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 0x7FFF;

    const buffer = audioContextRef.current.createBuffer(1, floatData.length, 16000);
    buffer.getChannelData(0).set(floatData);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const generateImage = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setCurrentResult(null);

    try {
      const finalPrompt = imageStyle !== 'none' ? `${prompt}, ${imageStyle} style` : prompt;
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: finalPrompt,
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any
          }
        }
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

  const generateCurrency = async () => {
    setIsLoading(true);
    setCurrentResult(null);
    setBkashStatus(null);

    if (paymentMethod === 'bkash') {
      if (window.bKash) {
        // Trigger bKash checkout UI
        const bKashBtn = document.getElementById('bKash_button');
        if (bKashBtn) bKashBtn.click();
        setIsLoading(false);
        return;
      }
      
      // Fallback to mock if script not loaded
      try {
        const response = await fetch('/api/bkash/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: currencyAmount, currency: toCurrency, receiver })
        });
        const data = await response.json();
        setBkashStatus(data);
        
        if (data.success) {
          const newItem: GeneratedItem = {
            id: Date.now().toString(),
            type: 'currency',
            prompt: `bKash Payment: ${currencyAmount} ${toCurrency} to ${receiver}`,
            result: `### bKash Payment Successful\n\n- **Transaction ID:** ${data.transactionId}\n- **Amount:** ${currencyAmount} ${toCurrency}\n- **Receiver:** ${receiver}\n- **Status:** Completed\n\n*Payment processed via bKash API.*`,
            timestamp: Date.now()
          };
          setHistory(prev => [newItem, ...prev]);
          setCurrentResult(newItem.result);
        } else {
          setCurrentResult(`### bKash Payment Failed\n\n${data.message}`);
        }
      } catch (error) {
        console.error("bKash payment failed", error);
        setCurrentResult("Error: Failed to process bKash payment. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const currencyPrompt = `Act as a global payment assistant. The user wants to "pay" or convert ${currencyAmount} ${fromCurrency} to ${toCurrency}. 
    Provide the current approximate exchange rate (mention it's an estimate), the converted amount, and a brief professional summary of the transaction. 
    Also, add a fun "AI Payment Confirmation" message. 
    Format the output nicely with markdown.`;

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: currencyPrompt,
      });
      const text = response.text;
      
      const newItem: GeneratedItem = {
        id: Date.now().toString(),
        type: 'currency',
        prompt: `Convert ${currencyAmount} ${fromCurrency} to ${toCurrency}`,
        result: text || '',
        timestamp: Date.now()
      };
      
      setHistory(prev => [newItem, ...prev]);
      setCurrentResult(text || '');
    } catch (error) {
      console.error("Currency conversion failed", error);
      setCurrentResult("Error: Failed to process currency request.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    if (activeTab === 'text') generateText();
    else if (activeTab === 'image') generateImage();
    else if (activeTab === 'currency') generateCurrency();
    else if (activeTab === 'live') {
      if (isLiveActive) stopLiveSession();
      else startLiveSession();
    }
  };

  const copyToClipboard = (text: string) => {
    if ((window as any).AndroidBridge) {
      (window as any).AndroidBridge.copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  const handleShare = (text: string) => {
    if ((window as any).AndroidBridge) {
      (window as any).AndroidBridge.shareContent(text);
    } else if (navigator.share) {
      navigator.share({
        title: 'AI Content Pro',
        text: text,
      }).catch((error) => console.log('Error sharing', error));
    } else {
      copyToClipboard(text);
    }
  };

  const handleDownload = () => {
    if (!currentResult) return;

    if (activeTab === 'image') {
      if ((window as any).AndroidBridge) {
        (window as any).AndroidBridge.downloadImage(currentResult, 'generated_image.png');
      } else {
        const link = document.createElement('a');
        link.href = currentResult;
        link.download = 'generated_image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else {
      // For text, download as .txt
      const blob = new Blob([currentResult], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'generated_content.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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

        <button 
          onClick={() => setActiveTab('currency')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200",
            activeTab === 'currency' ? "bg-white/10 text-emerald-400" : "text-white/40 hover:text-white/60"
          )}
        >
          <Coins size={24} />
        </button>

        <button 
          onClick={() => setActiveTab('live')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200",
            activeTab === 'live' ? "bg-white/10 text-emerald-400" : "text-white/40 hover:text-white/60"
          )}
        >
          <MessageSquare size={24} />
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
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Sparkles size={18} />
                      <span className="text-xs font-semibold uppercase tracking-widest">Prompt</span>
                    </div>
                    <button 
                      onClick={toggleVoiceInput}
                      className={cn(
                        "p-2 rounded-full transition-all flex items-center justify-center",
                        isListening ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
                      )}
                      title={isListening ? "Stop listening" : "Start voice input"}
                    >
                      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  </div>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      activeTab === 'text' 
                        ? "Describe the content you want to generate..." 
                        : activeTab === 'image' 
                          ? "Describe the image you want to create..."
                          : activeTab === 'live'
                            ? "Live conversation is active. Speak into your microphone..."
                            : "Enter details for the AI Payment Assistant..."
                    }
                    className={cn(
                      "w-full bg-transparent border-none focus:ring-0 text-xl resize-none min-h-[120px] placeholder:text-white/20",
                      (activeTab === 'currency' || activeTab === 'live') && "hidden"
                    )}
                  />
                  
                  {activeTab === 'live' && (
                    <div className="flex flex-col gap-4 py-8 items-center justify-center min-h-[120px]">
                      <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
                        isLiveActive ? "bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] scale-110" : "bg-white/5"
                      )}>
                        {isLiveActive ? <Volume2 size={32} className="text-black animate-pulse" /> : <VolumeX size={32} className="text-white/20" />}
                      </div>
                      <p className="text-sm text-white/40 font-medium">
                        {isLiveActive ? "Listening and responding..." : "Start the session to begin talking"}
                      </p>
                      
                      {liveTranscript.length > 0 && (
                        <div className="w-full mt-6 flex flex-col gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                          {liveTranscript.map((entry, i) => (
                            <div key={i} className={cn(
                              "p-3 rounded-xl text-xs max-w-[80%]",
                              entry.role === 'user' ? "ml-auto bg-emerald-500/10 text-emerald-400" : "mr-auto bg-white/5 text-white/60"
                            )}>
                              {entry.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'currency' && (
                    <div className="flex flex-col gap-6 py-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Payment Method</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setPaymentMethod('standard')}
                            className={cn(
                              "flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2",
                              paymentMethod === 'standard' ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                            )}
                          >
                            <ArrowRightLeft size={16} />
                            Standard
                          </button>
                          <button 
                            onClick={() => {
                              setPaymentMethod('bkash');
                              setToCurrency('BDT');
                            }}
                            className={cn(
                              "flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2",
                              paymentMethod === 'bkash' ? "bg-pink-500/10 border-pink-500 text-pink-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                            )}
                          >
                            <Zap size={16} />
                            bKash
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex flex-col gap-2">
                          <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Amount</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                            <input 
                              type="number"
                              value={currencyAmount}
                              onChange={(e) => setCurrencyAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {paymentMethod === 'bkash' ? (
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Receiver bKash Number</label>
                          <input 
                            type="text"
                            value={receiver}
                            onChange={(e) => setReceiver(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-pink-500/50 outline-none transition-all"
                            placeholder="01XXXXXXXXX"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="flex-1 flex flex-col gap-2">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">From</label>
                            <input 
                              type="text"
                              value={fromCurrency}
                              onChange={(e) => setFromCurrency(e.target.value.toUpperCase())}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all uppercase"
                              placeholder="USD"
                            />
                          </div>
                          <div className="pt-6">
                            <ArrowRightLeft className="text-white/20" size={20} />
                          </div>
                          <div className="flex-1 flex flex-col gap-2">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">To</label>
                            <input 
                              type="text"
                              value={toCurrency}
                              onChange={(e) => setToCurrency(e.target.value.toUpperCase())}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all uppercase"
                              placeholder="EUR"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'text' && (
                    <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-white/5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Intelligence</span>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => setUseHighThinking(!useHighThinking)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all",
                            useHighThinking ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-white/40 border border-transparent"
                          )}
                        >
                          <Brain size={14} />
                          High Thinking
                        </button>
                        <button 
                          onClick={() => {
                            setUseFastMode(!useFastMode);
                            if (!useFastMode) setUseHighThinking(false);
                          }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all",
                            useFastMode ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-white/5 text-white/40 border border-transparent"
                          )}
                        >
                          <Zap size={14} />
                          Fast Mode
                        </button>
                        <button 
                          onClick={() => setUseSearch(!useSearch)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all",
                            useSearch ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/40 border border-transparent"
                          )}
                        >
                          <Globe size={14} />
                          Search Data
                        </button>
                        <button 
                          onClick={() => setUseMaps(!useMaps)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all",
                            useMaps ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-white/40 border border-transparent"
                          )}
                        >
                          <MapPin size={14} />
                          Maps Data
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'image' && (
                    <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-white/5">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Style</span>
                        <div className="flex flex-wrap gap-2">
                          {STYLES.map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setImageStyle(style.id)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs transition-all",
                                imageStyle === style.id 
                                  ? "bg-emerald-500 text-black font-medium" 
                                  : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                              )}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Aspect Ratio</span>
                        <div className="flex gap-2">
                          {ASPECT_RATIOS.map((ratio) => (
                            <button
                              key={ratio}
                              onClick={() => setAspectRatio(ratio)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs transition-all",
                                aspectRatio === ratio 
                                  ? "bg-emerald-500 text-black font-medium" 
                                  : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                              )}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

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
                      id={paymentMethod === 'bkash' && activeTab === 'currency' ? 'bKash_button' : undefined}
                      onClick={handleGenerate}
                      disabled={isLoading || (activeTab !== 'currency' && activeTab !== 'live' && !prompt.trim()) || (activeTab === 'currency' && (!currencyAmount || (paymentMethod === 'bkash' && !receiver)))}
                      className={cn(
                        "px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all active:scale-95",
                        paymentMethod === 'bkash' && activeTab === 'currency' ? "bg-pink-500 hover:bg-pink-400 text-white" : 
                        activeTab === 'live' ? (isLiveActive ? "bg-red-500 hover:bg-red-400 text-white" : "bg-emerald-500 hover:bg-emerald-400 text-black") :
                        "bg-emerald-500 hover:bg-emerald-400 text-black",
                        (isLoading || (activeTab !== 'currency' && activeTab !== 'live' && !prompt.trim()) || (activeTab === 'currency' && (!currencyAmount || (paymentMethod === 'bkash' && !receiver)))) && "bg-white/10 text-white/20"
                      )}
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={20} /> : 
                       activeTab === 'currency' ? (paymentMethod === 'bkash' ? <Zap size={20} /> : <Coins size={20} />) : 
                       activeTab === 'live' ? (isLiveActive ? <VolumeX size={20} /> : <Volume2 size={20} />) :
                       <Send size={20} />}
                      {isLoading ? 'Processing...' : 
                       activeTab === 'currency' ? (paymentMethod === 'bkash' ? 'Pay with bKash' : 'AI Pay') : 
                       activeTab === 'live' ? (isLiveActive ? 'Stop Session' : 'Start Session') :
                       'Generate'}
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
                          onClick={() => copyToClipboard(currentResult || '')}
                          className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                          title="Copy to clipboard"
                        >
                          <Copy size={18} />
                        </button>
                        <button 
                          onClick={() => handleShare(currentResult || '')}
                          className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                          title="Share content"
                        >
                          <Share2 size={18} />
                        </button>
                        <button 
                          onClick={handleDownload}
                          className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors" 
                          title="Download"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="p-8 prose prose-invert max-w-none">
                      {activeTab === 'text' ? (
                        <div className="flex flex-col gap-6">
                          <div className="markdown-body">
                            <Markdown>{currentResult}</Markdown>
                          </div>
                          
                          {currentGrounding && currentGrounding.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
                                <Globe size={14} />
                                Sources & References
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {currentGrounding.map((chunk, i) => {
                                  const url = chunk.web?.uri || chunk.maps?.uri;
                                  const title = chunk.web?.title || chunk.maps?.title || "Source";
                                  if (!url) return null;
                                  return (
                                    <a 
                                      key={i}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all flex items-center gap-2"
                                    >
                                      {chunk.maps ? <MapPin size={10} /> : <Globe size={10} />}
                                      {title}
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
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
                        item.type === 'text' ? "bg-emerald-500/10 text-emerald-400" : 
                        item.type === 'image' ? "bg-cyan-500/10 text-cyan-400" :
                        "bg-amber-500/10 text-amber-400"
                      )}>
                        {item.type === 'text' ? <Type size={14} /> : 
                         item.type === 'image' ? <ImageIcon size={14} /> :
                         <Coins size={14} />}
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
