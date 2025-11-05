import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';
import { GlobalFilters } from '@/types';
import { callOpenAIWithRetry, isRateLimitError, formatRateLimitError } from '@/lib/openai-utils';
import {
  prepareAnalyticsSummary,
  calculateSprintVelocity,
  calculateTeamMetrics,
  analyzeVelocityTrends,
  calculateCycleTime,
} from '@/lib/analytics-utils';

export async function POST(request: NextRequest) {
  // Get environment variables outside try block so they're available in catch
  const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
  const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
  const pat = process.env.ADO_PAT;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Model configuration: Use gpt-4o-mini for simple tasks (lower cost, higher rate limits)
  // Set OPENAI_USE_MINI=false in .env to force gpt-4o for all calls
  const useMiniForSimpleTasks = process.env.OPENAI_USE_MINI !== 'false';
  const simpleTaskModel = useMiniForSimpleTasks ? 'gpt-4o-mini' : 'gpt-4o';
  const complexTaskModel = 'gpt-4o';

  // Parse request outside try block so prompt is available in catch
  let prompt = '';
  let filters: GlobalFilters | undefined;

  try {
    const body = await request.json() as {
      prompt: string;
      filters?: GlobalFilters;
    };
    prompt = body.prompt;
    filters = body.filters;

    console.log('[ADO Prompt API] Configuration:', {
      organization,
      hasProject: !!project,
      hasPAT: !!pat,
      hasOpenAI: !!openaiKey,
      prompt,
      filters: filters || 'NO FILTERS PROVIDED',
    });

    if (!organization || !pat) {
      return NextResponse.json(
        { error: 'ADO configuration not found.' },
        { status: 500 }
      );
    }

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not found. Please set OPENAI_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Step 1: Detect if this is an analytical query (velocity, trends, insights) vs a search query
    const analyticsDetectionResponse = await callOpenAIWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: simpleTaskModel,
        messages: [
          {
            role: 'system',
            content: `You are analyzing user queries to Azure DevOps. Determine if the user wants:
1. "SEARCH" - Find and list specific work items (bugs, tasks, stories)
2. "ANALYTICS" - Analyze metrics, trends, velocity, performance, insights

Analytical queries include words like: velocity, trend, performance, how fast, how many, analysis, metrics, throughput, cycle time, team performance, sprint progress, burn rate, comparison

Respond with ONLY "SEARCH" or "ANALYTICS".`,
          },
          {
            role: 'user',
            content: `Query: "${prompt}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 10,
      }),
    }, 3);

    const analyticsDetectionData = await analyticsDetectionResponse.json();
    const queryType = analyticsDetectionData.choices[0].message.content.trim().toUpperCase();
    const isAnalyticsQuery = queryType === 'ANALYTICS';

    console.log('[ADO Prompt API] Query type detected:', queryType);

    // Call OpenAI to interpret the prompt
    const messages = [
      {
        role: 'system',
        content: `You are an Azure DevOps WIQL (Work Item Query Language) expert. Your job is to convert natural language questions into WIQL queries.

WIQL Query Format:
SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [conditions] ORDER BY [field]

IMPORTANT RULES:
- Do NOT use TOP clause in SELECT statement (not supported in WIQL syntax)
- Do NOT filter by System.TeamProject - queries are already scoped to a single project
- When users mention "projects" in their query, search System.Title or System.Description instead

Common Fields (in order of usefulness):
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

IMPORTANT - Sprint/Iteration Queries:
- When users ask about "sprint", "iteration", or "current sprint", use System.IterationPath
- For "current sprint" or "latest sprint" queries, use: [System.IterationPath] CONTAINS 'Sprint' AND [System.State] <> 'Closed'
- For specific sprint: [System.IterationPath] UNDER 'ProjectName\\Sprint X'
- Sprint paths follow format: ProjectName\\Sprint X or ProjectName\\Release Y\\Sprint X

Operators:
- CONTAINS - For text search in Title, Description, AssignedTo, CreatedBy, Tags
- = - Exact match for State, WorkItemType, Priority
- >= / <= / < / > - Date/number comparison
- @Today - Current date
- UNDER - Hierarchical path matching for AreaPath and IterationPath

Examples:
Q: "Which tickets are talking about credit?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.Title] CONTAINS 'credit' OR [System.Description] CONTAINS 'credit' ORDER BY [System.ChangedDate] DESC

Q: "Show me all bugs assigned to John"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.AssignedTo] CONTAINS 'John' ORDER BY [System.ChangedDate] DESC

Q: "What tasks were created this week?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Task' AND [System.CreatedDate] >= @Today - 7 ORDER BY [System.CreatedDate] DESC

Q: "Show me all bob builder projects"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.Title] CONTAINS 'bob builder' OR [System.Description] CONTAINS 'bob builder' ORDER BY [System.ChangedDate] DESC

Q: "What are the most urgent issues?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC

Q: "Show me all P1 bugs"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [Microsoft.VSTS.Common.Priority] = 1 ORDER BY [System.ChangedDate] DESC

Q: "What are we working on this sprint?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.IterationPath] CONTAINS 'Sprint' AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC

Q: "Show me items in the current sprint"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.IterationPath] CONTAINS 'Sprint' AND [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC

Q: "What's in Sprint 5?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.IterationPath] CONTAINS 'Sprint 5' ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC

Q: "Show bugs in the latest sprint"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.IterationPath] CONTAINS 'Sprint' AND [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC

Respond ONLY with the WIQL query, nothing else.`,
      },
    ];

    // Add current user prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    const openaiResponse = await callOpenAIWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: simpleTaskModel, // Use gpt-4o-mini by default (6.7x higher rate limit, 60x cheaper)
        messages,
        temperature: 0.3,
        max_tokens: 200,
      }),
    }, 3); // Max 3 retries

    const openaiData = await openaiResponse.json();
    console.log('[ADO Prompt API] OpenAI response:', openaiData);

    if (!openaiResponse.ok) {
      const errorMessage = openaiData.error?.message || 'OpenAI API error';
      if (isRateLimitError(openaiData)) {
        throw new Error(`RATE_LIMIT:${errorMessage}`);
      }
      throw new Error(errorMessage);
    }

    const wiqlQuery = openaiData.choices[0].message.content.trim();
    console.log('[ADO Prompt API] Generated WIQL:', wiqlQuery);

    // If no project specified, get the first available project
    let targetProject = project;
    if (!targetProject) {
      const tempService = new ADOService(organization, pat);
      const projects = await tempService.getProjects();
      if (projects.length === 0) {
        throw new Error('No projects found in the organization');
      }
      targetProject = projects[0].name;
      console.log('[ADO Prompt API] No project specified, using first project:', targetProject);
    }

    // Apply global filters to the AI-generated WIQL query
    const adoService = new ADOService(organization, pat, targetProject);
    const filteredQuery = adoService.applyFiltersToQuery(wiqlQuery, filters);
    console.log('[ADO Prompt API] WIQL with filters:', filteredQuery);

    // Execute the filtered WIQL query
    const workItems = await adoService.searchWorkItems(filteredQuery);
    console.log('[ADO Prompt API] Found work items:', workItems.length);

    // If this is an analytics query, perform analysis and return insights
    if (isAnalyticsQuery && workItems.length > 0) {
      console.log('[ADO Prompt API] Performing analytics analysis...');

      // Calculate metrics
      const analyticsSummary = prepareAnalyticsSummary(workItems);
      const velocities = calculateSprintVelocity(workItems);
      const teamMetrics = calculateTeamMetrics(workItems);
      const velocityTrends = analyzeVelocityTrends(velocities);
      const cycleTime = calculateCycleTime(workItems);

      // Have AI analyze the metrics and answer the user's question
      const analyticsResponse = await callOpenAIWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: complexTaskModel, // Use gpt-4o for complex analysis
          messages: [
            {
              role: 'system',
              content: `You are an expert Agile/Scrum analytics consultant. Analyze Azure DevOps metrics and provide actionable insights.

When answering:
1. Directly address the user's question
2. Cite specific numbers from the data
3. Identify trends and patterns
4. Provide 2-3 actionable recommendations
5. Use clear, business-friendly language
6. Format with markdown for readability (use **bold** for numbers, bullet points for lists)

Keep your response focused and concise (3-5 paragraphs maximum).`,
            },
            {
              role: 'user',
              content: `User Question: "${prompt}"

${analyticsSummary}

Please analyze this data and answer the user's question with specific insights and recommendations.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }, 3);

      const analyticsData = await analyticsResponse.json();
      const analyticsAnswer = analyticsData.choices[0].message.content.trim();

      // Return analytics response with metrics for visualization
      return NextResponse.json({
        workItems,
        searchScope: `Analyzed ${workItems.length} work items`,
        wiqlQuery: filteredQuery,
        conversationalAnswer: analyticsAnswer,
        aiGenerated: true,
        originalPrompt: prompt,
        suggestions: [],
        isAnalytics: true,
        analyticsData: {
          velocities,
          teamMetrics,
          velocityTrends,
          cycleTime,
        },
      });
    }

    // Generate AI suggestions asynchronously (don't wait for it)
    let suggestions: string[] = [];
    if (workItems.length > 0) {
      try {
        const suggestionsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workItems, query: prompt }),
        });
        if (suggestionsResponse.ok) {
          const suggestionsData = await suggestionsResponse.json();
          suggestions = suggestionsData.suggestions || [];
        }
      } catch (error) {
        console.log('[ADO Prompt API] Failed to generate suggestions (non-critical):', error);
      }
    }

    // Determine if we should provide a conversational answer
    const shouldAnswerResponse = await callOpenAIWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: simpleTaskModel, // Simple classification task - use gpt-4o-mini
        messages: [
          {
            role: 'system',
            content: 'You are analyzing user questions about Azure DevOps. Determine if the user wants:\n1. "TICKETS" - A list of work items\n2. "ANSWER" - A conversational answer to their question\n\nRespond with ONLY "TICKETS" or "ANSWER".',
          },
          {
            role: 'user',
            content: `Question: "${prompt}"\nFound ${workItems.length} work items.\nShould I show tickets or provide an answer?`,
          },
        ],
        temperature: 0.3,
        max_tokens: 10,
      }),
    }, 3);

    const shouldAnswerData = await shouldAnswerResponse.json();
    const responseType = shouldAnswerData.choices[0].message.content.trim().toUpperCase();
    console.log('[ADO Prompt API] Response type:', responseType);

    // If user wants an answer, generate it with full context
    let conversationalAnswer = null;
    if (responseType === 'ANSWER') {
      // Load all non-closed items for comprehensive context
      console.log('[ADO Prompt API] Loading all non-closed items for AI context...');
      const allNonClosedItems = await adoService.getAllNonClosedWorkItems();
      console.log(`[ADO Prompt API] Loaded ${allNonClosedItems.length} non-closed items for context`);

      // Prepare context summary - group by priority and type
      const contextSummary = {
        totalNonClosed: allNonClosedItems.length,
        byPriority: {
          p1: allNonClosedItems.filter(i => i.priority === 1).length,
          p2: allNonClosedItems.filter(i => i.priority === 2).length,
          p3: allNonClosedItems.filter(i => i.priority === 3).length,
          p4: allNonClosedItems.filter(i => i.priority === 4).length,
        },
        byType: {} as Record<string, number>,
        byState: {} as Record<string, number>,
        searchResults: workItems.length,
      };

      // Count by type and state
      allNonClosedItems.forEach(item => {
        contextSummary.byType[item.type] = (contextSummary.byType[item.type] || 0) + 1;
        contextSummary.byState[item.state] = (contextSummary.byState[item.state] || 0) + 1;
      });

      // Prepare detailed items list - prioritize search results but include context from all items
      const detailedItems = workItems.length > 0
        ? workItems.slice(0, 30) // Show up to 30 search results
        : allNonClosedItems.slice(0, 50); // If no search results, show top 50 by priority

      const itemsList = detailedItems.map(item =>
        `- #${item.id}: ${item.title} (${item.type}, ${item.state}, P${item.priority}${item.assignedTo ? `, assigned to ${item.assignedTo}` : ''}${item.tags && item.tags.length > 0 ? `, tags: ${item.tags.join(', ')}` : ''})`
      ).join('\n');

      // Build messages array for conversational answer
      const answerMessages = [
        {
          role: 'system',
          content: 'You are an Azure DevOps assistant. Answer questions based on the work item data provided. Be conversational, insightful, and helpful. When discussing priority, remember P1 is highest priority and P4 is lowest.',
        },
      ];

      // Add current question with context
      answerMessages.push({
        role: 'user',
        content: `Question: "${prompt}"

CONTEXT: Overall Project Status (all non-closed items)
- Total non-closed items: ${contextSummary.totalNonClosed}
- By Priority: P1=${contextSummary.byPriority.p1}, P2=${contextSummary.byPriority.p2}, P3=${contextSummary.byPriority.p3}, P4=${contextSummary.byPriority.p4}
- By Type: ${Object.entries(contextSummary.byType).map(([type, count]) => `${type}=${count}`).join(', ')}
- By State: ${Object.entries(contextSummary.byState).map(([state, count]) => `${state}=${count}`).join(', ')}

SEARCH RESULTS: Found ${contextSummary.searchResults} matching items
${itemsList}

Based on this context, provide a helpful, conversational answer to the user's question. If asked about priorities or urgency, focus on P1 and P2 items. Be specific and reference actual work item IDs when relevant.`,
      });

      const answerResponse = await callOpenAIWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: complexTaskModel, // Keep gpt-4o for complex conversational answers
          messages: answerMessages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      }, 3);

      const answerData = await answerResponse.json();
      conversationalAnswer = answerData.choices[0].message.content.trim();
      console.log('[ADO Prompt API] Generated conversational answer');
    }

    return NextResponse.json({
      workItems,
      searchScope: `Project: ${targetProject}`,
      aiGenerated: true,
      originalPrompt: prompt,
      generatedQuery: wiqlQuery,
      responseType,
      conversationalAnswer,
      suggestions,
    });
  } catch (error: any) {
    console.error('[ADO Prompt API] Error:', {
      message: error.message,
      response: error.response?.data,
    });

    // Check if it's a rate limit error
    if (error.message?.startsWith('RATE_LIMIT:') || isRateLimitError(error.message)) {
      const errorMessage = error.message.replace('RATE_LIMIT:', '');
      const conversationalError = formatRateLimitError(errorMessage);

      return NextResponse.json(
        {
          workItems: [],
          searchScope: 'Rate limit encountered',
          error: 'OpenAI rate limit',
          conversationalAnswer: conversationalError,
          aiGenerated: true,
          originalPrompt: prompt,
          rateLimitError: true,
        },
        { status: 429 }
      );
    }

    // For non-rate-limit errors, try to use AI for a helpful response
    // But only if we have the API key and it's not a rate limit issue
    if (openaiKey) {
      try {
        const errorResponse = await callOpenAIWithRetry('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: simpleTaskModel, // Simple error explanation - use gpt-4o-mini
            messages: [
              {
                role: 'system',
                content: 'You are an Azure DevOps assistant. The system encountered an error while trying to fetch work items. Provide a helpful, conversational response explaining what might have gone wrong and suggesting alternatives.',
              },
              {
                role: 'user',
                content: `User question: "${prompt}"\n\nError: ${error.message}\n\nPlease provide a helpful response to the user.`,
              },
            ],
            temperature: 0.7,
            max_tokens: 300,
          }),
        }, 2); // Fewer retries for error handling

        if (errorResponse.ok) {
          const errorData = await errorResponse.json();
          const conversationalError = errorData.choices[0].message.content.trim();

          return NextResponse.json({
            workItems: [],
            searchScope: 'Error occurred',
            error: error.message,
            conversationalAnswer: conversationalError,
            aiGenerated: true,
            originalPrompt: prompt,
          });
        }
      } catch (aiError) {
        console.error('[ADO Prompt API] AI error response failed:', aiError);
      }
    }

    // Fallback to generic error if AI fails or unavailable
    return NextResponse.json(
      {
        error: error.message || 'Failed to process prompt',
        details: error.response?.data,
        conversationalAnswer: `I encountered an error while trying to search Azure DevOps: "${error.message}". This might be due to:\n\n• Invalid query syntax\n• Network connectivity issues\n• Insufficient permissions\n\nPlease try rephrasing your question or check your connection.`,
      },
      { status: 500 }
    );
  }
}
