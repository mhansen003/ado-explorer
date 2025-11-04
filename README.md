# ADO Explorer 🚀

A next-generation Azure DevOps browser with a powerful command-line interface and Robinhood-style design.

## Features

- 💬 **Chat-based Interface**: Natural conversation flow for searching and exploring work items
- ⚡ **Slash Commands**: Quick access to powerful search filters with autocomplete
- 🎨 **Robinhood-style Design**: Clean, modern, dark interface
- 📊 **Compact Card View**: Efficient display of search results
- 🔍 **Global Search**: Search across all work items with flexible filters
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

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_ADO_ORGANIZATION=your-org
NEXT_PUBLIC_ADO_PROJECT=your-project
ADO_PAT=your-personal-access-token
```

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
