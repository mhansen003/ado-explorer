import { NextRequest, NextResponse } from 'next/server';
import { ADOServiceHybrid } from '@/lib/ado-service-hybrid';

export async function GET(request: NextRequest) {
  try {
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;

    console.log('[Sprints API] Configuration:', {
      organization,
      hasProject: !!project,
      hasPAT: !!pat,
    });

    if (!organization || !pat) {
      return NextResponse.json(
        { error: 'ADO configuration not found.' },
        { status: 500 }
      );
    }

    // Get query parameters for project/team filtering
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get('project') || project;
    const teamName = searchParams.get('team') || undefined;

    if (!projectName) {
      return NextResponse.json(
        { error: 'Project name required to fetch sprints.' },
        { status: 400 }
      );
    }

    const adoService = new ADOServiceHybrid(organization, pat, projectName, {
      useMCP: true, // Enable MCP for better sprint queries with timeFrame
      useOpenRouter: !!process.env.OPENROUTER_API_KEY,
    });

    // Fetch all sprints for the team (MCP provides better timeFrame data!)
    const sprints = await adoService.getSprints(projectName, teamName);

    // Also get current sprint separately (MCP automatically detects "current" timeFrame)
    const currentSprint = await adoService.getCurrentSprint(projectName, teamName);

    return NextResponse.json({
      sprints,
      currentSprint,
    });
  } catch (error: any) {
    console.error('[Sprints API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sprints' },
      { status: 500 }
    );
  }
}
