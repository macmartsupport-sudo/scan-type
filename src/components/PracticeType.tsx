import { useState, useEffect, useRef, ChangeEvent } from "react";
import { Keyboard, RotateCcw, AlertTriangle, Play, CheckCircle, Zap, ShieldAlert, Award } from "lucide-react";
import { ScannedDocument, TypingConfig } from "../types";
import { playKeyboardClick } from "../lib/audio";

interface PracticeTypeProps {
  document: ScannedDocument;
  config: TypingConfig;
}

export default function PracticeType({ document: doc, config }: PracticeTypeProps) {
  const [inputText, setInputText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [isFinished, setIsFinished] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [highlightTypoWords, setHighlightTypoWords] = useState(true);

  // Word-level mismatch detector for visual tracking & analysis
  const getWrongWords = () => {
    if (!inputText.trim()) return [];
    
    // Split on whitespace to inspect individual tokens
    const targetWords = (doc.rawText || "").trim().split(/\s+/).filter(w => w.length > 0);
    const inputWords = inputText.trim().split(/\s+/);
    
    const wrongWordsList: { original: string; typed: string; index: number }[] = [];
    
    for (let i = 0; i < inputWords.length; i++) {
      const typedWord = inputWords[i];
      if (typedWord === undefined || typedWord === "") continue;
      
      const originalWord = targetWords[i];
      if (!originalWord) continue;
      
      const isCurrentWord = (i === inputWords.length - 1);
      
      if (isCurrentWord) {
        // If typing current word, mark wrong if what they typed is not a prefix of the original word
        if (!originalWord.startsWith(typedWord)) {
          wrongWordsList.push({
            original: originalWord,
            typed: typedWord,
            index: i
          });
        }
      } else {
        // Completed word, does it match fully?
        if (typedWord !== originalWord) {
          wrongWordsList.push({
            original: originalWord,
            typed: typedWord,
            index: i
          });
        }
      }
    }
    
    return wrongWordsList;
  };

  const wrongWords = getWrongWords();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const targetText = doc.rawText || "";

  useEffect(() => {
    // Reset typing test when document changes
    handleReset();
  }, [doc]);

  // Handle Elapsed Timer
  useEffect(() => {
    if (startTime !== null && !isFinished) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, isFinished]);

  const handleReset = () => {
    setInputText("");
    setStartTime(null);
    setElapsedTime(0);
    setIsFinished(false);
    setMistakeCount(0);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.focus();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // Prevent typing beyond target length
    if (value.length > targetText.length) return;

    if (startTime === null) {
      setStartTime(Date.now());
    }

    // Play keystroke click sound dynamically
    if (config.soundEnabled) {
      const lastChar = value[value.length - 1];
      if (lastChar === " ") {
        playKeyboardClick("space");
      } else if (lastChar === "\n") {
        playKeyboardClick("return");
      } else {
        playKeyboardClick(Math.random() > 0.5 ? "mech" : "typewriter");
      }
    }

    // Capture visual typing errors
    let errors = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== targetText[i]) {
        errors++;
      }
    }
    setMistakeCount(errors);
    setInputText(value);

    // End-state trigger
    if (value.length === targetText.length) {
      setIsFinished(true);
      
      // Calculate final stats to score highscore
      const finishTime = Date.now();
      const minutes = (finishTime - (startTime || finishTime)) / 60000;
      const cleanMin = minutes > 0.05 ? minutes : 0.05;
      const wordCount = targetText.length / 5;
      const currentWpm = Math.round(wordCount / cleanMin);
      if (currentWpm > highScore) {
        setHighScore(currentWpm);
      }
    }
  };

  // Focus utility
  const focusInput = () => {
    textareaRef.current?.focus();
  };

  // Compute live scores
  const minutesElapsed = elapsedTime / 60;
  const wordCount = inputText.length / 5;
  const rawWpm = minutesElapsed > 0.01 ? Math.round(wordCount / minutesElapsed) : 0;
  const accuracy = inputText.length > 0
    ? Math.round(((inputText.length - mistakeCount) / inputText.length) * 100)
    : 100;

  return (
    <div className="flex flex-col gap-8" id="practice-layout-holder">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto w-full" id="section-practice-sandbox">
      {/* Sidebar stats */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-indigo-900 rounded-[32px] p-6 text-white border border-indigo-950 shadow-md space-y-5">
          <h3 className="font-sans font-bold text-sm tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Performance Insights
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-800/40">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300">Live Speed</span>
              <span className="text-xl font-mono font-bold tracking-tight text-white">{rawWpm} WPM</span>
            </div>

            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-800/40">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300">Accuracy</span>
              <span className={`text-xl font-mono font-bold tracking-tight ${accuracy < 85 ? 'text-amber-300' : 'text-emerald-400'}`}>
                {accuracy}%
              </span>
            </div>

            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-800/40">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300">Errors</span>
              <span className="text-xl font-mono font-bold tracking-tight text-rose-400">{mistakeCount}</span>
            </div>

            <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-800/40">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300">Elapsed</span>
              <span className="text-xl font-mono font-bold tracking-tight text-white">{elapsedTime}s</span>
            </div>
          </div>

          <div className="bg-indigo-950/30 p-3 rounded-xl flex items-center justify-between text-xs text-indigo-200">
            <span>High Score (WPM):</span>
            <span className="font-bold text-white flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              {highScore || "No record"}
            </span>
          </div>

          <button
            onClick={handleReset}
            className="w-full py-3 bg-white text-indigo-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restart Practice
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-xs text-slate-500 space-y-2">
          <span className="font-extrabold uppercase text-slate-700 block tracking-wide">Interactive Guide</span>
          <p className="leading-relaxed">
            Practice typing the scanned text directly in the terminal workspace. We compare each character and calculate pure speed metric. Focus the text area to start!
          </p>
        </div>
      </div>

      {/* Modern custom visual typewriter interface (matches the central component in the design) */}
      <div className="lg:col-span-8 bg-white rounded-[40px] shadow-[0_20px_50px_rgba(99,102,241,0.12)] border border-slate-100 overflow-hidden flex flex-col min-h-[460px]">
        {/* Workspace tabs */}
        <div className="bg-slate-50 p-6 border-b border-indigo-50 flex justify-between items-center">
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs font-bold text-slate-500 font-sans">
            Typing Challenge Canvas
          </span>
        </div>

        {/* Monkeytype-style text layout highlighter */}
        <div
          onClick={focusInput}
          className="p-8 flex-1 bg-white font-mono leading-relaxed relative min-h-[220px] max-h-[340px] overflow-y-auto cursor-text select-none text-base md:text-lg"
          id="practice-text-area"
        >
          {/* Output layer highlighting errors and current inputs */}
          <div className="absolute inset-0 p-8 pointer-events-none whitespace-pre-wrap z-10">
            {targetText.split("").map((char, index) => {
              let charStyle = "text-slate-300"; // not typed yet
              
              if (index < inputText.length) {
                if (inputText[index] === char) {
                  charStyle = "text-emerald-500 font-bold bg-emerald-50"; // correct
                } else {
                  charStyle = "text-rose-600 font-bold bg-rose-50 border-b-2 border-rose-500"; // mistake
                }
              } else if (index === inputText.length) {
                charStyle = "border-l-2 border-indigo-700 bg-indigo-50 text-indigo-700 animate-pulse"; // cursor position
              }

              return (
                <span key={index} className={`transition-all ${charStyle}`}>
                  {char}
                </span>
              );
            })}
          </div>

          {/* Real backing input that intercepts user key strokes */}
          <textarea
            ref={textareaRef}
            className="absolute inset-0 p-8 w-full h-full opacity-0 resize-none outline-none z-20 cursor-text"
            value={inputText}
            onChange={handleInputChange}
            disabled={isFinished}
            placeholder="Click to focus and begin typing..."
            autoFocus
          />
        </div>

        {/* Finished modal trigger banner */}
        {isFinished && (
          <div className="bg-emerald-50 p-6 border-t border-emerald-100 flex items-center justify-between text-emerald-800 animate-fadeIn">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-sans font-extrabold text-sm text-emerald-950">Awesome, Challenge complete!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Your final speed calculation is <strong className="text-emerald-900">{rawWpm} WPM</strong> and accuracy score is <strong className="text-emerald-900">{accuracy}%</strong>.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-transform transform active:scale-95 cursor-pointer"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Active Typing state indicator footer */}
        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400 animate-bounce" />
            <span className="font-bold">
              {inputText.length} of {targetText.length} characters typed
            </span>
          </div>

          <button
            onClick={focusInput}
            className="px-4 py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-indigo-50 border border-slate-100 transition-colors"
          >
            Refocus Typing Board
          </button>
        </div>
      </div>
    </div>

      {/* Dynamic Spellcheck / Incorrect Words list Analyzer Dashboard */}
      <div className="bg-white rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-sm max-w-6xl mx-auto w-full space-y-6" id="spellcheck-analyzer-dashboard">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-sans font-extrabold text-slate-900 text-sm md:text-base">Live Mistype &amp; Spelling Analyzer</h3>
              <p className="text-slate-400 text-xs">Real-time compilation of typed words matching the original document transcript</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={highlightTypoWords}
                onChange={(e) => setHighlightTypoWords(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              Track Wrong Words Live
            </label>
          </div>
        </div>

        {wrongWords.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-2">
            <div className="inline-flex items-center justify-center p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 mb-1">
              <CheckCircle className="w-6 h-6" />
            </div>
            <p className="text-xs font-extrabold text-slate-800">Perfect Precision Record!</p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">No misspelled or wrong words parsed so far. Keep typing accurately to maintain clean copy integrity!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-black uppercase tracking-wider">{wrongWords.length} Mistyped {wrongWords.length === 1 ? 'Word' : 'Words'} Spotted</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[220px] overflow-y-auto pr-1">
              {wrongWords.map((item, index) => (
                <div key={index} className="bg-rose-50/40 p-3 rounded-2xl border border-rose-100 flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                    <span>word index: #{item.index + 1}</span>
                    <span className="text-rose-500 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">Mismatch</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-left w-1/2">
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Expected Word</span>
                      <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 inline-block truncate max-w-full font-bold">
                        {item.original}
                      </span>
                    </div>
                    <div className="w-6 text-center text-slate-300">➔</div>
                    <div className="truncate text-left w-1/2">
                      <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Your Typo</span>
                      <span className="font-mono text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 line-through inline-block truncate max-w-full font-bold">
                        {item.typed}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-indigo-50/45 border border-indigo-100/40 rounded-xl text-[11px] text-indigo-700 leading-relaxed">
              <strong>Spelling Tips:</strong> Ensure you are match-typing uppercase/lowercase capitals exactly as scanned. Commas, periods, or other inline punctuation immediately connected to a word are counted too!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
