/**
 * OpenAI API utilities with rate limit handling and retry logic
 */

interface OpenAIError {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  if (typeof error === 'string') {
    return error.toLowerCase().includes('rate limit');
  }
  if (error?.error?.message) {
    return error.error.message.toLowerCase().includes('rate limit');
  }
  if (error?.error?.type === 'rate_limit_exceeded') {
    return true;
  }
  if (error?.message) {
    return error.message.toLowerCase().includes('rate limit');
  }
  return false;
}

/**
 * Extract wait time from rate limit error message
 * Example: "Please try again in 2.312s" -> 2312 milliseconds
 */
export function extractWaitTime(errorMessage: string): number {
  const match = errorMessage.match(/try again in (\d+\.?\d*)s/i);
  if (match && match[1]) {
    return Math.ceil(parseFloat(match[1]) * 1000);
  }
  // Default to 3 seconds if we can't parse
  return 3000;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call OpenAI API with automatic retry on rate limits
 */
export async function callOpenAIWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If successful, return immediately
      if (response.ok) {
        return response;
      }

      // Clone the response to read it without consuming the stream
      const errorData = await response.clone().json();

      // Check if it's a rate limit error
      if (response.status === 429 || isRateLimitError(errorData)) {
        const errorMessage = errorData?.error?.message || 'Rate limit exceeded';
        console.log(`[OpenAI] Rate limit hit on attempt ${attempt}/${maxRetries}: ${errorMessage}`);

        if (attempt < maxRetries) {
          // Extract wait time from error message or use exponential backoff
          let waitTime = extractWaitTime(errorMessage);

          // Add exponential backoff multiplier
          const backoffMultiplier = Math.pow(1.5, attempt - 1);
          waitTime = Math.ceil(waitTime * backoffMultiplier);

          console.log(`[OpenAI] Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
          await sleep(waitTime);
          continue; // Retry
        }

        // Max retries exceeded, return the error response
        return response;
      }

      // Other error, return response for caller to handle
      return response;

    } catch (error) {
      lastError = error;
      console.error(`[OpenAI] Network error on attempt ${attempt}/${maxRetries}:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff for network errors
        const waitTime = 1000 * Math.pow(2, attempt - 1);
        console.log(`[OpenAI] Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await sleep(waitTime);
        continue;
      }
    }
  }

  // All retries failed
  throw lastError || new Error('OpenAI API call failed after retries');
}

/**
 * Format rate limit error for user display
 */
export function formatRateLimitError(errorMessage: string): string {
  const waitTime = extractWaitTime(errorMessage);
  const waitSeconds = Math.ceil(waitTime / 1000);

  return `⏱️ OpenAI rate limit reached. The system is automatically retrying your request in ${waitSeconds} seconds.\n\nThis happens when there's high usage. Your query will be processed shortly.`;
}
