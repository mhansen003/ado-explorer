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
import {
  WIQL_GENERATION_SYSTEM_PROMPT,
  CONVERSATIONAL_ANSWER_SYSTEM_PROMPT,
  ANALYTICS_SYSTEM_PROMPT,
  buildEnhancedContext,
  generateFriendlyError,
  generateFollowUpSuggestions,
  isSprintQuery,
  buildSprintContext,
  validateAndFixWiqlQuery,
} from '@/lib/enhanced-ai-prompts';

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
1. "SEARCH" - Find and list specific work items (bugs, tasks, stories, tickets in a sprint)
2. "ANALYTICS" - Analyze metrics, trends, velocity, performance, insights

Analytical queries include words like: velocity, sprint velocity, iteration velocity, trend, performance, how fast, how many, analysis, metrics, throughput, cycle time, team performance, sprint progress, burn rate, comparison, by iteration, by sprint

IMPORTANT: Sprint/iteration velocity queries are ANALYTICS, not SEARCH.
Examples of ANALYTICS: "sprint velocity", "velocity by iteration", "team performance by sprint"
Examples of SEARCH: "show sprint items", "tickets in sprint 23", "current sprint bugs"

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

    // Check if this is a sprint-related query and fetch sprint context
    let sprintContext = '';
    let availableSprints: Array<{ name: string; path: string; timeFrame?: string }> | undefined;
    let sprintProjectName = project;

    if (isSprintQuery(prompt)) {
      console.log('[ADO Prompt API] Sprint query detected, fetching sprint context...');

      // Determine project to use
      let targetProject = project;
      if (!targetProject) {
        const tempService = new ADOService(organization, pat);
        const projects = await tempService.getProjects();
        if (projects.length > 0) {
          targetProject = projects[0].name;
        }
      }

      if (targetProject) {
        sprintProjectName = targetProject;
        try {
          const adoService = new ADOService(organization, pat, targetProject);
          availableSprints = await adoService.getSprints();
          sprintContext = buildSprintContext(targetProject, availableSprints);
          console.log('[ADO Prompt API] Sprint context built:', sprintContext);
          console.log('[ADO Prompt API] Available sprints:', availableSprints?.length || 0);
        } catch (error) {
          console.warn('[ADO Prompt API] Failed to fetch sprint context:', error);
          // Continue without sprint context
        }
      }
    }

    // Call OpenAI to interpret the prompt with enhanced prompting
    const messages = [
      {
        role: 'system',
        content: WIQL_GENERATION_SYSTEM_PROMPT,
      },
    ];

    // Add current user prompt with sprint context if available
    messages.push({
      role: 'user',
      content: prompt + sprintContext,
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

    let wiqlQuery = openaiData.choices[0].message.content.trim();
    console.log('[ADO Prompt API] Generated WIQL:', wiqlQuery);

    // CRITICAL: Validate and fix WIQL query for IterationPath issues
    const validationResult = validateAndFixWiqlQuery(wiqlQuery, sprintProjectName || project || organization, availableSprints);
    if (validationResult.wasFixed) {
      console.warn('[ADO Prompt API] ⚠️ WIQL query was automatically fixed!');
      console.warn('[ADO Prompt API] Original:', wiqlQuery);
      console.warn('[ADO Prompt API] Fixed:', validationResult.query);
      console.warn('[ADO Prompt API] Reason:', validationResult.fixReason);
      wiqlQuery = validationResult.query;
    } else {
      console.log('[ADO Prompt API] ✅ WIQL query validation passed');
    }

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
    let workItems = await adoService.searchWorkItems(filteredQuery);
    console.log('[ADO Prompt API] Found work items:', workItems.length);

    // Enrich work items with relationship information
    workItems = await adoService.enrichWorkItemsWithRelationships(workItems);

    // If this is an analytics query, perform analysis and return insights
    if (isAnalyticsQuery && workItems.length > 0) {
      console.log('[ADO Prompt API] Performing analytics analysis...');

      // Calculate metrics
      const analyticsSummary = prepareAnalyticsSummary(workItems);
      const velocities = calculateSprintVelocity(workItems);
      const teamMetrics = calculateTeamMetrics(workItems);
      const velocityTrends = analyzeVelocityTrends(velocities);
      const cycleTime = calculateCycleTime(workItems);

      // Have AI analyze the metrics and answer the user's question with enhanced prompting
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
              content: ANALYTICS_SYSTEM_PROMPT,
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

      // Build messages array for conversational answer with enhanced context
      const enhancedContext = buildEnhancedContext(allNonClosedItems, workItems, filters);

      const answerMessages = [
        {
          role: 'system',
          content: CONVERSATIONAL_ANSWER_SYSTEM_PROMPT,
        },
      ];

      // Add current question with enhanced context
      answerMessages.push({
        role: 'user',
        content: `Question: "${prompt}"\n\n${enhancedContext}`,
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

    // Fallback to enhanced friendly error if AI fails or unavailable
    const friendlyError = generateFriendlyError(error.message || 'Unknown error', prompt);

    return NextResponse.json(
      {
        error: error.message || 'Failed to process prompt',
        details: error.response?.data,
        conversationalAnswer: friendlyError,
      },
      { status: 500 }
    );
  }
}
