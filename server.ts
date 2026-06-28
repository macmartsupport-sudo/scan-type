import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please open the Settings (gear icon) > Secrets panel in your AI Studio editor, and add your GEMINI_API_KEY to enable live scan extraction.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function getCleanErrorMessage(err: any): Promise<string> {
  if (!err) return "An unexpected error occurred during the visual image scan.";
  
  const rawMsg = err.message || String(err);
  
  // Try to find if there is a JSON string inside the message
  let jsonStr = "";
  if (rawMsg.includes("{") && rawMsg.includes("}")) {
    const startIdx = rawMsg.indexOf("{");
    const endIdx = rawMsg.lastIndexOf("}") + 1;
    jsonStr = rawMsg.substring(startIdx, endIdx);
  } else {
    jsonStr = rawMsg;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
    if (parsed?.message) {
      return parsed.message;
    }
  } catch {
    // Not valid JSON, ignore
  }

  // Handle common codes or keywords manually if parsing fails
  const lowerMsg = rawMsg.toLowerCase();
  if (lowerMsg.includes("503") || lowerMsg.includes("unavailable") || lowerMsg.includes("demand") || lowerMsg.includes("busy")) {
    return "AI service is temporarily busy. Please try again in a few minutes.";
  }
  if (lowerMsg.includes("429") || lowerMsg.includes("resourceexhausted") || lowerMsg.includes("limit")) {
    return "The Gemini API rate limit has been exceeded. Please try again in a few moments.";
  }
  if (lowerMsg.includes("500") || lowerMsg.includes("internal server error")) {
    return "AI service encountered an internal error. Please try again in a few moments.";
  }
  if (lowerMsg.includes("502") || lowerMsg.includes("504") || lowerMsg.includes("bad gateway") || lowerMsg.includes("gateway timeout")) {
    return "AI service gateway error. Please try again in a few moments.";
  }
  if (lowerMsg.includes("api_key") || lowerMsg.includes("api key") || lowerMsg.includes("invalid key")) {
    return "Gemini API Key is missing or invalid. Please check your Settings (gear icon) > Secrets panel.";
  }

  return rawMsg;
}

// Check if an error status/message is transient and should be retried
function isRetriableError(err: any): boolean {
  const errStr = String(err?.message || err?.status || err || "").toLowerCase();
  
  // Explicitly non-retriable: Invalid credentials or schema parameters
  if (errStr.includes("api_key") || errStr.includes("api key") || errStr.includes("invalid key") || errStr.includes("unauthorized") || errStr.includes("forbidden")) {
    return false;
  }
  if (errStr.includes("bad request") || errStr.includes("invalid payload") || errStr.includes("400")) {
    if (errStr.includes("validation") || errStr.includes("schema") || errStr.includes("parameter")) {
      return false;
    }
  }

  // Retriable: 503, 502, 504, 500, 429, timeouts, and network issues
  return (
    errStr.includes("503") ||
    errStr.includes("502") ||
    errStr.includes("504") ||
    errStr.includes("500") ||
    errStr.includes("429") ||
    errStr.includes("unavailable") ||
    errStr.includes("resourceexhausted") ||
    errStr.includes("demand") ||
    errStr.includes("timeout") ||
    errStr.includes("time out") ||
    errStr.includes("fetch") ||
    errStr.includes("network") ||
    errStr.includes("econnreset") ||
    errStr.includes("etimedout") ||
    errStr.includes("busy")
  );
}

