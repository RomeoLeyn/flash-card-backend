export interface FlashcardData {
  word: string;
  sourceLanguage: string;
  targetLanguage: string;
  translation: string;
  transcription?: string;
  explanation: string;
  example: string;
}
