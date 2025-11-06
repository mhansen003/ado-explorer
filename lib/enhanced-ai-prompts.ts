/**
 * Enhanced AI Prompt Engineering for ADO Explorer
 *
 * This module provides improved prompt templates and context building
 * for more human-friendly and accurate AI responses.
 */

import { WorkItem, GlobalFilters } from '@/types';

/**
 * System prompt for WIQL query generation with enhanced context awareness
 */
export const WIQL_GENERATION_SYSTEM_PROMPT = `You are an Azure DevOps WIQL (Work Item Query Language) expert with deep understanding of agile workflows and team dynamics.

Your role is to convert natural, human language questions into precise WIQL queries while understanding the user's intent.

## Core Capabilities
- Understand casual language and team jargon
- Recognize implicit requests (e.g., "what's urgent?" means P1/P2 items)
- Handle typos and informal phrasing gracefully
- Infer context from partial information

## WIQL Query Format:
SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [conditions] ORDER BY [field]

## CRITICAL RULES:
- DO NOT use TOP clause in SELECT statement (not supported in WIQL syntax)
- DO NOT filter by System.TeamProject - queries are already scoped to a single project
- When users mention "projects" in their query, search System.Title or System.Description instead
- ALWAYS prioritize user intent over literal interpretation

## Common Fields (in order of usefulness):
- System.Title - Work item title (use CONTAINS for text search)
- System.Description - Work item description (use CONTAINS for text search)
- System.State - State (use = for exact match: New, Active, Resolved, Closed)
- System.WorkItemType - Type (use = for exact match: Bug, Task, User Story, Epic, Feature)
- System.Tags - Tags (use CONTAINS)
- System.AssignedTo - Assigned person (use CONTAINS for name search)
- System.CreatedBy - Creator (use CONTAINS for name search)
- System.ChangedDate - Last modified date (use >=, <=, or = with @Today)
- System.CreatedDate - Creation date (use >=, <=, or = with @Today)
- Microsoft.VSTS.Common.Priority - Priority (1=highest, 4=lowest) (use = or < or >)
- System.IterationPath - Sprint/Iteration (use ONLY UNDER or = - NEVER CONTAINS!)
- System.AreaPath - Team/Area (use UNDER for hierarchical search)

## ⚠️ CRITICAL - Sprint/Iteration Path Rules (MUST FOLLOW):
AZURE DEVOPS DOES NOT ALLOW CONTAINS OPERATOR ON ITERATIONPATH!

**ONLY THESE OPERATORS ARE ALLOWED FOR System.IterationPath:**
1. UNDER - For hierarchical matching (RECOMMENDED)
2. = - For exact path match

**NEVER USE:**
- ❌ CONTAINS - Will cause 400 error!
- ❌ Multiple CONTAINS on IterationPath
- ❌ Partial path matching with CONTAINS

**Sprint Query Patterns:**

For "current sprint" or "latest sprint":
✅ Use: [System.IterationPath] UNDER 'ProjectName'
(Returns all items in all sprints, then filter by date in application)

For "sprint in Marketing" or "Marketing sprint":
✅ Use: [System.IterationPath] UNDER 'ProjectName\\\\Marketing Experience'
(UNDER matches the path and all children - note the double backslashes)

For specific sprint by name:
✅ Use: [System.IterationPath] = 'ProjectName\\\\Marketing Experience\\\\Sprint 23'
(Exact match to full path)

**Sprint paths use backslash separator:** ProjectName\\AreaPath\\SprintName
Example: Next Gen LOS\\Marketing Experience\\MX Sprint 2025.11.12 (23)

## Operators:
- CONTAINS - For text search in Title, Description, AssignedTo, CreatedBy, Tags
- = - Exact match for State, WorkItemType, Priority
- >= / <= / < / > - Date/number comparison
- @Today - Current date
- UNDER - Hierarchical path matching for AreaPath and IterationPath

## Human Language Interpretation Examples:

Casual: "what's broken?"
→ SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC

Urgent: "show me urgent stuff" or "what needs attention?"
→ SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [Microsoft.VSTS.Common.Priority] <= 2 AND [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC

Time-based: "recent work" or "what's new?"
→ SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.CreatedDate] >= @Today - 7 ORDER BY [System.CreatedDate] DESC

Team member: "john's tickets" or "what is sarah working on?"
→ SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.AssignedTo] CONTAINS 'john' OR [System.AssignedTo] CONTAINS 'sarah' AND [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC

Sprint: "this sprint" or "current iteration" or "sprint items"
→ SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.IterationPath] <> '' AND [System.State] <> 'Closed' ORDER BY [System.ChangedDate] DESC
(Note: Returns items with any sprint. For specific sprint, need exact path)

Sprint in area: "marketing sprint" or "sprint in marketing"
→ SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.IterationPath] UNDER 'Next Gen LOS\\Marketing Experience' AND [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC

⚠️ REMEMBER: NEVER use CONTAINS with IterationPath - only UNDER or = !

Respond ONLY with the WIQL query, nothing else.`;

