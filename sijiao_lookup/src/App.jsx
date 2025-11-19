import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Delete, Upload, AlertCircle, Loader2, X, BookOpen, Volume2, Maximize, Minimize } from 'lucide-react';


// --- Trie Implementation ---

class TrieNode {
  constructor() {
    this.children = {};
    this.characters = []; // Stores full character data objects
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(code, data) {
    if (!code) return;
    let node = this.root;
    for (const char of code) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    // Store the full data object instead of just args
    node.characters.push({ ...data, code });
  }

  // Find all characters that start with the given prefix
  search(prefix) {
    let node = this.root;
    for (const char of prefix) {
      if (!node.children[char]) {
        return [];
      }
      node = node.children[char];
    }
    return this.collectAll(node);
  }

  // Helper to collect all characters from a given node downwards
  collectAll(node) {
    let results = [...node.characters];
    for (const key in node.children) {
      results = results.concat(this.collectAll(node.children[key]));
    }
    return results;
  }
}

// --- UI Components ---

const KeypadButton = ({ value, onClick, className = "" }) => (
  <button
    onClick={() => onClick(value)}
    className={`h-14 text-xl font-semibold rounded-lg shadow-sm active:scale-95 transition-transform flex items-center justify-center select-none ${className}`}
  >
    {value}
  </button>
);

const DetailView = ({ data, onClose }) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-800 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
        
        {/* Header / Large Char */}
        <div className="bg-slate-950 p-8 flex flex-col items-center border-b border-slate-800 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-slate-100 shadow-sm hover:shadow transition-all"
          >
            <X size={20} />
          </button>
          
          <div className="text-8xl font-serif text-slate-100 mb-4 leading-none filter drop-shadow-lg">
            {data.char}
          </div>
          
          <div className="flex gap-3 mt-2">
            {data.pinyin && (
              <span className="px-3 py-1 rounded-full bg-blue-900/30 text-blue-200 border border-blue-800/50 text-sm font-medium flex items-center gap-1">
                 Mandarin: {data.pinyin}
              </span>
            )}
            {data.cantonese && (
              <span className="px-3 py-1 rounded-full bg-indigo-900/30 text-indigo-200 border border-indigo-800/50 text-sm font-medium flex items-center gap-1">
                 Cantonese: {data.cantonese}
              </span>
            )}
          </div>
        </div>

        {/* Details Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Code Section */}
          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">Four Corner Code</div>
            <div className="font-mono text-2xl font-bold text-slate-200 tracking-widest">{data.code}</div>
          </div>

          {/* Definition Section */}
          <div>
            <div className="flex items-center gap-2 text-slate-200 font-semibold mb-2">
              <BookOpen size={18} className="text-blue-400" />
              <h3>Definition</h3>
            </div>
            <p className="text-slate-400 leading-relaxed text-lg">
              {data.def || "No definition available."}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [trie, setTrie] = useState(null);
  const [inputCode, setInputCode] = useState("");
  const [results, setResults] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [datasetSize, setDatasetSize] = useState(0);
  const [showUploader, setShowUploader] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const DATA_URL = "https://waytoomuchcoding.github.io/Unihan_Reference//assets/unihan.csv";

  // --- Data Processing ---

  const processCSV = useCallback((text) => {
    try {
      const lines = text.split('\n');
      const newTrie = new Trie();
      let count = 0;
      let codeIndex = -1;

      // Heuristic to find the Four Corner Code column
      // We look at the first 50 lines to find a column that consistently has 4-5 digits
      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        const cols = lines[i].split('|');
        if (cols.length < 5) continue;

        // Check columns for 5 digit pattern (standard Sijiao is 4 or 5 digits)
        for (let j = 0; j < cols.length; j++) {
            if (/^\d{4,5}$/.test(cols[j])) {
                codeIndex = j;
                break;
            }
        }
        if (codeIndex !== -1) break;
      }

      if (codeIndex === -1) {
        throw new Error("Could not automatically detect the Four Corner Code column in the CSV.");
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split('|');
        const char = columns[0];
        const cantonese = columns[1]; // Assuming index 1 based on example
        const definition = columns[2] || ""; 
        const pinyin = columns[9];    // Assuming index 9 based on example
        const code = columns[codeIndex];

        // Strict validation: Code must be numeric, and must have definition and pinyin
        if (char && code && /^\d+$/.test(code) && definition && pinyin) {
          newTrie.insert(code, { 
            char, 
            def: definition, 
            cantonese, 
            pinyin 
          });
          count++;
        }
      }

      setTrie(newTrie);
      setDatasetSize(count);
      setLoading(false);
      setError(null);
      setShowUploader(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to process data.");
      setLoading(false);
      setShowUploader(true);
    }
  }, []);

