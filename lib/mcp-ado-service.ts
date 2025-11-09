/**
 * MCP ADO Service
 *
 * Azure DevOps service that uses the Microsoft MCP server
 * via Anthropic SDK for tool calling.
 *
 * This provides better:
 * - Sprint path resolution
 * - Full-text search with relevance ranking
 * - Direct iteration queries without WIQL
 *
 * Falls back to REST API for unsupported operations.
 */

import Anthropic from '@anthropic-ai/sdk';
import { WorkItem, GlobalFilters } from '@/types';

export class MCPADOService {
  private client: Anthropic;
  private organization: string;
  private project?: string;
  private useOpenRouter: boolean;

  constructor(
    organization: string,
    project?: string,
    options?: {
      apiKey?: string;
      useOpenRouter?: boolean;
    }
  ) {
    this.organization = organization;
    this.project = project;

    // Determine if using OpenRouter
    this.useOpenRouter = options?.useOpenRouter !== undefined
      ? options.useOpenRouter
      : !!process.env.OPENROUTER_API_KEY;

    // Get API key from options or environment
    const apiKey = options?.apiKey ||
      (this.useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.ANTHROPIC_API_KEY);

    if (!apiKey) {
      throw new Error('API key required for MCP service');
    }

    // Initialize Anthropic client with OpenRouter endpoint if configured
    this.client = new Anthropic({
      apiKey: apiKey,
      // OpenRouter uses a different base URL
      ...(this.useOpenRouter && {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://ado-explorer.vercel.app',
          'X-Title': 'ADO Explorer',
        },
      }),
    });