/**
 * System prompt for conversational answer generation
 */
export const CONVERSATIONAL_ANSWER_SYSTEM_PROMPT = `You are a helpful, friendly Azure DevOps assistant who speaks naturally and clearly.

## Your Personality:
- Professional but approachable
- Concise but thorough
- Use emojis sparingly for emphasis (📋 for lists, 🔥 for urgent, ✅ for done)
- Speak in natural sentences, not bullet points (unless listing items)
- Acknowledge context and user's implicit questions

## CRITICAL RULE - MOST IMPORTANT:
**YOU MUST ONLY DISCUSS THE ITEMS IN THE "SEARCH RESULTS" SECTION.**

Do NOT make statements about items that are not explicitly listed in the search results, even if you see broader project statistics in the background context. The background context is provided ONLY for reference to help you understand priorities and relative importance.

When the user asks "how many blocked items?", count ONLY the items in the search results. When they ask "what bugs are there?", list ONLY the bugs from search results. NEVER say "there are no items" when the search results show items.

## Guidelines:
1. **Start with a direct answer** - Don't make users wait for the point
2. **Provide context** - Help users understand the bigger picture
3. **Suggest next steps** - What should they do with this information?
4. **Be specific** - Reference actual work item IDs and details
5. **Acknowledge priorities** - P1 is highest priority, P4 is lowest
6. **Think like a team member** - Understand agile workflow and team dynamics

## Response Structure:
1. Direct answer to their question (1-2 sentences)
2. Key findings or insights (2-3 sentences with specifics)
3. Context or recommendations (1-2 sentences)

## Examples:

Question: "What are the urgent bugs?"
Good: "You have 3 urgent bugs that need attention right now. Two are P1s (#12345 and #12347) related to authentication, and one P2 (#12350) is a UI issue. I'd recommend tackling the auth bugs first since they're blocking users."

Bad: "Here are the urgent bugs: Bug #12345 - Auth failure, Bug #12347 - Login timeout, Bug #12350 - Button misaligned"

Question: "What's John working on?"
Good: "John has 5 active items on his plate. He's primarily focused on the payment gateway integration (#12400) and fixing a critical P1 bug (#12399). The other 3 tasks are lower priority backlog items that can wait."

Bad: "John has: Task #12400, Bug #12399, Task #12401, Task #12402, Task #12403"

Remember: Priority helps determine urgency (P1 > P2 > P3 > P4)`;

/**
 * System prompt for analytics interpretation
 */
export const ANALYTICS_SYSTEM_PROMPT = `You are an expert Agile/Scrum analytics consultant with deep knowledge of velocity, burndown, and team performance metrics.

## Context Understanding:
- In Azure DevOps, Sprints = Iterations (same thing, different names)
- Tickets are assigned to sprints via the Iteration Path field
- Sprint velocity = story points completed in an iteration
- Story points measure complexity/effort, not time

## Your Analysis Should:
1. **Directly address the user's question** with the metric they asked for
2. **Cite specific numbers** from the data (use iteration names from the data)
3. **Identify trends** - Is velocity increasing, decreasing, or stable?
4. **Provide 2-3 actionable recommendations** based on the data
5. **Use clear, business-friendly language** - avoid jargon unless necessary
6. **Format with markdown** for readability (use **bold** for numbers, bullet points for lists)

## Response Structure:
1. **Key Metric** (2-3 sentences with the main answer)
2. **Trend Analysis** (2-3 sentences about patterns)
3. **Recommendations** (2-3 bullet points with actionable advice)

## Example:

Question: "What's our sprint velocity?"
Good: "Your team's velocity has been averaging **42 story points** per sprint over the last 3 iterations. Sprint 2025.11.12 delivered **45 points**, Sprint 2025.10.29 completed **38 points**, and Sprint 2025.10.15 finished with **43 points**.

The velocity is relatively stable with a slight upward trend (+8% from 2 sprints ago), which suggests good consistency in your estimates and delivery. However, Sprint 2025.10.29 had a dip that's worth investigating.

**Recommendations:**
• Continue current sprint planning approach - your estimates are tracking well
• Review what happened in Sprint 2025.10.29 to understand the velocity drop
• Consider increasing capacity slightly given the upward trend, but be conservative"

Keep responses focused and concise (3-5 paragraphs maximum).`;

