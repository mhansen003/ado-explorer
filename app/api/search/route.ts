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

    // Handle special /current-sprint command
    if (mainCommand === '/current-sprint' || mainCommand === '/current_sprint') {
      console.log('[ADO API] Handling current sprint query');
      let workItems = await adoService.getCurrentSprintWorkItems(targetProject, undefined, filters);
      console.log('[ADO API] Found work items in current sprint:', workItems.length);

      // Enrich work items with relationship information
      workItems = await adoService.enrichWorkItemsWithRelationships(workItems);

      return NextResponse.json({
        workItems,
        searchScope: `Project: ${targetProject} - Current Sprint`,
        debug: {
          organization,
          project: targetProject,
          command: 'current-sprint',
          count: workItems.length,
        }
      });
    }

    // Build and execute query with global filters
    const query = adoService.buildQuery(mainCommand, param, filters);
    console.log('[ADO API] WIQL Query:', query);

    let workItems = await adoService.searchWorkItems(query);
    console.log('[ADO API] Found work items:', workItems.length);

    // Enrich work items with relationship information
    workItems = await adoService.enrichWorkItemsWithRelationships(workItems);

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

    // Handle specific Azure DevOps errors
    const status = error.response?.status;
    const errorMessage = error.response?.data?.message || error.message;

    // TF51011: Iteration path doesn't exist
    if (status === 400 && errorMessage && errorMessage.includes('TF51011')) {
      const pathMatch = errorMessage.match(/«'([^']+)'»/);
      const invalidPath = pathMatch ? pathMatch[1] : 'unknown path';

      console.warn('[ADO API] Invalid iteration path detected:', invalidPath);

      return NextResponse.json(
        {
          error: 'Sprint or iteration path not found',
          message: `The sprint path "${invalidPath}" doesn't exist or may have been archived.`,
          hint: 'This sprint may have been deleted, archived, or renamed. Try searching for a different sprint or use the current sprint instead.',
          invalidPath,
          errorCode: 'INVALID_ITERATION_PATH'
        },
        { status: 404 } // Changed to 404 (Not Found) instead of 500
      );
    }

    // TF51005: Area path doesn't exist
    if (status === 400 && errorMessage && errorMessage.includes('TF51005')) {
      return NextResponse.json(
        {
          error: 'Area path not found',
          message: 'The specified team or area path doesn\'t exist in this project.',
          hint: 'This area may have been deleted or renamed. Try selecting a different team from the list.',
          errorCode: 'INVALID_AREA_PATH'
        },
        { status: 404 }
      );
    }

    // VS403403: Permission denied
    if (status === 403 || errorMessage?.includes('VS403403')) {
      return NextResponse.json(
        {
          error: 'Permission denied',
          message: 'You don\'t have permission to access this resource.',
          hint: 'Your Personal Access Token may not have the required permissions or may have expired.',
          errorCode: 'PERMISSION_DENIED'
        },
        { status: 403 }
      );
    }

    // Generic 400 errors
    if (status === 400) {
      return NextResponse.json(
        {
          error: 'Invalid query',
          message: errorMessage || 'The search query is invalid.',
          hint: 'Try rephrasing your search or check that paths and field names are correct.',
          details: error.response?.data,
          errorCode: 'INVALID_QUERY'
        },
        { status: 400 }
      );
    }

    // Generic error fallback
    return NextResponse.json(
      {
        error: error.message || 'Failed to search work items',
        message: 'An unexpected error occurred while searching.',
        details: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        },
        errorCode: 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}
