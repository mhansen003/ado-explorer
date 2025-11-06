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
    const { content, role } = body;

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

    // Add message
    const message = await conversationService.addMessage(
      conversationId,
      role,
      content
    );

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
