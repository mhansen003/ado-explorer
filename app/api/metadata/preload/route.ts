/**
 * Metadata Preload API
 *
 * Endpoints to preload and manage cached ADO metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { MetadataPreloader } from '@/lib/ai-orchestrator/metadata-preloader';

export const dynamic = 'force-dynamic';

/**
 * GET /api/metadata/preload
 * Check preload status and stats
 */
export async function GET(req: NextRequest) {
  try {
    const preloader = new MetadataPreloader();
    const stats = await preloader.getStats();

    return NextResponse.json({
      success: true,
      stats,
      message: stats.cached ? 'Metadata is cached' : 'Metadata not cached',
    });
  } catch (error: any) {
    console.error('Error checking metadata stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get metadata stats',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/metadata/preload
 * Trigger metadata preload
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'preload' } = body;

    const preloader = new MetadataPreloader();

    if (action === 'refresh') {
      // Force refresh (clear cache and reload)
      const metadata = await preloader.refresh();
      return NextResponse.json({
        success: true,
        action: 'refresh',
        metadata: {
          counts: {
            sprints: metadata.sprints.length,
            users: metadata.users.length,
            states: metadata.states.length,
            types: metadata.types.length,
            tags: metadata.tags.length,
            queries: metadata.queries.length,
            projects: metadata.projects.length,
            teams: metadata.teams.length,
          },
          lastUpdated: metadata.lastUpdated,
        },
        message: 'Metadata refreshed successfully',
      });
    } else {
      // Normal preload (uses cache if available)
      const metadata = await preloader.preloadAll();
      return NextResponse.json({
        success: true,
        action: 'preload',
        metadata: {
          counts: {
            sprints: metadata.sprints.length,
            users: metadata.users.length,
            states: metadata.states.length,
            types: metadata.types.length,
            tags: metadata.tags.length,
            queries: metadata.queries.length,
            projects: metadata.projects.length,
            teams: metadata.teams.length,
          },
          lastUpdated: metadata.lastUpdated,
        },
        message: 'Metadata preloaded successfully',
      });
    }
  } catch (error: any) {
    console.error('Error preloading metadata:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to preload metadata',
      },
      { status: 500 }
    );
  }
}
