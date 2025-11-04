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
    const tags = await adoService.getTags();
    console.log('[ADO Tags API] Found tags:', tags.length);

    return NextResponse.json({ tags });
  } catch (error: any) {
    console.error('[ADO Tags API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}
