
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Video, 
  Upload, 
  Copy, 
  Trash2, 
  ExternalLink, 
  FileText, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Download,
  Search,
  Sparkles,
  Play,
  Share2,
  Info
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
interface ExtractedLink {
  url: string;
  platform: string;
  context?: string;
  title?: string;
}

// --- App Component ---
const CineFetch: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<ExtractedLink[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractLinks = async () => {
    if (!inputText.trim()) {
      setError("Please provide some text or a file to process.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (useAI) {
        await extractWithAI();
      } else {
        await extractWithRegex();
      }
    } catch (err: any) {
      console.error("Extraction error:", err);
      setError("Failed to process content. " + (err.message || "Please check your input."));
    } finally {
      setIsProcessing(false);
    }
  };

  const extractWithRegex = async () => {
    // Artificial short delay for UX smoothness
    await new Promise(resolve => setTimeout(resolve, 600));

    const patterns = [
      {
        name: 'YouTube',
        regex: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi
      },
      {
        name: 'Vimeo',
        regex: /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/gi
      },
      {
        name: 'Twitch',
        regex: /(?:https?:\/\/)?(?:www\.)?(?:twitch\.tv\/)([a-z0-9_]+)/gi
      },
      {
        name: 'TikTok',
        regex: /(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com\/@[\w.-]+\/video\/\d+|vt\.tiktok\.com\/\w+)/gi
      },
      {
        name: 'Instagram',
        regex: /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/(?:p|reels|reel)\/([\w-]+))/gi
      },
      {
        name: 'Direct Link',
        regex: /https?:\/\/[^\s"']+?\.(?:mp4|webm|ogg|mov|m4v|m3u8)(?:\?[^\s"']+)?/gi
      }
    ];

    const foundLinks: ExtractedLink[] = [];
    const seenUrls = new Set<string>();

    patterns.forEach(p => {
      let match;
      p.regex.lastIndex = 0;
      while ((match = p.regex.exec(inputText)) !== null) {
        const url = match[0];
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          const start = Math.max(0, match.index - 50);
          const end = Math.min(inputText.length, match.index + url.length + 50);
          let context = inputText.substring(start, end).replace(/\s+/g, ' ');
          if (start > 0) context = '...' + context;
          if (end < inputText.length) context = context + '...';

          foundLinks.push({
            url,
            platform: p.name,
            context: context.trim()
          });
        }
      }
    });

    setResults(foundLinks);
    if (foundLinks.length === 0) setError("No video links found using standard scanning.");
  };

  const extractWithAI = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract all video links (YouTube, Vimeo, TikTok, Direct MP4s, etc.) from the following text. 
      Also look for obfuscated links (e.g., "youtu dot be slash xyz") and fix them. 
      Provide a brief context of what each video might be about if possible.
      
      INPUT TEXT:
      ${inputText.substring(0, 15000)}`, // Limit to prevent token overflow
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  url: { type: Type.STRING },
                  platform: { type: Type.STRING },
                  context: { type: Type.STRING },
                  title: { type: Type.STRING }
                },
                required: ["url", "platform"]
              }
            }
          },
          required: ["videos"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"videos":[]}');
    setResults(data.videos);
    if (data.videos.length === 0) setError("AI couldn't identify any video links in this content.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setInputText(event.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (event) => setInputText(event.target?.result as string);
      reader.readAsText(e.dataTransfer.files[0]);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadResults = () => {
    const content = results.map(r => `Platform: ${r.platform}\nTitle: ${r.title || 'Unknown'}\nURL: ${r.url}\nContext: ${r.context || 'N/A'}\n---`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cinefetch_export_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-7xl mx-auto">
      {/* Navbar / Header */}
      <header className="w-full flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 via-violet-600 to-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 transform rotate-3">
              <Video className="text-white w-8 h-8 -rotate-3" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-[#050505] animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white">CINEFETCH</h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">Version 2.0</span>
              <p className="text-xs text-zinc-500 font-medium tracking-wide">Professional Link Extraction</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 glass px-4 py-2 rounded-2xl">
          <button 
            onClick={() => setUseAI(!useAI)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-sm font-semibold ${
              useAI 
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles size={16} className={useAI ? 'animate-pulse' : ''} />
            {useAI ? 'AI Scan Active' : 'Enable AI Scan'}
          </button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <button 
            onClick={() => { setInputText(''); setResults([]); setError(null); }}
            className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-zinc-400 hover:text-red-400"
            title="Clear all"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      <main className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Control Panel */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative group flex flex-col gap-4 p-1 rounded-[2rem] transition-all duration-500 ${
              dragActive ? 'bg-indigo-500/20 scale-[1.01]' : 'bg-white/5'
            }`}
          >
            <div className="bg-[#0c0c0c] p-6 rounded-[1.8rem] border border-white/5 flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2 text-zinc-400">
                  <FileText size={18} className="text-indigo-400" />
                  <span className="text-sm font-bold uppercase tracking-wider">Source Material</span>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="group/btn text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-2 transition-all"
                >
                  <Upload size={14} className="group-hover/btn:-translate-y-0.5 transition-transform" />
                  UPLOAD FILE
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept=".txt,.html,.htm,.log,.md,.json"
                />
              </div>

              <textarea
                className="w-full h-[450px] bg-black/40 border border-white/5 rounded-2xl p-6 text-sm text-zinc-300 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all resize-none custom-scrollbar placeholder:text-zinc-700"
                placeholder="Paste code snippets, raw HTML, server logs, or drop a text file here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />

              <button
                onClick={extractLinks}
                disabled={isProcessing || !inputText.trim()}
                className="relative overflow-hidden group w-full py-5 bg-white text-black disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-2xl font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing with {useAI ? 'Gemini AI' : 'Regex'}
                  </>
                ) : (
                  <>
                    <Zap size={20} className="fill-current group-hover:scale-125 transition-transform" />
                    Begin Extraction
                  </>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"></div>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="p-6 glass rounded-2xl border-indigo-500/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Info size={16} className="text-indigo-400" />
              Supported Platforms
            </h3>
            <div className="flex flex-wrap gap-2">
              {['YouTube', 'Vimeo', 'Twitch', 'TikTok', 'Instagram', 'Direct MP4', 'DailyMotion'].map(plat => (
                <span key={plat} className="text-[10px] font-bold text-zinc-500 border border-white/5 px-2 py-1 rounded-md bg-white/5">
                  {plat}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Results Panel */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Extracted Assets</h2>
                <p className="text-xs text-zinc-500">Found {results.length} valid video pointers</p>
              </div>
            </div>
            
            {results.length > 0 && (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const all = results.map(r => r.url).join('\n');
                    copyToClipboard(all);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-zinc-300 transition-all"
                >
                  <Copy size={14} />
                  COPY ALL
                </button>
                <button 
                  onClick={downloadResults}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl text-xs font-bold transition-all"
                >
                  <Download size={14} />
                  EXPORT
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 min-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-12">
            {results.length === 0 && !isProcessing && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 glass rounded-[2.5rem] border-dashed border-white/5">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Search size={40} className="text-zinc-800" />
                </div>
                <h3 className="text-xl font-bold text-zinc-300 mb-2">No results yet</h3>
                <p className="text-sm text-zinc-600 max-w-[280px]">
                  Provide a data source on the left to begin searching for video streams.
                </p>
              </div>
            )}

            {isProcessing && (
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 glass rounded-3xl animate-pulse bg-white/5" />
                ))}
              </div>
            )}

            {results.map((item, idx) => (
              <div 
                key={idx} 
                className="group relative bg-[#111] border border-white/5 hover:border-indigo-500/40 rounded-3xl p-5 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1 overflow-hidden"
              >
                {/* Highlight line */}
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Icon/Preview Area */}
                  <div className="w-full md:w-40 aspect-video md:aspect-square bg-black rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-indigo-500/20 transition-colors overflow-hidden relative">
                    <Play className="text-zinc-800 group-hover:text-indigo-500/50 w-12 h-12 transition-all duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                       <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${
                        item.platform.toLowerCase().includes('youtube') ? 'bg-red-600 text-white' :
                        item.platform.toLowerCase().includes('vimeo') ? 'bg-blue-600 text-white' :
                        item.platform.toLowerCase().includes('twitch') ? 'bg-purple-600 text-white' :
                        'bg-zinc-700 text-white'
                      }`}>
                        {item.platform}
                      </span>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-base font-bold text-zinc-100 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                          {item.title || `${item.platform} Stream`}
                        </h4>
                        <div className="flex gap-2 shrink-0">
                          <button 
                            onClick={() => copyToClipboard(item.url)}
                            className="p-2 hover:bg-white/10 rounded-xl text-zinc-500 hover:text-white transition-all"
                            title="Copy URL"
                          >
                            <Copy size={16} />
                          </button>
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-white/5 hover:bg-indigo-600 rounded-xl text-zinc-500 hover:text-white transition-all"
                            title="Visit Link"
                          >
                            <ExternalLink size={16} />
                          </a>
                        </div>
                      </div>
                      
                      <div className="text-xs font-mono text-zinc-500 break-all mb-4 bg-black/40 p-2 rounded-lg border border-white/5">
                        {item.url}
                      </div>

                      {item.context && (
                        <div className="relative">
                          <p className="text-xs text-zinc-500 leading-relaxed italic line-clamp-2 pl-4 border-l-2 border-zinc-800 group-hover:border-indigo-500/30">
                            "{item.context}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                      <button className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 hover:text-indigo-400 transition-colors uppercase tracking-widest">
                        <Share2 size={12} />
                        Share Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Persistent Footer */}
      <footer className="mt-auto py-12 text-center w-full border-t border-white/5">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-indigo-500" />
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">CINEFETCH CORE</span>
          </div>
          <p className="text-[10px] text-zinc-600 max-w-md mx-auto leading-loose">
            High-speed local processing engine for large-scale data sets. 
            Privacy-first extraction: your data never leaves your browser unless AI Scan is enabled.
            &copy; {new Date().getFullYear()} CineFetch Lab.
          </p>
        </div>
      </footer>
    </div>
  );
};

// --- Render ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<CineFetch />);
}
