/**
 * Email Report Utilities
 * Functions for capturing charts and sending email reports
 */

import html2canvas from 'html2canvas';

export interface ChartCapture {
  name: string;
  image: string; // base64
}

/**
 * Capture a DOM element as a base64 PNG image
 */
export async function captureElementAsImage(
  element: HTMLElement,
  name: string
): Promise<ChartCapture> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#1a1f2e',
      scale: 2, // Higher resolution
      logging: false,
    });

    const image = canvas.toDataURL('image/png');

    return {
      name,
      image,
    };
  } catch (error) {
    console.error(`Failed to capture ${name}:`, error);
    throw error;
  }
}

/**
 * Capture multiple chart elements
 */
export async function captureCharts(
  chartRefs: Array<{ ref: React.RefObject<HTMLElement>; name: string }>
): Promise<ChartCapture[]> {
  const captures: ChartCapture[] = [];

  for (const { ref, name } of chartRefs) {
    if (ref.current) {
      try {
        const capture = await captureElementAsImage(ref.current, name);
        captures.push(capture);
      } catch (error) {
        console.error(`Failed to capture chart ${name}:`, error);
        // Continue with other charts even if one fails
      }
    }
  }

  return captures;
}

/**
 * Send email report with charts and data
 */
export async function sendEmailReport(data: {
  searchParams: any;
  workItems: any[];
  charts?: ChartCapture[];
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch('/api/email-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      credentials: 'include',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send email report');
    }

    return {
      success: true,
      message: result.message,
    };
  } catch (error: any) {
    console.error('Failed to send email report:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email report',
    };
  }
}
