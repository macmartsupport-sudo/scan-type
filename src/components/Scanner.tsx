import { useState, useRef, useEffect, DragEvent, ChangeEvent, MouseEvent } from "react";
import { Camera, Upload, Image as ImageIcon, Sparkles, AlertCircle, RefreshCw, Eye, ZoomIn, ZoomOut, Move, X, Check, Globe } from "lucide-react";
import { ScannedDocument } from "../types";

interface ScannerProps {
  onScanComplete: (doc: ScannedDocument) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
}

// Preset structured mock data to allow instant, beautiful demonstration scans
const PRESET_DEMOS = [
  {
    id: "receipt",
    title: "Starbucks Receipt",
    category: "Receipt / Invoice",
    description: "Multi-item coffee purchase receipt template",
    color: "from-emerald-50 to-teal-50",
    textColor: "text-emerald-700",
    data: {
      rawText: `STARBUCKS COFFEE
Store #48291 - Seattle WA

Date: 2026-06-21  04:44 PM
-------------------------
1x Matcha Latte      $5.75
1x Avocado Sourdough  $8.50 
1x Butter Croissant  $3.50
-------------------------
Subtotal:           $17.75
Tax (10%):           $1.78
-------------------------
TOTAL DUE:          $19.53

Thank you for fueling with us!`,
      docType: "Receipt / Invoice",
      fields: [
        { label: "Merchant Name", value: "Starbucks Coffee" },
        { label: "Date of Purchase", value: "2026-06-21" },
        { label: "Store Location", value: "Seattle, WA" },
        { label: "Tax Amount", value: "$1.78" },
        { label: "Total Amount Due", value: "$19.53" },
        { label: "Total Items Scanned", value: "3" }
      ],
      suggestedFilename: "receipt_starbucks_23.txt"
    }
  },
  {
    id: "code",
    title: "Python Factorial Code",
    category: "Source Code",
    description: "Clean recursive mathematical script screenshot",
    color: "from-blue-50 to-indigo-50",
    textColor: "text-indigo-700",
    data: {
      rawText: `def calculate_factorial(n):
    """
    Returns the factorial of n using recursion.
    """
    if n == 0 or n == 1:
        return 1
    else:
        return n * calculate_factorial(n - 1)

# Quick terminal test run
result = calculate_factorial(5)
print(f"Factorial of 5 is: {result}") # Output: 120`,
      docType: "Source Code",
      fields: [
        { label: "Programming Language", value: "Python" },
        { label: "Function Name", value: "calculate_factorial" },
        { label: "Design Pattern", value: "Recursive Function" },
        { label: "Primary Parameter", value: "n (integer)" },
        { label: "Expected Test Value", value: "120" },
        { label: "Complexity", value: "O(n)" }
      ],
      suggestedFilename: "factorial_recursion.py"
    }
  },
  {
    id: "card",
    title: "Elena's Business Card",
    category: "Business Card",
    description: "Handwritten modern UX Architect contact info",
    color: "from-amber-50 to-orange-50",
    textColor: "text-amber-700",
    data: {
      rawText: `ELENA VANOV
Lead UX Architect

Email: elena.vanov@quantum-design.io
Mobile: +1 (555) 382-9012

Quantum Design Labs
45 West 21st St, Suite 400
New York, NY 10010`,
      docType: "Business Card",
      fields: [
        { label: "Full Name", value: "Elena Vanov" },
        { label: "Job Title", value: "Lead UX Architect" },
        { label: "Company Name", value: "Quantum Design Labs" },
        { label: "Corporate Email", value: "elena.vanov@quantum-design.io" },
        { label: "Mobile Number", value: "+1 (555) 382-9012" },
        { label: "Office Location", value: "New York, NY" }
      ],
      suggestedFilename: "contact_elena_vanov.txt"
    }
  }
];

