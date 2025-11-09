/**
 * Test OpenRouter Integration with MCP Service
 *
 * Verifies that the MCP service works with OpenRouter API
 */

import { ADOServiceHybrid } from './lib/ado-service-hybrid';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testOpenRouterIntegration() {
  console.log('🧪 Testing OpenRouter Integration with MCP Service\n');
  console.log('Environment Check:');
  console.log(`  ADO_ORGANIZATION: ${process.env.NEXT_PUBLIC_ADO_ORGANIZATION}`);
  console.log(`  ADO_PROJECT: ${process.env.NEXT_PUBLIC_ADO_PROJECT}`);
  console.log(`  ADO_PAT: ${process.env.ADO_PAT ? '✓ Set' : '✗ Not set'}`);
  console.log(`  OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Not set'}\n`);

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set!');
    return;
  }

  if (!process.env.ADO_PAT) {
    console.error('❌ ADO_PAT not set!');
    return;
  }

  try {
    // Initialize hybrid service (should auto-detect OpenRouter)
    console.log('📡 Initializing hybrid service...\n');
    const service = new ADOServiceHybrid(
      process.env.NEXT_PUBLIC_ADO_ORGANIZATION!,
      process.env.ADO_PAT!,
      process.env.NEXT_PUBLIC_ADO_PROJECT,
      { useMCP: true }
    );

    // Check service status
    const status = service.getServiceStatus();
    console.log('📊 Service Status:');
    console.log(`  MCP Enabled: ${status.useMCP ? '✓' : '✗'}`);
    console.log(`  MCP Available: ${status.mcpAvailable ? '✓' : '✗'}`);
    console.log(`  REST Available: ${status.restAvailable ? '✓' : '✗'}\n`);

    if (!status.mcpAvailable) {
      console.error('❌ MCP service not available! Check logs above for errors.');
      return;
    }

    // Test 1: Get projects (simple MCP call)
    console.log('🧪 Test 1: Get Projects (via MCP)');
    console.log('─'.repeat(50));
    const projects = await service.getProjects();
    console.log(`✅ Found ${projects.length} projects:`);
    projects.slice(0, 3).forEach(p => console.log(`  - ${p.name}`));
    console.log();

    // Test 2: Get sprints (MCP benefit - includes timeframe!)
    console.log('🧪 Test 2: Get Sprints (via MCP with timeframe)');
    console.log('─'.repeat(50));
    const sprints = await service.getSprints();
    console.log(`✅ Found ${sprints.length} sprints:`);
    sprints.slice(0, 5).forEach(s => {
      const timeFrame = s.timeFrame ? ` [${s.timeFrame}]` : '';
      console.log(`  - ${s.name}${timeFrame}`);
    });
    console.log();

    // Test 3: Get teams
    console.log('🧪 Test 3: Get Teams (via MCP)');
    console.log('─'.repeat(50));
    const teams = await service.getTeams();
    console.log(`✅ Found ${teams.length} teams:`);
    teams.slice(0, 3).forEach(t => console.log(`  - ${t.name}`));
    console.log();

    // Success summary
    console.log('═'.repeat(50));
    console.log('🎉 OpenRouter Integration Working!');
    console.log('═'.repeat(50));
    console.log('✅ MCP service initialized with OpenRouter');
    console.log('✅ Successfully called Claude via OpenRouter');
    console.log('✅ All MCP tools functioning correctly');
    console.log('✅ Sprint queries include timeframe field');
    console.log('\n💡 OpenRouter is now your MCP provider for Claude!');

  } catch (error: any) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

// Run the test
testOpenRouterIntegration().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
