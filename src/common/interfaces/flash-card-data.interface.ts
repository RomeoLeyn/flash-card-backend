import { AiGenerationLevel } from 'src/ai/ai-generation-level.enum';

export interface FlashcardData {
  word: string;
  sourceLanguage: string;
  targetLanguage: string;
  translation: string;
  transcription?: string;
  explanation: string;
  example: string;
  level?: AiGenerationLevel | null;
}
