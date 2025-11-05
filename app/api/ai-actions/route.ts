import { NextRequest, NextResponse } from 'next/server';
import { WorkItem } from '@/types';

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
