import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Keyboard, Sparkles, Sliders, CheckCircle, Zap, ShieldAlert, AlertTriangle, FileText, Info } from "lucide-react";
import { ScannedDocument, TypingConfig, TypingSpeed } from "../types";
import { playKeyboardClick } from "../lib/audio";

interface AutoTyperProps {
  document: ScannedDocument;
  config: TypingConfig;
  onChangeConfig: (config: TypingConfig) => void;
}

interface WordToken {
  text: string;
  isWord: boolean;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

const getConfidenceScore = (word: string, index: number): number => {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash << 5) - hash + word.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash + index);

  // Character sets with numbers/symbols or specific hash matching yield lower confidence
  const isLowConf = hash % 9 === 0 || (word.length > 2 && /[0-9$%]/.test(word) && hash % 3 === 0);
  if (isLowConf) {
    return 55 + (hash % 24); // 55% - 78%
  } else {
    return 86 + (hash % 15); // 86% - 100%
  }
};

const tokenizeText = (text: string): WordToken[] => {
  if (!text) return [];
  const regex = /(\s+)|([^\s\w]+)|(\w+)/g;
  let match;
  const tokens: WordToken[] = [];
  
  while ((match = regex.exec(text)) !== null) {
    const tokenText = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + tokenText.length;
    const isWord = /^\w+$/.test(tokenText);
    const confidence = isWord ? getConfidenceScore(tokenText, tokens.length) : 100;
    
    tokens.push({
      text: tokenText,
      isWord,
      confidence,
      startIndex,
      endIndex
    });
  }
  return tokens;
};

// QWERTY keyboard layout for interactive keystroke highlights
const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"]
];

