import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function DELETE(request: NextRequest) {
  try {
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const pat = process.env.ADO_PAT;

    if (!organization || !pat) {
      return NextResponse.json(
        { error: 'ADO configuration not found.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { workItemIds } = body;

    if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
      return NextResponse.json(
        { error: 'No work item IDs provided' },
        { status: 400 }
      );
    }

    console.log(`[Work Items Delete API] Deleting ${workItemIds.length} work items`);

    const auth = Buffer.from(`:${pat}`).toString('base64');
    let deletedCount = 0;
    const errors: { id: string; error: string }[] = [];

    // Delete each work item
    for (const workItemId of workItemIds) {
      try {
        const url = `https://dev.azure.com/${organization}/_apis/wit/workitems/${workItemId}?api-version=7.1`;

        await axios.delete(url, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        deletedCount++;
        console.log(`[Work Items Delete API] Successfully deleted work item ${workItemId}`);
      } catch (error: any) {
        console.error(`[Work Items Delete API] Failed to delete work item ${workItemId}:`, error.message);
        errors.push({
          id: workItemId,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    console.log(`[Work Items Delete API] Deleted ${deletedCount}/${workItemIds.length} work items`);

    return NextResponse.json({
      deletedCount,
      total: workItemIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[Work Items Delete API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to delete work items' },
      { status: 500 }
    );
  }
}
