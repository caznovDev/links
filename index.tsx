import React, { useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
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
  Download
} from 'lucide-react';

// --- Types ---
interface ExtractedLink {
  url: string;
  platform: string;
  context?: string;
}

// --- App Component ---
const CineFetch: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<ExtractedLink[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following text and extract all video URLs. 
        Identify the platform (YouTube, Vimeo, Twitch, DailyMotion, or Direct Link/File). 
        Include a tiny snippet of the context where the link was found.
        
        TEXT TO ANALYZE:
        ${inputText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              links: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    url: { type: Type.STRING },
                    platform: { type: Type.STRING },
                    context: { type: Type.STRING }
                  },
                  required: ["url", "platform"]
                }
              }
            },
            required: ["links"]
          }
        }
      });

      const data = JSON.parse(response.text || '{"links": []}');
      setResults(data.links);
      
      if (data.links.length === 0) {
        setError("No video links were found in the provided content.");
      }
    } catch (err: any) {
      console.error("Extraction error:", err);
      setError("Failed to extract links. Please check your input or try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setInputText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setInputText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyAllLinks = () => {
    const allLinks = results.map(r => r.url).join('\n');
    copyToClipboard(allLinks);
  };

  const downloadResults = () => {
    const content = results.map(r => `Platform: ${r.platform}\nURL: ${r.url}\nContext: ${r.context || 'N/A'}\n---`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_links.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setInputText('');
    setResults([]);
    setError(null);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-7xl mx-auto">
      {/* Header */}
      <header className="w-full flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Video className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CineFetch</h1>
            <p className="text-xs text-zinc-500 font-medium tracking-widest uppercase">AI Video Link Extractor</p>
          </div>
        </div>
        <button 
          onClick={clearAll}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white"
          title="Clear everything"
        >
          <Trash2 size={20} />
        </button>
      </header>

      <main className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Input */}
        <section className="flex flex-col gap-4">
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative flex flex-col gap-4 p-6 rounded-2xl glass transition-all duration-300 ${dragActive ? 'border-purple-500/50 bg-purple-500/5' : 'border-white/10'}`}
          >
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
                <FileText size={16} />
                Input Source Content
              </label>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <Upload size={14} />
                Upload File
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload}
                accept=".txt,.html,.htm,.log,.md"
              />
            </div>

            <textarea
              className="w-full h-[400px] bg-black/20 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none custom-scrollbar"
              placeholder="Paste text containing video links, HTML code, or server logs here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <button
              onClick={extractLinks}
              disabled={isProcessing || !inputText.trim()}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-xl shadow-purple-900/20 transition-all flex items-center justify-center gap-2 group"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  AI Scanning...
                </>
              ) : (
                <>
                  <Zap size={20} className="group-hover:scale-125 transition-transform" />
                  Extract Video Links
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </section>

        {/* Right Column: Results */}
        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Results Found ({results.length})
            </h2>
            {results.length > 0 && (
              <div className="flex gap-4">
                <button 
                  onClick={copyAllLinks}
                  className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <Copy size={14} />
                  Copy All
                </button>
                <button 
                  onClick={downloadResults}
                  className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <Download size={14} />
                  Export
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 h-[525px] overflow-y-auto custom-scrollbar pr-2">
            {results.length === 0 && !isProcessing && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/5 rounded-2xl opacity-50">
                <Video size={48} className="mb-4 text-zinc-700" />
                <p className="text-sm font-medium">Extracted links will appear here</p>
                <p className="text-xs text-zinc-600 mt-1">Ready for your first extraction?</p>
              </div>
            )}

            {isProcessing && (
              <div className="flex flex-col gap-3 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 glass rounded-xl" />
                ))}
              </div>
            )}

            {results.map((item, idx) => (
              <div 
                key={idx} 
                className="group p-4 glass rounded-xl border-white/5 hover:border-purple-500/30 transition-all hover:bg-white/[0.05]"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    item.platform.toLowerCase().includes('youtube') ? 'bg-red-500/20 text-red-400' :
                    item.platform.toLowerCase().includes('vimeo') ? 'bg-blue-500/20 text-blue-400' :
                    item.platform.toLowerCase().includes('twitch') ? 'bg-purple-500/20 text-purple-400' :
                    'bg-zinc-500/20 text-zinc-400'
                  }`}>
                    {item.platform}
                  </span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => copyToClipboard(item.url)}
                      className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-400"
                      title="Copy URL"
                    >
                      <Copy size={14} />
                    </button>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-400"
                      title="Open Link"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <div className="text-sm font-medium text-zinc-100 break-all mb-2 leading-relaxed">
                  {item.url}
                </div>
                {item.context && (
                  <p className="text-xs text-zinc-500 italic line-clamp-2">
                    "{item.context}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer info */}
      <footer className="mt-auto pt-12 pb-4 text-center">
        <p className="text-xs text-zinc-600">
          Powered by <span className="text-zinc-400 font-semibold">Gemini 3 Pro</span> &bull; 
          Secure & Private Link Extraction
        </p>
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