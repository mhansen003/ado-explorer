/**
 * Save Message API
 * POST: Save a message to a conversation without generating a response
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { getRedisClient } from '@/lib/redis/client';
import { ConversationService } from '@/lib/redis/conversationService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  try {
    // Verify authentication
    const token = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const session = verifyAuthToken(token);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, role, metadata } = body;

    if (!content || !role) {
      return NextResponse.json(
        { success: false, error: 'Content and role are required' },
        { status: 400 }
      );
    }

    if (role !== 'user' && role !== 'assistant') {
      return NextResponse.json(
        { success: false, error: 'Role must be user or assistant' },
        { status: 400 }
      );
    }

    const redis = await getRedisClient();
    const conversationService = new ConversationService(redis);

    // Get conversation
    const conversation = await conversationService.getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Create message with metadata if provided
    // DO NOT use addMessage if we have metadata, to avoid duplicate entries
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = Date.now();

    const message: any = {
      id: messageId,
      role,
      content,
      timestamp,
    };

    // Add metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      message.metadata = metadata;
      console.log('[Save Message API] Creating message with metadata:', {
        keys: Object.keys(metadata),
        hasWorkItems: !!metadata.workItems,
        workItemsCount: metadata.workItems?.length || 0,
        hasListItems: !!metadata.listItems,
        listItemsCount: metadata.listItems?.length || 0,
      });
    } else {
      console.log('[Save Message API] Creating message without metadata');
    }

    // Save message to Redis (single save, no duplicates)
    await redis.zAdd(`conversation:${conversationId}:messages`, {
      score: timestamp,
      value: JSON.stringify(message),
    });

    // Update conversation metadata (increment message count, etc.)
    const newMessageCount = conversation.messageCount + 1;
    const lastMessagePreview = content.substring(0, 100);

    await conversationService.updateConversation(conversationId, {
      messageCount: newMessageCount,
      lastMessagePreview,
    });

    // Auto-generate/update title from user messages
    if (role === 'user') {
      const now = new Date();
      const dateTime = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Generate title from message (max 50 chars) + timestamp
      let title = content.trim();
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      // Add timestamp on first message, update without timestamp on subsequent
      if (conversation.messageCount === 0) {
        title = `${title} (${dateTime})`;
      }

      await conversationService.updateConversation(conversationId, { title });
      console.log('[Save Message API] Updated conversation title:', title);
    }

    return NextResponse.json({
      success: true,
      message,
    });

  } catch (error: any) {
    console.error('[Save Message API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save message',
      },
      { status: 500 }
    );
  }
}
