/**
 * Intelligent Query Processor
 * Three-stage architecture: Analyze → Fetch → Summarize
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface QueryAnalysis {
  needsAdoData: boolean;
  searchCriteria?: {
    projectName?: string;
    status?: string;
    workItemType?: string;
    tags?: string[];
    assignedTo?: string;
    searchText?: string;
    priority?: number;
  };
  intent: string;
  requiresSummary: boolean;
}

export interface ProcessedResponse {
  summary: string;
  insights: string[];
  data?: any;
}

/**
 * Stage 1: Analyze user query to determine what ADO data is needed
 */
export async function analyzeQuery(userQuery: string, conversationHistory: any[]): Promise<QueryAnalysis> {
  console.log('[Query Processor] Analyzing user query for data needs...');

  const prompt = `Analyze this user query to determine what Azure DevOps data is needed.

User Query: "${userQuery}"

Recent conversation context:
${conversationHistory.slice(-4).map(m => `${m.role}: ${m.content.substring(0, 200)}`).join('\n')}

## Your Task

Determine if this query needs Azure DevOps data, and if so, extract the search criteria.

## Response Format (JSON only)

{
  "needsAdoData": boolean,
  "searchCriteria": {
    "projectName": "extracted project name or null",
    "status": "Active|Blocked|Closed|etc or null",
    "workItemType": "Bug|Task|User Story|etc or null",
    "tags": ["tag1", "tag2"] or null,
    "assignedTo": "person name or null",
    "searchText": "text to search in title/description or null",
    "priority": 1-4 or null
  },
  "intent": "Brief description of what user wants",
  "requiresSummary": boolean (true if user wants analysis/summary)
}

## Examples

Query: "hello, can you talk to me about the ccw project and give me a summary of the blocked tickets"
Response: {
  "needsAdoData": true,
  "searchCriteria": {
    "projectName": "ccw",
    "status": "Blocked",
    "workItemType": null,
    "tags": null,
    "assignedTo": null,
    "searchText": "ccw",
    "priority": null
  },
  "intent": "Get blocked tickets in CCW project and provide analysis",
  "requiresSummary": true
}

Query: "what are the P1 bugs?"
Response: {
  "needsAdoData": true,
  "searchCriteria": {
    "projectName": null,
    "status": null,
    "workItemType": "Bug",
    "tags": null,
    "assignedTo": null,
    "searchText": null,
    "priority": 1
  },
  "intent": "Find all P1 priority bugs",
  "requiresSummary": false
}

Query: "thanks for your help!"
Response: {
  "needsAdoData": false,
  "searchCriteria": null,
  "intent": "User expressing gratitude",
  "requiresSummary": false
}

Respond with JSON only.`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022', // Fast and cheap for analysis
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response
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

  const analysis: QueryAnalysis = JSON.parse(jsonText);

  console.log('[Query Processor] Analysis result:', {
    needsAdoData: analysis.needsAdoData,
    intent: analysis.intent,
    requiresSummary: analysis.requiresSummary,
  });

  return analysis;
}

/**
 * Stage 3: Generate intelligent summary of fetched data
 */
export async function generateIntelligentSummary(
  userQuery: string,
  data: any,
  analysis: QueryAnalysis
): Promise<ProcessedResponse> {
  console.log('[Query Processor] Generating intelligent summary...');

  const prompt = `You are analyzing Azure DevOps work items to provide an intelligent summary.

User Query: "${userQuery}"
User Intent: ${analysis.intent}

Data Retrieved:
${JSON.stringify(data, null, 2)}

## Your Task

Provide an intelligent, contextual summary that:
1. Directly answers the user's question
2. Highlights key insights (recent activity, system relationships, priorities, etc.)
3. Provides context about project health or status
4. Mentions any notable patterns or concerns

## Response Format (JSON only)

{
  "summary": "2-3 sentence overview directly answering the question",
  "insights": [
    "Insight 1: Notable pattern or observation",
    "Insight 2: System relationships or dependencies",
    "Insight 3: Project health indicator",
    "Insight 4: Any concerns or priorities"
  ]
}

## Example

Query: "tell me about the CCW project blocked tickets"
Data: 5 blocked tickets, last updated 2 days ago, related to payment system

Response: {
  "summary": "The CCW project currently has 5 blocked tickets. Most were blocked recently (within the last 2 days), indicating active work that hit obstacles. These tickets are primarily related to the payment system integration.",
  "insights": [
    "Recent Activity: All 5 tickets were updated in the last 48 hours, showing active development",
    "System Dependencies: 4 out of 5 blocked tickets relate to payment system integration",
    "Priority Distribution: 3 are P1 (critical), 2 are P2, requiring immediate attention",
    "Team Impact: John Smith is assigned to 3 of the blocked items, may need support"
  ]
}

Respond with JSON only.`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON
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

  const processed: ProcessedResponse = JSON.parse(jsonText);
  processed.data = data; // Include raw data

  console.log('[Query Processor] Generated summary with', processed.insights.length, 'insights');

  return processed;
}
