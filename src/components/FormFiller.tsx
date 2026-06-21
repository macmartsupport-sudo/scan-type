import { useState, useEffect } from "react";
import { Sparkles, Save, FileText, Check, Database, HelpCircle, Edit2, Zap, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { ScannedDocument, ScannedField } from "../types";

interface FormFillerProps {
  document: ScannedDocument;
}

export default function FormFiller({ document: doc }: FormFillerProps) {
  const [formFields, setFormFields] = useState<ScannedField[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [dbRecords, setDbRecords] = useState<any[]>([]);

  // Track field anim states
  const [animatingField, setAnimatingField] = useState<number | null>(null);

  useEffect(() => {
    // Reset and sync with scanned document
    setFormFields(doc.fields || []);
    setIsSaved(false);
  }, [doc]);

  const handleFieldChange = (index: number, value: string) => {
    const updated = [...formFields];
    updated[index].value = value;
    setFormFields(updated);
    setIsSaved(false);
  };

  const simulateAutoFill = (index: number) => {
    setAnimatingField(index);
    // Play quick sound or visual delay
    setTimeout(() => {
      setAnimatingField(null);
    }, 1000);
  };

  const handleSaveToDatabase = () => {
    const newRecord = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      docType: doc.docType,
      filename: doc.suggestedFilename,
      properties: [...formFields]
    };
    setDbRecords((prev) => [newRecord, ...prev]);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const downloadAsCSV = () => {
    if (formFields.length === 0) return;

    // Prepare CSV data
    const headers = ["Field Label", "Extracted Value"];
    const rows = formFields.map(f => {
      // Escape inner quotes
      const escapedLabel = f.label.replace(/"/g, '""');
      const escapedValue = f.value.replace(/"/g, '""');
      return `"${escapedLabel}","${escapedValue}"`;
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const baseFilename = doc.suggestedFilename.split(".")[0] || "extracted_data";
    link.setAttribute("download", `${baseFilename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsWord = () => {
    if (formFields.length === 0) return;

    const baseFilename = doc.suggestedFilename.split(".")[0] || "extracted_data";
    
    // Construct rich Word document HTML wrapper
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Extracted OCR Report - ${doc.suggestedFilename}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; padding: 40px; }
          h1 { color: #1e3a8a; font-size: 26px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 5px; }
          .subtitle { color: #64748b; font-size: 11px; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
          h2 { color: #2563eb; font-size: 18px; margin-top: 30px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 35px; }
          th { background-color: #f8fafc; color: #1e293b; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 13px; }
          td { border: 1px solid #cbd5e1; padding: 12px; color: #334155; font-size: 12px; }
          .label-col { font-weight: bold; color: #0f172a; background-color: #fcfdfe; width: 30%; }
          .value-col { width: 70%; }
          .raw-title { color: #1e3a8a; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 40px; }
          .raw-pre { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #334155; white-space: pre-wrap; margin-top: 15px; border-radius: 8px; }
          .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <h1>OCR Document Extraction Report</h1>
        <div class="subtitle">
          Document Type: <strong>${doc.docType.toUpperCase()}</strong> | 
          Source Image: <strong>${doc.suggestedFilename}</strong> | 
          Generated: ${new Date().toLocaleString()}
        </div>
        
        <h2>Structured Metadata Fields</h2>
        <table>
          <thead>
            <tr>
              <th>Field Label</th>
              <th>Extracted Value</th>
            </tr>
          </thead>
          <tbody>
            ${formFields.map(f => `
              <tr>
                <td class="label-col">${f.label.toUpperCase()}</td>
                <td class="value-col">${f.value || '(Empty)'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${doc.rawText ? `
          <h2 class="raw-title">Full Document Transcript (OCR)</h2>
          <div class="raw-pre">${doc.rawText.replace(/\n/g, '<br/>')}</div>
        ` : ''}

        <div class="footer">
          Report compiled automatically via Antigravity Gemini OCR Extraction Applet safely on ${new Date().toLocaleDateString()}.
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${baseFilename}.doc`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsPDF = () => {
    if (formFields.length === 0) return;

    const docPdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const startX = 20;
    let currentY = 20;
    const pageHeight = 297;
    const marginY = 20;
    const contentWidth = 170;

    const addFooter = (pNum: number) => {
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(8);
      docPdf.setTextColor(148, 163, 184); // slate-400
      docPdf.text(`Page ${pNum}`, 105, pageHeight - 10, { align: "center" });
      docPdf.text("Intelligent Document Processing Applet", startX, pageHeight - 10);
    };

    let pageNum = 1;
    addFooter(pageNum);

    // Header strip
    docPdf.setFillColor(79, 70, 229); // Indigo #4f46e5
    docPdf.rect(startX, currentY, contentWidth, 3, "F");
    currentY += 10;

    // Header Title
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(22);
    docPdf.setTextColor(15, 23, 42); // slate-900
    docPdf.text("OCR DATA EXTRACTION REPORT", startX, currentY);
    currentY += 6;

    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(9);
    docPdf.setTextColor(100, 116, 139); // slate-500
    docPdf.text("Generated by Antigravity Gemini OCR Applet", startX, currentY);
    currentY += 12;

    // Metadata Card
    docPdf.setFillColor(248, 250, 252); // slate-50
    docPdf.setDrawColor(226, 232, 240); // slate-200
    docPdf.rect(startX, currentY, contentWidth, 24, "FD");

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(9);
    docPdf.setTextColor(100, 116, 139);
    docPdf.text("DOCUMENT TYPE:", startX + 5, currentY + 7);
    docPdf.text("SOURCE FILE:", startX + 5, currentY + 15);
    docPdf.text("TIMESTAMP:", startX + 5, currentY + 22);

    docPdf.setFont("helvetica", "bold");
    docPdf.setTextColor(79, 70, 229); // Indigo
    docPdf.text((doc.docType || "Unknown").toUpperCase(), startX + 38, currentY + 7);
    docPdf.setFont("helvetica", "normal");
    docPdf.setTextColor(15, 23, 42);
    docPdf.text(doc.suggestedFilename || "source_image.png", startX + 38, currentY + 15);
    docPdf.text(new Date().toLocaleString(), startX + 38, currentY + 22);

    currentY += 34;

    // Structured metadata table title
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(13);
    docPdf.setTextColor(15, 23, 42);
    docPdf.text("EXTRACTED FIELDS & METADATA", startX, currentY);
    currentY += 3;

    docPdf.setDrawColor(226, 232, 240);
    docPdf.line(startX, currentY, startX + contentWidth, currentY);
    currentY += 6;

    // Table headers
    docPdf.setFillColor(241, 245, 249); // slate-100
    docPdf.rect(startX, currentY, contentWidth, 8, "F");
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(9);
    docPdf.setTextColor(71, 85, 105);
    docPdf.text("FIELD NAME", startX + 4, currentY + 5.5);
    docPdf.text("EXTRACTED VALUE", startX + 60, currentY + 5.5);
    currentY += 8;

    // Table row content
    formFields.forEach((field) => {
      if (currentY + 12 > pageHeight - marginY) {
        docPdf.addPage();
        currentY = 20;
        pageNum++;
        addFooter(pageNum);
      }

      docPdf.setDrawColor(241, 245, 249);
      docPdf.line(startX, currentY, startX + contentWidth, currentY);

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(9);
      docPdf.setTextColor(51, 65, 85);
      docPdf.text(field.label.toUpperCase(), startX + 4, currentY + 6);

      docPdf.setFont("helvetica", "normal");
      docPdf.setTextColor(15, 23, 42);
      const wrappedValue = docPdf.splitTextToSize(field.value || "—", contentWidth - 64);
      
      let textY = currentY + 6;
      for (let i = 0; i < wrappedValue.length; i++) {
        if (textY > pageHeight - marginY) {
          docPdf.addPage();
          currentY = 20;
          pageNum++;
          addFooter(pageNum);
          textY = currentY + 6;
        }
        docPdf.text(wrappedValue[i], startX + 60, textY);
        textY += 4.5;
      }

      const rowHeight = Math.max(8, 4.5 * wrappedValue.length + 3);
      currentY += rowHeight;
    });

    // Append OCR Transcript if available
    if (doc.rawText) {
      if (currentY + 25 > pageHeight - marginY) {
        docPdf.addPage();
        currentY = 20;
        pageNum++;
        addFooter(pageNum);
      } else {
        currentY += 10;
      }

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(13);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text("FULL OCR TRANSCRIPT", startX, currentY);
      currentY += 3;

      docPdf.setDrawColor(226, 232, 240);
      docPdf.line(startX, currentY, startX + contentWidth, currentY);
      currentY += 6;

      docPdf.setFont("courier", "normal");
      docPdf.setFontSize(8.5);
      docPdf.setTextColor(51, 65, 85);

      const splitTranscript = docPdf.splitTextToSize(doc.rawText, contentWidth - 8);

      let startLine = 0;
      while (startLine < splitTranscript.length) {
        const remainingSpace = pageHeight - marginY - 6 - currentY;
        const linesThatFit = Math.max(3, Math.floor(remainingSpace / 4.2));
        const endLine = Math.min(splitTranscript.length, startLine + linesThatFit);

        const count = endLine - startLine;
        const boxHeight = count * 4.2 + 4;

        docPdf.setFillColor(250, 250, 250);
        docPdf.setDrawColor(241, 245, 249);
        docPdf.rect(startX, currentY, contentWidth, boxHeight, "FD");

        let transcriptY = currentY + 4;
        for (let i = startLine; i < endLine; i++) {
          docPdf.text(splitTranscript[i], startX + 4, transcriptY);
          transcriptY += 4.2;
        }

        startLine = endLine;
        if (startLine < splitTranscript.length) {
          docPdf.addPage();
          currentY = 20;
          pageNum++;
          addFooter(pageNum);
        } else {
          currentY += boxHeight;
        }
      }
    }

    const baseFilenameWithoutExt = doc.suggestedFilename.split(".")[0] || "extracted_data";
    docPdf.save(`${baseFilenameWithoutExt}.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto" id="section-formfill-sandbox">
      {/* Dynamic Fields Form Card */}
      <div className="lg:col-span-7 bg-white rounded-[40px] shadow-[0_20px_50px_rgba(99,102,241,0.12)] border border-slate-100 overflow-hidden flex flex-col">
        <div className="bg-slate-50 p-6 border-b border-indigo-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
            <h3 className="font-sans font-bold text-slate-800 text-sm">Interactive Structured Fields</h3>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold uppercase tracking-wider">
            {doc.docType}
          </span>
        </div>

        <div className="p-8 flex-1 space-y-6">
          <p className="text-slate-500 text-xs">
            These fields have been automatically mapped from the image visual content using Gemini. You can modify them before submitting.
          </p>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            {formFields.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-slate-500 font-bold">No structural metadata fields scanned</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Please test one of our Starbucks receipt or contact card presets.</p>
              </div>
            ) : (
              formFields.map((field, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-1 md:grid-cols-4 gap-3 items-center p-4 rounded-2xl border transition-all ${
                    animatingField === idx
                      ? "bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-100 scale-[1.01]"
                      : "bg-white border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <label className="text-xs font-black text-slate-700 capitalize flex items-center gap-1.5 md:col-span-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {field.label}
                  </label>
                  
                  <div className="md:col-span-2 relative flex items-center justify-between">
                    <input
                      type="text"
                      className="w-full text-xs font-sans text-slate-800 bg-slate-50/70 border border-slate-200 hover:border-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none px-3.5 py-2.5 rounded-xl transition-all"
                      value={field.value}
                      onChange={(e) => handleFieldChange(idx, e.target.value)}
                    />
                  </div>

                  <div className="flex md:col-span-1 justify-end">
                    <button
                      type="button"
                      onClick={() => simulateAutoFill(idx)}
                      className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all cursor-pointer flex items-center gap-1 text-right"
                    >
                      <Zap className="w-3 h-3 text-indigo-500" /> Fill Wave
                    </button>
                  </div>
                </div>
              ))
            )}

            {formFields.length > 0 && (
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] text-slate-400">Save/Export extracted structured fields</span>
                </div>

                <div className="flex flex-wrap gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={downloadAsCSV}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs shadow-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 transition-all cursor-pointer"
                    id="btn-download-csv"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    Download as CSV
                  </button>

                  <button
                    type="button"
                    onClick={downloadAsWord}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs shadow-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 transition-all cursor-pointer"
                    id="btn-download-word"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    Download as Word
                  </button>

                  <button
                    type="button"
                    onClick={downloadAsPDF}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs shadow-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 transition-all cursor-pointer"
                    id="btn-download-pdf"
                  >
                    <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download as PDF
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToDatabase}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer ${
                      isSaved
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-slate-900 text-white hover:bg-slate-800 shadow-md"
                    }`}
                    id="btn-save-record"
                  >
                    {isSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Saved Successfully!
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-indigo-300" />
                        Commit to Local Database
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Database simulated list (matches bottom design of Vibrant theme) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-indigo-900 rounded-[32px] p-6 text-white border border-indigo-950 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h4 className="font-sans font-bold text-sm tracking-tight text-white">Local Virtual Database</h4>
          </div>
          <p className="text-indigo-200 text-[11px] leading-relaxed mb-4">
            Simulated persistence records index. Records saved from your parsed visual scan will populate instantly here.
          </p>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1" id="db-records-list">
            {dbRecords.length === 0 ? (
              <div className="text-center py-8 bg-indigo-950/40 rounded-2xl border border-indigo-800/40 text-indigo-300/60 font-sans text-xs">
                No local database records created yet. Fill out fields and click 'Commit' to save.
              </div>
            ) : (
              dbRecords.map((rec) => (
                <div key={rec.id} className="bg-indigo-950/60 p-3.5 rounded-xl border border-indigo-800/65 space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b border-indigo-800/50 pb-1.5">
                    <span className="font-mono text-[10px] text-indigo-300 font-bold uppercase">{rec.docType}</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold">{rec.timestamp}</span>
                  </div>
                  <p className="text-slate-300 font-mono text-[11px] truncate">File: {rec.filename}</p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {rec.properties.slice(0, 4).map((p: any, i: number) => (
                      <div key={i} className="bg-slate-900/40 p-1.5 rounded border border-indigo-900/30 text-[10px]">
                        <span className="block text-indigo-300 font-bold font-sans uppercase text-[8px] truncate">{p.label}</span>
                        <span className="text-white truncate block font-mono">{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs text-slate-500">
          <h5 className="font-bold text-slate-700 mb-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Automatic Mapping Schema
          </h5>
          <p className="leading-relaxed">
            Our visual pipeline utilizes a customized high-entropy validation schema powered by Gemini, ensuring perfect labels mapping.
          </p>
        </div>
      </div>
    </div>
  );
}
