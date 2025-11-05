import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function GET(request: NextRequest) {
  try {
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;

    if (!organization || !pat) {
      return NextResponse.json(
        { error: 'ADO configuration not found.' },
        { status: 500 }
      );
    }

    const adoService = new ADOService(organization, pat, project);
    const states = await adoService.getStates();
    console.log('[ADO States API] Found states:', states.length);

    return NextResponse.json(states);
  } catch (error: any) {
    console.error('[ADO States API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch states' },
      { status: 500 }
    );
  }
}
