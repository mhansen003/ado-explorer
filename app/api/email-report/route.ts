/**
 * Email Report API Route
 * Sends search results, charts, and data to authenticated user's email
 */

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG, EMAIL_CONFIG } from '@/lib/auth/config';

interface EmailReportRequest {
  searchParams: {
    query?: string;
    state?: string;
    assignedTo?: string;
    type?: string;
    dateRange?: string;
  };
  workItems: any[];
  charts?: {
    name: string;
    image: string; // base64
  }[];
}

/**
 * Create email transporter
 */
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

/**
 * Generate CSV content from work items
 */
function generateCSV(workItems: any[]): string {
  if (!workItems || workItems.length === 0) {
    return 'No data available';
  }

  // CSV Headers
  const headers = ['ID', 'Title', 'Type', 'State', 'Assigned To', 'Tags', 'Created Date'];

  // CSV Rows
  const rows = workItems.map(item => [
    item.id || '',
    `"${(item.title || '').replace(/"/g, '""')}"`, // Escape quotes
    item.type || '',
    item.state || '',
    item.assignedTo || '',
    item.tags ? `"${item.tags.join(', ')}"` : '',
    item.createdDate || '',
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Generate HTML email content
 */
function generateEmailHTML(
  userEmail: string,
  searchParams: any,
  workItems: any[],
  charts?: { name: string; image: string }[]
): string {
  const searchSummary = Object.entries(searchParams)
    .filter(([_, value]) => value)
    .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
    .join(' • ');

  const chartHTML = charts && charts.length > 0
    ? charts.map(chart => `
        <div style="margin: 24px 0;">
          <h3 style="color: #10b981; margin-bottom: 12px;">${chart.name}</h3>
          <img src="${chart.image}" alt="${chart.name}" style="max-width: 100%; border: 1px solid #2d3748; border-radius: 8px;" />
        </div>
      `).join('')
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0f1419;
      color: #d1d5db;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 12px 12px 0 0;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #d1fae5;
      font-size: 14px;
    }
    .content {
      background-color: #1a1f2e;
      border: 1px solid #2d3748;
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 40px 32px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      color: #10b981;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      border-bottom: 2px solid #10b981;
      padding-bottom: 8px;
    }
    .search-info {
      background-color: #1e3a28;
      border: 1px solid #10b981;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.6;
    }
    .stats {
      display: flex;
      gap: 16px;
      margin: 24px 0;
    }
    .stat-card {
      flex: 1;
      background: linear-gradient(135deg, #1e3a28 0%, #1a2e26 100%);
      border: 1px solid #10b981;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-number {
      font-size: 32px;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 12px;
      color: #9ca3af;
      text-transform: uppercase;
    }
    .footer {
      text-align: center;
      padding: 24px;
      color: #6b7280;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ADO Explorer Report</h1>
      <p>Work Item Analysis • ${new Date().toLocaleDateString()}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">Search Parameters</div>
        <div class="search-info">
          ${searchSummary || 'All work items'}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Summary</div>
        <div class="stats">
          <div class="stat-card">
            <div class="stat-number">${workItems.length}</div>
            <div class="stat-label">Total Items</div>
          </div>
        </div>
      </div>

      ${chartHTML ? `
        <div class="section">
          <div class="section-title">Charts</div>
          ${chartHTML}
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Data Export</div>
        <p style="color: #9ca3af; font-size: 14px;">
          A CSV file with all ${workItems.length} work items is attached to this email.
        </p>
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
    const body: EmailReportRequest = await request.json();
    const { searchParams, workItems, charts } = body;

    console.log('[Email Report] Generating report for:', userEmail);

    // Generate CSV
    const csvContent = generateCSV(workItems);

    // Generate HTML email
    const htmlContent = generateEmailHTML(userEmail, searchParams, workItems, charts);

    // Send email
    const transporter = createEmailTransporter();

    await transporter.sendMail({
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.SMTP_USER}>`,
      to: userEmail,
      subject: `ADO Explorer Report - ${workItems.length} Work Items (${new Date().toLocaleDateString()})`,
      html: htmlContent,
      attachments: [
        {
          filename: `ado-report-${new Date().toISOString().split('T')[0]}.csv`,
          content: csvContent,
          contentType: 'text/csv',
        },
      ],
    });

    console.log('[Email Report] Report sent successfully to:', userEmail);

    return NextResponse.json({
      success: true,
      message: `Report sent to ${userEmail}`,
    });

  } catch (error: any) {
    console.error('[Email Report] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send report',
      },
      { status: 500 }
    );
  }
}
