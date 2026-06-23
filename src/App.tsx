import { useState } from "react";
import { Sparkles, ArrowRight, Eye, RefreshCw, Layers, Terminal, Database, HelpCircle, Laptop, Settings, Play, ArrowUpRight, Check } from "lucide-react";
import Scanner from "./components/Scanner";
import AutoTyper from "./components/AutoTyper";
import FormFiller from "./components/FormFiller";
import PracticeType from "./components/PracticeType";
import { ScannedDocument, TypingConfig, AppView } from "./types";

export default function App() {
  const [scannedDoc, setScannedDoc] = useState<ScannedDocument | null>(null);
  const [activeView, setActiveView] = useState<AppView>("scanner");
  const [isLoading, setIsLoading] = useState(false);
  const [proUnlocked, setProUnlocked] = useState(false);

  // Global typing configurations
  const [typingConfig, setTypingConfig] = useState<TypingConfig>({
    speed: "medium",
    soundEnabled: true,
    virtualKeyboardHighlight: true,
    humanHesitation: true
  });

  const handleScanComplete = (doc: ScannedDocument) => {
    setScannedDoc(doc);
    // Transition to the Auto-Typer playground on successful OCR scan
    setActiveView("autotyper");
  };

  const handleResetApp = () => {
    setScannedDoc(null);
    setActiveView("scanner");
  };

  return (
    <div className="min-h-screen bg-indigo-50/70 py-6 md:py-8 px-4 font-sans" id="app-container">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Top Premium Navigation Header */}
        <nav className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-[24px] border border-indigo-100 shadow-sm" id="top-nav-bar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-2xl font-black text-slate-800 tracking-tight">SCAN<span className="text-indigo-600">TYPE</span></span>
          </div>

          <div className="flex items-center gap-3">
            {scannedDoc && (
              <button
                onClick={handleResetApp}
                className="hidden sm:inline-flex px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-full text-xs font-bold text-slate-600 shadow-sm border border-slate-200 transition-colors cursor-pointer"
                id="btn-scan-another"
              >
                Scan Another Image
              </button>
            )}

            <button
              type="button"
              onClick={() => setProUnlocked(!proUnlocked)}
              className={`px-4 py-2.5 rounded-full text-xs font-extrabold shadow-md flex items-center gap-1 cursor-pointer transition-all ${
                proUnlocked
                  ? "bg-emerald-600 text-white shadow-emerald-200"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
              }`}
              id="btn-pro-access"
            >
              {proUnlocked ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  Pro Active Active
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                  Pro Access
                </>
              )}
            </button>
            
            <div className="w-10 h-10 bg-orange-400 rounded-full border-2 border-white shadow-sm flex items-center justify-center font-bold text-white text-sm select-none">
              JD
            </div>
          </div>
        </nav>

        {/* Master Workflow Navigation Controller */}
        {scannedDoc && (
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-1.5 border border-indigo-100 grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-w-4xl mx-auto w-full shadow-sm" id="tab-nav-controls">
            <button
              onClick={() => setActiveView("scanner")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeView === "scanner"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Layers className="w-4 h-4" />
              File Scanner
            </button>

            <button
              onClick={() => setActiveView("autotyper")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeView === "autotyper"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Auto Type Sandbox
            </button>

            <button
              onClick={() => setActiveView("formfill")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeView === "formfill"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Database className="w-4 h-4" />
              Form Mapping
            </button>

            <button
              onClick={() => setActiveView("typingPractice")}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeView === "typingPractice"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Laptop className="w-4 h-4" />
              Typing Challenge
            </button>
          </div>
        )}

        {/* Header Hero Area */}
        <header className="text-center max-w-2xl mx-auto space-y-2 mt-4">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Visual Scan &amp; <span className="text-indigo-600">Dynamic Auto-Type</span>
          </h1>
          <p className="text-slate-500 text-sm md:text-base px-2">
            Upload code screenshots, printed layouts, or restaurant receipts. Watch the visual model transcribe keys, fill structured mappings, or practice typing yourself!
          </p>
        </header>

        {/* Main active view rendering container */}
        <main className="min-h-[480px]">
          {activeView === "scanner" && (
            <Scanner
              onScanComplete={handleScanComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}

          {activeView === "autotyper" && scannedDoc && (
            <AutoTyper
              document={scannedDoc}
              config={typingConfig}
              onChangeConfig={setTypingConfig}
            />
          )}

          {activeView === "formfill" && scannedDoc && (
            <FormFiller document={scannedDoc} />
          )}

          {activeView === "typingPractice" && scannedDoc && (
            <PracticeType
              document={scannedDoc}
              config={typingConfig}
            />
          )}
        </main>

        {/* Visual Engine Status Bar */}
        <div className="bg-indigo-950 text-white rounded-[32px] p-6 text-white flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-0.5">Dual Neural Engine Status</p>
            <p className="text-base font-bold flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
              Gemini Vision Core &amp; Web Audio Engine v4.2
            </p>
          </div>
          
          <div className="flex gap-4 items-center">
            {scannedDoc && (
              <div className="bg-slate-900/50 px-4 py-2 rounded-xl text-left border border-indigo-900/30">
                <span className="block text-[8px] font-bold text-indigo-300 uppercase">Active Scanned Document</span>
                <span className="text-xs font-bold font-mono text-emerald-400 text-ellipsis max-w-[150px] truncate block">
                  {scannedDoc.suggestedFilename}
                </span>
              </div>
            )}

            <div className="text-right">
              <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-0.5">Avg Model Latency</p>
              <p className="text-base font-bold">0.42s</p>
            </div>
          </div>
        </div>

        {/* Footer info (matches bottom strip in design request) */}
        <footer className="mt-8 pt-6 border-t border-indigo-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-400 text-xs">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white p-2 border border-indigo-100 flex items-center justify-center font-mono text-[9px] text-indigo-400 font-extrabold shadow-sm">
              v1.0
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white p-2 border border-indigo-100 flex items-center justify-center font-sans text-xs text-indigo-600 font-extrabold shadow-sm">
              OCR
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white p-2 border border-indigo-100 flex items-center justify-center font-sans text-xs text-emerald-500 font-extrabold shadow-sm opacity-60">
              SYNTH
            </div>
          </div>
          
          <div className="text-center sm:text-right text-slate-500 font-sans font-medium">
            Designed for rapid transcription workflows &copy; 2026 ScanType AI Studio
          </div>
        </footer>

      </div>
    </div>
  );
}
