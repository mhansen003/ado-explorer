import { NextRequest, NextResponse } from 'next/server';
import { WorkItem } from '@/types';
import { callOpenAIWithRetry, isRateLimitError, formatRateLimitError } from '@/lib/openai-utils';

export async function POST(request: NextRequest) {
  try {
    const { workItems, query } = await request.json() as { workItems: WorkItem[]; query: string };

    const openaiKey = process.env.OPENAI_API_KEY;

    // Use gpt-4o-mini for suggestions (6.7x higher rate limit, 60x cheaper)
    const model = process.env.OPENAI_USE_MINI !== 'false' ? 'gpt-4o-mini' : 'gpt-4o';

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not found.' },
        { status: 500 }
      );
    }

    // Analyze work items to generate smart suggestions
    const workItemSummary = {
      total: workItems.length,
      types: Array.from(new Set(workItems.map(item => item.type))),
      states: Array.from(new Set(workItems.map(item => item.state))),
      priorities: Array.from(new Set(workItems.map(item => `P${item.priority}`))),
      assignees: Array.from(new Set(workItems.map(item => item.assignedTo))).slice(0, 5),
      projects: Array.from(new Set(workItems.map(item => item.project))).slice(0, 3),
      tags: Array.from(new Set(workItems.flatMap(item => item.tags || []))).slice(0, 5),
    };

    const prompt = `You are an Azure DevOps query assistant. Based on this search and results, suggest 3-4 follow-up queries that would be useful.

Original Query: "${query}"

Results Summary:
- Total items: ${workItemSummary.total}
- Types: ${workItemSummary.types.join(', ')}
- States: ${workItemSummary.states.join(', ')}
- Priorities: ${workItemSummary.priorities.join(', ')}
- Top Assignees: ${workItemSummary.assignees.join(', ')}
- Projects: ${workItemSummary.projects.join(', ')}
${workItemSummary.tags.length > 0 ? `- Tags: ${workItemSummary.tags.join(', ')}` : ''}

Generate 3-4 natural language follow-up queries that:
1. Drill down into specific aspects (e.g., filter by state, assignee, priority)
2. Explore related areas (e.g., similar tags, related projects)
3. Provide different perspectives (e.g., "show high priority items", "items assigned to X")

Return ONLY a JSON array of strings, each being a complete natural language query.
Example: ["show me only the bugs", "filter by high priority items", "show items assigned to John"]

Keep queries short (5-8 words) and actionable.`;

    const openaiResponse = await callOpenAIWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model, // Use gpt-4o-mini by default for better rate limits
          messages: [
            {
              role: 'system',
              content: 'You are a helpful Azure DevOps assistant that generates follow-up query suggestions. Always respond with valid JSON arrays only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      },
      3 // Max 3 retries
    );

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      const errorMessage = openaiData.error?.message || 'OpenAI API error';

      // Check if it's a rate limit error
      if (isRateLimitError(openaiData)) {
        throw new Error(`RATE_LIMIT:${errorMessage}`);
      }

      throw new Error(errorMessage);
    }

    const suggestionsText = openaiData.choices[0].message.content.trim();

    // Parse the JSON response
    let suggestions: string[];
    try {
      suggestions = JSON.parse(suggestionsText);
    } catch (parseError) {
      // Fallback: extract suggestions from text
      suggestions = suggestionsText
        .split('\n')
        .filter((line: string) => line.trim().length > 0 && !line.includes('[') && !line.includes(']'))
        .map((line: string) => line.replace(/^["'\-\*\d\.\)]\s*/, '').replace(/["']$/, '').trim())
        .filter((line: string) => line.length > 0)
        .slice(0, 4);
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 4) });
  } catch (error: any) {
    console.error('[Suggestions API] Error:', error.message);

    // Check if it's a rate limit error
    if (error.message?.startsWith('RATE_LIMIT:') || isRateLimitError(error.message)) {
      const errorMessage = error.message.replace('RATE_LIMIT:', '');
      const conversationalError = formatRateLimitError(errorMessage);

      return NextResponse.json(
        {
          suggestions: [],
          error: 'OpenAI rate limit',
          rateLimitError: true,
          message: conversationalError,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
