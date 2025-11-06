/**
 * AI Suggestion Generator
 * Generates contextual follow-up suggestions based on conversation history and results
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface SuggestionContext {
  userQuery: string;
  assistantResponse: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  collectionType?: string;
  resultCount?: number;
}

/**
 * Generate 3-4 contextual follow-up suggestions
 */
export async function generateSuggestions(context: SuggestionContext): Promise<string[]> {
  try {
    const { userQuery, assistantResponse, conversationHistory, collectionType, resultCount } = context;

    // Build conversation context
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = '\n\nPrevious conversation:\n';
      // Take last 4 messages for context (2 exchanges)
      const recentHistory = conversationHistory.slice(-4);
      recentHistory.forEach(msg => {
        conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 200)}...\n`;
      });
    }

    // Build result context
    let resultContext = '';
    if (collectionType) {
      resultContext = `\nThe query returned ${resultCount || 0} ${collectionType}.`;
    }

    const prompt = `You are helping generate follow-up suggestions for an Azure DevOps chat assistant. Based on the user's question and the assistant's response, suggest 3-4 natural follow-up questions the user might want to ask next.

User's Question: "${userQuery}"

Assistant's Response: "${assistantResponse.substring(0, 500)}..."
${resultContext}
${conversationContext}

Generate 3-4 follow-up suggestions that:
1. **Build on the current context** - Dig deeper into the results shown
2. **Are actionable** - User can click and immediately get useful results
3. **Are specific** - Reference actual data points from the response (e.g., project names, team names, user names)
4. **Are diverse** - Cover different angles (filter, analyze, related data)
5. **Are concise** - Max 8-10 words each

Examples of GOOD suggestions:
- "Show marketing team's active bugs"
- "What's in the current sprint for E-Commerce?"
- "List all P1 items assigned to Sarah"
- "Show velocity for the last 3 sprints"

Examples of BAD suggestions (too generic):
- "Tell me more"
- "Show me other things"
- "What else can you do?"

IMPORTANT: Return ONLY the suggestions as a JSON array of strings, nothing else.

Format: ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"]`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Use Haiku for fast, cheap suggestions
      max_tokens: 300,
      temperature: 0.7, // Some creativity for varied suggestions
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    // Extract text from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.error('[Suggestion Generator] No text content in response');
      return [];
    }

    // Parse JSON array
    const suggestionsText = textContent.text.trim();

    // Try to find JSON array in the response
    const jsonMatch = suggestionsText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[Suggestion Generator] Could not find JSON array in response:', suggestionsText);
      return [];
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(suggestions)) {
      console.error('[Suggestion Generator] Response is not an array:', suggestions);
      return [];
    }

    console.log('[Suggestion Generator] Generated suggestions:', suggestions);
    return suggestions.slice(0, 4); // Max 4 suggestions

  } catch (error: any) {
    console.error('[Suggestion Generator] Error:', error.message);
    // Return fallback suggestions
    return generateFallbackSuggestions(context.userQuery);
  }
}

/**
 * Fallback suggestions if AI generation fails
 */
function generateFallbackSuggestions(userQuery: string): string[] {
  const lowerQuery = userQuery.toLowerCase();

  // Generic but useful fallbacks based on query type
  if (lowerQuery.includes('project')) {
    return [
      'Show teams in the first project',
      'List active work items by project',
      'Show all users in projects',
    ];
  }

  if (lowerQuery.includes('team')) {
    return [
      'Show active work items by team',
      'List team members and assignments',
      'Show team velocity over time',
    ];
  }

  if (lowerQuery.includes('user') || lowerQuery.includes('people')) {
    return [
      'Show work items by assignee',
      'List active tasks by user',
      'Show who created the most items',
    ];
  }

  if (lowerQuery.includes('bug') || lowerQuery.includes('active')) {
    return [
      'Show P1 and P2 items only',
      'Group bugs by assignee',
      'Show bugs created this week',
    ];
  }

  // Generic fallbacks
  return [
    'Show active work items by priority',
    'List all projects and teams',
    'Show items created this week',
    'What\'s in the current sprint?',
  ];
}
