# ADO Explorer - Quick Setup Guide

## 🎯 Your Organization: cmgfidev

Your Azure DevOps URL: `https://cmgfidev.visualstudio.com/Next%20Gen%20LOS`

---

## 🚀 Quick Start (3 Steps)

### Step 1: Get Your Personal Access Token (PAT)

1. Go to: **https://cmgfidev.visualstudio.com/_usersSettings/tokens**
2. Click **"+ New Token"**
3. Fill in:
   - **Name**: ADO Explorer
   - **Expiration**: 90 days (or your preference)
   - **Scopes**:
     - ✅ Work Items (Read)
     - ✅ Project and Team (Read)
4. Click **Create**
5. **⚠️ IMPORTANT**: Copy the token immediately (you won't see it again!)

---

### Step 2: Configure Vercel Environment Variables

Go to your Vercel project: **https://vercel.com/cmgprojects/ado-explorer/settings/environment-variables**

Add these 2 variables:

| Variable Name | Value | Notes |
|--------------|--------|-------|
| `NEXT_PUBLIC_ADO_ORGANIZATION` | `cmgfidev` | Your organization name |
| `ADO_PAT` | *paste your token here* | From Step 1 |

**Optional** - Only add this if you want to search ONE project only:

| Variable Name | Value | Notes |
|--------------|--------|-------|
| `NEXT_PUBLIC_ADO_PROJECT` | `Next Gen LOS` | Leave blank for ALL projects |

---

### Step 3: Redeploy (Automatic)

Vercel will automatically redeploy after you save the environment variables. Wait about 30 seconds, then refresh your app!

---

## 🌐 Your Live App

**Production URL**: https://ado-explorer-qxd4ew2i4-cmgprojects.vercel.app

---

## 🔍 Search Modes

### Mode 1: Search ALL Projects (Recommended)
- **Setup**: Don't add `NEXT_PUBLIC_ADO_PROJECT` variable (or leave it blank)
- **Result**: Searches across your entire organization
- **Display**: Each work item shows which project it belongs to

### Mode 2: Search One Project Only
- **Setup**: Set `NEXT_PUBLIC_ADO_PROJECT=Next Gen LOS`
- **Result**: Only searches "Next Gen LOS" project
- **Display**: Faster, focused results

---

## 💡 Available Commands

Once configured, try these commands in the chat:

- `/recent` - Recently updated work items
- `/created_by [name]` - Work items created by someone (e.g., `/created_by ericka`)
- `/assigned_to [name]` - Work items assigned to someone
- `/state [state]` - Filter by state (e.g., `/state active`)
- `/type [type]` - Filter by type (e.g., `/type bug`)
- `/tag [tag]` - Search by tag
- `/help` - Show all commands

You can also just type any search term without a slash to search in titles and descriptions!

---

## 🔧 Troubleshooting

### "ADO configuration not found" error
- Make sure you added both `NEXT_PUBLIC_ADO_ORGANIZATION` and `ADO_PAT` in Vercel
- Wait 30 seconds for Vercel to redeploy
- Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)

### "Demo Mode" message
- This means the app is using mock data
- Follow Steps 1-3 above to connect to real data

### PAT token expired
- Create a new token (Step 1)
- Update the `ADO_PAT` variable in Vercel
- Vercel will auto-redeploy

---

## 📞 Support

- **GitHub Issues**: https://github.com/mhansen003/ado-explorer/issues
- **Vercel Dashboard**: https://vercel.com/cmgprojects/ado-explorer
- **ADO Settings**: https://cmgfidev.visualstudio.com/_usersSettings/tokens

---

## 🎨 Features

✨ Robinhood-style dark interface
⚡ Real-time slash command autocomplete
🔍 Search across all projects or one specific project
📊 Compact card view with detailed modal on click
🚀 Deployed on Vercel with automatic updates from GitHub

---

**Made with Claude Code** 🤖
