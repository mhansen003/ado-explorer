import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function POST(request: NextRequest) {
  try {
    const { workItemId } = await request.json() as { workItemId: number };

    // Get configuration from environment variables
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;

    console.log('[Comments API] Configuration:', {
      organization,
      project,
      hasProject: !!project,
      hasPAT: !!pat,
      workItemId,
    });

    if (!organization || !pat) {
      console.error('[Comments API] Missing configuration:', { organization: !!organization, pat: !!pat });
      return NextResponse.json(
        { error: 'ADO configuration not found.' },
        { status: 500 }
      );
    }

    if (!project) {
      console.error('[Comments API] Missing project configuration');
      return NextResponse.json(
        { error: 'Azure DevOps project must be configured. Please set NEXT_PUBLIC_ADO_PROJECT environment variable.' },
        { status: 500 }
      );
    }

    // Create ADO service instance
    const adoService = new ADOService(organization, pat, project);

    // Fetch comments
    const comments = await adoService.getComments(workItemId);
    console.log('[Comments API] Found comments:', comments.length);

    return NextResponse.json({ comments });
  } catch (error: any) {
    console.error('[Comments API] Error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch comments',
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
