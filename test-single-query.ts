/**
 * Test Single Query
 * Simple test to debug a single orchestrator query
 */

import { AIOrchestrator } from './lib/ai-orchestrator';
import { OrchestratorInput } from './lib/types/ai-types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function test(query: string) {
  console.log('\n=================================');
  console.log(`Testing Query: "${query}"`);
  console.log('=================================\n');

  console.log('Environment Check:');
  console.log(`- ADO_ORG: ${process.env.NEXT_PUBLIC_ADO_ORGANIZATION}`);
  console.log(`- ADO_PROJECT: ${process.env.NEXT_PUBLIC_ADO_PROJECT}`);
  console.log(`- ADO_PAT: ${process.env.ADO_PAT ? '✓ Set' : '✗ Not Set'}`);
  console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not Set'}\n`);

  const orchestrator = new AIOrchestrator();

  const input: OrchestratorInput = {
    query,
    userId: 'test-user@example.com',
    options: {
      skipCache: false,
      verbose: true,
    },
  };

  try {
    const result = await orchestrator.process(input);

    console.log('\n✅ SUCCESS\n');
    console.log('Summary:', result.response.summary);
    console.log('\nWork Items Found:', result.response.rawData.length);

    if (result.response.rawData.length > 0) {
      console.log('\nSample Items:');
      result.response.rawData.slice(0, 5).forEach((item: any) => {
        console.log(
          `  - #${item.id}: ${item.fields['System.Title']} [${item.fields['System.State']}]`
        );
      });
    }

    console.log('\nMetadata:');
    console.log(`  - Queries Executed: ${result.response.metadata.queriesExecuted}`);
    console.log(`  - Processing Time: ${result.response.metadata.processingTime}ms`);
    console.log(`  - Confidence: ${(result.response.metadata.confidence * 100).toFixed(1)}%`);
    console.log(`  - Cache Hit: ${result.response.metadata.cacheHit}`);

    if (result.response.suggestions) {
      console.log('\nSuggestions:');
      result.response.suggestions.forEach((s: string) => console.log(`  - ${s}`));
    }

    if (result.response.visualizations) {
      console.log('\nVisualizations:');
      result.response.visualizations.forEach((viz: any) =>
        console.log(`  - ${viz.type}: ${viz.title}`)
      );
    }

    if (input.options?.verbose && result.metrics) {
      console.log('\nPhase Metrics:');
      result.metrics.forEach((metric: any) => {
        console.log(
          `  - ${metric.phase}: ${metric.duration}ms ${metric.success ? '✓' : '✗'}`
        );
      });
    }
  } catch (error) {
    console.error('\n❌ ERROR\n');
    console.error(error);
  }
}

// Get query from command line or use default
const query = process.argv[2] || 'What is a sprint?';
test(query);
