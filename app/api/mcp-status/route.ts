/**
 * MCP Status Endpoint
 *
 * Returns the current status of the MCP integration including:
 * - Whether MCP is enabled
 * - Which API provider is being used (Anthropic or OpenRouter)
 * - Connection status
 * - Available features
 */

import { NextRequest, NextResponse } from 'next/server';
import { ADOServiceHybrid } from '@/lib/ado-service-hybrid';

export async function GET(request: NextRequest) {
  try {
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION;
    const pat = process.env.ADO_PAT;
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;

    // Check environment configuration
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here';
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your-openrouter-key-here';
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-key-here';
    const hasMCPKey = hasAnthropicKey || hasOpenRouterKey;

    // Determine which service is being used for AI Orchestrator
    const aiOrchestratorService = hasOpenRouterKey ? 'OpenRouter' : hasOpenAIKey ? 'OpenAI' : 'None';
    const aiOrchestratorBaseURL = hasOpenRouterKey
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.openai.com/v1';

    if (!organization || !pat) {
      return NextResponse.json({
        error: 'ADO configuration missing',
        status: 'misconfigured',
        details: {
          hasOrganization: !!organization,
          hasPAT: !!pat,
          hasMCPKey: false,
        },
      }, { status: 500 });
    }

    // Create a hybrid service to check status
    let serviceStatus = {
      useMCP: false,
      mcpAvailable: false,
      restAvailable: false,
    };

    try {
      const hybridService = new ADOServiceHybrid(organization, pat, project, {
        useMCP: true,
        useOpenRouter: hasOpenRouterKey,
      });

      serviceStatus = hybridService.getServiceStatus();
    } catch (error) {
      console.error('[MCP Status] Error creating hybrid service:', error);
    }

    // Determine provider
    const mcpProvider = hasOpenRouterKey ? 'OpenRouter' : hasAnthropicKey ? 'Anthropic' : 'None';

    // Build response
    const status = {
      mcp: {
        enabled: serviceStatus.useMCP,
        available: serviceStatus.mcpAvailable,
        provider: mcpProvider,
        features: serviceStatus.useMCP ? [
          'Better sprint queries with timeFrame detection',
          'Full-text search with relevance ranking',
          'Direct iteration queries without WIQL',
          'Automatic fallback to REST API on errors',
        ] : [],
      },
      aiOrchestrator: {
        service: aiOrchestratorService,
        baseURL: aiOrchestratorBaseURL,
        models: {
          intent: hasOpenRouterKey ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
          decision: hasOpenRouterKey ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
          planning: hasOpenRouterKey ? 'openai/gpt-4o' : 'gpt-4o',
          evaluation: hasOpenRouterKey ? 'openai/gpt-4o' : 'gpt-4o',
          synthesis: hasOpenRouterKey ? 'openai/gpt-4o' : 'gpt-4o',
        },
        description: hasOpenRouterKey
          ? 'All AI orchestrator calls (intent analysis, query planning, response synthesis) route through OpenRouter'
          : 'All AI orchestrator calls route directly to OpenAI',
      },
      rest: {
        enabled: true,
        available: serviceStatus.restAvailable,
        features: [
          'Custom WIQL queries',
          'Tag extraction',
          'User listing',
          'Relationship enrichment',
        ],
      },
      configuration: {
        organization,
        project: project || 'All projects',
        hasAnthropicKey,
        hasOpenRouterKey,
        hasOpenAIKey,
        hasMCPKey,
      },
      recommendations: [] as Array<{ level: string; message: string }>,
    };

    // Add recommendations based on configuration
    if (!hasMCPKey) {
      status.recommendations.push({
        level: 'info',
        message: 'MCP is not enabled. Add ANTHROPIC_API_KEY or OPENROUTER_API_KEY to .env.local to enable enhanced features.',
      });
    }

    if (serviceStatus.useMCP && !serviceStatus.mcpAvailable) {
      status.recommendations.push({
        level: 'warning',
        message: 'MCP is enabled but not available. Check your API key and network connection.',
      });
    }

    if (serviceStatus.useMCP && serviceStatus.mcpAvailable) {
      status.recommendations.push({
        level: 'success',
        message: `MCP is active via ${mcpProvider}! You're getting enhanced sprint queries and full-text search.`,
      });
    }

    return NextResponse.json({
      status: serviceStatus.useMCP && serviceStatus.mcpAvailable ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      ...status,
    });

  } catch (error: any) {
    console.error('[MCP Status] Error:', error);

    return NextResponse.json({
      status: 'error',
      error: error.message || 'Failed to check MCP status',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
