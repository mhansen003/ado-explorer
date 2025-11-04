import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json();

    // Get configuration from environment variables
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;

    if (!organization || !project || !pat) {
      return NextResponse.json(
        { error: 'ADO configuration not found. Please set environment variables.' },
        { status: 500 }
      );
    }

    // Create ADO service instance
    const adoService = new ADOService(organization, project, pat);

    // Parse command and parameter
    const parts = command.trim().split(' ');
    const mainCommand = parts[0];
    const param = parts.slice(1).join(' ');

    // Build and execute query
    const query = adoService.buildQuery(mainCommand, param);
    const workItems = await adoService.searchWorkItems(query);

    return NextResponse.json({ workItems });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search work items' },
      { status: 500 }
    );
  }
}
