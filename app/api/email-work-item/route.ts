/**
 * Email Work Item API Route
 * Sends comprehensive work item details including discussion and relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG, EMAIL_CONFIG } from '@/lib/auth/config';
import { WorkItem, Comment } from '@/types';

interface EmailWorkItemRequest {
  workItem: WorkItem;
  comments: Comment[];
  relatedWorkItems: WorkItem[];
}

function createEmailTransporter() {
  if (!EMAIL_CONFIG.SMTP_USER || !EMAIL_CONFIG.SMTP_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  return nodemailer.createTransport({
    host: EMAIL_CONFIG.SMTP_HOST,
    port: EMAIL_CONFIG.SMTP_PORT,
    secure: false,
    auth: {
      user: EMAIL_CONFIG.SMTP_USER,
      pass: EMAIL_CONFIG.SMTP_PASS,
    },
  });
}

function stripHTML(html: string): string {
  // Simple HTML stripping for email content
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateEmailHTML(
  userEmail: string,
  workItem: WorkItem,
  comments: Comment[],
  relatedWorkItems: WorkItem[]
): string {
  const descriptionText = workItem.description ? stripHTML(workItem.description) : 'No description provided';
  const criteriaText = workItem.acceptanceCriteria ? stripHTML(workItem.acceptanceCriteria) : 'No acceptance criteria';

  const commentsHTML = comments.length > 0
    ? comments.map(comment => `
        <div style="background: rgba(255, 255, 255, 0.03); border-left: 3px solid #10b981; padding: 16px; margin-bottom: 12px; border-radius: 6px;">
          <div style="display: flex; justify-between; margin-bottom: 8px;">
            <strong style="color: #10b981;">${comment.createdBy}</strong>
            <span style="color: #6B6B6D; font-size: 12px;">${new Date(comment.createdDate).toLocaleString()}</span>
          </div>
          <div style="color: #E5E5E7; line-height: 1.6;">${stripHTML(comment.text)}</div>
        </div>
      `).join('')
    : '<p style="color: #6B6B6D;">No comments yet</p>';

  const relationshipsHTML = relatedWorkItems.length > 0
    ? relatedWorkItems.map(related => `
        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 12px; margin-bottom: 8px; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="background: ${
              related.relationType === 'Parent' ? '#10b981' :
              related.relationType === 'Child' ? '#f59e0b' :
              related.relationType === 'Related' ? '#3b82f6' : '#6366f1'
            }; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">${related.relationType || 'Related'}</span>
            <span style="color: #10b981; font-weight: 600;">#${related.id}</span>
            <span style="color: #E5E5E7;">${related.title}</span>
          </div>
          <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12px;">
            <span style="color: #6B6B6D;">Type: <strong style="color: #A0A0A3;">${related.type}</strong></span>
            <span style="color: #6B6B6D;">State: <strong style="color: #A0A0A3;">${related.state}</strong></span>
          </div>
        </div>
      `).join('')
    : '<p style="color: #6B6B6D;">No related work items</p>';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0D0D0D;
      color: #E5E5E7;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 12px 12px 0 0;
      padding: 40px 32px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
    }
    .header .id {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      margin-top: 8px;
    }
    .content {
      background: linear-gradient(to bottom, #0D0D0D 0%, #000000 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 48px 32px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section-title {
      color: #10b981;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(16, 185, 129, 0.3);
    }
    .detail-row {
      display: flex;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .detail-label {
      width: 150px;
      color: #6B6B6D;
      font-weight: 500;
      font-size: 14px;
    }
    .detail-value {
      flex: 1;
      color: #E5E5E7;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      padding: 32px 24px;
      color: #6B6B6D;
      font-size: 13px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${workItem.title}</h1>
      <div class="id">Work Item #${workItem.id} • ${workItem.type}</div>
    </div>
    <div class="content">
      <!-- Details Section -->
      <div class="section">
        <div class="section-title">📋 Details</div>
        <div class="detail-row">
          <div class="detail-label">State</div>
          <div class="detail-value"><strong>${workItem.state}</strong></div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Priority</div>
          <div class="detail-value">P${workItem.priority}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Assigned To</div>
          <div class="detail-value">${workItem.assignedTo}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Created By</div>
          <div class="detail-value">${workItem.createdBy} on ${new Date(workItem.createdDate).toLocaleDateString()}</div>
        </div>
        ${workItem.project ? `
        <div class="detail-row">
          <div class="detail-label">Project</div>
          <div class="detail-value">${workItem.project}</div>
        </div>
        ` : ''}
        ${workItem.tags && workItem.tags.length > 0 ? `
        <div class="detail-row">
          <div class="detail-label">Tags</div>
          <div class="detail-value">${workItem.tags.join(', ')}</div>
        </div>
        ` : ''}
      </div>

      <!-- Description Section -->
      <div class="section">
        <div class="section-title">📝 Description</div>
        <div style="background: rgba(255, 255, 255, 0.03); border-radius: 8px; padding: 20px; color: #E5E5E7; line-height: 1.7;">
          ${descriptionText}
        </div>
      </div>

      <!-- Acceptance Criteria Section -->
      <div class="section">
        <div class="section-title">✓ Acceptance Criteria</div>
        <div style="background: rgba(16, 185, 129, 0.05); border-radius: 8px; padding: 20px; color: #E5E5E7; line-height: 1.7;">
          ${criteriaText}
        </div>
      </div>

      <!-- Discussion Section -->
      <div class="section">
        <div class="section-title">💬 Discussion (${comments.length} comments)</div>
        ${commentsHTML}
      </div>

      <!-- Relationships Section -->
      <div class="section">
        <div class="section-title">🔗 Related Work Items (${relatedWorkItems.length})</div>
        ${relationshipsHTML}
      </div>
    </div>
    <div class="footer">
      Report generated for <strong>${userEmail}</strong><br>
      ADO Explorer - Azure DevOps Work Item Management<br>
      © ${new Date().getFullYear()} CMG Financial. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const session = verifyAuthToken(token);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userEmail = session.email;
    const body: EmailWorkItemRequest = await request.json();
    const { workItem, comments, relatedWorkItems } = body;

    console.log('[Email Work Item] Generating report for:', userEmail, 'Work Item:', workItem.id);

    // Generate HTML email
    const htmlContent = generateEmailHTML(userEmail, workItem, comments, relatedWorkItems);

    // Send email
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.SMTP_USER}>`,
      to: userEmail,
      subject: `Work Item #${workItem.id}: ${workItem.title}`,
      html: htmlContent,
    });

    console.log('[Email Work Item] Email sent successfully to:', userEmail);

    return NextResponse.json({
      success: true,
      message: `Work item sent to ${userEmail}`,
    });

  } catch (error: any) {
    console.error('[Email Work Item] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send email',
      },
      { status: 500 }
    );
  }
}
