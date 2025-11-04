import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json();

    // Get configuration from environment variables
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT; // Optional - if not set, searches all projects
    const pat = process.env.ADO_PAT;

    if (!organization || !pat) {
      return NextResponse.json(
        { error: 'ADO configuration not found. Please set NEXT_PUBLIC_ADO_ORGANIZATION and ADO_PAT environment variables.' },
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

    // Build and execute query
    const query = adoService.buildQuery(mainCommand, param);
    const workItems = await adoService.searchWorkItems(query);

    return NextResponse.json({
      workItems,
      searchScope: project ? `Project: ${project}` : 'All Projects'
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search work items' },
      { status: 500 }
    );
  }
}