/**
 * Build enhanced context for AI query understanding
 */
export function buildEnhancedContext(
  allWorkItems: WorkItem[],
  searchResults: WorkItem[],
  filters?: GlobalFilters
): string {
  const contextSummary = {
    totalNonClosed: allWorkItems.length,
    byPriority: {
      p1: allWorkItems.filter(i => i.priority === 1).length,
      p2: allWorkItems.filter(i => i.priority === 2).length,
      p3: allWorkItems.filter(i => i.priority === 3).length,
      p4: allWorkItems.filter(i => i.priority === 4).length,
    },
    byType: {} as Record<string, number>,
    byState: {} as Record<string, number>,
    searchResults: searchResults.length,
  };

  // Count by type and state
  allWorkItems.forEach(item => {
    contextSummary.byType[item.type] = (contextSummary.byType[item.type] || 0) + 1;
    contextSummary.byState[item.state] = (contextSummary.byState[item.state] || 0) + 1;
  });

  // Prepare detailed items list
  const detailedItems = searchResults.length > 0
    ? searchResults.slice(0, 30) // Show up to 30 search results
    : allWorkItems.slice(0, 50); // If no search results, show top 50 by priority

  const itemsList = detailedItems.map(item =>
    `- #${item.id}: ${item.title} (${item.type}, ${item.state}, P${item.priority}${item.assignedTo ? `, assigned to ${item.assignedTo}` : ''}${item.tags && item.tags.length > 0 ? `, tags: ${item.tags.join(', ')}` : ''})`
  ).join('\n');

  // Build filter context
  let filterContext = '';
  if (filters) {
    const activeFilters: string[] = [];
    if (filters.ignoreClosed) activeFilters.push('ignoring closed tickets');
    if (filters.ignoreStates?.length) activeFilters.push(`excluding states: ${filters.ignoreStates.join(', ')}`);
    if (filters.onlyMyTickets && filters.currentUser) activeFilters.push(`only showing tickets for ${filters.currentUser}`);
    if (filters.ignoreOlderThanDays) activeFilters.push(`ignoring tickets older than ${filters.ignoreOlderThanDays} days`);

    if (activeFilters.length > 0) {
      filterContext = `\n\n🔍 Active Filters: ${activeFilters.join(', ')}`;
    }
  }

  return `🔍 SEARCH RESULTS - YOUR ANSWER MUST BE BASED ON THESE ${contextSummary.searchResults} ITEMS ONLY:

${itemsList}
${filterContext}

───────────────────────────────────────────────────────────────────

📊 BACKGROUND CONTEXT (For reference only - DO NOT discuss these statistics unless directly relevant):
- Total non-closed items in entire project: ${contextSummary.totalNonClosed}
- Overall Priority Distribution: P1=${contextSummary.byPriority.p1}, P2=${contextSummary.byPriority.p2}, P3=${contextSummary.byPriority.p3}, P4=${contextSummary.byPriority.p4}
- Overall Type Distribution: ${Object.entries(contextSummary.byType).map(([type, count]) => `${type}=${count}`).join(', ')}
- Overall State Distribution: ${Object.entries(contextSummary.byState).map(([state, count]) => `${state}=${count}`).join(', ')}

───────────────────────────────────────────────────────────────────

⚠️ CRITICAL INSTRUCTION:
Base your answer EXCLUSIVELY on the ${contextSummary.searchResults} search results listed at the top. The background context is provided only to help you understand relative priorities and project scale - do NOT make statements about items that are not in the search results.

If the user asks "how many?" - count the search results.
If the user asks "what items?" - list the search results.
If there are ${contextSummary.searchResults} search results, do NOT say "there are no items".`;
}

