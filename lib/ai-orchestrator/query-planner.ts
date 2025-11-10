/**
 * Query Planner
 *
 * Phase 3 of the AI Orchestrator pipeline.
 * Plans optimal queries to fetch data from Azure DevOps using MCP server.
 */

import { Intent, Decision, QueryPlan, PlannedQuery } from '../types/ai-types';
import {
  QUERY_PLANNING_SYSTEM_PROMPT,
  buildQueryPlanningPrompt,
} from '../ai-prompts/planning-prompts';
import { openai, MODEL_NAMES } from './openai-config';

const PROJECT_NAME = process.env.NEXT_PUBLIC_ADO_PROJECT || 'Next Gen LOS';

export class QueryPlanner {
  private model: string;
  private projectName: string;

  constructor(model?: string, projectName?: string) {
    this.model = model || MODEL_NAMES.planning;
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
        temperature: 0.0, // Zero temperature for deterministic query planning
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

    // Case 4: ASSIGNEE-specific queries
    if (intent.scope === 'ASSIGNEE' && intent.userIdentifier && intent.complexity === 'SIMPLE') {
      const stateCondition = intent.states?.length
        ? `AND [System.State] IN (${intent.states.map((s) => `'${s}'`).join(', ')})`
        : `AND [System.State] <> 'Closed' AND [System.State] <> 'Removed'`;

      const typeCondition = intent.types?.length
        ? `AND [System.WorkItemType] IN (${intent.types.map((t) => `'${t}'`).join(', ')})`
        : '';

      return {
        queries: [
          {
            id: 'assignee_items',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] CONTAINS '${intent.userIdentifier}' ${stateCondition} ${typeCondition} ORDER BY [System.ChangedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.AssignedTo',
              'Microsoft.VSTS.Common.Priority',
              'System.ChangedDate',
            ],
            purpose: `Get items assigned to ${intent.userIdentifier}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // Case 5: CREATOR-specific queries
    if (intent.scope === 'CREATOR' && intent.userIdentifier && intent.complexity === 'SIMPLE') {
      const stateCondition = intent.states?.length
        ? `AND [System.State] IN (${intent.states.map((s) => `'${s}'`).join(', ')})`
        : '';

      const dateCondition = intent.dateRange?.start
        ? `AND [System.CreatedDate] >= '${intent.dateRange.start}'`
        : '';

      return {
        queries: [
          {
            id: 'creator_items',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.CreatedBy] CONTAINS '${intent.userIdentifier}' ${stateCondition} ${dateCondition} ORDER BY [System.CreatedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.CreatedBy',
              'System.CreatedDate',
              'System.AssignedTo',
            ],
            purpose: `Get items created by ${intent.userIdentifier}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // Case 6: STATE-specific queries
    if (intent.scope === 'STATE' && intent.states?.length) {
      const typeCondition = intent.types?.length
        ? `AND [System.WorkItemType] IN (${intent.types.map((t) => `'${t}'`).join(', ')})`
        : '';

      return {
        queries: [
          {
            id: 'state_items',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.State] IN (${intent.states.map((s) => `'${s}'`).join(', ')}) ${typeCondition} ORDER BY [System.ChangedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.AssignedTo',
              'System.ChangedDate',
            ],
            purpose: `Get items in state: ${intent.states.join(', ')}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // Case 7: TYPE-specific queries
    if (intent.scope === 'TYPE' && intent.types?.length) {
      const stateCondition = intent.states?.length
        ? `AND [System.State] IN (${intent.states.map((s) => `'${s}'`).join(', ')})`
        : '';

      return {
        queries: [
          {
            id: 'type_items',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] IN (${intent.types.map((t) => `'${t}'`).join(', ')}) ${stateCondition} ORDER BY [System.ChangedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.AssignedTo',
              'System.ChangedDate',
            ],
            purpose: `Get items of type: ${intent.types.join(', ')}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // Case 8: TAG queries
    if (intent.scope === 'TAG' && intent.tags?.length) {
      const tagCondition = intent.tags.map(tag => `[System.Tags] CONTAINS '${tag}'`).join(' OR ');

      return {
        queries: [
          {
            id: 'tag_items',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE ${tagCondition} ORDER BY [System.ChangedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.Tags',
              'System.AssignedTo',
              'System.ChangedDate',
            ],
            purpose: `Get items with tags: ${intent.tags.join(', ')}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // Case 9: TITLE search queries
    if (intent.scope === 'TITLE' && intent.entities?.length) {
      const searchTerm = intent.entities.join(' ');

      return {
        queries: [
          {
            id: 'title_search',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.Title] CONTAINS '${searchTerm}' ORDER BY [System.ChangedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.AssignedTo',
              'System.ChangedDate',
            ],
            purpose: `Search titles for: ${searchTerm}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // Case 10: QUERY scope (saved queries)
    if (intent.scope === 'QUERY') {
      // This should use REST API to get saved queries, not WIQL
      return {
        queries: [
          {
            id: 'get_queries',
            type: 'REST',
            query: '/queries',
            purpose: 'Get list of saved queries',
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Saved queries retrieved',
        estimatedDuration: 1000,
      };
    }

    // Case 11: AREA/BOARD queries
    if ((intent.scope === 'AREA' || intent.scope === 'BOARD') && intent.boardIdentifier) {
      const areaPath = intent.boardIdentifier.includes('\\')
        ? intent.boardIdentifier
        : `${this.projectName}\\${intent.boardIdentifier}`;

      return {
        queries: [
          {
            id: 'area_items',
            type: 'WIQL',
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '${areaPath}' ORDER BY [System.ChangedDate] DESC`,
            fields: [
              'System.Id',
              'System.Title',
              'System.State',
              'System.WorkItemType',
              'System.AreaPath',
              'System.AssignedTo',
              'System.ChangedDate',
            ],
            purpose: `Get items in area: ${intent.boardIdentifier}`,
            priority: 1,
            optional: false,
          },
        ],
        validationRules: [],
        successCriteria: 'Query executes successfully',
        estimatedDuration: 1500,
      };
    }

    // Case 12: ITERATION queries (alias for SPRINT)
    if (intent.scope === 'ITERATION' && intent.sprintIdentifier) {
      // Reuse sprint logic
      intent.scope = 'SPRINT';
      return this.trySimplePlan(intent, decision, metadata);
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

      if (intent.tags?.length) {
        const tagConditions = intent.tags.map(tag => `[System.Tags] CONTAINS '${tag}'`);
        conditions.push(`(${tagConditions.join(' OR ')})`);
      }

      // Handle field-specific scopes
      if (intent.scope === 'ASSIGNEE' && intent.userIdentifier) {
        conditions.push(`[System.AssignedTo] CONTAINS '${intent.userIdentifier}'`);
      }

      if (intent.scope === 'CREATOR' && intent.userIdentifier) {
        conditions.push(`[System.CreatedBy] CONTAINS '${intent.userIdentifier}'`);
      }

      if (intent.scope === 'AREA' && intent.boardIdentifier) {
        const areaPath = intent.boardIdentifier.includes('\\')
          ? intent.boardIdentifier
          : `${this.projectName}\\\\${intent.boardIdentifier}`;
        conditions.push(`[System.AreaPath] UNDER '${areaPath}'`);
      }

      if (intent.scope === 'TITLE' && intent.entities?.length) {
        const searchTerm = intent.entities.join(' ');
        conditions.push(`[System.Title] CONTAINS '${searchTerm}'`);
      }

      if (intent.scope === 'DESCRIPTION' && intent.entities?.length) {
        const searchTerm = intent.entities.join(' ');
        conditions.push(`[System.Description] CONTAINS '${searchTerm}'`);
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