// Timeout helper wrapping a Promise
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = "Request"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Simple sleep helper
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateContentWithRetry(client: GoogleGenAI, params: any) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  const errors: string[] = [];
  let lastError: any = null;

  // Delays for exponential backoff: 2s, 4s, 8s, 16s, 32s (up to 5 retries, making 6 attempts total)
  const retryDelays = [2000, 4000, 8000, 16000, 32000];
  const maxRetries = retryDelays.length;

  for (const model of modelsToTry) {
    console.log(`Routing OCR scan to pool model: ${model}`);
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[Retry Attempt ${attempt}/${maxRetries}] Retrying model ${model} in ${retryDelays[attempt - 1]}ms...`);
          await wait(retryDelays[attempt - 1] + Math.random() * 400); // Backoff + Jitter
        }

        console.log(`Sending API Request to model: ${model} (Attempt ${attempt + 1}/${maxRetries + 1})`);
        
        // Timeout request after 35 seconds to ensure we do not hang forever
        const responsePromise = client.models.generateContent({
          ...params,
          model,
        });

        const response = await withTimeout(responsePromise, 35000, `Gemini call on ${model}`);
        console.log(`Successfully completed scan using model: ${model}`);
        return response;

      } catch (err: any) {
        lastError = err;
        const errStr = String(err?.message || err?.status || err || "");
        console.error(`[Attempt ${attempt + 1} Failed] model: ${model}. Error: ${errStr}`);
        
        // If the error is not retriable (e.g., API key, bad parameters), abort immediately
        if (!isRetriableError(err)) {
          const errMsg = `Non-retriable error encountered on ${model}: ${errStr}`;
          console.warn(errMsg);
          errors.push(errMsg);
          break; // Break and try next model in pool or throw
        }

        // Keep track of the failure for summary
        errors.push(`Model ${model} attempt ${attempt + 1} failed: ${errStr}`);
      }
    }
  }

  // If we reach here, all models and retries have exhausted
  const combinedErrorMessage = `All attempted Gemini models failed. Details:\n${errors.join("\n")}`;
  console.error(combinedErrorMessage);

  // Requirement 3: If all retries fail, return the exact requested message
  throw new Error("AI service is temporarily busy. Please try again in a few minutes.");
}

// Sequential Execution Request Queue (Requirement 8)
class RequestQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } catch (err) {
        // Task promise rejection is handled inside the task wrapper
      }
    }
    this.processing = false;
    this.processNext();
  }
}

const ocrQueue = new RequestQueue();

// In-Memory Search Cache for OCR Optimizations (Requirement 9)
const ocrCache = new Map<string, any>();

function getSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return String(hash);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body size limit to handle larger base64 scanned images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API scan endpoint
  app.post("/api/scan", async (req, res) => {
    try {
      const { image, mimeType, language } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No image payload provided" });
      }

      // Strip potential visual base64 descriptor prefix (e.g., "data:image/png;base64,")
      let cleanBase64 = image;
      let cleanMime = mimeType || "image/png";

      if (image.includes(";base64,")) {
        const parts = image.split(";base64,");
        cleanBase64 = parts[1];
        if (parts[0] && parts[0].startsWith("data:")) {
          cleanMime = parts[0].replace("data:", "");
        }
      }

      // Cache Lookup (Requirement 9)
      const cacheKey = `${getSimpleHash(cleanBase64)}_${language || "auto"}`;
      if (ocrCache.has(cacheKey)) {
        console.log(`[Cache Hit] Serving OCR results directly from memory for key: ${cacheKey}`);
        return res.json(ocrCache.get(cacheKey));
      }

      const client = getGeminiClient();

      const imagePart = {
        inlineData: {
          mimeType: cleanMime,
          data: cleanBase64,
        },
      };

      const langInstruction = language && language !== "auto" 
        ? `The document is in ${language}. Ensure the character set, accent symbols, spelling rules, and specialized characters of ${language} are strictly adhered to for perfect OCR accuracy.`
        : "The document language should be auto-detected, but optimize for the primary localized dialect found in the text.";

      const textPart = {
        text: `Analyze this image and perform a detailed OCR scan. ${langInstruction} ` +
          "Extract the raw text/code preserving layout, capitalization, and indentation. " +
          "Determine the document type and extract up to 6 key individual metadata field labels and values.",
      };

      // Wrap visual extraction task in sequentially executed Queue (Requirement 8)
      const parsedData = await ocrQueue.enqueue(async () => {
        const response = await generateContentWithRetry(client, {
          contents: { parts: [imagePart, textPart] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                rawText: {
                  type: Type.STRING,
                  description: "Full and precise textual/code transcription of the document, maintaining visual indentation, headers, and spacing. No markdown formatting wraps like ```."
                },
                docType: {
                  type: Type.STRING,
                  description: "The classified document category, e.g., 'Source Code', 'Receipt / Invoice', 'Business Card', 'Handwritten Notes', 'Official Document'."
                },
                fields: {
                  type: Type.ARRAY,
                  description: "Array of exactly typed labels and values containing key metrics found in the document (such as Total Amount, Balance, Date, Store Name, Name, Job Title, Language). Maximum 6 pairs.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING, description: "Logical label name of the metric." },
                      value: { type: Type.STRING, description: "Structured value string." }
                    },
                    required: ["label", "value"]
                  }
                },
                suggestedFilename: {
                  type: Type.STRING,
                  description: "Suggested file name suitable for this file, lowercase and containing clean characters with the correct extension, e.g. receipt_apple.txt, counter_code.py, memo.txt."
                }
              },
              required: ["rawText", "docType", "fields", "suggestedFilename"]
            }
          },
        });

        const text = response.text;
        if (!text) {
          throw new Error("Empty scan output generated from Gemini model.");
        }

        let cleanedText = text.trim();
        if (cleanedText.startsWith("```")) {
          // Strip markdown blocks if they happen to exist
          const firstNewLine = cleanedText.indexOf("\n");
          const lastBackticks = cleanedText.lastIndexOf("```");
          if (firstNewLine !== -1 && lastBackticks !== -1 && lastBackticks > firstNewLine) {
            cleanedText = cleanedText.substring(firstNewLine + 1, lastBackticks).trim();
          }
        }

        const data = JSON.parse(cleanedText);
        
        // Save to cache (Requirement 9)
        ocrCache.set(cacheKey, data);
        if (ocrCache.size > 50) {
          // Keep cache clean and avoid unbounded size
          const oldestKey = ocrCache.keys().next().value;
          if (oldestKey) ocrCache.delete(oldestKey);
        }

        return data;
      });

      return res.json(parsedData);

    } catch (err: any) {
      console.error("Scan error occurred:", err);
      const userMessage = await getCleanErrorMessage(err);
      return res.status(500).json({
        error: userMessage
      });
    }
  });

  // Serve static assets or mount Vite in dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server scanning and routing on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start custom server:", err);
});