/**
 * Generate user-friendly error message
 */
export function generateFriendlyError(
  error: string,
  originalPrompt: string
): string {
  // Detect common error types
  if (error.toLowerCase().includes('rate limit')) {
    return `⏱️ I'm getting rate limited by OpenAI right now (lots of usage!). The system is automatically retrying your request. Your query "${originalPrompt}" will be processed in just a moment.`;
  }

  if (error.toLowerCase().includes('no project')) {
    return `🔧 I need a project to be configured to search work items. It looks like the NEXT_PUBLIC_ADO_PROJECT environment variable isn't set.

You can either:
1. Set NEXT_PUBLIC_ADO_PROJECT to search a specific project
2. Or I can search across all projects (but WIQL queries need a project)

Can you check your environment configuration?`;
  }

  if (error.toLowerCase().includes('permission') || error.toLowerCase().includes('unauthorized')) {
    return `🔐 I don't have permission to access Azure DevOps right now. This usually means:

• The Personal Access Token (PAT) might be expired
• The PAT doesn't have the right permissions (needs "Work Items - Read")
• There might be a network connectivity issue

Could you verify your ADO_PAT environment variable is set correctly?`;
  }

  if (error.toLowerCase().includes('wiql') || error.toLowerCase().includes('query')) {
    return `❌ I had trouble understanding your query "${originalPrompt}".

Could you try rephrasing it? For example:
• "show me all bugs" instead of technical queries
• "john's tasks" instead of specific field names
• "urgent items" for priority-based searches

I'm still learning, so clearer language helps!`;
  }

  // Generic fallback
  return `❌ I encountered an error while trying to help with "${originalPrompt}".

**Error details:** ${error}

**What you can try:**
• Rephrase your question in simpler terms
• Check if you're asking for something that exists in your ADO project
• Try a more specific search (like "show me bugs" instead of "show me everything")

If this keeps happening, there might be a configuration issue.`;
}

/**
 * Suggest follow-up queries based on results
 */
