/**
 * OpenAI/OpenRouter Client Configuration
 *
 * Centralized configuration for AI models.
 * Routes through OpenRouter if OPENROUTER_API_KEY is set, otherwise uses OpenAI directly.
 */

import OpenAI from 'openai';

// Determine which service to use
const useOpenRouter = !!process.env.OPENROUTER_API_KEY;

// Create configured OpenAI client
export const openai = new OpenAI({
  apiKey: useOpenRouter
    ? process.env.OPENROUTER_API_KEY
    : process.env.OPENAI_API_KEY,
  baseURL: useOpenRouter
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.openai.com/v1',
  defaultHeaders: useOpenRouter ? {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'ADO Explorer',
  } : undefined,
});

// Model mappings (OpenRouter-compatible names when using OpenRouter)
export const MODEL_NAMES = {
  // Fast, cheap models for classification and simple tasks
  intent: useOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
  decision: useOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',

  // More powerful models for complex tasks
  planning: useOpenRouter ? 'openai/gpt-4o' : 'gpt-4o',
  evaluation: useOpenRouter ? 'openai/gpt-4o' : 'gpt-4o',
  synthesis: useOpenRouter ? 'openai/gpt-4o' : 'gpt-4o',
};

// Log which service is being used
console.log(`[OpenAI Config] Using ${useOpenRouter ? 'OpenRouter' : 'OpenAI'} for AI models`);
console.log(`[OpenAI Config] Base URL: ${useOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'}`);
console.log(`[OpenAI Config] Models:`, MODEL_NAMES);
