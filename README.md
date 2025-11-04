# ADO Explorer 🚀

A next-generation Azure DevOps browser with a powerful command-line interface and Robinhood-style design.

## Features

- 💬 **Chat-based Interface**: Natural conversation flow for searching and exploring work items
- ⚡ **Slash Commands**: Quick access to powerful search filters with autocomplete
- 🎨 **Robinhood-style Design**: Clean, modern, dark interface
- 📊 **Compact Card View**: Efficient display of search results
- 🔍 **Global Search**: Search across ALL projects or filter to one specific project
- 🌐 **Multi-Project Support**: Query across your entire Azure DevOps organization
- 📱 **Responsive**: Works on desktop and mobile devices

## Available Commands

- `/clear` - Search for work items containing "clear"
- `/created_by <name>` - Filter by creator (e.g., /created_by ericka)
- `/assigned_to <name>` - Filter by assignee
- `/state <state>` - Filter by state (active, resolved, etc.)
- `/type <type>` - Filter by work item type (Bug, Task, Story)
- `/project <name>` - Filter by project name
- `/tag <tag>` - Filter by tag
- `/recent` - Show recently updated items
- `/help` - Show available commands

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Azure DevOps account with Personal Access Token

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://://3000) in your browser.

### Configuration

#### Finding Your Organization Name

Your ADO organization is in your Azure DevOps URL:
- `https://cmgfidev.visualstudio.com/...` → Organization: **cmgfidev**
- `https://dev.azure.com/yourorg/...` → Organization: **yourorg**

#### Creating Your Environment File

Copy `.env.local.example` to `.env.local` and configure:

```env
# Required: Your organization name
NEXT_PUBLIC_ADO_ORGANIZATION=cmgfidev

# Optional: Leave blank/commented to search ALL projects
# Set to search only one project (e.g., "Next Gen LOS")
# NEXT_PUBLIC_ADO_PROJECT=Next Gen LOS

# Required: Your Personal Access Token
ADO_PAT=your-personal-access-token
```

#### Getting Your Personal Access Token (PAT)

1. Go to: `https://[your-org].visualstudio.com/_usersSettings/tokens`
2. Click **"+ New Token"**
3. Name it: "ADO Explorer"
4. Set expiration: 90 days or custom
5. Required Scopes:
   - ✅ **Work Items (Read)**
   - ✅ **Project and Team (Read)** - for all-project searches
6. Click **Create** and **copy the token** immediately

#### Search Scope Options

- **All Projects**: Leave `NEXT_PUBLIC_ADO_PROJECT` blank or commented out
  - Searches across your entire organization
  - Each result shows which project it belongs to

- **Single Project**: Set `NEXT_PUBLIC_ADO_PROJECT=Your Project Name`
  - Faster queries, focused results
  - Use the exact project name from your ADO

## Building for Production

```bash
npm run build
npm run start
```

## Deployment

This project is optimized for deployment on Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mhansen003/ado-explorer)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **API**: Azure DevOps REST API

## License

MIT
