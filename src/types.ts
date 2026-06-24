// Shared type definitions for the Scan & Auto-Type application

export interface ScannedField {
  label: string;
  value: string;
}

export interface ScannedDocument {
  rawText: string;
  docType: string;
  fields: ScannedField[];
  suggestedFilename: string;
}

export type TypingSpeed = "slow" | "medium" | "fast" | "instant" | "human" | "custom";

export interface TypingConfig {
  speed: TypingSpeed;
  soundEnabled: boolean;
  virtualKeyboardHighlight: boolean;
  humanHesitation: boolean;
}

export type AppView = "scanner" | "autotyper" | "formfill" | "typingPractice";
