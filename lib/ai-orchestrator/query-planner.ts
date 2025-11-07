/**
 * Query Planner
 *
 * Phase 3 of the AI Orchestrator pipeline.
 * Plans optimal queries to fetch data from Azure DevOps using MCP server.
 */

import OpenAI from 'openai';
import { Intent, Decision, QueryPlan, PlannedQuery } from '../types/ai-types';
import {
  QUERY_PLANNING_SYSTEM_PROMPT,
  buildQueryPlanningPrompt,
} from '../ai-prompts/planning-prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROJECT_NAME = process.env.NEXT_PUBLIC_ADO_PROJECT || 'Next Gen LOS';

export class QueryPlanner {
  private model: string;
  private projectName: string;

  constructor(model: string = 'gpt-4o', projectName?: string) {
    this.model = model;
    this.projectName = projectName || PROJECT_NAME;
  }

  /**
   * Plan queries to fulfill the given intent
   * This integrates with MCP to get metadata for planning
   */
  async plan(
    intent: Intent,
    decision: Decision,
    metadata?: {
      sprints?: string[];
      users?: string[];
    }
  ): Promise<QueryPlan> {
    try {
      // If no ADO data needed, return empty plan
      if (!decision.requiresADO) {
        return {
          queries: [],
          validationRules: [],
          successCriteria: 'No ADO data required',
          estimatedDuration: 0,
        };
      }

      // Try simple plan first (no AI needed)
      const simplePlan = this.trySimplePlan(intent, decision, metadata);
      if (simplePlan) {
        return simplePlan;
      }

      // Use AI for complex query planning
      const context = {
        projectName: this.projectName,
        availableSprints: metadata?.sprints,
        availableUsers: metadata?.users,
        currentDate: new Date().toISOString().split('T')[0],
      };

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: QUERY_PLANNING_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildQueryPlanningPrompt(intent, context),
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      return this.validateQueryPlan(parsed);
    } catch (error) {
      console.error('Error planning queries:', error);

      // Fallback: Create basic query plan
      return this.createFallbackPlan(intent, decision);
    }
  }

