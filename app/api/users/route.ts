import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-api';

export async function GET(request: NextRequest) {
  try {
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    const pat = process.env.ADO_PAT;

    console.log('[ADO Users API] Configuration:', {
      organization,
      hasProject: !!project,
      hasPAT: !!pat,
    });

    if (!organization || !pat) {
      return NextResponse.json(
        { error: 'ADO configuration not found.' },
        { status: 500 }
      );
    }

    const adoService = new ADOService(organization, pat, project);
    const users = await adoService.getUsers();
    console.log('[ADO Users API] Found users:', users.length);

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('[ADO Users API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
