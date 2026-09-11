export const AiErrorMessages = {
  AI_SERVICE_UNAVAILABLE_MESSAGE:
    'AI service is temporarily unavailable or overloaded. Please try again later.',
  AI_SERVICE_ERROR_MESSAGE: 'The AI service failed to generate a response.',
  EMPTY_RESPONSE: 'Received an empty response from the AI.',
  INVALID_JSON: 'The AI returned malformed JSON.',
  INVALID_FORMAT: 'The AI returned data in an unexpected format.',
  NO_VALID_CARDS: 'The AI did not return any valid cards.',
} as const;

export const CategoryErrorMessages = {
  CATEGORY_NOT_FOUND: 'The specified category was not found.',
  CATEGORY_NOT_OWNED: 'You do not have permission to access this category.',
} as const;
