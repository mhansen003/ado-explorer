/**
 * Conversation Cleanup API
 * DELETE: Clean up conversations older than 5 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';
import { getRedisClient } from '@/lib/redis/client';
import { ConversationService } from '@/lib/redis/conversationService';

export async function DELETE(request: NextRequest) {
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

    // Get all user's conversations
    const conversations = await conversationService.listUserConversations(session.email, 1000);

    const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000);
    const toDelete: string[] = [];

    // Find conversations older than 5 days
    for (const conversation of conversations) {
      if (conversation.updatedAt < fiveDaysAgo) {
        toDelete.push(conversation.id);
      }
    }

    // Delete old conversations
    for (const conversationId of toDelete) {
      await conversationService.deleteConversation(conversationId);
    }

    console.log(`[Cleanup API] Deleted ${toDelete.length} conversations older than 5 days for user ${session.email}`);

    return NextResponse.json({
      success: true,
      deletedCount: toDelete.length,
      deletedIds: toDelete,
    });

  } catch (error: any) {
    console.error('[Cleanup API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to cleanup conversations',
      },
      { status: 500 }
    );
  }
}
