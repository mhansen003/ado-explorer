import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';
import { GlobalFilters } from '@/types';

export async function POST(request: NextRequest) {
  // Get environment variables outside try block so they're available in catch
  const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
  const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
  const pat = process.env.ADO_PAT;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    const { prompt, filters } = await request.json() as { prompt: string; filters?: GlobalFilters };

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

    // Call OpenAI to interpret the prompt
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an Azure DevOps WIQL (Work Item Query Language) expert. Your job is to convert natural language questions into WIQL queries.

WIQL Query Format:
SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [conditions] ORDER BY [field]

IMPORTANT RULES:
- Do NOT use TOP keyword - results will be limited automatically
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

Operators:
- CONTAINS - For text search in Title, Description, AssignedTo, CreatedBy, Tags
- = - Exact match for State, WorkItemType
- >= / <= - Date/number comparison
- @Today - Current date

Examples:
Q: "Which tickets are talking about credit?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.Title] CONTAINS 'credit' OR [System.Description] CONTAINS 'credit' ORDER BY [System.ChangedDate] DESC

Q: "Show me all bugs assigned to John"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.AssignedTo] CONTAINS 'John' ORDER BY [System.ChangedDate] DESC

Q: "What tasks were created this week?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Task' AND [System.CreatedDate] >= @Today - 7 ORDER BY [System.CreatedDate] DESC

Q: "Show me all bob builder projects"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.Title] CONTAINS 'bob builder' OR [System.Description] CONTAINS 'bob builder' ORDER BY [System.ChangedDate] DESC

Respond ONLY with the WIQL query, nothing else.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    const openaiData = await openaiResponse.json();
    console.log('[ADO Prompt API] OpenAI response:', openaiData);

    if (!openaiResponse.ok) {
      throw new Error(openaiData.error?.message || 'OpenAI API error');
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
    const shouldAnswerResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
    });

    const shouldAnswerData = await shouldAnswerResponse.json();
    const responseType = shouldAnswerData.choices[0].message.content.trim().toUpperCase();
    console.log('[ADO Prompt API] Response type:', responseType);

    // If user wants an answer, generate it
    let conversationalAnswer = null;
    if (responseType === 'ANSWER') {
      const answerResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an Azure DevOps assistant. Answer questions based on the work item data provided. Be conversational and helpful.',
            },
            {
              role: 'user',
              content: `Question: "${prompt}"\n\nFound ${workItems.length} work items:\n${workItems.slice(0, 10).map(item => `- ${item.id}: ${item.title} (${item.type}, ${item.state})`).join('\n')}\n\nProvide a helpful answer to the question.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

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

    // Use AI to provide a conversational error response
    try {
      const errorResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
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
      });

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

    // Fallback to generic error if AI fails
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