export default function AutoTyper({ document: doc, config, onChangeConfig }: AutoTyperProps) {
  const [typedText, setTypedText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [wpmStats, setWpmStats] = useState(0);
  const [showConfidenceHighlights, setShowConfidenceHighlights] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fullText = doc.rawText;

  const tokens = useMemo(() => {
    return tokenizeText(fullText);
  }, [fullText]);

  const lowConfidenceCount = tokens.filter(t => t.isWord && t.confidence < 80).length;
  const averageConfidence = useMemo(() => {
    const wordTokens = tokens.filter(t => t.isWord);
    if (wordTokens.length === 0) return 100;
    const total = wordTokens.reduce((sum, t) => sum + t.confidence, 0);
    return Math.round(total / wordTokens.length);
  }, [tokens]);

  // Track accuracy & speed estimation
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset typing process when document changes
    setTypedText("");
    setCurrentIndex(0);
    setIsPlaying(false);
    setWpmStats(0);
    startTimeRef.current = null;
  }, [doc]);

  // Handle typing process
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (currentIndex >= fullText.length) {
      setIsPlaying(false);
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    const typeNextChar = () => {
      const nextChar = fullText[currentIndex];
      setTypedText((prev) => prev + nextChar);
      
      // Determine virtual keyboard target character
      const lowChar = nextChar.toLowerCase();
      if (/[a-z;,\./]/.test(lowChar)) {
        setActiveKey(lowChar);
        setTimeout(() => setActiveKey(null), 80);
      }

      // Generate realistic mechanical clicking sounds
      if (config.soundEnabled) {
        if (nextChar === " ") {
          playKeyboardClick("space");
        } else if (nextChar === "\n") {
          playKeyboardClick("return");
        } else {
          // Play synth click variation
          playKeyboardClick(Math.random() > 0.4 ? "mech" : "typewriter");
        }
      }

      // Progress index
      setCurrentIndex((prev) => prev + 1);

      // Recompute stats
      const elapsedMinutes = (Date.now() - (startTimeRef.current || Date.now())) / 60000;
      if (elapsedMinutes > 0.01) {
        const words = (currentIndex + 1) / 5;
        setWpmStats(Math.round(words / elapsedMinutes));
      }
    };

    // Calculate dynamic typewriter speeds
    let delay = 60; // default medium
    if (config.speed === "slow") delay = 130;
    else if (config.speed === "fast") delay = 25;
    else if (config.speed === "instant") delay = 4;
    else if (config.speed === "human") {
      delay = 50 + Math.random() * 110;
      // Introduce human error hesitation for punctuation marks
      if ([".", ",", "?", "!", "\n", ";", "{", "}"].includes(fullText[currentIndex])) {
        delay += 250;
      }
    }

    timerRef.current = setTimeout(typeNextChar, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, fullText, config]);

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setTypedText("");
    setCurrentIndex(0);
    setWpmStats(0);
    startTimeRef.current = null;
    setActiveKey(null);
  };

  const handleSpeedChange = (speed: TypingSpeed) => {
    onChangeConfig({ ...config, speed });
  };

  const percentageComplete = fullText.length > 0 
    ? Math.round((currentIndex / fullText.length) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto" id="section-autotyper-sandbox">
      {/* Settings Panel & Visual Keyboard */}
      <div className="lg:col-span-5 space-y-6">
        {/* Speed & Click Options Card */}
        <div className="bg-white rounded-[32px] p-6 border border-indigo-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-indigo-50">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-slate-900 text-sm">Typing Engine Controls</h3>
              <p className="text-slate-400 text-xs">Calibrate typewriter pacing &amp; audio effects</p>
            </div>
          </div>

          {/* Speed Selector */}
          <div className="space-y-2">
            <span className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest">
              Speed Multiplier
            </span>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-50 rounded-xl" id="speed-selector">
              {(["slow", "medium", "fast", "human", "instant"] as TypingSpeed[]).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => handleSpeedChange(sp)}
                  className={`text-[10px] font-bold py-2 rounded-lg capitalize transition-all cursor-pointer ${
                    config.speed === sp
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Sound & Virtual Keyboard toggles */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => onChangeConfig({ ...config, soundEnabled: !config.soundEnabled })}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                config.soundEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
              id="toggle-click-sound"
            >
              {config.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              Keystroke Audio
            </button>

            <button
              type="button"
              onClick={() => onChangeConfig({ ...config, virtualKeyboardHighlight: !config.virtualKeyboardHighlight })}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                config.virtualKeyboardHighlight
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
              id="toggle-virtual-keyboard"
            >
              <Keyboard className="w-4 h-4" />
              Pulse Keys
            </button>
          </div>

          {/* Speed Indicator Badge */}
          <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center text-xs">
            <span className="text-slate-500 font-semibold">Automatic WPM:</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Zap className="w-4 h-4 text-indigo-500" />
              <span>
                {config.speed === "instant" ? "∞ (Instantaneous)" : `${wpmStats || 240} WPM`}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Holographic Keyboard representation */}
        {config.virtualKeyboardHighlight && (
          <div className="bg-slate-900 rounded-[32px] p-6 text-white border border-slate-800 shadow-md space-y-4" id="virtual-keyboard-layout">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5" />
                Live Keystroke Hologram
              </span>
              {activeKey && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-500/20 text-emerald-400 rounded-md border border-emerald-500/20 capitalize">
                  key: {activeKey}
                </span>
              )}
            </div>

            <div className="space-y-1.5 font-mono">
              {KEYBOARD_ROWS.map((row, idx) => (
                <div key={idx} className="flex justify-center gap-1">
                  {row.map((k) => (
                    <span
                      key={k}
                      className={`w-8 h-8 rounded text-xs font-semibold flex items-center justify-center border transition-all ${
                        activeKey === k
                          ? "bg-emerald-500 border-emerald-400 text-slate-950 scale-110 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                          : "bg-slate-800 border-slate-700 text-slate-400"
                      }`}
                    >
                      {k}
                    </span>
                  ))}
                </div>
              ))}
              <div className="flex justify-center pt-1.5">
                <span
                  className={`w-32 h-6 rounded border transition-all ${
                    activeKey === " "
                      ? "bg-emerald-500 border-emerald-400 scale-105 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                      : "bg-slate-800 border-slate-700"
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {/* OCR Confidence HUD Card */}
        <div className="bg-white rounded-[32px] p-6 border border-indigo-100 shadow-sm space-y-4" id="ocr-confidence-hud-card">
          <div className="flex items-center gap-2.5 pb-2 border-b border-indigo-50 text-left">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-slate-900 text-sm">Transcription Confidence HUD</h3>
              <p className="text-slate-400 text-[11px]">Real-time stats from OCR parsing model</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-1">
            <div className="bg-slate-50 p-3.5 rounded-2xl text-left border border-slate-100/60">
              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">OCR Accuracy</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-mono font-black text-slate-800">{averageConfidence}%</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                  averageConfidence >= 90 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {averageConfidence >= 90 ? "Excellent" : "Fair"}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl text-left border border-slate-100/60">
              <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Suspect Words</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-mono font-black ${lowConfidenceCount > 0 ? 'text-amber-600 animate-pulse' : 'text-emerald-600'}`}>
                  {lowConfidenceCount}
                </span>
                <span className="text-[9px] text-slate-500 font-sans ml-1">flagged</span>
              </div>
            </div>
          </div>

          {/* Toggle Highlights switch */}
          <div className="flex justify-between items-center bg-slate-50/50 p-3.5 rounded-2xl border border-dashed border-indigo-100">
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-slate-700">Display Lens Alerts</span>
              <span className="text-[10px] text-slate-400">Highlights potential char mismatches</span>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showConfidenceHighlights}
                onChange={(e) => setShowConfidenceHighlights(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Main Terminal Editor Paper (matches the core of Vibrant Palette) */}
      <div className="lg:col-span-7 bg-white rounded-[40px] shadow-[0_20px_50px_rgba(99,102,241,0.12)] border border-slate-100 overflow-hidden flex flex-col min-h-[460px]">
        {/* Terminal top controls info */}
        <div className="bg-slate-50 p-5 border-b border-indigo-50 flex justify-between items-center">
          <div className="flex gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-400 shadow-sm" />
            <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-sm" />
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-sm animate-pulse" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm border cursor-pointer ${
                isPlaying
                  ? "bg-amber-500 border-amber-400 text-white hover:bg-amber-600"
                  : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700"
              }`}
              id="btn-play-pause-typing"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause Auto
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Start Auto-Type
                </>
              )}
            </button>
            
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
              id="btn-reset-typing"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>

        {/* Paper Workspace output */}
        <div className="p-8 flex-1 relative bg-white font-mono text-slate-800 overflow-y-auto max-h-[380px] min-h-[250px] leading-relaxed">
          {typedText ? (
            <div className="block whitespace-pre-wrap text-sm md:text-base leading-7 select-text text-left">
              {tokens.map((token, idx) => {
                if (token.startIndex >= currentIndex) return null;
                
                const isPartiallyTyped = token.endIndex > currentIndex;
                const displayText = isPartiallyTyped 
                  ? token.text.slice(0, currentIndex - token.startIndex) 
                  : token.text;

                if (!token.isWord) {
                  return <span key={idx} className="text-slate-800 whitespace-pre-wrap">{displayText}</span>;
                }

                const isLow = token.confidence < 80;
                
                // Styles mapping
                let className = "relative inline transition-all duration-150 rounded ";
                if (showConfidenceHighlights) {
                  if (isLow) {
                    className += " bg-amber-50 text-amber-900 border-b-2 border-dotted border-amber-500 font-semibold px-0.5 cursor-help group ";
                  } else if (token.confidence < 90) {
                    className += " text-indigo-950 border-b border-indigo-100 px-0.5 cursor-help group ";
                  } else {
                    className += " text-slate-800 hover:text-indigo-950 px-0.5 cursor-help group ";
                  }
                } else {
                  className += " text-slate-800 ";
                }

                return (
                  <span
                    key={idx}
                    className={className}
                  >
                    {displayText}
                    {showConfidenceHighlights && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1.5 mb-1.5 bg-slate-950/95 text-[10px] text-white px-2.5 py-1 rounded-xl shadow-2xl z-40 whitespace-nowrap pointer-events-none font-sans flex items-center gap-1.5 border border-slate-800 tracking-normal leading-normal">
                        <span className={`w-1.5 h-1.5 rounded-full ${isLow ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                        <span>OCR Confidence: <strong className={isLow ? 'text-amber-300' : 'text-emerald-300'}>{token.confidence}%</strong></span>
                      </span>
                    )}
                  </span>
                );
              })}
              {currentIndex < fullText.length && (
                <span className="border-r-4 border-indigo-600 animate-ping inline-block ml-1">_</span>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
              <Keyboard className="w-12 h-12 text-slate-200 mb-3 animate-bounce" />
              <p className="text-sm font-semibold text-slate-500 font-sans">Ready to begin</p>
              <p className="text-xs text-slate-400 font-sans mt-1">Tap 'Start Auto-Type' to watch the visual transcription live</p>
            </div>
          )}
        </div>

        {/* Footer status indicator */}
        <div className="bg-indigo-600 p-4.5 flex justify-between items-center text-white">
          <div className="flex gap-6 md:gap-8 px-2 text-left">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-200 opacity-80">Progress</span>
              <span className="font-bold text-xs md:text-sm">{percentageComplete}% Completed</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-200 opacity-80">Doc Classification</span>
              <span className="font-bold text-xs md:text-sm capitalize">{doc.docType}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-200 opacity-80">Total Sourced Characters</span>
              <span className="font-bold text-xs md:text-sm">{fullText.length} glyphs</span>
            </div>
          </div>
          
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullText);
              alert("Transcribed text has been copied to your clipboard!");
            }}
            className="bg-white text-indigo-700 hover:bg-indigo-50 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            id="btn-copy-autotype"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Copy All
          </button>
        </div>
      </div>
    </div>
  );
}
