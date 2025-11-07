/**
 * Test Script for AI Orchestrator
 *
 * Run with: npx tsx test-queries.ts
 */

import { AIOrchestrator } from './lib/ai-orchestrator';
import { OrchestratorInput } from './lib/types/ai-types';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TEST_QUERIES = [
  "all tickets opened by ericka",
  "display items from project genesis that have the iteration sprint 49",
  "show me all active bugs",
  "what are the P1 items?",
  "tickets assigned to mark",
  "list all projects",
  "show sprint 48 items",
];

async function testQuery(query: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`Testing Query: "${query}"`);
  console.log('='.repeat(80));

  const orchestrator = new AIOrchestrator();

  const input: OrchestratorInput = {
    query,
    userId: 'test@example.com',
    options: {
      skipCache: false,
      verbose: true,
    },
  };

  const startTime = Date.now();

  try {
    const result = await orchestrator.process(input);

    console.log('\n✅ SUCCESS');
    console.log('Processing Time:', Date.now() - startTime, 'ms');
    console.log('\n📊 Response:');
    console.log('  Success:', result.response.success);
    console.log('  Summary:', result.response.summary);
    console.log('  Work Items:', result.response.rawData.length);
    console.log('  Suggestions:', result.response.suggestions?.length || 0);

    if (result.metrics && input.options?.verbose) {
      console.log('\n⏱️ Phase Metrics:');
      result.metrics.forEach((metric) => {
        const status = metric.success ? '✓' : '✗';
        console.log(`  ${status} ${metric.phase}: ${metric.duration}ms`);
        if (metric.error) {
          console.log(`     Error: ${metric.error}`);
        }
      });
    }

    // Show intent analysis
    if (result.metrics) {
      const intentMetric = result.metrics.find(m => m.phase === 'Intent Analysis');
      if (intentMetric?.output) {
        console.log('\n🎯 Intent:');
        console.log('  Type:', intentMetric.output.type);
        console.log('  Scope:', intentMetric.output.scope);
        console.log('  Complexity:', intentMetric.output.complexity);
        console.log('  Project:', intentMetric.output.projectIdentifier || '(default)');
        console.log('  Sprint:', intentMetric.output.sprintIdentifier || '(none)');
        console.log('  User:', intentMetric.output.userIdentifier || '(none)');
      }
    }

    // Show query details
    if (result.metrics) {
      const queryMetric = result.metrics.find(m => m.phase === 'Query Planning');
      if (queryMetric?.output?.queries?.length > 0) {
        console.log('\n📝 Generated Queries:');
        queryMetric.output.queries.forEach((q: any, i: number) => {
          console.log(`  Query ${i + 1} (${q.type}): ${q.query}`);
        });
      }
    }

    return { success: true, result };
  } catch (error: any) {
    console.log('\n❌ ERROR');
    console.log('Processing Time:', Date.now() - startTime, 'ms');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    return { success: false, error };
  }
}

async function main() {
  console.log('🧪 ADO Explorer Query Testing');
  console.log('Environment Check:');
  console.log('  Organization:', process.env.NEXT_PUBLIC_ADO_ORGANIZATION || 'NOT SET');
  console.log('  Project:', process.env.NEXT_PUBLIC_ADO_PROJECT || 'NOT SET');
  console.log('  PAT:', process.env.ADO_PAT ? 'SET' : 'NOT SET');
  console.log('  OpenAI Key:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');

  // Test specific query or all
  const specificQuery = process.argv[2];

  if (specificQuery) {
    await testQuery(specificQuery);
  } else {
    const results = [];
    for (const query of TEST_QUERIES) {
      const result = await testQuery(query);
      results.push({ query, ...result });

      // Pause between queries
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);

    if (failed > 0) {
      console.log('\nFailed Queries:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - "${r.query}"`);
        console.log(`    Error: ${r.error?.message}`);
      });
    }
  }
}

main().catch(console.error);
