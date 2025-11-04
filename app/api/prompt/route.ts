import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;
    const openaiKey = process.env.OPENAI_API_KEY;

    console.log('[ADO Prompt API] Configuration:', {
      organization,
      hasProject: !!project,
      hasPAT: !!pat,
      hasOpenAI: !!openaiKey,
      prompt,
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
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an Azure DevOps WIQL (Work Item Query Language) expert. Your job is to convert natural language questions into WIQL queries.

WIQL Query Format:
SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [conditions] ORDER BY [field]

Common Fields:
- System.Title - Work item title
- System.Description - Work item description
- System.State - State (New, Active, Resolved, Closed)
- System.WorkItemType - Type (Bug, Task, User Story, Epic, Feature)
- System.Tags - Tags
- System.AssignedTo - Assigned person
- System.CreatedBy - Creator
- System.ChangedDate - Last modified date
- System.CreatedDate - Creation date
- System.TeamProject - Project name

Operators:
- CONTAINS - For text search
- = - Exact match
- >= / <= - Date/number comparison
- @Today - Current date

Examples:
Q: "Which tickets are talking about credit?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.Title] CONTAINS 'credit' OR [System.Description] CONTAINS 'credit' ORDER BY [System.ChangedDate] DESC

Q: "Show me all bugs assigned to John"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.AssignedTo] CONTAINS 'John' ORDER BY [System.ChangedDate] DESC

Q: "What tasks were created this week?"
A: SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Task' AND [System.CreatedDate] >= @Today - 7 ORDER BY [System.CreatedDate] DESC

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

    // Execute the WIQL query
    const adoService = new ADOService(organization, pat, project);
    const workItems = await adoService.searchWorkItems(wiqlQuery);
    console.log('[ADO Prompt API] Found work items:', workItems.length);

    return NextResponse.json({
      workItems,
      searchScope: project ? `Project: ${project}` : 'All Projects',
      aiGenerated: true,
      originalPrompt: prompt,
      generatedQuery: wiqlQuery,
    });
  } catch (error: any) {
    console.error('[ADO Prompt API] Error:', {
      message: error.message,
      response: error.response?.data,
    });

    return NextResponse.json(
      {
        error: error.message || 'Failed to process prompt',
        details: error.response?.data,
      },
      { status: 500 }
    );
  }
}
