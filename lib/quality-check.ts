/**
 * Quality Check System
 * Validates AI responses against actual data to prevent hallucinations
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface QualityCheckInput {
  userQuery: string;
  aiResponse: string;
  actualData?: string; // The actual search results or data context
  collectionType?: string;
  collectionData?: any;
}

export interface QualityCheckResult {
  isAccurate: boolean;
  correctedResponse?: string;
  issues?: string[];
}

/**
 * Quality check system prompt - instructs AI to validate responses
 */
const QUALITY_CHECK_SYSTEM_PROMPT = `You are a quality assurance validator for AI responses about Azure DevOps data.

## Your Role

Your job is to verify that an AI assistant's response accurately reflects the actual data provided. You must:

1. **Compare the AI's response against the actual data**
2. **Identify any inaccuracies, hallucinations, or contradictions**
3. **Correct the response if needed**

## Common Issues to Check

- **Count mismatches**: AI says "no items" but data shows 5 items
- **Missing items**: AI doesn't mention items that are in the data
- **Wrong attributes**: AI mentions wrong priority, state, or assignee
- **Fabricated information**: AI mentions items not in the data
- **Contradictions**: AI summary contradicts the data shown

## Your Response Format

If the response is ACCURATE:
\`\`\`json
{
  "isAccurate": true,
  "issues": []
}
\`\`\`

If the response has ISSUES:
\`\`\`json
{
  "isAccurate": false,
  "correctedResponse": "The corrected response text here...",
  "issues": ["Issue 1: AI said X but data shows Y", "Issue 2: ..."]
}
\`\`\`

## Important Rules

- **Preserve formatting**: Keep the AI's markdown formatting, tone, and style
- **Only fix inaccuracies**: Don't rewrite the entire response unless necessary
- **Be specific**: In the correctedResponse, make minimal changes to fix the issues
- **Maintain context**: Keep helpful explanations and suggestions from the original

Your response MUST be valid JSON only, nothing else.`;

/**
 * Validates an AI response against actual data
 * Returns corrected response if inaccuracies are found
 */
export async function validateResponse(input: QualityCheckInput): Promise<QualityCheckResult> {
  try {
    console.log('[Quality Check] Starting validation...');

    // Build the validation prompt
    let validationPrompt = `## User's Original Question
"${input.userQuery}"

## AI Assistant's Response
${input.aiResponse}

## Actual Data Context
${input.actualData || 'No specific data context provided'}`;

    // Add collection data if available
    if (input.collectionType && input.collectionData) {
      validationPrompt += `\n\n## Collection Data (${input.collectionType})
${JSON.stringify(input.collectionData, null, 2)}`;
    }

    validationPrompt += `\n\n## Your Task
Validate the AI assistant's response against the actual data. Check for:
1. Count accuracy (if AI mentions numbers, do they match the data?)
2. Item accuracy (does AI mention items that exist in the data?)
3. Attribute accuracy (are priorities, states, assignees correct?)
4. No fabrications (AI doesn't mention items not in the data?)

Respond with JSON only.`;

    // Call Claude Haiku for fast validation (cheapest, fastest model)
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast and cheap for validation
      max_tokens: 2048,
      system: QUALITY_CHECK_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: validationPrompt,
        },
      ],
    });

    // Parse the response
    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    console.log('[Quality Check] Raw response:', responseText);

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const result: QualityCheckResult = JSON.parse(jsonText);

    if (result.isAccurate) {
      console.log('[Quality Check] ✅ Response is accurate');
    } else {
      console.log('[Quality Check] ❌ Issues found:', result.issues);
      console.log('[Quality Check] Corrected response length:', result.correctedResponse?.length || 0);
    }

    return result;

  } catch (error: any) {
    console.error('[Quality Check] Validation error:', error.message);
    // On error, assume response is accurate (fail open)
    return {
      isAccurate: true,
      issues: [`Quality check failed: ${error.message}`],
    };
  }
}

/**
 * Quick validation for simple cases (optional optimization)
 * Checks for obvious issues before doing full AI validation
 */
export function quickValidate(response: string, dataContext: string): { needsValidation: boolean; reason?: string } {
  // Check for obvious contradictions
  const hasNoItemsPhrase = /no\s+(work\s+)?items?|nothing\s+found|0\s+items?/i.test(response);
  const dataHasItems = /- #\d+:|"id":\s*\d+/i.test(dataContext);

  if (hasNoItemsPhrase && dataHasItems) {
    return {
      needsValidation: true,
      reason: 'Response says "no items" but data contains items',
    };
  }

  // Check for count mismatches
  const responseCountMatch = response.match(/\b(\d+)\s+(work\s+)?items?\b/i);
  const dataItemCount = (dataContext.match(/- #\d+:/g) || []).length;

  if (responseCountMatch && dataItemCount > 0) {
    const responseCounted = parseInt(responseCountMatch[1]);
    if (responseCounted === 0 && dataItemCount > 0) {
      return {
        needsValidation: true,
        reason: `Response mentions ${responseCounted} items but data has ${dataItemCount}`,
      };
    }
  }

  // No obvious issues
  return { needsValidation: false };
}
