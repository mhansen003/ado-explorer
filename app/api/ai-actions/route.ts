import { NextRequest, NextResponse } from 'next/server';
import { WorkItem } from '@/types';
import { ADOService } from '@/lib/ado-api';

export async function POST(request: NextRequest) {
  try {
    const { action, workItem } = await request.json() as { action: string; workItem: WorkItem };

    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not found.' },
        { status: 500 }
      );
    }

    // Special handling for relatedItems - search ADO and return structured data
    if (action === 'relatedItems') {
      const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
      const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
      const pat = process.env.ADO_PAT;

      if (!organization || !pat) {
        return NextResponse.json(
          { error: 'ADO configuration not found.' },
          { status: 500 }
        );
      }

      // Get project if not specified
      let targetProject = project;
      if (!targetProject) {
        const tempService = new ADOService(organization, pat);
        const projects = await tempService.getProjects();
        if (projects.length > 0) {
          targetProject = projects[0].name;
        }
      }

      // Use TWO clients:
      // 1. Org-level (no project) for cross-project relation support
      // 2. Project-level for WIQL searches (which require a project)
      const orgService = new ADOService(organization, pat);
      const projectService = targetProject ? new ADOService(organization, pat, targetProject) : null;

      const relatedItems: WorkItem[] = [];
      const maxSimilarTitles = 5; // Only show up to 5 similar title suggestions

      // FIRST AND MOST IMPORTANT: Get actual linked work items from Azure DevOps relations
      // This includes Parent, Child, Related, Predecessor, Successor from ADO
      console.log('[AI Actions] 🔍 Fetching ADO relationships for work item ID:', workItem.id);
      try {
        const linkedItems = await orgService.getRelatedWorkItems(parseInt(workItem.id));
        console.log('[AI Actions] ✅ ADO returned', linkedItems.length, 'linked relationships');

        if (linkedItems.length > 0) {
          relatedItems.push(...linkedItems); // Add ALL linked items from ADO, no limit
          console.log('[AI Actions] ADO relationships:', linkedItems.map(item => ({
            id: item.id,
            title: item.title,
            relationType: item.relationType,
            relationSource: item.relationSource,
          })));
        } else {
          console.warn('[AI Actions] ⚠️ NO ADO RELATIONSHIPS FOUND - This should not happen for ticket with Parent/Child');
        }
      } catch (error) {
        console.error('[AI Actions] ❌ ERROR fetching ADO relationships:', error);
      }

      // SECOND: Add up to 5 similar titles based on title keywords
      // This is ONLY AI suggestions, separate from actual ADO relationships
      // NOTE: WIQL queries require a project, so we use the project-level service
      if (projectService) {
        const titleWords = workItem.title
          .split(/\s+/)
          .filter(word => word.length >= 4)
          .slice(0, 3);

        if (titleWords.length > 0) {
          const titleQuery = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.Title] CONTAINS '${titleWords[0]}' AND [System.Id] <> ${workItem.id} ORDER BY [System.ChangedDate] DESC`;
          try {
            const titleResults = await projectService.searchWorkItems(titleQuery);
            // Add items that aren't already in the list
            const existingIds = new Set(relatedItems.map(item => item.id));
            const newResults = titleResults
              .filter(item => !existingIds.has(item.id))
              .slice(0, maxSimilarTitles)
              .map(item => ({ ...item, relationSource: 'title' as const, relationType: 'Similar Title' }));

            if (newResults.length > 0) {
              relatedItems.push(...newResults);
              console.log('[AI Actions] Added', newResults.length, 'similar title suggestions (max 5)');
            }
          } catch (error) {
            console.error('[AI Actions] Title similarity search error:', error);
          }
        }
      } else {
        console.log('[AI Actions] Skipping title similarity search - no project available for WIQL');
      }

      // Return ALL related work items - no limit on actual ADO relationships
      // Only suggested items (tag/title based) are limited to maxSuggestedResults
      const breakdown = {
        linked: relatedItems.filter(i => i.relationSource === 'linked').length,
        tag: relatedItems.filter(i => i.relationSource === 'tag').length,
        title: relatedItems.filter(i => i.relationSource === 'title').length,
        total: relatedItems.length,
      };
      console.log('[AI Actions] ✅ RETURNING RESULTS - Breakdown:', breakdown);
      console.log('[AI Actions] ✅ TOTAL ITEMS BEING RETURNED:', relatedItems.length);
      console.log('[AI Actions] ✅ Items by type:', relatedItems.reduce((acc, item) => {
        acc[item.relationType || 'Unknown'] = (acc[item.relationType || 'Unknown'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));

      return NextResponse.json({
        result: null,
        relatedWorkItems: relatedItems, // Return all items, no slice
      });
    }

    const prompts: Record<string, string> = {
      releaseNotes: `Generate professional release notes for this work item:

Title: ${workItem.title}
Type: ${workItem.type}
Description: ${workItem.description || 'No description'}

Format the output as:
## ${workItem.id} - ${workItem.title}

**What Changed:**
[Clear, user-facing description of the change]

**Impact:**
[Who is affected and how]

**Additional Notes:**
[Any important details]`,

      summary: `Create a concise, shareable summary of this work item suitable for Slack or email:

Title: ${workItem.title}
Type: ${workItem.type}
State: ${workItem.state}
Priority: P${workItem.priority}
Assigned to: ${workItem.assignedTo}
Description: ${workItem.description || 'No description'}

Format as a brief 2-3 sentence summary that anyone can understand, followed by key details.`,

      testCases: `Generate comprehensive test cases for this work item:

Title: ${workItem.title}
Type: ${workItem.type}
Description: ${workItem.description || 'No description'}

Provide test cases in this format:
**Test Case 1: [Name]**
- **Given:** [preconditions]
- **When:** [action]
- **Then:** [expected result]

Include positive, negative, and edge case scenarios.`,

      acceptanceCriteria: `Define clear acceptance criteria for this work item:

Title: ${workItem.title}
Type: ${workItem.type}
Description: ${workItem.description || 'No description'}

Format as:
**Acceptance Criteria:**

✅ [Specific, measurable criterion]
✅ [Specific, measurable criterion]
✅ [Specific, measurable criterion]

Make them specific, testable, and aligned with the Definition of Done.`,

      complexity: `Analyze the complexity and provide an effort estimate for this work item:

Title: ${workItem.title}
Type: ${workItem.type}
Description: ${workItem.description || 'No description'}

Provide:
1. **Complexity Rating:** (Low/Medium/High/Very High)
2. **Estimated Effort:** (in story points or hours)
3. **Key Factors:** What makes this complex or simple?
4. **Risks:** What could make this take longer?
5. **Dependencies:** What other work is needed first?`,

      relatedItems: `Suggest related work items or areas that connect to this item:

Title: ${workItem.title}
Type: ${workItem.type}
Description: ${workItem.description || 'No description'}
Tags: ${workItem.tags?.join(', ') || 'None'}

Provide:
1. **Likely Related Work Items:** (suggest types and keywords to search)
2. **Related Features/Components:**
3. **Team Members to Consult:**
4. **Documentation to Review:**`,
    };

    const prompt = prompts[action];
    if (!prompt) {
      return NextResponse.json(
        { error: 'Invalid action type' },
        { status: 400 }
      );
    }

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
            content: 'You are an expert software development assistant helping with Azure DevOps work items. Provide clear, professional, and actionable content.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      throw new Error(openaiData.error?.message || 'OpenAI API error');
    }

    const result = openaiData.choices[0].message.content.trim();

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('[AI Actions API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to generate AI content' },
      { status: 500 }
    );
  }
}
