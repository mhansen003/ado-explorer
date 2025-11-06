/**
 * Conversation Messages API
 * POST: Send a message and get streaming response
 */

import { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { getRedisClient } from '@/lib/redis/client';
import { ConversationService } from '@/lib/redis/conversationService';
import { SendMessageRequest } from '@/types/chat';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

    // Get context messages
    const contextMessages = await conversationService.getRecentMessagesForContext(
      conversationId,
      160000, // Claude Sonnet 4 token limit
      0.8 // Use 80% of limit
    );

    // Build Claude messages array (exclude system messages, include user/assistant only)
    const claudeMessages = contextMessages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Get system prompt from metadata
    const systemPrompt = conversation.metadata?.systemPrompt ||
      'You are a helpful AI assistant integrated with Azure DevOps. You help users manage work items, understand project status, and provide insights.';

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();
          let fullResponse = '';

          // Stream from Claude
          const messageStream = await anthropic.messages.create({
            model: model || conversation.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: claudeMessages,
            stream: true,
          });

          // Send streaming tokens
          for await (const event of messageStream) {
            if (event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta') {
              const text = event.delta.text;
              fullResponse += text;

              // Send token to client
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'token', content: text })}\n\n`)
              );
            }
          }

          // Save assistant response
          const assistantMessage = await conversationService.addMessage(
            conversationId,
            'assistant',
            fullResponse
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
