import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';
import { GlobalFilters } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { queryId, filters } = await request.json() as { queryId: string; filters?: GlobalFilters };

    // Get configuration from environment variables
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;

    console.log('[ADO Run Query API] Configuration:', {
      organization,
      hasProject: !!project,
      hasPAT: !!pat,
      queryId,
    });

    if (!organization || !pat) {
      console.error('[ADO Run Query API] Missing configuration');
      return NextResponse.json(
        {
          error: 'ADO configuration not found. Please set NEXT_PUBLIC_ADO_ORGANIZATION and ADO_PAT environment variables.',
          details: { hasOrg: !!organization, hasPAT: !!pat }
        },
        { status: 500 }
      );
    }

    if (!project) {
      console.error('[ADO Run Query API] Project is required');
      return NextResponse.json(
        {
          error: 'Project is required to run queries. Please set NEXT_PUBLIC_ADO_PROJECT environment variable.',
        },
        { status: 500 }
      );
    }

    // Create ADO service instance
    const adoService = new ADOService(organization, pat, project);

    // Run the query
    const workItems = await adoService.runQuery(queryId);
    console.log('[ADO Run Query API] Query returned', workItems.length, 'work items');

    return NextResponse.json({
      workItems,
      searchScope: `Project: ${project}`,
      debug: {
        organization,
        project,
        queryId,
        count: workItems.length,
      }
    });
  } catch (error: any) {
    console.error('[ADO Run Query API] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: error.message || 'Failed to run query',
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