  /**
   * Try to create a simple plan without AI for common cases
   */
  private trySimplePlan(
    intent: Intent,
    decision: Decision,
    metadata?: {
      sprints?: any[];
      users?: string[];
    }
  ): QueryPlan | null {
    // Case 1: Single issue lookup
    if (intent.scope === 'ISSUE' && intent.issueId) {
      return {
        queries: [
          {
            id: 'issue_lookup',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.Id] = ${intent.issueId}`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.AssignedTo',
              'System.CreatedBy',
              'System.CreatedDate',
              'System.ChangedDate',
              'System.Description',
            ],
            purpose: `Get work item #${intent.issueId}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Work item found',
        estimatedDuration: 1000,
      };
    }

    // Case 2: Sprint query (with or without explicit project)
    if ((intent.scope === 'PROJECT' || intent.scope === 'SPRINT') && intent.sprintIdentifier) {
      const projectName = intent.projectIdentifier || this.projectName;

      // Check if sprintIdentifier is already a full path (contains backslash)
      const isFullPath = intent.sprintIdentifier.includes('\\');

      // Try to find actual sprint path from metadata
      let sprintPath = isFullPath
        ? intent.sprintIdentifier  // Already a full path, use as-is
        : `${projectName}\\${intent.sprintIdentifier}`;  // Just a name, construct path

      if (metadata?.sprints) {
        const sprintMatch = metadata.sprints.find((s: any) => {
          const nameLower = s.name?.toLowerCase() || '';
          const pathLower = s.path?.toLowerCase() || '';
          const identifierLower = intent.sprintIdentifier?.toLowerCase() || '';

          // If identifier is a full path, try exact match first
          if (isFullPath) {
            return pathLower === identifierLower;
          }

          // Otherwise, try name or path contains
          return nameLower.includes(identifierLower) || pathLower.includes(identifierLower);
        });

        if (sprintMatch && sprintMatch.path) {
          sprintPath = sprintMatch.path;
          console.log('[Query Planner] Using actual sprint path from metadata:', sprintPath);
        } else if (isFullPath) {
          console.log('[Query Planner] Full path provided but not found in metadata, using as-is:', sprintPath);
        }
      }

      return {
        queries: [
          {
            id: 'sprint_items',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] UNDER '${sprintPath}' ORDER BY [System.ChangedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.AssignedTo',
              'System.CreatedBy',
              'Microsoft.VSTS.Common.Priority',
              'System.ChangedDate',
              'System.IterationPath',
            ],
            purpose: `Get items from ${intent.sprintIdentifier}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // Case 3: User's items
    if (intent.scope === 'USER' && intent.userIdentifier && intent.complexity === 'SIMPLE') {
      const stateCondition = intent.states?.length
        ? `AND [System.State] IN (${intent.states.map((s) => `'${s}'`).join(', ')})`
        : `AND [System.State] <> 'Closed' AND [System.State] <> 'Removed'`;

      // Determine if we're looking for CreatedBy or AssignedTo based on query text
      const queryLower = intent.originalQuery.toLowerCase();
      const isCreatedByQuery =
        queryLower.includes('opened by') ||
        queryLower.includes('created by') ||
        queryLower.includes('authored by') ||
        queryLower.includes('submitted by');

      const userField = isCreatedByQuery ? 'System.CreatedBy' : 'System.AssignedTo';
      const userFieldDisplay = isCreatedByQuery ? 'created by' : 'assigned to';

      // Use CONTAINS for user search to handle different name formats
      const userCondition = `[${userField}] CONTAINS '${intent.userIdentifier}'`;

      return {
        queries: [
          {
            id: 'user_items',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE ${userCondition} ${stateCondition} ORDER BY [System.ChangedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.AssignedTo',
              'System.CreatedBy',
              'Microsoft.VSTS.Common.Priority',
              'System.ChangedDate',
              'System.CreatedDate',
            ],
            purpose: `Get items ${userFieldDisplay} ${intent.userIdentifier}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // No simple plan available
    return null;
  }

  /**
   * Validate the AI-generated query plan
   */
  private validateQueryPlan(parsed: any): QueryPlan {
    const queries: PlannedQuery[] = Array.isArray(parsed.queries)
      ? parsed.queries.map((q: any, index: number) => ({
          id: q.id || `query_${index}`,
          type: this.validateQueryType(q.type),
          query: q.query || '',
          fields: Array.isArray(q.fields) ? q.fields : [],
          purpose: q.purpose || 'Query execution',
          dependsOn: Array.isArray(q.dependsOn) ? q.dependsOn : undefined,
          priority: typeof q.priority === 'number' ? q.priority : index + 1,
          optional: Boolean(q.optional),
        }))
      : [];

    return {
      queries,
      validationRules: Array.isArray(parsed.validationRules) ? parsed.validationRules : [],
      successCriteria: parsed.successCriteria || 'Queries execute successfully',
      fallbackStrategy: parsed.fallbackStrategy,
      estimatedDuration: typeof parsed.estimatedDuration === 'number' ? parsed.estimatedDuration : 2000,
    };
  }

  /**
   * Validate query type
   */
  private validateQueryType(type: string): 'WIQL' | 'REST' | 'METADATA' {
    const validTypes = ['WIQL', 'REST', 'METADATA'];
    return validTypes.includes(type) ? (type as 'WIQL' | 'REST' | 'METADATA') : 'WIQL';
  }

  /**
   * Create fallback plan when AI fails
   */
  private createFallbackPlan(intent: Intent, decision: Decision): QueryPlan {
    const queries: PlannedQuery[] = [];

    // Create a basic WIQL query if needed
    if (decision.queriesNeeded.includes('WIQL')) {
      let wiqlQuery = 'SELECT [System.Id] FROM WorkItems';
      const conditions: string[] = [];

      // Add conditions based on intent
      if (intent.issueId) {
        conditions.push(`[System.Id] = ${intent.issueId}`);
      } else if (intent.userIdentifier) {
        // Check if query is for CreatedBy or AssignedTo
        const queryLower = intent.originalQuery.toLowerCase();
        const isCreatedByQuery =
          queryLower.includes('opened by') ||
          queryLower.includes('created by') ||
          queryLower.includes('authored by') ||
          queryLower.includes('submitted by');

        const userField = isCreatedByQuery ? 'System.CreatedBy' : 'System.AssignedTo';
        conditions.push(`[${userField}] CONTAINS '${intent.userIdentifier}'`);
      } else if (intent.sprintIdentifier) {
        // Check if sprintIdentifier is already a full path (contains backslash)
        const isFullPath = intent.sprintIdentifier.includes('\\');
        const sprintPath = isFullPath
          ? intent.sprintIdentifier
          : `${intent.projectIdentifier || this.projectName}\\\\${intent.sprintIdentifier}`;
        conditions.push(
          `[System.IterationPath] UNDER '${sprintPath}'`
        );
      } else if (intent.teamIdentifier) {
        conditions.push(
          `[System.AreaPath] UNDER '${this.projectName}\\\\${intent.teamIdentifier}'`
        );
      }

      // Add project filter if specified
      if (intent.projectIdentifier) {
        conditions.push(`[System.TeamProject] = '${intent.projectIdentifier}'`);
      }

      if (intent.states?.length) {
        conditions.push(
          `[System.State] IN (${intent.states.map((s) => `'${s}'`).join(', ')})`
        );
      }

      if (intent.types?.length) {
        conditions.push(
          `[System.WorkItemType] IN (${intent.types.map((t) => `'${t}'`).join(', ')})`
        );
      }

      if (conditions.length > 0) {
        wiqlQuery += ` WHERE ${conditions.join(' AND ')}`;
      }

      wiqlQuery += ' ORDER BY [System.ChangedDate] DESC';

      queries.push({
        id: 'main_query',
        type: 'WIQL',
        query: wiqlQuery,
        fields: [
          'System.Id',
          'System.Title',
          'System.State',
          'System.WorkItemType',
          'System.AssignedTo',
          'System.CreatedDate',
          'System.ChangedDate',
        ],
        purpose: 'Fetch work items based on intent',
        priority: 1,
        optional: false,
      });
    }

    return {
      queries,
      validationRules: [
        {
          field: 'System.IterationPath',
          rule: 'must use UNDER or = operator',
          errorMessage: 'IterationPath cannot use CONTAINS',
        },
      ],
      successCriteria: 'Query executes without errors',
      fallbackStrategy: 'Return empty results if query fails',
      estimatedDuration: 2000,
    };
  }

  /**
   * Validate WIQL query for common errors
   */
  validateWIQL(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for CONTAINS with IterationPath (common error)
    if (
      query.includes('[System.IterationPath]') &&
      query.toUpperCase().includes('CONTAINS')
    ) {
      const iterPathRegex = /\[System\.IterationPath\][^\n]*?CONTAINS/i;
      if (iterPathRegex.test(query)) {
        errors.push(
          'CONTAINS operator cannot be used with System.IterationPath. Use UNDER or = instead.'
        );
      }
    }

    // Check for proper field syntax
    if (!query.includes('[System.Id]')) {
      errors.push('Query should include [System.Id] in SELECT clause');
    }

    // Check for ORDER BY
    if (!query.toUpperCase().includes('ORDER BY')) {
      errors.push('Query should include ORDER BY clause for consistent results');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Fix common WIQL errors
   */
  fixWIQL(query: string): string {
    let fixed = query;

    // Fix: CONTAINS with IterationPath -> change to UNDER
    const iterPathContainsRegex = /\[System\.IterationPath\]\s+CONTAINS\s+'([^']+)'/gi;
    fixed = fixed.replace(
      iterPathContainsRegex,
      `[System.IterationPath] UNDER '${this.projectName}\\\\$1'`
    );

    // Add ORDER BY if missing
    if (!fixed.toUpperCase().includes('ORDER BY')) {
      fixed += ' ORDER BY [System.ChangedDate] DESC';
    }

    return fixed;
  }
}

export default QueryPlanner;
