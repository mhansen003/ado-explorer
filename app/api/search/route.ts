import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';
import { GlobalFilters } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { command, filters } = await request.json() as { command: string; filters?: GlobalFilters };

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

    // If no project specified, get the first available project
    let targetProject = project;
    if (!targetProject) {
      const tempService = new ADOService(organization, pat);
      const projects = await tempService.getProjects();
      if (projects.length === 0) {
        throw new Error('No projects found in the organization');
      }
      targetProject = projects[0].name;
      console.log('[ADO API] No project specified, using first project:', targetProject);
    }

    // Create ADO service instance with project
    const adoService = new ADOService(organization, pat, targetProject);

    // Parse command and parameter
    const parts = command.trim().split(' ');
    const mainCommand = parts[0];
    const param = parts.slice(1).join(' ');

    console.log('[ADO API] Parsed command:', { mainCommand, param, filters });

    // Build and execute query with global filters
    const query = adoService.buildQuery(mainCommand, param, filters);
    console.log('[ADO API] WIQL Query:', query);

    const workItems = await adoService.searchWorkItems(query);
    console.log('[ADO API] Found work items:', workItems.length);

    return NextResponse.json({
      workItems,
      searchScope: `Project: ${targetProject}`,
      debug: {
        organization,
        project: targetProject,
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
