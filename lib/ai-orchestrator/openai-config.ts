/**
 * OpenAI/OpenRouter Client Configuration
 *
 * Centralized configuration for AI models.
 * Routes through OpenRouter if OPENROUTER_API_KEY is set, otherwise uses OpenAI directly.
 */

import OpenAI from 'openai';

let cachedClient: OpenAI | null = null;
let cachedModelNames: any = null;

/**
 * Get or create the OpenAI client (lazy initialization)
 * This ensures environment variables are read at runtime, not module load time
 */
export function getOpenAIClient(): OpenAI {
  if (cachedClient) {
    return cachedClient;
  }

  // Check environment at runtime
  const useOpenRouter = !!process.env.OPENROUTER_API_KEY;

  console.log(`[OpenAI Config] Initializing client - Using ${useOpenRouter ? 'OpenRouter' : 'OpenAI'}`);
  console.log(`[OpenAI Config] OPENROUTER_API_KEY present: ${!!process.env.OPENROUTER_API_KEY}`);
  console.log(`[OpenAI Config] OPENAI_API_KEY present: ${!!process.env.OPENAI_API_KEY}`);

  cachedClient = new OpenAI({
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

  console.log(`[OpenAI Config] Base URL: ${cachedClient.baseURL}`);

  return cachedClient;
}

/**
 * Get model names (lazy initialization)
 */
export function getModelNames() {
  if (cachedModelNames) {
    return cachedModelNames;
  }

  const useOpenRouter = !!process.env.OPENROUTER_API_KEY;

  cachedModelNames = {
    // Fast, cheap models for classification and simple tasks
    intent: useOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
    decision: useOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',

    // More powerful models for complex tasks
    planning: useOpenRouter ? 'openai/gpt-4o' : 'gpt-4o',
    evaluation: useOpenRouter ? 'openai/gpt-4o' : 'gpt-4o',
    synthesis: useOpenRouter ? 'openai/gpt-4o' : 'gpt-4o',
  };

  console.log(`[OpenAI Config] Models:`, cachedModelNames);

  return cachedModelNames;
}

// Backwards compatibility exports (will be initialized on first use)
export const openai = new Proxy({} as OpenAI, {
  get(target, prop) {
    return (getOpenAIClient() as any)[prop];
  }
});

export const MODEL_NAMES = new Proxy({} as any, {
  get(target, prop) {
    return getModelNames()[prop];
  }
});
