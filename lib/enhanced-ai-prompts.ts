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
- System.IterationPath - Sprint/Iteration (use CONTAINS or UNDER for hierarchical search)
- System.AreaPath - Team/Area (use CONTAINS or UNDER for hierarchical search)

## CRITICAL - Sprint/Iteration Queries:
⚠️ SPRINTS = ITERATIONS in Azure DevOps! Always use System.IterationPath for sprint queries.
- When users ask about "sprint", "iteration", "sprint velocity", or "current sprint", use System.IterationPath
- Sprint queries MUST filter by [System.IterationPath] field
- For "current sprint" or "latest sprint": [System.IterationPath] CONTAINS 'Sprint' AND [System.State] <> 'Closed'
- For specific sprint (e.g., "Sprint 2025.11.12"): [System.IterationPath] CONTAINS '2025.11.12'
- Sprint paths follow format: ProjectName\\Sprint Name

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

Sprint: "this sprint" or "current iteration"
→ SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.IterationPath] CONTAINS 'Sprint' AND [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC

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

  return `CONTEXT: Overall Project Status (all non-closed items)
- Total non-closed items: ${contextSummary.totalNonClosed}
- By Priority: P1=${contextSummary.byPriority.p1}, P2=${contextSummary.byPriority.p2}, P3=${contextSummary.byPriority.p3}, P4=${contextSummary.byPriority.p4}
- By Type: ${Object.entries(contextSummary.byType).map(([type, count]) => `${type}=${count}`).join(', ')}
- By State: ${Object.entries(contextSummary.byState).map(([state, count]) => `${state}=${count}`).join(', ')}${filterContext}

SEARCH RESULTS: Found ${contextSummary.searchResults} matching items
${itemsList}

Based on this context, provide a helpful, conversational answer. If asked about priorities or urgency, focus on P1 and P2 items. Be specific and reference actual work item IDs when relevant.`;
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
