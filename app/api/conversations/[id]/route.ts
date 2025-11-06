/**
 * Conversation Detail API
 * GET: Get conversation by ID
 * PATCH: Update conversation
 * DELETE: Delete conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { getRedisClient } from '@/lib/redis/client';
import { ConversationService } from '@/lib/redis/conversationService';

export async function GET(
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

    // Get messages
    const messages = await conversationService.getMessages(conversationId, 100);

    console.log('[Conversation Detail] Retrieved conversation:', conversationId);
    console.log('[Conversation Detail] Messages count:', messages.length);

    // Log metadata for debugging
    const messagesWithMetadata = messages.filter(m => m.metadata && Object.keys(m.metadata).length > 0);
    console.log('[Conversation Detail] Messages with metadata:', {
      total: messagesWithMetadata.length,
      details: messagesWithMetadata.map(m => ({
        role: m.role,
        hasWorkItems: !!m.metadata?.workItems,
        workItemsCount: m.metadata?.workItems?.length || 0,
        hasListItems: !!m.metadata?.listItems,
        listItemsCount: m.metadata?.listItems?.length || 0,
      }))
    });

    return NextResponse.json({
      success: true,
      conversation,
      messages,
    });

  } catch (error: any) {
    console.error('[Conversation Detail] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get conversation',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const updates = await request.json();

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

    // Update conversation
    await conversationService.updateConversation(conversationId, updates);

    const updatedConversation = await conversationService.getConversation(conversationId);

    console.log('[Conversation Detail] Updated conversation:', conversationId);

    return NextResponse.json({
      success: true,
      conversation: updatedConversation,
    });

  } catch (error: any) {
    console.error('[Conversation Detail] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update conversation',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Delete conversation
    await conversationService.deleteConversation(conversationId);

    console.log('[Conversation Detail] Deleted conversation:', conversationId);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
    });

  } catch (error: any) {
    console.error('[Conversation Detail] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete conversation',
      },
      { status: 500 }
    );
  }
}
