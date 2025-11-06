/**
 * Conversation Messages API
 * POST: Send a message and get streaming response
 */

import { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { getRedisClient } from '@/lib/redis/client';
import { ConversationService } from '@/lib/redis/conversationService';
import { SendMessageRequest, ADOCollection } from '@/types/chat';
import Anthropic from '@anthropic-ai/sdk';
import { detectCollectionQuery, fetchCollectionData, formatCollectionContext } from '@/lib/collection-detector';
import { generateSuggestions } from '@/lib/suggestion-generator';
import { validateResponse, quickValidate } from '@/lib/quality-check';
import { analyzeQuery, generateIntelligentSummary, QueryAnalysis } from '@/lib/intelligent-query-processor';
import { ADOService } from '@/lib/ado-api';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Helper function to fetch work items based on query analysis search criteria
 */
async function fetchWorkItemsFromCriteria(searchCriteria: QueryAnalysis['searchCriteria']): Promise<any> {
  if (!searchCriteria) {
    return null;
  }

  // Get ADO configuration
  const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
  const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
  const pat = process.env.ADO_PAT;

  if (!organization || !pat || !project) {
    console.error('[Intelligent Query] Missing ADO configuration');
    return null;
  }

  try {
    // Create ADO service instance
    const adoService = new ADOService(organization, pat, project);

    // Build WIQL query from search criteria
    let conditions: string[] = [];

    if (searchCriteria.status) {
      conditions.push(`[System.State] = '${searchCriteria.status}'`);
    }

    if (searchCriteria.workItemType) {
      conditions.push(`[System.WorkItemType] = '${searchCriteria.workItemType}'`);
    }

    if (searchCriteria.assignedTo) {
      conditions.push(`[System.AssignedTo] CONTAINS '${searchCriteria.assignedTo}'`);
    }

    if (searchCriteria.priority) {
      conditions.push(`[Microsoft.VSTS.Common.Priority] = ${searchCriteria.priority}`);
    }

    if (searchCriteria.searchText) {
      conditions.push(`([System.Title] CONTAINS '${searchCriteria.searchText}' OR [System.Description] CONTAINS '${searchCriteria.searchText}')`);
    }

    if (searchCriteria.tags && searchCriteria.tags.length > 0) {
      const tagConditions = searchCriteria.tags.map(tag => `[System.Tags] CONTAINS '${tag}'`).join(' OR ');
      conditions.push(`(${tagConditions})`);
    }

    if (searchCriteria.projectName) {
      conditions.push(`[System.TeamProject] = '${searchCriteria.projectName}'`);
    }

    // Build the full query
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [Microsoft.VSTS.Common.Priority], [System.Tags], [System.CreatedDate], [System.ChangedDate] FROM WorkItems ${whereClause} ORDER BY [System.ChangedDate] DESC`;

    console.log('[Intelligent Query] Generated WIQL:', query);

    // Execute query using ADOService
    const workItems = await adoService.searchWorkItems(query);
    console.log('[Intelligent Query] Fetched', workItems.length, 'work items');

    return { workItems, count: workItems.length };
  } catch (error: any) {
    console.error('[Intelligent Query] Error fetching work items:', error.message);
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  try {
    // Verify authentication
    const token = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401 }
      );
    }

    const session = verifyAuthToken(token);
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid session' }),
        { status: 401 }
      );
    }

    const body: SendMessageRequest = await request.json();
    const { content, model } = body;

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message content is required' }),
        { status: 400 }
      );
    }

    const redis = await getRedisClient();
    const conversationService = new ConversationService(redis);

    // Get conversation
    const conversation = await conversationService.getConversation(conversationId);

    if (!conversation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conversation not found' }),
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 403 }
      );
    }

    // Add user message
    const userMessage = await conversationService.addMessage(
      conversationId,
      'user',
      content
    );

    console.log('[Messages API] User message added to', conversationId);

    // Get context messages early for intelligent query processing
    const contextMessages = await conversationService.getRecentMessagesForContext(
      conversationId,
      160000, // Claude Sonnet 4 token limit
      0.8 // Use 80% of limit
    );

    // **NEW: Intelligent Query Processing (Three-Stage Architecture)**
    // Stage 1: Analyze the query to understand intent and data needs
    console.log('[Intelligent Query] ═══════════════════════════════════════');
    console.log('[Intelligent Query] Stage 1: Analyzing query...');
    console.log('[Intelligent Query] User query:', content);
    const queryAnalysis = await analyzeQuery(content, contextMessages);
    console.log('[Intelligent Query] ✅ Analysis complete:');
    console.log('[Intelligent Query]   needsAdoData:', queryAnalysis.needsAdoData);
    console.log('[Intelligent Query]   intent:', queryAnalysis.intent);
    console.log('[Intelligent Query]   requiresSummary:', queryAnalysis.requiresSummary);
    console.log('[Intelligent Query]   searchCriteria:', JSON.stringify(queryAnalysis.searchCriteria, null, 2));

    let intelligentContext = '';
    let workItemData: any = null;

    // Stage 2: Fetch data if needed (only for work item queries, not collection queries)
    if (queryAnalysis.needsAdoData && queryAnalysis.searchCriteria) {
      console.log('[Intelligent Query] Stage 2: Fetching work items...');
      console.log('[Intelligent Query]   Criteria:', JSON.stringify(queryAnalysis.searchCriteria, null, 2));

      const result = await fetchWorkItemsFromCriteria(queryAnalysis.searchCriteria);

      if (result && result.workItems) {
        workItemData = result;
        console.log('[Intelligent Query] ✅ Stage 2 complete: Fetched', result.count, 'work items');
        console.log('[Intelligent Query]   First 3 items:', result.workItems.slice(0, 3).map((wi: any) => `#${wi.id}: ${wi.title} (${wi.state})`));

        // Stage 3: Generate intelligent summary if requested
        if (queryAnalysis.requiresSummary) {
          console.log('[Messages API] Stage 3: Generating intelligent summary...');

          const processedResponse = await generateIntelligentSummary(
            content,
            result.workItems,
            queryAnalysis
          );

          // Build intelligent context to inject into Claude
          intelligentContext = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 PRE-FETCHED DATA - DO NOT USE MCP SEARCH TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT:** The data below has already been fetched and analyzed.
DO NOT call mcp__azure-devops__search_work_items or any other search tools.
Use ONLY the data provided below to answer the user's question.

<intelligent_analysis>
**Query Analysis:** ${queryAnalysis.intent}

**Summary:** ${processedResponse.summary}

**Key Insights:**
${processedResponse.insights.map((insight, idx) => `${idx + 1}. ${insight}`).join('\n')}

**Data Available:** ${result.count} work items matching the criteria

**All Work Items:**
${result.workItems.map((wi: any) => `- #${wi.id}: ${wi.title} (${wi.state}, ${wi.type}, Priority: ${wi.priority || 'N/A'}, Assigned: ${wi.assignedTo})`).join('\n')}
</intelligent_analysis>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

          console.log('[Messages API] Generated intelligent summary with', processedResponse.insights.length, 'insights');
        } else {
          // Just provide a simple data context
          intelligentContext = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 PRE-FETCHED DATA - DO NOT USE MCP SEARCH TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT:** The data below has already been fetched.
DO NOT call mcp__azure-devops__search_work_items.
Use ONLY the data provided below.

<work_items_data>
Found ${result.count} work items matching the query.

**All Work Items:**
${result.workItems.map((wi: any) => `- #${wi.id}: ${wi.title} (${wi.state}, ${wi.type}, Priority: ${wi.priority || 'N/A'}, Assigned: ${wi.assignedTo})`).join('\n')}
</work_items_data>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }
      } else {
        console.log('[Intelligent Query] ⚠️  No work items found or error fetching data');
        intelligentContext = '\n\n<note>No work items found matching the search criteria.</note>';
      }
    } else {
      console.log('[Intelligent Query] ⏭️  Skipping intelligent data fetch');
      console.log('[Intelligent Query]   needsAdoData:', queryAnalysis.needsAdoData);
      console.log('[Intelligent Query]   hasSearchCriteria:', !!queryAnalysis.searchCriteria);
    }
    console.log('[Intelligent Query] ═══════════════════════════════════════');

    // **NEW: Detect if this is a collection query**
    const collectionDetection = detectCollectionQuery(content);
    console.log('[Messages API] Collection detection:', collectionDetection);

    let collectionContext = '';
    let collectionData: ADOCollection | null = null;

    // If HIGH confidence collection query, fetch the data
    if (collectionDetection.confidence === 'high' && collectionDetection.type !== 'none') {
      console.log(`[Messages API] Fetching ${collectionDetection.type} collection data...`);

      // Determine base URL for API calls
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                      (request.headers.get('host')?.includes('localhost')
                        ? 'http://localhost:3000'
                        : `https://${request.headers.get('host')}`);

      const result = await fetchCollectionData(collectionDetection.type, baseUrl);

      if (result.error) {
        console.error(`[Messages API] Error fetching collection:`, result.error);
        // Continue anyway, Claude can explain the error
        collectionContext = `\n\nNote: Attempted to fetch ${collectionDetection.type} but encountered an error: ${result.error}`;
      } else if (result.data && result.count > 0) {
        console.log(`[Messages API] Successfully fetched ${result.count} ${collectionDetection.type}`);
        collectionContext = formatCollectionContext(collectionDetection.type, result.data);
        collectionData = {
          type: collectionDetection.type as any,
          data: result.data,
          count: result.count,
        };
      } else {
        console.log(`[Messages API] No ${collectionDetection.type} found`);
        collectionContext = `\n\nNote: No ${collectionDetection.type} found in the organization.`;
      }
    }

    // Build Claude messages array (exclude system messages, include user/assistant only)
    const claudeMessages = contextMessages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // **NEW: If we fetched collection data, append it to the last user message**
    if (collectionContext && claudeMessages.length > 0 && claudeMessages[claudeMessages.length - 1].role === 'user') {
      claudeMessages[claudeMessages.length - 1].content += collectionContext;
      console.log('[Messages API] Appended collection context to user message');
    }

    // **NEW: If we generated intelligent analysis, append it to the last user message**
    if (intelligentContext && claudeMessages.length > 0 && claudeMessages[claudeMessages.length - 1].role === 'user') {
      claudeMessages[claudeMessages.length - 1].content += intelligentContext;
      console.log('[Messages API] Appended intelligent analysis context to user message');
    }

    // Get system prompt from metadata or use enhanced default
    const systemPrompt = conversation.metadata?.systemPrompt ||
      `You are an AI assistant integrated with Azure DevOps. Your role is to help users explore and understand their Azure DevOps projects, work items, teams, and more.

## 🎯 CRITICAL: Conversation Context & Drill-Down Behavior

**YOU ARE IN A MULTI-TURN CONVERSATION.** The conversation history contains previous questions and your previous responses with data. You MUST:

1. **Remember Previous Context (Last 5 Messages)**
   - Reference data from your previous responses
   - When user asks follow-up questions, they're referring to PREVIOUS results
   - Example: If you showed 5 blocked items, and user asks "what are the P1 ones?", they mean the P1 items FROM THOSE 5 BLOCKED ITEMS

2. **Drill-Down Behavior**
   - User questions often narrow down or filter PREVIOUS results
   - "show me the P1 ones" = filter previous results for P1
   - "who's working on those?" = show assignees from previous results
   - "what about the bugs?" = filter previous results for bugs
   - Always reference what you're filtering: "Of the 5 blocked items I showed you, 2 are P1..."

3. **Contextual References**
   - "those" = items from previous response
   - "these" = items from previous response
   - "them" = items from previous response
   - "the P1 ones" = P1 items from previous results
   - "the blocked ones" = blocked items from previous results

4. **Resuming Old Conversations**
   - When conversation is resumed after time, review the last 5 messages
   - Acknowledge what was previously discussed: "Last time we looked at..."
   - Continue from where the conversation left off

5. **Examples of Context-Aware Responses**

**Bad (No Context):**
\`\`\`
User: "show me blocked items"
You: [Shows 5 blocked items: #100, #101, #102, #103, #104]
User: "what are the P1 ones?"
You: [Queries ALL items for P1, returns 50 P1 items] ❌ WRONG
\`\`\`

**Good (Context-Aware):**
\`\`\`
User: "show me blocked items"
You: [Shows 5 blocked items: #100, #101, #102, #103, #104]
User: "what are the P1 ones?"
You: "Of the 5 blocked items I just showed you, 2 are P1:
- #100: Login bug (P1)
- #103: Payment issue (P1)" ✅ CORRECT
\`\`\`

## Collection Data Format

When users ask about Azure DevOps collections (projects, teams, users, states, types, tags), the system will automatically fetch the data and provide it to you in this format:

<collection_data type="projects|teams|users|states|types|tags" count="N">
[Structured data here]
</collection_data>

## Your Response Guidelines

When you receive collection_data:
1. **Format as a beautiful markdown table or list**
2. **Add helpful context** - explain what the data means
3. **Provide insights** - notice patterns, highlight important items
4. **Suggest next steps** - what can the user do next?

### Example Format for Projects:
| Project Name | State | Description |
|--------------|-------|-------------|
| E-Commerce | Active | Customer-facing app |
| Internal Tools | Active | Admin tools |

"I found 2 active projects in your organization. The E-Commerce project is your main customer-facing application, while Internal Tools provides admin capabilities. Would you like to see the teams in any of these projects?"

### Example Format for Teams:
**E-Commerce Project:**
- Frontend Team (8 members)
- Backend Team (6 members)
- QA Team (4 members)

"The E-Commerce project has 3 teams with 18 total members..."

### Example Format for Users:
| Name | Email |
|------|-------|
| John Smith | john@company.com |
| Sarah Johnson | sarah@company.com |

## Important Notes

- **Always format data nicely** - use tables for structured data, lists for simple data
- **Provide context** - don't just show raw data
- **Be conversational** - explain findings in natural language
- **Suggest actions** - help users know what to do next
- **Reference previous results** - maintain drill-down behavior
- **If data is missing** - explain that no items were found and suggest alternatives`;

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();
          let fullResponse = '';
          const collections: ADOCollection[] = [];

          // Helper function to identify collection type from tool name
          const identifyCollectionType = (toolName: string, result: any): ADOCollection | null => {
            if (toolName === 'mcp__azure-devops__get_projects' && Array.isArray(result?.projects)) {
              return { type: 'projects', data: result.projects, count: result.projects.length };
            } else if (toolName === 'mcp__azure-devops__get_teams' && Array.isArray(result?.teams)) {
              return { type: 'teams', data: result.teams, count: result.teams.length };
            } else if (toolName === 'mcp__azure-devops__get_users' && Array.isArray(result?.users)) {
              return { type: 'users', data: result.users, count: result.users.length };
            } else if (toolName === 'mcp__azure-devops__get_states' && Array.isArray(result?.states)) {
              return { type: 'states', data: result.states, count: result.states.length };
            } else if (toolName === 'mcp__azure-devops__get_types' && Array.isArray(result?.types)) {
              return { type: 'types', data: result.types, count: result.types.length };
            } else if (toolName === 'mcp__azure-devops__get_tags' && Array.isArray(result?.tags)) {
              return { type: 'tags', data: result.tags, count: result.tags.length };
            } else if (toolName === 'mcp__azure-devops__search_work_items') {
              // Handle different possible result structures
              const workItems = result?.workItems || result?.items || result;
              if (Array.isArray(workItems)) {
                return { type: 'work_items', data: workItems, count: workItems.length, query: result?.query };
              }
            }
            return null;
          };

          // Stream from Claude with tool use enabled
          const messageStream = await anthropic.messages.create({
            model: model || conversation.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: claudeMessages,
            stream: true,
            // Enable tool use - Claude will use MCP tools automatically
          });

          // Send streaming tokens and handle tool use
          for await (const event of messageStream) {
            // Handle text content
            if (event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta') {
              const text = event.delta.text;
              fullResponse += text;

              // Send token to client
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'token', content: text })}\n\n`)
              );
            }

            // Handle tool use
            else if (event.type === 'content_block_start' &&
                     event.content_block.type === 'tool_use') {
              const toolUse = event.content_block;
              console.log('[Messages API] Tool use detected:', toolUse.name);

              // Send tool use notification to client
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_use',
                  toolName: toolUse.name,
                  toolInput: toolUse.input
                })}\n\n`)
              );
            }

            // Handle tool results
            // Note: Tool result handling would go here if needed in the future
            // Currently disabled due to TypeScript limitations with Delta type
          }

          // After streaming completes, check if we collected any tool results
          // Note: Tool results are embedded in the content, we need to extract them from the response
          // For now, we'll rely on Claude to mention the data in its response
          console.log('[Messages API] Streaming completed, collections:', collections.length);

          // **NEW: Quality Check - Validate response against actual data**
          let finalResponse = fullResponse;
          console.log('[Messages API] Running quality check on response...');

          // Send verifying event to UI
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'verifying' })}\n\n`)
          );

          try {
            // Quick pre-check to see if validation is needed
            const quickCheck = quickValidate(fullResponse, collectionContext);

            if (quickCheck.needsValidation) {
              console.log('[Messages API] Quick check detected issue:', quickCheck.reason);
              console.log('[Messages API] Running full AI validation...');

              // Run full AI validation
              const validationResult = await validateResponse({
                userQuery: content,
                aiResponse: fullResponse,
                actualData: collectionContext,
                collectionType: collectionData?.type,
                collectionData: collectionData?.data,
              });

              if (!validationResult.isAccurate && validationResult.correctedResponse) {
                console.log('[Messages API] ❌ Response inaccurate, using corrected version');
                console.log('[Messages API] Issues found:', validationResult.issues);

                finalResponse = validationResult.correctedResponse;

                // Send correction event to UI
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'correction',
                    correctedContent: finalResponse,
                    issues: validationResult.issues,
                  })}\n\n`)
                );
              } else {
                console.log('[Messages API] ✅ Response validated as accurate');
              }
            } else {
              console.log('[Messages API] ✅ Quick check passed, skipping full validation');
            }
          } catch (qualityCheckError: any) {
            console.error('[Messages API] Quality check failed:', qualityCheckError.message);
            // Continue with original response if quality check fails
            console.log('[Messages API] Using original response due to quality check error');
          }

          // Save assistant response (corrected version if validation found issues)
          const assistantMessage = await conversationService.addMessage(
            conversationId,
            'assistant',
            finalResponse
          );

          // Auto-generate title if this is the 3rd message
          if (conversation.messageCount === 2 && conversation.title === 'New Conversation') {
            const newTitle = await conversationService.generateTitle(conversationId);
            await conversationService.updateConversation(conversationId, {
              title: newTitle,
            });

            // Send title update
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'title_update',
                title: newTitle
              })}\n\n`)
            );
          }

          // **NEW: Generate AI follow-up suggestions**
          console.log('[Messages API] Generating follow-up suggestions...');
          try {
            // Get recent conversation history for context (last 4 messages = 2 exchanges)
            const recentMessages = contextMessages.slice(-4).map(m => ({
              role: m.role,
              content: m.content.substring(0, 300), // Truncate for context
            }));

            const suggestions = await generateSuggestions({
              userQuery: content,
              assistantResponse: fullResponse,
              conversationHistory: recentMessages,
              collectionType: collectionData?.type,
              resultCount: collectionData?.count,
            });

            if (suggestions && suggestions.length > 0) {
              console.log('[Messages API] Generated', suggestions.length, 'suggestions');

              // Send suggestions to client
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'suggestions',
                  suggestions: suggestions,
                  messageId: assistantMessage.id,
                })}\n\n`)
              );

              // Update the assistant message with suggestions in Redis
              // Note: We need to add a method to update message metadata
              // For now, suggestions are sent but not persisted
            } else {
              console.log('[Messages API] No suggestions generated');
            }
          } catch (suggestionError: any) {
            console.error('[Messages API] Failed to generate suggestions:', suggestionError.message);
            // Continue without suggestions - non-critical
          }

          // Send done event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              messageId: assistantMessage.id,
              userMessageId: userMessage.id,
            })}\n\n`)
          );

          controller.close();

          console.log('[Messages API] Streaming complete for', conversationId);

        } catch (error: any) {
          console.error('[Messages API] Streaming error:', error);
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error.message
            })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('[Messages API] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send message',
      }),
      { status: 500 }
    );
  }
}