export default function Scanner({ onScanComplete, isLoading, setIsLoading }: ScannerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanSpeedEstimate, setScanSpeedEstimate] = useState<string>("");
  const [documentLanguage, setDocumentLanguage] = useState<string>("auto");

  // Interactive zoom modal verification states
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.8);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const resetZoomAndPan = () => {
    setZoomLevel(1.8);
    setPanOffset({ x: 0, y: 0 });
  };

  // Turn off camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setErrorMessage("Could not launch camera. Ensure browser frame permissions are enabled.");
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setSelectedImage(dataUrl);
        stopCamera();
      }
    } catch (err) {
      setErrorMessage("Failed to capture snapshot from camera stream.");
    }
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Unsupported payload. Please upload a standard image file (PNG, JPG, WEBP).");
      return;
    }
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setSelectedImage(e.target.result as string);
      }
    };
    reader.onerror = () => {
      setErrorMessage("Could not parse image file.");
    };
    reader.readAsDataURL(file);
  };

  const triggerSearch = () => {
    fileInputRef.current?.click();
  };

  // Perform Gemini full-stack scan
  const executeImageScan = async () => {
    if (!selectedImage) return;

    setIsLoading(true);
    setErrorMessage(null);
    setScanSpeedEstimate("Consulting Gemini Core...");

    const quoteTimer = setTimeout(() => {
      setScanSpeedEstimate("Translating pixels to glyphs...");
    }, 2800);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          image: selectedImage, 
          mimeType: "image/jpeg",
          language: documentLanguage
        })
      });

      if (!response.ok) {
        let errMsg = "Server scanner error response.";
        try {
          const rawText = await response.text();
          try {
            const errJson = JSON.parse(rawText);
            if (errJson && errJson.error) {
              errMsg = errJson.error;
            } else {
              errMsg = `Server error (Status ${response.status}): ${rawText.slice(0, 300)}`;
            }
          } catch {
            errMsg = `Server error (Status ${response.status}): ${rawText.slice(0, 300)}`;
          }
        } catch (readErr: any) {
          errMsg = `Network or Server communication error: ${readErr.message || "Unknown"}`;
        }
        throw new Error(errMsg);
      }

      const rawBodyText = await response.text();
      const scannedDoc = JSON.parse(rawBodyText);
      onScanComplete(scannedDoc);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to scan the image. Try another file or a preset.");
    } finally {
      clearTimeout(quoteTimer);
      setIsLoading(false);
      setScanSpeedEstimate("");
    }
  };

  const triggerPreset = (presetData: ScannedDocument) => {
    setIsLoading(true);
    setErrorMessage(null);
    setScanSpeedEstimate("Loading high-fidelity preset...");

    // Tiny artificial timeout for gorgeous cinematic layout transition
    setTimeout(() => {
      onScanComplete(presetData);
      setIsLoading(false);
      setScanSpeedEstimate("");
    }, 850);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto items-start p-1" id="section-scanner-hub">
      {/* Upload & Camera Section */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[460px]">
        {/* Header tabs / switches */}
        <div className="flex border-b border-slate-100 p-4 justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-sans font-semibold text-slate-800 text-sm tracking-tight">Active Image Capture</h2>
          </div>
          
          <div className="flex gap-2">
            {!isCameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                id="btn-trigger-camera"
              >
                <Camera className="w-3.5 h-3.5 text-slate-500" />
                Live Camera
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-colors cursor-pointer"
                id="btn-close-camera"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Stop Cam
              </button>
            )}
          </div>
        </div>

        {/* Display Frame */}
        <div className="p-6 flex-1 flex flex-col justify-center">
          {isCameraActive ? (
            /* Live Camera view */
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-900 group">
              <video
                ref={videoRef}
                className="w-full h-full object-cover scale-x-[-1]"
                muted
                playsInline
              />
              {/* Overlay Hologram Laser Target Laser */}
              <div className="absolute inset-0 border border-emerald-500/30 flex items-center justify-center pointer-events-none">
                <div className="w-11/12 h-0.5 bg-emerald-500/80 absolute top-1/2 left-0 shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-[bounce_3s_infinite]" />
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
              </div>
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-700/20 flex items-center gap-2 cursor-pointer transition-transform transform active:scale-95"
                  id="btn-capture-snapshot"
                >
                  <Camera className="w-4 h-4" />
                  Capture & Load Image
                </button>
              </div>
            </div>
          ) : selectedImage ? (
            /* Selected File view preview */
            <div className="relative bg-slate-50 rounded-xl border border-dashed border-slate-200 p-3 max-h-[360px] overflow-hidden flex flex-col items-center justify-center group">
              <img
                src={selectedImage}
                alt="Selected preview scan payload"
                className="max-h-[280px] w-auto object-contain rounded-lg shadow-sm"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => {
                    resetZoomAndPan();
                    setIsZoomModalOpen(true);
                  }}
                  className="p-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-semibold cursor-pointer border border-indigo-500 flex items-center gap-1 shadow-sm"
                  id="btn-zoom-interactive"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  Zoom &amp; Verify
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-semibold cursor-pointer border border-rose-200"
                  id="btn-clear-photo"
                >
                  Remove File
                </button>
                <button
                  type="button"
                  onClick={triggerSearch}
                  className="p-1.5 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
                  id="btn-replace-photo"
                >
                  Replace
                </button>
              </div>
              
              {/* Subtle overlay hint */}
              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[10px] font-sans flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Want to check transcription accuracy?</span>
                <button
                  type="button"
                  onClick={() => {
                    resetZoomAndPan();
                    setIsZoomModalOpen(true);
                  }}
                  className="text-emerald-400 font-extrabold hover:underline"
                >
                  Launch Live Zoom
                </button>
              </div>
            </div>
          ) : (
            /* Drag & Drop empty state */
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerSearch}
              className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragActive
                  ? "border-emerald-500 bg-emerald-50/40 text-emerald-600Scale shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-500 hover:bg-slate-50/80"
              }`}
              id="file-drop-zone"
            >
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 text-slate-400 mb-4">
                <Upload className="w-5 h-5 text-slate-500" />
              </div>
              <p className="font-sans text-sm font-semibold text-slate-800 mb-1">
                Drag &amp; drop your image here, or <span className="text-emerald-600 hover:underline">browse</span>
              </p>
              <p className="font-sans text-xs text-slate-400 max-w-sm px-4">
                Supports PNG, JPG, and WEBP captures of receipts, forms, code blocks, or documents. Feel free to use the camera, too!
              </p>
            </div>
          )}

          {/* OCR Document Optimization Settings */}
          <div className="mt-5 p-4.5 bg-slate-50 border border-slate-100 rounded-xl space-y-3.5" id="ocr-language-selector-section">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span className="text-xs font-bold text-slate-800 font-sans">OCR Language Advisor</span>
              </div>
              <span className="text-[10px] bg-slate-200 text-slate-700 font-mono font-semibold px-2 py-0.5 rounded-md">
                Active
              </span>
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="select-ocr-lang" className="block text-[11px] font-sans font-bold text-slate-500">
                Primary Document/Text Language
              </label>
              <div className="relative">
                <select
                  id="select-ocr-lang"
                  value={documentLanguage}
                  onChange={(e) => setDocumentLanguage(e.target.value)}
                  className="w-full text-xs font-sans font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 appearance-none cursor-pointer"
                >
                  <option value="auto">🌐 Auto-Detect Language (Dynamic)</option>
                  
                  {/* Common Languages */}
                  <option disabled className="text-slate-400 font-bold bg-slate-100">─── Global Languages ───</option>
                  <option value="English">🇺🇸 English (Universal)</option>
                  <option value="Spanish">🇪🇸 Spanish (Español)</option>
                  <option value="French">🇫🇷 French (Français)</option>
                  <option value="German">🇩🇪 German (Deutsch)</option>
                  <option value="Chinese">🇨🇳 Chinese Simplified (简体中文)</option>
                  <option value="Chinese Traditional">🇭🇰 Chinese Traditional (繁體中文)</option>
                  <option value="Japanese">🇯🇵 Japanese (日本語)</option>
                  <option value="Korean">🇰🇷 Korean (한국어)</option>
                  <option value="Arabic">🇸🇦 Arabic (العربية)</option>
                  <option value="Hindi">🇮🇳 Hindi (हिन्दी)</option>
                  <option value="Portuguese">🇵🇹 Portuguese (Português)</option>
                  <option value="Russian">🇷🇺 Russian (Русский)</option>
                  <option value="Italian">🇮🇹 Italian (Italiano)</option>
                  <option value="Vietnamese">🇻🇳 Vietnamese (Tiếng Việt)</option>
                  
                  <option disabled className="text-slate-400 font-bold bg-slate-100">─── Asian Languages ───</option>
                  <option value="Bengali">🇧🇩 Bengali (বাংলা)</option>
                  <option value="Gujarati">🇮🇳 Gujarati (ગુજરાતી)</option>
                  <option value="Indonesian">🇮🇩 Indonesian (Bahasa Indonesia)</option>
                  <option value="Kannada">🇮🇳 Kannada (ಕನ್ನಡ)</option>
                  <option value="Malay">🇲🇾 Malay (Bahasa Melayu)</option>
                  <option value="Malayalam">🇮🇳 Malayalam (മലയാളം)</option>
                  <option value="Marathi">🇮🇳 Marathi (मराठी)</option>
                  <option value="Nepali">🇳🇵 Nepali (नेपाली)</option>
                  <option value="Punjabi">🇮🇳 Punjabi (ਪੰਜਾਬੀ)</option>
                  <option value="Sinhala">🇱🇰 Sinhala (සිංහල)</option>
                  <option value="Tamil">🇮🇳 Tamil (தமிழ்)</option>
                  <option value="Telugu">🇮🇳 Telugu (తెలుగు)</option>
                  <option value="Thai">🇹🇭 Thai (ภาษาไทย)</option>
                  <option value="Urdu">🇵🇰 Urdu (اردو)</option>
                  <option value="Filipino">🇵🇭 Filipino/Tagalog (Wikang Filipino)</option>

                  <option disabled className="text-slate-400 font-bold bg-slate-100">─── European Languages ───</option>
                  <option value="Albanian">🇦🇱 Albanian (Shqip)</option>
                  <option value="Basque">🇪🇸 Basque (Euskara)</option>
                  <option value="Belarusian">🇧🇾 Belarusian (Бэларуская)</option>
                  <option value="Bosnian">🇧🇦 Bosnian (Bosanski)</option>
                  <option value="Bulgarian">🇧🇬 Bulgarian (Български)</option>
                  <option value="Catalan">🇪🇸 Catalan (Català)</option>
                  <option value="Croatian">🇭🇷 Croatian (Hrvatski)</option>
                  <option value="Czech">🇨🇿 Czech (Čeština)</option>
                  <option value="Danish">🇩🇰 Danish (Dansk)</option>
                  <option value="Dutch">🇳🇱 Dutch (Nederlands)</option>
                  <option value="Estonian">🇪🇪 Estonian (Eesti)</option>
                  <option value="Finnish">🇫🇮 Finnish (Suomi)</option>
                  <option value="Galician">🇪🇸 Galician (Galego)</option>
                  <option value="Georgian">🇬🇪 Georgian (ქართული)</option>
                  <option value="Greek">🇬🇷 Greek (Ελληνικά)</option>
                  <option value="Hungarian">🇭🇺 Hungarian (Magyar)</option>
                  <option value="Icelandic">🇮🇸 Icelandic (Íslenska)</option>
                  <option value="Irish">🇮🇪 Irish (Gaeilge)</option>
                  <option value="Latvian">🇱🇻 Latvian (Latviešu)</option>
                  <option value="Lithuanian">🇱🇹 Lithuanian (Lietuvių)</option>
                  <option value="Macedonian">🇲🇰 Macedonian (Македонски)</option>
                  <option value="Maltese">🇲🇹 Maltese (Malti)</option>
                  <option value="Norwegian">🇳🇴 Norwegian (Norsk)</option>
                  <option value="Polish">🇵🇱 Polish (Polski)</option>
                  <option value="Romanian">🇷🇴 Romanian (Română)</option>
                  <option value="Serbian">🇷🇸 Serbian (Српски)</option>
                  <option value="Slovak">🇸🇰 Slovak (Slovenčina)</option>
                  <option value="Slovenian">🇸🇮 Slovenian (Slovenščina)</option>
                  <option value="Swedish">🇸🇪 Swedish (Svenska)</option>
                  <option value="Ukrainian">🇺🇦 Ukrainian (Українська)</option>
                  <option value="Welsh">🇬🇧 Welsh (Cymraeg)</option>

                  <option disabled className="text-slate-400 font-bold bg-slate-100">─── Middle East & Africa ───</option>
                  <option value="Amharic">🇪🇹 Amharic (አማርኛ)</option>
                  <option value="Azerbaijani">🇦🇿 Azerbaijani (Azərbaycanca)</option>
                  <option value="Hebrew">🇮🇱 Hebrew (עברית)</option>
                  <option value="Kazakh">🇰🇿 Kazakh (Қазақ тілі)</option>
                  <option value="Persian">🇮🇷 Persian (فارسی)</option>
                  <option value="Swahili">🇰🇪 Swahili (Kiswahili)</option>
                  <option value="Turkish">🇹🇷 Turkish (Türkçe)</option>
                  <option value="Zulu">🇿🇦 Zulu (isiZulu)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                  <svg className="h-4 w-4 fill-current text-slate-500" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Selecting a language optimizes grammar heuristics, character dictionaries, and special punctuation glyphs for precise visual OCR transcription.
              </p>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="mt-6">
            <button
              type="button"
              disabled={!selectedImage || isLoading}
              onClick={executeImageScan}
              className={`w-full py-3.5 px-6 font-sans font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${
                selectedImage && !isLoading
                  ? "bg-slate-900 text-white hover:bg-slate-800 shadow-md transform hover:-translate-y-0.5 cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
              id="btn-submit-scan"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                  <span>{scanSpeedEstimate || "Scanning with Gemini..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Execute Visual Scan &amp; Extract Data</span>
                </>
              )}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {errorMessage && (
          <div className="mx-6 mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Preset Demo Panel */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <h3 className="font-sans font-bold text-base mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            No images on hand?
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed mb-4">
            Test the auto-typing, structured form mapping, and interactive practice layout immediately with one of our high-quality scanned presets.
          </p>

          <div className="space-y-3" id="presets-container">
            {PRESET_DEMOS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => triggerPreset(item.data)}
                className="w-full text-left p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all cursor-pointer flex justify-between items-center group relative"
                id={`preset-${item.id}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-semibold text-slate-100 text-xs">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-700 text-slate-300 rounded-md">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {item.description}
                  </p>
                </div>
                
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-all pointer-events-none">
                  <Eye className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-slate-500 text-xs space-y-3.5">
          <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">How does it work?</h4>
          <ol className="list-decimal list-inside space-y-2 text-slate-600 font-sans leading-relaxed">
            <li>
              Upload any print/code image or snap a document view using your device.
            </li>
            <li>
              Gemini visual intelligence OCR formats and extracts metadata structure blocks.
            </li>
            <li>
              <strong className="text-slate-800">Auto-Type:</strong> Watch a mock mechanical terminal type the exact content at up to 800 WPM with sound clicks.
            </li>
            <li>
              <strong className="text-slate-800">Form Fill:</strong> Watch fields automatically input and map into interactive components.
            </li>
            <li>
              <strong className="text-slate-800">Practice:</strong> Practice typing the text yourself with live WPM &amp; accuracy analysis!
            </li>
          </ol>
        </div>
      </div>

      {/* Interactive Zoom Verification Modal */}
      {isZoomModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6" id="zoom-verification-modal">
          <div className="bg-white rounded-[32px] shadow-2xl border border-indigo-100 max-w-4xl w-full flex flex-col overflow-hidden max-h-[90vh] animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-indigo-50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                  <ZoomIn className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-sans font-black text-slate-800 text-sm md:text-base">Accuracy Verification Lens</h3>
                  <p className="text-slate-400 text-[11px]">Inspect high-contrast pixel sections to verify text readability</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                id="btn-close-zoom"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto">
              
              {/* Left Settings & Presets Console */}
              <div className="md:col-span-4 space-y-5">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-extrabold text-indigo-500 tracking-widest block">Lens Parameters</span>
                  <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50 space-y-4">
                    {/* Zoom multiplier display */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">Magnification:</span>
                      <span className="text-xs font-mono font-black text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                        {zoomLevel.toFixed(1)}x
                      </span>
                    </div>

                    {/* Proactive controls slider */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="0.1"
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>1.0x</span>
                        <span>2.5x</span>
                        <span>4.0x</span>
                      </div>
                    </div>

                    {/* Step buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.3))}
                        className="flex-1 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center justify-center gap-1 cursor-pointer font-sans"
                      >
                        <ZoomOut className="w-3.5 h-3.5 text-slate-500" /> Out
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.min(4, prev + 0.3))}
                        className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700 flex items-center justify-center gap-1 cursor-pointer font-sans"
                      >
                        <ZoomIn className="w-3.5 h-3.5 text-indigo-600" /> In
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drag info */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-start gap-2 font-sans">
                  <Move className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="text-slate-700 block">Interactive Pan Gesture:</strong>
                    Click and drag inside the viewport frame to glide, pan, or track specific receipt lines/signatures.
                  </p>
                </div>

                {/* Sector Presets */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-extrabold text-indigo-500 tracking-widest block font-sans">Focal Sector Shortcuts</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                    <button
                      type="button"
                      onClick={() => { setZoomLevel(2.2); setPanOffset({ x: 120, y: 100 }); }}
                      className="p-2 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/20 text-left font-bold text-slate-700 flex flex-col gap-0.5 transition-all text-[11px] cursor-pointer"
                    >
                      <span>Top Header Sector</span>
                      <span className="text-[9px] font-mono text-slate-400 font-normal">Merchant &amp; Main Title</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setZoomLevel(2.2); setPanOffset({ x: -120, y: 100 }); }}
                      className="p-2 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/20 text-left font-bold text-slate-700 flex flex-col gap-0.5 transition-all text-[11px] cursor-pointer"
                    >
                      <span>Middle Data Rows</span>
                      <span className="text-[9px] font-mono text-slate-400 font-normal">Transcribed keys</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setZoomLevel(2.4); setPanOffset({ x: 0, y: -100 }); }}
                      className="p-2 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/20 text-left font-bold text-slate-700 flex flex-col gap-0.5 transition-all text-[11px] cursor-pointer"
                    >
                      <span>Bottom Sector</span>
                      <span className="text-[9px] font-mono text-slate-400 font-normal">Totals / Signatures</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetZoomAndPan}
                      className="p-2 border border-indigo-100 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 hover:border-indigo-200 text-center font-black flex items-center justify-center transition-all text-[11px] cursor-pointer"
                    >
                      Center View
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Viewport Canvas */}
              <div className="md:col-span-8 flex flex-col gap-4">
                <div
                  className="relative aspect-video w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden select-none cursor-grab active:cursor-grabbing group shadow-inner flex items-center justify-center"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                >
                  {/* Visual Crosshair Alignment Reticle HUD */}
                  <div className="absolute inset-0 border border-indigo-500/10 pointer-events-none flex items-center justify-center">
                    <div className="w-[1px] h-full bg-indigo-500/15" />
                    <div className="h-[1px] w-full bg-indigo-500/15" />
                    <div className="absolute w-8 h-8 rounded-full border border-indigo-500/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/30" />
                    </div>
                  </div>

                  {/* Corner Visual Tech HUD Markers */}
                  <div className="absolute top-3 left-3 text-[10px] font-mono text-indigo-400 bg-slate-900/60 backdrop-blur-sm px-2 py-1 rounded border border-indigo-500/10 pointer-events-none">
                    PAN_X: {Math.round(panOffset.x)} | PAN_Y: {Math.round(panOffset.y)}
                  </div>
                  <div className="absolute top-3 right-3 text-[10px] font-mono text-emerald-400 bg-slate-900/60 backdrop-blur-sm px-2 py-1 rounded border border-emerald-500/10 pointer-events-none">
                    LENS: ACTIVE
                  </div>

                  {/* Scaled and Panned Scanned Image */}
                  <div
                    style={{
                      transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                      transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                    }}
                    className="w-full h-full flex items-center justify-center pointer-events-none origin-center"
                  >
                    <img
                      src={selectedImage}
                      alt="Inspection target"
                      className="max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 px-1 font-sans">
                  <span>Tip: Hold left mouse key and drag around the viewport to inspect details.</span>
                  <span className="font-mono text-[10px]">Viewport: Live Pixel Matrix</span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4.5 border-t border-indigo-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetZoomAndPan}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer font-sans"
              >
                Reset Orientation
              </button>
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(false)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer font-sans"
              >
                <Check className="w-3.5 h-3.5 text-indigo-200" /> Confirm Accuracy &amp; Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
