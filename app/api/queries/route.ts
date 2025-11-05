import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function GET(request: NextRequest) {
  try {
    // Get configuration from environment variables
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;

    console.log('[ADO Queries API] Configuration:', {
      organization,
      hasProject: !!project,
      hasPAT: !!pat,
    });

    if (!organization || !pat) {
      console.error('[ADO Queries API] Missing configuration');
      return NextResponse.json(
        {
          error: 'ADO configuration not found. Please set NEXT_PUBLIC_ADO_ORGANIZATION and ADO_PAT environment variables.',
          details: { hasOrg: !!organization, hasPAT: !!pat }
        },
        { status: 500 }
      );
    }

    if (!project) {
      console.error('[ADO Queries API] Project is required for queries');
      return NextResponse.json(
        {
          error: 'Project is required to fetch queries. Please set NEXT_PUBLIC_ADO_PROJECT environment variable.',
        },
        { status: 500 }
      );
    }

    // Create ADO service instance
    const adoService = new ADOService(organization, pat, project);

    // Get all queries
    const queries = await adoService.getQueries();
    console.log('[ADO Queries API] Found queries:', queries.length);

    return NextResponse.json({ queries });
  } catch (error: any) {
    console.error('[ADO Queries API] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch queries',
        details: {
          status: error.response?.status,
          data: error.response?.data,
        }
      },
      { status: 500 }
    );
  }
}