    console.log(`[MCP Service] Initialized with ${this.useOpenRouter ? 'OpenRouter' : 'Anthropic'}`);
  }

  /**
   * Get the appropriate model name based on provider
   */
  private getModelName(): string {
    // OpenRouter requires provider prefix, direct Anthropic doesn't
    return this.useOpenRouter
      ? 'anthropic/claude-sonnet-4'
      : 'claude-sonnet-4-20250514';
  }

  /**
   * Search work items using full-text search (MCP server)
   * Better than WIQL for simple text searches - provides relevance ranking
   */
  async searchWorkItemsFullText(
    searchText: string,
    project?: string,
    top: number = 100
  ): Promise<WorkItem[]> {
    try {
      const targetProject = project || this.project;

      console.log('[MCP Service] Full-text search:', { searchText, project: targetProject, top });

      const response = await this.client.messages.create({
        model: this.getModelName(),
        max_tokens: 4096,
        tools: [
          {
            name: 'search_workitem',
            description: 'Get work item search results for a given search text',
            input_schema: {
              type: 'object',
              properties: {
                searchText: {
                  type: 'string',
                  description: 'The search text to find work items',
                },
                $top: {
                  type: 'number',
                  description: 'Number of results to return',
                },
                project: {
                  type: 'string',
                  description: 'Optional project name to filter results',
                },
              },
              required: ['searchText'],
            },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Search for work items with text "${searchText}"${
              targetProject ? ` in project "${targetProject}"` : ''
            }. Return up to ${top} results. Use the search_workitem tool.`,
          },
        ],
      });

      // Extract tool use results
      const toolUse = response.content.find((block) => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool use found in response');
      }

      // Parse and map results
      const results = this.parseSearchResults(toolUse.input as any);
      console.log(`[MCP Service] Found ${results.length} work items via full-text search`);

      return results;
    } catch (error) {
      console.error('[MCP Service] Error in full-text search:', error);
      throw error;
    }
  }

  /**
   * Get projects using MCP server
   */
  async getProjects(): Promise<{ id: string; name: string; description?: string }[]> {
    try {
      console.log('[MCP Service] Getting projects...');

      const response = await this.client.messages.create({
        model: this.getModelName(),
        max_tokens: 2048,
        tools: [
          {
            name: 'core_list_projects',
            description: 'Retrieve a list of projects in your Azure DevOps organization',
            input_schema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        messages: [
          {
            role: 'user',
            content: 'List all projects in the Azure DevOps organization using core_list_projects.',
          },
        ],
      });

      const toolUse = response.content.find((block) => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool use found in response');
      }

      const projects = this.parseProjects(toolUse.input as any);
      console.log(`[MCP Service] Found ${projects.length} projects`);

      return projects;
    } catch (error) {
      console.error('[MCP Service] Error getting projects:', error);
      throw error;
    }
  }

  /**
   * Get teams for a project using MCP server
   */
  async getTeams(project?: string): Promise<{ id: string; name: string; projectName: string }[]> {
    try {
      const targetProject = project || this.project;
      if (!targetProject) {
        throw new Error('Project name required for getTeams');
      }

      console.log('[MCP Service] Getting teams for project:', targetProject);

      const response = await this.client.messages.create({
        model: this.getModelName(),
        max_tokens: 2048,
        tools: [
          {
            name: 'core_list_project_teams',
            description: 'Retrieve a list of teams for the specified Azure DevOps project',
            input_schema: {
              type: 'object',
              properties: {
                project: {
                  type: 'string',
                  description: 'The project name',
                },
              },
              required: ['project'],
            },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `List all teams for project "${targetProject}" using core_list_project_teams.`,
          },
        ],
      });

      const toolUse = response.content.find((block) => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool use found in response');
      }

      const teams = this.parseTeams(toolUse.input as any, targetProject);
      console.log(`[MCP Service] Found ${teams.length} teams`);

      return teams;
    } catch (error) {
      console.error('[MCP Service] Error getting teams:', error);
      throw error;
    }
  }

  /**
   * Get sprints/iterations for a team using MCP server
   * This is MUCH better than REST API - includes timeframe (current/past/future)!
   */
  async getSprints(
    project?: string,
    team?: string
  ): Promise<Array<{ name: string; path: string; timeFrame?: string; startDate?: string; finishDate?: string }>> {
    try {
      const targetProject = project || this.project;
      if (!targetProject) {
        throw new Error('Project name required for getSprints');
      }

      console.log('[MCP Service] Getting sprints:', { project: targetProject, team });

      // If no team specified, use work_list_iterations (all iterations in project)
      // If team specified, use work_list_team_iterations (team-specific with timeframe)
      const toolName = team ? 'work_list_team_iterations' : 'work_list_iterations';

      const response = await this.client.messages.create({
        model: this.getModelName(),
        max_tokens: 4096,
        tools: [
          {
            name: toolName,
            description: team
              ? 'Get iterations for a specific team with timeframe info'
              : 'Get all iterations in a project',
            input_schema: {
              type: 'object',
              properties: {
                project: {
                  type: 'string',
                  description: 'The project name',
                },
                ...(team && {
                  team: {
                    type: 'string',
                    description: 'The team name',
                  },
                }),
              },
              required: ['project', ...(team ? ['team'] : [])],
            },
          },
        ],
        messages: [
          {
            role: 'user',
            content: team
              ? `List all iterations for project "${targetProject}" and team "${team}" using work_list_team_iterations.`
              : `List all iterations for project "${targetProject}" using work_list_iterations.`,
          },
        ],
      });

      const toolUse = response.content.find((block) => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool use found in response');
      }

      const sprints = this.parseSprints(toolUse.input as any);
      console.log(`[MCP Service] Found ${sprints.length} sprints`);

      return sprints;
    } catch (error) {
      console.error('[MCP Service] Error getting sprints:', error);
      throw error;
    }
  }

  /**
   * Get work items for a specific iteration/sprint using MCP server
   * This is MUCH better than WIQL - no path issues!
   */
  async getWorkItemsForIteration(
    project: string,
    team: string,
    iterationId: string
  ): Promise<WorkItem[]> {
    try {
      console.log('[MCP Service] Getting work items for iteration:', { project, team, iterationId });

      const response = await this.client.messages.create({
        model: this.getModelName(),
        max_tokens: 4096,
        tools: [
          {
            name: 'wit_get_work_items_for_iteration',
            description: 'Get all work items in a specific sprint/iteration',
            input_schema: {
              type: 'object',
              properties: {
                project: {
                  type: 'string',
                  description: 'The project name',
                },
                team: {
                  type: 'string',
                  description: 'The team name',
                },
                iterationId: {
                  type: 'string',
                  description: 'The iteration ID',
                },
              },
              required: ['project', 'team', 'iterationId'],
            },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Get all work items for project "${project}", team "${team}", iteration "${iterationId}" using wit_get_work_items_for_iteration.`,
          },
        ],
      });

      const toolUse = response.content.find((block) => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool use found in response');
      }

      const workItems = this.parseWorkItems(toolUse.input as any);
      console.log(`[MCP Service] Found ${workItems.length} work items in iteration`);

      return workItems;
    } catch (error) {
      console.error('[MCP Service] Error getting work items for iteration:', error);
      throw error;
    }
  }

  /**
   * Get a single work item by ID using MCP server
   */
  async getWorkItem(id: string): Promise<WorkItem | null> {
    try {
      console.log('[MCP Service] Getting work item:', id);

      const response = await this.client.messages.create({
        model: this.getModelName(),
        max_tokens: 2048,
        tools: [
          {
            name: 'wit_get_work_item',
            description: 'Get a single work item by ID',
            input_schema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'The work item ID',
                },
                $expand: {
                  type: 'string',
                  description: 'Expand relations',
                  enum: ['relations', 'all', 'none'],
                },
              },
              required: ['id'],
            },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Get work item ${id} with relations expanded using wit_get_work_item.`,
          },
        ],
      });

      const toolUse = response.content.find((block) => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool use found in response');
      }

      const workItem = this.parseWorkItems(toolUse.input as any)[0];
      return workItem || null;
    } catch (error) {
      console.error('[MCP Service] Error getting work item:', error);
      return null;
    }
  }

  // ==================== Parsing Utilities ====================

  /**
   * Parse search results from MCP response
   */
  private parseSearchResults(input: any): WorkItem[] {
    if (!input || !input.results) {
      return [];
    }

    return input.results.map((item: any) => this.mapToWorkItem(item));
  }

  /**
   * Parse projects from MCP response
   */
  private parseProjects(input: any): { id: string; name: string; description?: string }[] {
    if (!input || !input.value) {
      return [];
    }

    return input.value.map((project: any) => ({
      id: project.id,
      name: project.name,
      description: project.description,
    }));
  }

  /**
   * Parse teams from MCP response
   */
  private parseTeams(input: any, projectName: string): { id: string; name: string; projectName: string }[] {
    if (!input || !input.value) {
      return [];
    }

    return input.value.map((team: any) => ({
      id: team.id,
      name: team.name,
      projectName,
    }));
  }

  /**
   * Parse sprints from MCP response
   */
  private parseSprints(input: any): Array<{
    name: string;
    path: string;
    timeFrame?: string;
    startDate?: string;
    finishDate?: string;
  }> {
    if (!input || !input.value) {
      return [];
    }

    return input.value.map((iteration: any) => ({
      name: iteration.name,
      path: iteration.path,
      timeFrame: iteration.attributes?.timeFrame,
      startDate: iteration.attributes?.startDate,
      finishDate: iteration.attributes?.finishDate,
    }));
  }

  /**
   * Parse work items from MCP response
   */
  private parseWorkItems(input: any): WorkItem[] {
    if (!input) {
      return [];
    }

    // Handle different response formats
    const items = input.workItems || input.value || [input];

    return items.map((item: any) => this.mapToWorkItem(item));
  }

  /**
   * Map ADO work item (from MCP) to our WorkItem interface
   * Same mapping as ADOService for consistency
   */
  private mapToWorkItem(item: any): WorkItem {
    const fields = item.fields || {};

    return {
      id: item.id?.toString() || item['System.Id']?.toString() || 'unknown',
      title: fields['System.Title'] || item.title || 'Untitled',
      type: fields['System.WorkItemType'] || item.type || 'Unknown',
      state: fields['System.State'] || item.state || 'Unknown',
      assignedTo: fields['System.AssignedTo']?.displayName || item.assignedTo || 'Unassigned',
      assignedToEmail: fields['System.AssignedTo']?.uniqueName,
      createdBy: fields['System.CreatedBy']?.displayName || item.createdBy || 'Unknown',
      createdByEmail: fields['System.CreatedBy']?.uniqueName,
      createdDate: fields['System.CreatedDate'] || item.createdDate || new Date().toISOString(),
      closedDate: fields['Microsoft.VSTS.Common.ClosedDate'],
      priority: fields['Microsoft.VSTS.Common.Priority'] || item.priority || 3,
      description: fields['System.Description'] || item.description || '',
      tags: fields['System.Tags']
        ? fields['System.Tags'].split(';').map((t: string) => t.trim())
        : item.tags || [],
      project: fields['System.TeamProject'] || item.project || this.project || 'Unknown',
      changedDate: fields['System.ChangedDate'] || item.changedDate,
      changedBy: fields['System.ChangedBy']?.displayName,
      changedByEmail: fields['System.ChangedBy']?.uniqueName,
      iterationPath: fields['System.IterationPath'] || item.iterationPath,
      areaPath: fields['System.AreaPath'] || item.areaPath,
      storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || item.storyPoints,
      acceptanceCriteria: fields['Microsoft.VSTS.Common.AcceptanceCriteria'],
    };
  }
}
