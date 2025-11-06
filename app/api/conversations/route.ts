/**
 * Conversations API
 * GET: List user's conversations
 * POST: Create new conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { getRedisClient } from '@/lib/redis/client';
import { ConversationService } from '@/lib/redis/conversationService';
import { CreateConversationRequest } from '@/types/chat';

export async function GET(request: NextRequest) {
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

    const userEmail = session.email;
    const redis = await getRedisClient();
    const conversationService = new ConversationService(redis);

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // List user's conversations
    const conversations = await conversationService.listUserConversations(
      userEmail,
      limit
    );

    console.log('[Conversations API] Listed', conversations.length, 'conversations for', userEmail);

    return NextResponse.json({
      success: true,
      conversations,
    });

  } catch (error: any) {
    console.error('[Conversations API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list conversations',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const userEmail = session.email;
    const body: CreateConversationRequest = await request.json();
    const { title, model, systemPrompt } = body;

    const redis = await getRedisClient();
    const conversationService = new ConversationService(redis);

    // Create new conversation
    const conversation = await conversationService.createConversation(
      userEmail,
      title,
      model,
      systemPrompt
    );

    console.log('[Conversations API] Created conversation:', conversation.id);

    return NextResponse.json({
      success: true,
      conversation,
    });

  } catch (error: any) {
    console.error('[Conversations API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create conversation',
      },
      { status: 500 }
    );
  }
}
