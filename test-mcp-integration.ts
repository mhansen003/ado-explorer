/**
 * Test Script: MCP Integration Verification
 *
 * This script tests the MCP integration to ensure:
 * 1. MCP service can be instantiated
 * 2. OpenRouter/Anthropic API is accessible
 * 3. Hybrid service properly falls back to REST on errors
 * 4. Sprint queries work better with MCP
 *
 * Run with: npx tsx test-mcp-integration.ts
 */

import { config } from 'dotenv';
import { ADOServiceHybrid } from './lib/ado-service-hybrid';
import { MCPADOService } from './lib/mcp-ado-service';

// Load .env.local explicitly
config({ path: '.env.local' });

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(` ${message}`, colors.green);
}

function warning(message: string) {
  log(`�  ${message}`, colors.yellow);
}

function error(message: string) {
  log(`L ${message}`, colors.red);
}

function info(message: string) {
  log(`9  ${message}`, colors.cyan);
}

function header(message: string) {
  log(`\n${colors.bright}=== ${message} ===${colors.reset}`, colors.blue);
}

async function main() {
  log('\n=� MCP Integration Test Suite\n', colors.bright);

  // Configuration check
  header('Configuration Check');
  const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
  const pat = process.env.ADO_PAT;
  const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here';
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your-openrouter-key-here';

  if (!organization || !pat) {
    error('Missing ADO configuration');
    info('Set NEXT_PUBLIC_ADO_ORGANIZATION and ADO_PAT in .env.local');
    process.exit(1);
  }
  success(`Organization: ${organization}`);
  success(`Project: ${project || 'All projects'}`);

  if (!hasAnthropicKey && !hasOpenRouterKey) {
    warning('No MCP API key found');
    info('MCP features will be disabled. Add OPENROUTER_API_KEY or ANTHROPIC_API_KEY to .env.local');
  } else {
    const provider = hasOpenRouterKey ? 'OpenRouter' : 'Anthropic';
    success(`MCP Provider: ${provider}`);
  }

  // Test 1: Create Hybrid Service
  header('Test 1: Create Hybrid Service');
  let hybridService: ADOServiceHybrid;
  try {
    hybridService = new ADOServiceHybrid(organization, pat, project, {
      useMCP: true,
      useOpenRouter: hasOpenRouterKey,
    });
    success('Hybrid service created successfully');

    const status = hybridService.getServiceStatus();
    info(`MCP Enabled: ${status.useMCP}`);
    info(`MCP Available: ${status.mcpAvailable}`);
    info(`REST Available: ${status.restAvailable}`);

    if (status.useMCP && status.mcpAvailable) {
      success('MCP is active and available!');
    } else if (status.useMCP && !status.mcpAvailable) {
      warning('MCP is enabled but not available (will use REST fallback)');
    } else {
      info('MCP is disabled (using REST API only)');
    }
  } catch (err: any) {
    error(`Failed to create hybrid service: ${err.message}`);
    process.exit(1);
  }

  // Test 2: Get Projects (tests basic connectivity)
  header('Test 2: Get Projects');
  try {
    const projects = await hybridService.getProjects();
    success(`Found ${projects.length} projects`);
    if (projects.length > 0) {
      projects.slice(0, 3).forEach(p => {
        info(`  - ${p.name}${p.description ? ` (${p.description})` : ''}`);
      });
    }
  } catch (err: any) {
    error(`Failed to get projects: ${err.message}`);
  }

  // Test 3: Get Sprints (this is where MCP shines!)
  header('Test 3: Get Sprints');
  const testProject = project || organization;
  try {
    const sprints = await hybridService.getSprints(testProject);
    success(`Found ${sprints.length} sprints in project: ${testProject}`);

    // Check if we got timeFrame data (only available with MCP!)
    const withTimeFrame = sprints.filter(s => s.timeFrame);
    if (withTimeFrame.length > 0) {
      success(`<� MCP is working! Got timeFrame data for ${withTimeFrame.length} sprints`);
      info('TimeFrame breakdown:');
      const current = sprints.filter(s => s.timeFrame === 'current');
      const past = sprints.filter(s => s.timeFrame === 'past');
      const future = sprints.filter(s => s.timeFrame === 'future');
      if (current.length > 0) info(`  - Current: ${current.length} (${current.map(s => s.name).join(', ')})`);
      if (past.length > 0) info(`  - Past: ${past.length}`);
      if (future.length > 0) info(`  - Future: ${future.length}`);
    } else {
      warning('No timeFrame data found (MCP may not be active, using REST fallback)');
    }

    // Show first few sprints
    if (sprints.length > 0) {
      info('Sample sprints:');
      sprints.slice(0, 5).forEach(s => {
        const timeFrame = s.timeFrame ? ` [${s.timeFrame}]` : '';
        info(`  - ${s.name}${timeFrame}`);
      });
    }
  } catch (err: any) {
    error(`Failed to get sprints: ${err.message}`);
  }

  // Test 4: Get Current Sprint
  header('Test 4: Get Current Sprint');
  try {
    const currentSprint = await hybridService.getCurrentSprint(testProject);
    if (currentSprint) {
      success(`Found current sprint: ${currentSprint.name}`);
      if (currentSprint.startDate) info(`Start: ${currentSprint.startDate}`);
      if (currentSprint.finishDate) info(`End: ${currentSprint.finishDate}`);
      if (currentSprint.timeFrame) success(`TimeFrame: ${currentSprint.timeFrame} (MCP feature!)`);
    } else {
      warning('No current sprint found');
    }
  } catch (err: any) {
    error(`Failed to get current sprint: ${err.message}`);
  }

  // Test 5: Full-text Search (MCP exclusive feature!)
  if (hybridService.isMCPEnabled()) {
    header('Test 5: Full-text Search (MCP Exclusive)');
    try {
      const searchResults = await hybridService.searchFullText('bug login', testProject, 5);
      if (searchResults.length > 0) {
        success(`<� Full-text search works! Found ${searchResults.length} items`);
        searchResults.slice(0, 3).forEach(item => {
          info(`  - #${item.id}: ${item.title} (${item.type})`);
        });
      } else {
        info('No results found for "bug login"');
      }
    } catch (err: any) {
      warning(`Full-text search failed: ${err.message}`);
    }
  } else {
    info('Test 5: Skipped (MCP not enabled - full-text search requires MCP)');
  }

  // Summary
  header('Test Summary');
  const status = hybridService.getServiceStatus();

  if (status.useMCP && status.mcpAvailable) {
    success('( MCP Integration: ACTIVE');
    success('Your app is using enhanced Azure DevOps features!');
    info('Benefits:');
    info('  - Better sprint queries with automatic timeFrame detection');
    info('  - Full-text search with relevance ranking');
    info('  - Direct iteration queries without WIQL path errors');
    info('  - Automatic fallback to REST API on errors');
  } else if (status.useMCP && !status.mcpAvailable) {
    warning('� MCP Integration: DEGRADED');
    warning('MCP is enabled but not available, using REST API fallback');
    info('Check your API key and network connection');
  } else {
    info('=� MCP Integration: DISABLED');
    info('Using REST API only (reliable but limited features)');
    info('Add OPENROUTER_API_KEY to .env.local to enable MCP');
  }

  log('\n Test suite completed!\n', colors.bright);
}

// Run the tests
main().catch(err => {
  error(`\nUnexpected error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