export function generateFollowUpSuggestions(
  workItems: WorkItem[],
  originalQuery: string
): string[] {
  const suggestions: string[] = [];

  // No results - suggest broader searches
  if (workItems.length === 0) {
    suggestions.push("show me all active work items");
    suggestions.push("what are the most recent tickets?");
    return suggestions;
  }

  // Has results - suggest refinements
  const hasBugs = workItems.some(i => i.type === 'Bug');
  const hasMultiplePriorities = new Set(workItems.map(i => i.priority)).size > 1;
  const hasMultipleAssignees = new Set(workItems.map(i => i.assignedTo)).size > 1;
  const hasP1 = workItems.some(i => i.priority === 1);

  if (hasBugs && !originalQuery.toLowerCase().includes('bug')) {
    suggestions.push("show me just the bugs from these results");
  }

  if (hasP1) {
    suggestions.push("which of these are P1 priority?");
  }

  if (hasMultipleAssignees) {
    const topAssignee = workItems.reduce((acc, item) => {
      acc[item.assignedTo] = (acc[item.assignedTo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostCommon = Object.entries(topAssignee).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (mostCommon && mostCommon !== 'Unassigned') {
      suggestions.push(`what is ${mostCommon} working on?`);
    }
  }

  suggestions.push("create a chart to visualize this data");

  return suggestions.slice(0, 3); // Return top 3 suggestions
}

/**
 * Detect if a query is asking about sprints
 */
export function isSprintQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const sprintKeywords = [
    'sprint',
    'iteration',
    'current sprint',
    'last sprint',
    'latest sprint',
    'recent sprint',
    'this sprint',
    'sprint items',
    'sprint work',
    'what we working on',
  ];

  return sprintKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Build sprint-aware context for better WIQL generation
 */
export function buildSprintContext(
  projectName: string,
  availableSprints?: Array<{ name: string; path: string; timeFrame?: string }>
): string {
  if (!availableSprints || availableSprints.length === 0) {
    return `\n\n**Sprint Context:**
Project Name: ${projectName}
No sprint information available. Use generic sprint query: [System.IterationPath] <> ''`;
  }

  const currentSprint = availableSprints.find(s => s.timeFrame === 'current');
  const recentSprints = availableSprints.slice(0, 5);

  let context = `\n\n**Sprint Context for ${projectName}:**\n`;

  if (currentSprint) {
    context += `Current Sprint: "${currentSprint.name}"\n`;
    context += `Current Sprint Path: ${currentSprint.path}\n`;
  }

  if (recentSprints.length > 0) {
    context += `\nAvailable Sprints:\n`;
    recentSprints.forEach(sprint => {
      const marker = sprint.timeFrame === 'current' ? ' (CURRENT)' : '';
      context += `- "${sprint.name}"${marker} → Path: ${sprint.path}\n`;
    });
  }

  context += `\n**For sprint queries, use UNDER operator with the full path:**\n`;
  context += `Example: [System.IterationPath] UNDER '${currentSprint?.path || recentSprints[0]?.path || projectName}'\n`;
  context += `\n⚠️ NEVER use CONTAINS with IterationPath!`;

  return context;
}

/**
 * Validate and fix WIQL query to prevent CONTAINS on IterationPath
 * This is a safety check in case the AI still generates invalid queries
 */
export function validateAndFixWiqlQuery(
  wiqlQuery: string,
  projectName: string,
  availableSprints?: Array<{ name: string; path: string; timeFrame?: string }>
): { query: string; wasFixed: boolean; fixReason?: string } {
  // Check if query has CONTAINS with IterationPath (case insensitive)
  const containsIterationPathRegex = /\[System\.IterationPath\]\s+CONTAINS\s+'([^']+)'/gi;
  const matches = [...wiqlQuery.matchAll(containsIterationPathRegex)];

  if (matches.length === 0) {
    // Query is valid
    return { query: wiqlQuery, wasFixed: false };
  }

  console.warn('[WIQL Validator] Found invalid CONTAINS on IterationPath, attempting to fix...');

  // Try to fix the query
  let fixedQuery = wiqlQuery;
  let fixReason = '';

  for (const match of matches) {
    const fullMatch = match[0];
    const searchTerm = match[1];

    console.log(`[WIQL Validator] Fixing: ${fullMatch}`);

    // Try to find a matching sprint
    if (availableSprints && availableSprints.length > 0) {
      // Look for sprint that matches the search term
      const matchingSprint = availableSprints.find(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.path.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (matchingSprint) {
        // Replace with UNDER using the exact path
        const replacement = `[System.IterationPath] UNDER '${matchingSprint.path}'`;
        fixedQuery = fixedQuery.replace(fullMatch, replacement);
        fixReason = `Replaced CONTAINS with UNDER using sprint path: ${matchingSprint.path}`;
        console.log(`[WIQL Validator] Fixed using sprint: ${matchingSprint.name} → ${replacement}`);
        continue;
      }

      // Try to find by area/team name
      const matchingArea = availableSprints.find(s => {
        const pathParts = s.path.split('\\');
        return pathParts.some(part => part.toLowerCase().includes(searchTerm.toLowerCase()));
      });

      if (matchingArea) {
        // Use the parent path (remove last segment for area path)
        const pathParts = matchingArea.path.split('\\');
        const areaPath = pathParts.slice(0, -1).join('\\') || matchingArea.path;
        const replacement = `[System.IterationPath] UNDER '${areaPath}'`;
        fixedQuery = fixedQuery.replace(fullMatch, replacement);
        fixReason = `Replaced CONTAINS with UNDER using area path: ${areaPath}`;
        console.log(`[WIQL Validator] Fixed using area: ${areaPath} → ${replacement}`);
        continue;
      }
    }

    // Fallback: use generic sprint filter
    const replacement = `[System.IterationPath] <> ''`;
    fixedQuery = fixedQuery.replace(fullMatch, replacement);
    fixReason = `Replaced invalid CONTAINS with generic sprint filter (IterationPath not empty)`;
    console.log(`[WIQL Validator] Fixed using generic filter: ${replacement}`);
  }

  return {
    query: fixedQuery,
    wasFixed: true,
    fixReason,
  };
}
