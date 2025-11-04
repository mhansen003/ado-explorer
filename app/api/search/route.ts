import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json();

    // Get configuration from environment variables
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT; // Optional - if not set, searches all projects
    const pat = process.env.ADO_PAT;

    console.log('[ADO API] Configuration:', {
      organization,
      hasProject: !!project,
      projectName: project || 'ALL PROJECTS',
      hasPAT: !!pat,
      command,
    });

    if (!organization || !pat) {
      console.error('[ADO API] Missing configuration:', { organization: !!organization, pat: !!pat });
      return NextResponse.json(
        {
          error: 'ADO configuration not found. Please set NEXT_PUBLIC_ADO_ORGANIZATION and ADO_PAT environment variables.',
          details: { hasOrg: !!organization, hasPAT: !!pat }
        },
        { status: 500 }
      );
    }

    // Create ADO service instance (project is optional)
    // If project is not provided, searches across ALL projects in the organization
    const adoService = new ADOService(organization, pat, project);

    // Parse command and parameter
    const parts = command.trim().split(' ');
    const mainCommand = parts[0];
    const param = parts.slice(1).join(' ');

    console.log('[ADO API] Parsed command:', { mainCommand, param });

    // Build and execute query
    const query = adoService.buildQuery(mainCommand, param);
    console.log('[ADO API] WIQL Query:', query);

    const workItems = await adoService.searchWorkItems(query);
    console.log('[ADO API] Found work items:', workItems.length);

    return NextResponse.json({
      workItems,
      searchScope: project ? `Project: ${project}` : 'All Projects',
      debug: {
        organization,
        project: project || 'ALL',
        query,
        count: workItems.length,
      }
    });
  } catch (error: any) {
    console.error('[ADO API] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: error.message || 'Failed to search work items',
        details: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        }
      },
      { status: 500 }
    );
  }
}
