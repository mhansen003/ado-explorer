import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function GET(request: NextRequest) {
  try {
    // Get configuration from environment variables
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;

    if (!organization || !pat) {
      return NextResponse.json(
        { error: 'ADO configuration not found. Please set NEXT_PUBLIC_ADO_ORGANIZATION and ADO_PAT environment variables.' },
        { status: 500 }
      );
    }

    // Get optional project filter from query params
    const searchParams = request.nextUrl.searchParams;
    const projectFilter = searchParams.get('project');

    // Create ADO service instance
    const adoService = new ADOService(organization, pat, project);

    // Get all teams/boards
    const teams = await adoService.getTeams(projectFilter || undefined);

    return NextResponse.json({ teams });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch teams/boards' },
      { status: 500 }
    );
  }
}
