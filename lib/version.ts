export const VERSION = 'v1.6';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    category: 'Feature' | 'Enhancement' | 'Fix';
    description: string;
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v1.6',
    date: '2025-01-12',
    changes: [
      {
        category: 'Feature',
        description: '🌳 Hierarchy View Toggle - Choose between Single (flat list) or Hierarchy (nested parent-child) view modes for work items',
      },
      {
        category: 'Feature',
        description: '💾 Complete Settings Persistence - All user preferences (filters, view modes, hierarchy toggle) now automatically saved to Redis and restored across sessions',
      },
      {
        category: 'Enhancement',
        description: '⚙️ Unified Settings Management - Filters and view preferences saved together in Redis user profile with 90-day retention',
      },
    ],
  },
  {
    version: 'v1.5',
    date: '2025-01-12',
    changes: [
      {
        category: 'Feature',
        description: '📧 Preload Discussion & Relationships - Work item modal now loads comments and relationships immediately on open, ensuring email reports include all data',
      },
      {
        category: 'Feature',
        description: '🗺️ Relationship Map in Emails - Email reports now include high-resolution relationship diagram image showing visual hierarchy of work items',
      },
    ],
  },
  {
    version: 'v1.4.3',
    date: '2025-01-12',
    changes: [
      {
        category: 'Enhancement',
        description: '👤 Auto-populate User Filter - "My Tickets" filter now automatically uses authenticated email from MFA session, no manual entry needed',
      },
    ],
  },
  {
    version: 'v1.4.2',
    date: '2025-01-12',
    changes: [
      {
        category: 'Enhancement',
        description: '🗺️ Compact Relationship Map - Reduced card sizes (60%) and spacing to fit entire relationship graph on one screen, rely on tooltips for details',
      },
    ],
  },
  {
    version: 'v1.4.1',
    date: '2025-01-12',
    changes: [
      {
        category: 'Feature',
        description: '🔔 Toast Notifications - Elegant slide-in notifications for email sends with success/error feedback',
      },
      {
        category: 'Enhancement',
        description: '✉️ Email Template Redesign - Sleek black Robinhood-style email reports (#0D0D0D background) with refined typography and spacing',
      },
    ],
  },
  {
    version: 'v1.4',
    date: '2025-01-11',
    changes: [
      {
        category: 'Feature',
        description: '🔐 Email MFA Authentication - Secure login with one-time passwords sent to @cmgfi.com email addresses (5-day sessions)',
      },
      {
        category: 'Feature',
        description: '👤 User Profile Menu - User avatar with initials in top-right corner showing email and sign-out option',
      },
      {
        category: 'Feature',
        description: '💾 User Settings Persistence - Filter preferences automatically saved to Redis and restored across sessions (90-day retention)',
      },
      {
        category: 'Feature',
        description: '📧 Email Me Reports - Send search results and charts to your email with one click, includes HTML summary and CSV attachment',
      },
      {
        category: 'Feature',
        description: '📊 Email Chart Images - Charts can be emailed as high-resolution PNG images along with underlying data',
      },
      {
        category: 'Enhancement',
        description: '🎨 Smart Error Styling - AI responses now show in red when queries fail (needs better prompting) vs green for successful answers',
      },
      {
        category: 'Enhancement',
        description: '📏 Improved Column Widths - Results modal table now has better proportioned columns with more space for Type, State, and other metadata',
      },
      {
        category: 'Enhancement',
        description: '✉️ OTP Email Redesign - Login verification emails now match landing page styling with sleek black background',
      },
    ],
  },
  {
    version: 'v1.3',
    date: '2025-01-06',
    changes: [
      {
        category: 'Feature',
        description: '🧠 AI-Powered Analytics Engine - Ask analytical questions and get consultant-level insights with trends, recommendations, and automatic visualizations',
      },
      {
        category: 'Feature',
        description: '📈 Sprint Velocity Analysis - Calculate velocity trends, completion rates, and consistency scores across sprints with interactive line charts',
      },
      {
        category: 'Feature',
        description: '👥 Team Performance Metrics - Analyze team productivity, story point distribution, and top contributors with bar charts',
      },
      {
        category: 'Feature',
        description: '⏱️ Cycle Time Analysis - Track average and median time-to-completion by work item type to identify bottlenecks',
      },
      {
        category: 'Feature',
        description: '🔍 Trend Detection - AI automatically identifies increasing, decreasing, stable, or volatile patterns with actionable recommendations',
      },
      {
        category: 'Feature',
        description: '💡 Intelligent Query Classification - System automatically detects analytical vs search intent to provide appropriate responses',
      },
      {
        category: 'Enhancement',
        description: '🔄 Automatic Rate Limit Retry - OpenAI API calls now retry automatically with exponential backoff when rate limits are hit (up to 3 attempts)',
      },
      {
        category: 'Enhancement',
        description: '⚡ Hybrid Model Optimization - Simple tasks now use gpt-4o-mini for 6.7x higher rate limits and 60x lower cost, while complex analysis uses gpt-4o',
      },
      {
        category: 'Enhancement',
        description: '📊 Analytics Dashboard - Beautiful metric cards showing velocity, trends, cycle time, and team size at a glance',
      },
      {
        category: 'Enhancement',
        description: '🎯 Smart Recommendations - AI provides 2-3 specific action items based on velocity trends and team performance data',
      },
    ],
  },
  {
    version: 'v1.2',
    date: '2025-01-06',
    changes: [
      {
        category: 'Feature',
        description: 'Interactive Chart Creation - Create charts directly from search results with one-click Chart button and dropdown menu',
      },
      {
        category: 'Feature',
        description: 'Dynamic Pivot Selection - Change chart grouping on-the-fly between State, Type, Priority, Assigned To, and Created By',
      },
      {
        category: 'Feature',
        description: 'Project-Based Charts - Chart command now supports project selection to visualize specific project data',
      },
      {
        category: 'Feature',
        description: 'Grid Modal Charts - Create charts from filtered results in the grid modal with dedicated chart popup view',
      },
      {
        category: 'Enhancement',
        description: 'Improved dropdown visibility - Sprint and all dropdowns now show friendly names instead of GUIDs',
      },
      {
        category: 'Enhancement',
        description: 'Wider dropdown menus (256px → 384px) for better readability of long project and sprint names',
      },
      {
        category: 'Enhancement',
        description: 'Blue chart buttons for improved visibility and easier discovery of chart features',
      },
    ],
  },
  {
    version: 'v1.1',
    date: '2025-01-05',
    changes: [
      {
        category: 'Feature',
        description: 'Sprint/Iteration Support - Query work items by sprint, view current sprint, and filter by iteration path',
      },
      {
        category: 'Feature',
        description: 'Chart Visualizations - Create pie, bar, line, and area charts from search results to analyze work item distribution',
      },
      {
        category: 'Enhancement',
        description: 'Improved natural language AI understanding for sprint-related queries',
      },
      {
        category: 'Enhancement',
        description: 'Added sprint and chart command templates with interactive dropdowns',
      },
    ],
  },
  {
    version: 'v1.0',
    date: '2024-12-01',
    changes: [
      {
        category: 'Feature',
        description: 'Initial release - Chat-based Azure DevOps work item search',
      },
      {
        category: 'Feature',
        description: 'Natural language query processing with AI',
      },
      {
        category: 'Feature',
        description: 'Relationship mapping and visualization',
      },
      {
        category: 'Feature',
        description: 'Work item details with discussion threads',
      },
      {
        category: 'Feature',
        description: 'Global filters for refined searching',
      },
    ],
  },
];