  // --- Fetching ---

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        const text = await response.text();
        processCSV(text);
      } catch (err) {
        console.error("Fetch failed, likely CORS or Network", err);
        setLoading(false);
        setShowUploader(true);
        setError("Could not auto-load data (likely CORS). Please download the CSV manually and upload it below.");
      }
    };

    fetchData();
  }, [processCSV]);

  // --- Search Logic ---

  useEffect(() => {
    if (!trie) return;
    if (inputCode.length === 0) {
      setResults([]);
      return;
    }
    
    // Use the Trie to get results
    const matches = trie.search(inputCode);
    // Sort by code length (exact match first) then code value
    matches.sort((a, b) => {
        if (a.code === inputCode && b.code !== inputCode) return -1;
        if (b.code === inputCode && a.code !== inputCode) return 1;
        return a.code.localeCompare(b.code);
    });
    
    // Limit results for performance if massive
    setResults(matches.slice(0, 100));
  }, [inputCode, trie]);

  // --- Handlers ---

  const handleKeyPress = (key) => {
    if (inputCode.length < 5) {
      setInputCode(prev => prev + key);
    }
  };

  const handleDelete = () => {
    setInputCode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInputCode("");
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      processCSV(e.target.result);
    };
    reader.readAsText(file);
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row">
      
      {/* Detail View Modal */}
      {selectedChar && (
        <DetailView 
          data={selectedChar} 
          onClose={() => setSelectedChar(null)} 
        />
      )}

      {/* Sidebar / Control Panel */}
      <div className="w-full md:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-[50vh] md:h-screen shadow-2xl z-10">
        <div className="p-6 bg-slate-950 text-white border-b border-slate-800 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-3xl text-blue-500">四</span> Four Corner
            </h1>
            <p className="text-slate-400 text-sm mt-1">Sijiao Haoma Lookup</p>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          
          {/* Status Area */}
          {loading && (
            <div className="bg-blue-900/20 text-blue-300 p-4 rounded-lg flex items-center gap-3 animate-pulse border border-blue-900/30">
              <Loader2 className="animate-spin" />
              <span>Processing Unihan Database...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 text-red-300 p-4 rounded-lg border border-red-900/30">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <AlertCircle size={18} />
                <span>Error Loading Data</span>
              </div>
              <p className="text-sm mb-3 text-red-200/80">{error}</p>
              {showUploader && (
                 <div className="mt-2">
                    <label className="block text-xs font-medium uppercase text-red-400 mb-1">
                        Upload unihan.csv manually
                    </label>
                    <input 
                        type="file" 
                        accept=".csv,.txt"
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-red-900/40 file:text-red-300
                        hover:file:bg-red-900/60"
                    />
                 </div>
              )}
            </div>
          )}

          {!loading && !error && (
             <div className="text-xs text-center text-slate-500 mb-2">
                Database loaded: {datasetSize.toLocaleString()} characters
             </div>
          )}

          {/* Display Screen */}
          <div className="bg-slate-950 rounded-xl p-6 flex flex-col items-center justify-center shadow-inner border border-slate-800 min-h-[120px]">
            <div className="text-5xl font-mono tracking-widest text-white h-16 filter drop-shadow-md">
              {inputCode || <span className="text-slate-700 opacity-50">_ _ _ _ _</span>}
            </div>
            <div className="text-slate-500 text-xs uppercase tracking-wide mt-2 font-semibold">
              Current Code
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 mt-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <KeypadButton 
                key={num} 
                value={num} 
                onClick={handleKeyPress} 
                className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 hover:text-white hover:border-slate-600"
              />
            ))}
            <KeypadButton 
              value={<Search size={20}/>} 
              onClick={() => {}} 
              className="bg-slate-900 text-slate-600 cursor-default border border-transparent"
            />
            <KeypadButton 
              value={0} 
              onClick={handleKeyPress} 
              className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 hover:text-white hover:border-slate-600"
            />
            <KeypadButton 
              value={<Delete size={20}/>} 
              onClick={handleDelete} 
              className="bg-red-900/20 text-red-400 hover:bg-red-900/30 border border-red-900/30 hover:border-red-900/50"
            />
          </div>
          
          <button 
            onClick={handleClear}
            className="w-full py-3 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Clear Input
          </button>

        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 bg-slate-950 h-[50vh] md:h-screen flex flex-col overflow-hidden">
        <div className="bg-slate-900 border-b border-slate-800 p-4 shadow-sm flex justify-between items-center z-10">
          <h2 className="font-semibold text-slate-300">
            Candidates <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs ml-2">{results.length}</span>
          </h2>
          <a 
            href={DATA_URL} 
            target="_blank" 
            rel="noreferrer"
            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
          >
            Source CSV
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {results.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
              {inputCode.length === 0 ? (
                <>
                  <Search size={48} className="mb-4 opacity-20" />
                  <p>Enter a code to begin searching</p>
                </>
              ) : (
                 <p>No characters found for code "{inputCode}"</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {results.map((item, idx) => (
                <button
                  key={`${item.char}-${idx}`}
                  onClick={() => setSelectedChar(item)}
                  className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-sm hover:shadow-lg hover:shadow-blue-900/20 hover:border-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex flex-col items-center group relative cursor-pointer"
                >
                  <div className="text-4xl sm:text-5xl font-serif mb-2 text-slate-200 group-hover:text-blue-400 transition-colors">
                    {item.char}
                  </div>
                  <div className="text-xs font-mono bg-slate-950 text-slate-500 px-2 py-1 rounded w-full text-center group-hover:text-slate-400 transition-colors">
                    {item.code}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}