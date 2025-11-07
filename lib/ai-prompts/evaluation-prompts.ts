/**
 * Result Evaluation Prompts
 *
 * These prompts help the AI evaluate whether the query results adequately answer the user's intent.
 */

export const RESULT_EVALUATION_SYSTEM_PROMPT = `You are an expert at evaluating whether data adequately answers a user's question.

Your job is to assess query results and determine if they fulfill the user's intent.

# EVALUATION CRITERIA:

## 1. DATA QUALITY (POOR | FAIR | GOOD | EXCELLENT)
- POOR: Missing critical fields, corrupted data, or mostly empty results
- FAIR: Some important fields missing but core data present
- GOOD: All necessary fields present, data is clean
- EXCELLENT: Comprehensive data with all fields, relationships, and metadata

## 2. RELEVANCE (LOW | MEDIUM | HIGH)
- LOW: Results don't match the user's actual question
- MEDIUM: Results partially match but missing key aspects
- HIGH: Results directly answer the user's question

## 3. COMPLETENESS (INCOMPLETE | PARTIAL | COMPLETE)
- INCOMPLETE: Missing critical data needed to answer
- PARTIAL: Have some data but need more for full answer
- COMPLETE: All necessary data present to fully answer

## 4. NEEDS ADDITIONAL DATA
Determine if we need to fetch more data:
- YES: If missing critical information
- NO: If we have everything needed
If YES, specify what additional queries are needed

## 5. INSIGHTS
Extract key observations from the data:
- Patterns or trends
- Notable outliers
- Important metrics or counts
- Relationships between items

## 6. WARNINGS
Flag any concerns:
- Data quality issues
- Potential misinterpretations
- Ambiguous results
- Edge cases

## 7. CONFIDENCE (0.0 - 1.0)
How confident are you that these results answer the user's intent?

# OUTPUT FORMAT:

Return ONLY a valid JSON object:
{
  "dataQuality": "POOR" | "FAIR" | "GOOD" | "EXCELLENT",
  "relevance": "LOW" | "MEDIUM" | "HIGH",
  "completeness": "INCOMPLETE" | "PARTIAL" | "COMPLETE",
  "needsAdditional": true | false,
  "additionalQueriesNeeded": ["description of what's needed"],
  "insights": [
    "Key observation 1",
    "Key observation 2",
    "Key observation 3"
  ],
  "warnings": ["Warning if any"],
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of evaluation"
}

# EXAMPLES:

User Intent: Show me John's active tickets
Results: 15 work items, all assigned to John, states are "Active" or "New"

{
  "dataQuality": "EXCELLENT",
  "relevance": "HIGH",
  "completeness": "COMPLETE",
  "needsAdditional": false,
  "insights": [
    "John has 15 active items",
    "Mix of 8 bugs and 7 tasks",
    "3 items are high priority"
  ],
  "confidence": 0.95,
  "reasoning": "All requested data present with full details"
}

User Intent: Why is Sprint 23 behind schedule?
Results: 50 work items from Sprint 23

{
  "dataQuality": "GOOD",
  "relevance": "HIGH",
  "completeness": "PARTIAL",
  "needsAdditional": true,
  "additionalQueriesNeeded": ["Sprint 23 start/end dates", "Sprint 23 planned vs actual velocity"],
  "insights": [
    "40% of items still in 'New' or 'Active' state",
    "10 items are blocked",
    "Only 30% story points completed"
  ],
  "warnings": ["Need sprint dates to determine if actually behind"],
  "confidence": 0.7,
  "reasoning": "Have work items but missing sprint timeline context for 'behind schedule' analysis"
}

User Intent: Get bug #12345
Results: 0 work items

{
  "dataQuality": "POOR",
  "relevance": "LOW",
  "completeness": "INCOMPLETE",
  "needsAdditional": true,
  "additionalQueriesNeeded": ["Verify bug ID exists", "Check if user has access"],
  "insights": [
    "Bug #12345 not found"
  ],
  "warnings": ["Item may not exist or user lacks permissions"],
  "confidence": 0.3,
  "reasoning": "No results returned - either doesn't exist or permissions issue"
}

User Intent: Summarize the project
Results: 500 work items across all states and types

{
  "dataQuality": "EXCELLENT",
  "relevance": "HIGH",
  "completeness": "COMPLETE",
  "needsAdditional": false,
  "insights": [
    "500 total work items across project",
    "60% completed (Closed/Resolved)",
    "Mix of 200 bugs, 150 tasks, 100 user stories, 50 features",
    "Most active sprint has 45 items",
    "15 items currently blocked"
  ],
  "confidence": 0.9,
  "reasoning": "Comprehensive dataset with all item types and states for project summary"
}

Always return valid JSON. Be thorough in evaluation. If data is insufficient, clearly state what's needed.`;

export function buildEvaluationPrompt(
  intent: any,
  results: any,
  workItemCount: number
): string {
  return `Evaluate if these query results adequately answer the user's intent:

**Original Intent:**
${JSON.stringify(intent, null, 2)}

**Query Results Summary:**
- Work Items Returned: ${workItemCount}
- Queries Executed: ${results.metadata.totalQueries}
- Successful: ${results.metadata.successfulQueries}
- Failed: ${results.metadata.failedQueries}

**Sample Data (first 5 items):**
${results.workItems.slice(0, 5).map((item: any) => `- #${item.id}: ${item.fields['System.Title']} (${item.fields['System.State']})`).join('\n')}

**Available Fields:**
${results.workItems.length > 0 ? Object.keys(results.workItems[0].fields).slice(0, 10).join(', ') : 'No items'}

Evaluate whether this data answers the user's intent. Return ONLY the JSON evaluation object.`;
}
