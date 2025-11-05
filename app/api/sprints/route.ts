import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

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

    const adoService = new ADOService(organization, pat, projectName);

    // Fetch all sprints for the team
    const sprints = await adoService.getSprints(projectName, teamName);

    // Also get current sprint separately
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
