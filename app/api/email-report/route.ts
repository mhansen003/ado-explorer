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
        <div style="margin: 28px 0;">
          <div class="chart-title">${chart.name}</div>
          <div class="chart-container">
            <img src="${chart.image}" alt="${chart.name}" style="max-width: 100%; display: block; background: #000000;" />
          </div>
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
      text-align: center;
      box-shadow: 0 8px 32px rgba(16, 185, 129, 0.2);
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 12px 0 0 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 15px;
      font-weight: 500;
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
      letter-spacing: -0.3px;
    }
    .search-info {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.8;
      color: #E5E5E7;
    }
    .stats {
      display: flex;
      gap: 20px;
      margin: 24px 0;
    }
    .stat-card {
      flex: 1;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }
    .stat-number {
      font-size: 42px;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 8px;
      letter-spacing: -1px;
    }
    .stat-label {
      font-size: 13px;
      color: #A0A0A3;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }
    .chart-container {
      margin: 28px 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }
    .chart-title {
      color: #E5E5E7;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-left: 4px;
    }
    .data-export-info {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 20px;
      color: #A0A0A3;
      font-size: 14px;
      line-height: 1.6;
    }
    .data-export-info strong {
      color: #E5E5E7;
    }
    .footer {
      text-align: center;
      padding: 32px 24px;
      color: #6B6B6D;
      font-size: 13px;
      line-height: 1.8;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      margin-top: 20px;
    }
    .footer strong {
      color: #10b981;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ADO Explorer Report</h1>
      <p>Work Item Analysis • ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
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
          <div class="section-title">Charts & Analytics</div>
          ${chartHTML}
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Data Export</div>
        <div class="data-export-info">
          📎 A CSV file containing all <strong>${workItems.length} work items</strong> is attached to this email for further analysis.
        </div>
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
