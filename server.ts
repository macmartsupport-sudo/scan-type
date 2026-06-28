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

async function generateContentWithRetry(client: GoogleGenAI, params: any, maxRetries = 3) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  const errors: string[] = [];
  let lastError: any = null;

  for (const model of modelsToTry) {
    let delay = 1000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting scan with model: ${model}, attempt ${attempt}/${maxRetries}`);
        const response = await client.models.generateContent({
          ...params,
          model,
        });
        console.log(`Successfully scanned document using model: ${model}`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errStr = String(err?.message || err?.status || err || JSON.stringify(err) || "");
        
        const is503OrUnavailable = errStr.includes("503") || 
                                   errStr.includes("UNAVAILABLE") || 
                                   errStr.includes("demand");
        
        const isRateLimit = errStr.includes("429") || 
                            errStr.includes("ResourceExhausted") ||
                            errStr.includes("limit");

        if (is503OrUnavailable) {
          // 503 means the model is overloaded. Immediately break from this model and try the next fallback model!
          const failureMsg = `Model ${model} is experiencing high demand (503/Unavailable). Switching to next available model immediately without waiting. Error: ${errStr}`;
          console.warn(failureMsg);
          errors.push(failureMsg);
          break; // break the attempt loop to try the next model in modelsToTry
        } else if (isRateLimit && attempt < maxRetries) {
          console.warn(`Gemini API rate limit (429) encountered on ${model} (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms... Error details: ${errStr}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = delay * 2 + Math.random() * 300; // exponential backoff with jitter
        } else {
          const failureMsg = `Model ${model} failed on attempt ${attempt}/${maxRetries}: ${errStr}`;
          console.error(failureMsg);
          errors.push(failureMsg);
          break; // break to try the next model
        }
      }
    }
  }

  const combinedErrorMessage = `All attempted Gemini models failed. Details:\n${errors.join("\n")}`;
  console.error(combinedErrorMessage);
  
  // Extract clean human-readable details from the last error if it is a stringified JSON
  let details = "Service Unavailable";
  if (lastError) {
    if (lastError.message) {
      try {
        const parsed = JSON.parse(lastError.message);
        if (parsed?.error?.message) {
          details = parsed.error.message;
        } else {
          details = lastError.message;
        }
      } catch {
        details = lastError.message;
      }
    } else {
      details = String(lastError);
    }
  }

  // Create a clean user-facing error message with helpful advice
  const userFriendlyError = new Error(
    "The translation/OCR AI service is currently experiencing extremely high demand. " +
    "Please try again in a few moments, or check if your API Key in Settings is correctly configured. " +
    `[Technical Details: ${details}]`
  );
  
  throw userFriendlyError;
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
        return res.status(500).json({ error: "Empty scan output generated from Gemini model." });
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

      const parsedData = JSON.parse(cleanedText);
      return res.json(parsedData);

    } catch (err: any) {
      console.error("Scan error occurred:", err);
      return res.status(500).json({
        error: err.message || "An unexpected error occurred during the visual image scan."
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
