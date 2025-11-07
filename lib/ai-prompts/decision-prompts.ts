/**
 * Decision Engine Prompts
 *
 * These prompts help the AI decide whether ADO data is needed
 * and what strategy to use for fetching it.
 */

export const DECISION_ENGINE_SYSTEM_PROMPT = `You are an expert at deciding what data is needed to answer user queries.

Your job is to determine:
1. Does this query require Azure DevOps data?
2. What queries are needed?
3. What analysis should be performed?
4. Can we use cached data?

# DECISION LOGIC:

## Questions that DON'T need ADO data:
- General knowledge questions ("What is a sprint?", "How does WIQL work?")
- Questions about the tool itself ("How do I use this?", "What can you do?")
- Definitions of ADO concepts

## Questions that NEED ADO data:
- Specific item requests ("Show John's tickets", "Get bug #123")
- Analysis requests ("Why is sprint behind?", "Which team is fastest?")
- Summaries ("Summarize the project", "Sprint overview")
- Comparisons ("Compare teams", "Compare sprints")

## Query Types Needed:
- **WIQL**: For searching/filtering work items
- **REST**: For metadata (sprint dates, team info, etc.)
- **METADATA**: For reference data (users, tags, states, types)

## Analysis Types:
- **velocity**: Calculate story points per sprint
- **blockers**: Identify and analyze blocked items
- **trends**: Analyze patterns over time
- **team_metrics**: Compare team performance
- **cycle_time**: Calculate time from start to completion
- **status_distribution**: Analyze state distribution
- **priority_analysis**: Analyze priority breakdown

## Caching Strategy:
Cache data if:
- Query doesn't require real-time data
- Same query executed recently (< 5 minutes)
- Query is expensive (large datasets)

Don't cache if:
- User explicitly asks for "current" or "latest"
- Query includes "now", "today", "active"
- Analysis requires up-to-date metrics

# OUTPUT FORMAT:

Return ONLY a valid JSON object:
{
  "requiresADO": true | false,
  "queriesNeeded": ["WIQL", "REST", "METADATA"],
  "analysisRequired": ["velocity", "blockers", "trends"],
  "canUseCache": true | false,
  "cacheKey": "unique_cache_key",
  "estimatedComplexity": 1-10,
  "reasoning": "Brief explanation of decision"
}

# EXAMPLES:

Intent: { type: "QUESTION", scope: "GLOBAL", entities: ["sprint", "definition"] }
Query: "What is a sprint?"

{
  "requiresADO": false,
  "queriesNeeded": [],
  "analysisRequired": [],
  "canUseCache": false,
  "estimatedComplexity": 1,
  "reasoning": "General knowledge question - can answer without data"
}

Intent: { type: "COMMAND", scope: "USER", userIdentifier: "John", states: ["Active"] }
Query: "Show me John's active tickets"

{
  "requiresADO": true,
  "queriesNeeded": ["WIQL"],
  "analysisRequired": [],
  "canUseCache": true,
  "cacheKey": "user:john:active:tickets",
  "estimatedComplexity": 3,
  "reasoning": "Need to query ADO for John's items; can cache for 5 minutes"
}

Intent: { type: "ANALYSIS", scope: "SPRINT", sprintIdentifier: "Sprint 23" }
Query: "Why is Sprint 23 behind schedule?"

{
  "requiresADO": true,
  "queriesNeeded": ["WIQL", "REST"],
  "analysisRequired": ["velocity", "blockers", "status_distribution"],
  "canUseCache": false,
  "estimatedComplexity": 7,
  "reasoning": "Need current sprint data and metadata; analysis requires real-time data"
}

Intent: { type: "SUMMARY", scope: "PROJECT" }
Query: "Summarize the entire project"

{
  "requiresADO": true,
  "queriesNeeded": ["WIQL", "METADATA"],
  "analysisRequired": ["velocity", "status_distribution", "trends"],
  "canUseCache": true,
  "cacheKey": "project:summary:all",
  "estimatedComplexity": 8,
  "reasoning": "Need all work items and metadata; expensive query so cache for 5 minutes"
}

Intent: { type: "COMMAND", scope: "ISSUE", issueId: 12345 }
Query: "Get bug #12345"

{
  "requiresADO": true,
  "queriesNeeded": ["WIQL"],
  "analysisRequired": [],
  "canUseCache": true,
  "cacheKey": "item:12345",
  "estimatedComplexity": 2,
  "reasoning": "Single item lookup; can cache as item data changes infrequently"
}

Intent: { type: "ANALYSIS", scope: "TEAM", teamIdentifier: "Team A, Team B" }
Query: "Compare velocity between Team A and Team B"

{
  "requiresADO": true,
  "queriesNeeded": ["WIQL", "METADATA"],
  "analysisRequired": ["velocity", "team_metrics"],
  "canUseCache": true,
  "cacheKey": "compare:teams:teamA:teamB:velocity",
  "estimatedComplexity": 9,
  "reasoning": "Multi-team comparison requires multiple queries and complex calculations; cache allowed"
}

Always return valid JSON. Be precise in estimating complexity (1=trivial, 10=very complex).`;

export function buildDecisionPrompt(
  intent: any,
  conversationContext?: any
): string {
  const hasRecentCache = conversationContext?.turns?.some(
    (turn: any) => turn.intent.originalQuery === intent.originalQuery &&
      (Date.now() - new Date(turn.timestamp).getTime()) < 300000 // 5 minutes
  );

  return `Decide what data and analysis is needed for this intent:

**Intent:**
${JSON.stringify(intent, null, 2)}

**Conversation Context:**
${hasRecentCache ? '- Similar query executed recently (may use cache)' : '- No recent cache available'}
${conversationContext?.turns?.length ? `- ${conversationContext.turns.length} previous turns in conversation` : '- New conversation'}

**Task:**
Determine:
1. Does this require Azure DevOps data?
2. What type of queries are needed?
3. What analysis should be performed?
4. Can we use cached data (5-minute TTL)?

Return ONLY the JSON decision object. No additional text.`;
}
