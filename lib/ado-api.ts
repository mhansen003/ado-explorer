import axios, { AxiosInstance } from 'axios';
import { WorkItem, GlobalFilters, Comment } from '@/types';

export class ADOService {
  private client: AxiosInstance;
  private orgClient: AxiosInstance;
  private organization: string;
  private project?: string;

  constructor(organization: string, personalAccessToken: string, project?: string) {
    this.organization = organization;
    this.project = project;

    // Create base64 encoded PAT for Basic Auth
    const auth = Buffer.from(`:${personalAccessToken}`).toString('base64');

    // Organization-level client (searches across all projects)
    this.orgClient = axios.create({
      baseURL: `https://dev.azure.com/${organization}/_apis`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      params: {
        'api-version': '7.1',
      },
    });

    // Project-level client (for single project searches)
    // URL-encode the project name to handle spaces and special characters
    const encodedProject = project ? encodeURIComponent(project) : '';
    this.client = axios.create({
      baseURL: `https://dev.azure.com/${organization}${encodedProject ? `/${encodedProject}` : ''}/_apis`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      params: {
        'api-version': '7.1',
      },
    });
  }

  /**
   * Search work items using WIQL (Work Item Query Language)
   * Searches across all projects if no project specified
   */
  async searchWorkItems(query: string): Promise<WorkItem[]> {
    try {
      // WIQL queries must be scoped to a project in Azure DevOps
      if (!this.project) {
        throw new Error('A project must be specified for WIQL queries. Please set NEXT_PUBLIC_ADO_PROJECT environment variable.');
      }

      // First, execute the query to get work item IDs
      const queryResponse = await this.client.post('/wit/wiql', {
        query: query,
      });

      const workItemIds = queryResponse.data.workItems.map((item: any) => item.id);

      if (workItemIds.length === 0) {
        return [];
      }

      // Fetch all items in batches of 200 to respect URL length limits
      console.log(`[ADO API] Query returned ${workItemIds.length} items, fetching all in batches...`);

      const allWorkItems: WorkItem[] = [];
      const batchSize = 200;

      // Fetch in batches
      for (let i = 0; i < workItemIds.length; i += batchSize) {
        const batchIds = workItemIds.slice(i, i + batchSize);
        console.log(`[ADO API] Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(workItemIds.length / batchSize)} (${batchIds.length} items)`);

        const detailsResponse = await this.orgClient.get('/wit/workitems', {
          params: {
            ids: batchIds.join(','),
            fields: 'System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.CreatedBy,System.CreatedDate,System.ChangedDate,System.ChangedBy,Microsoft.VSTS.Common.Priority,System.Description,System.Tags,System.TeamProject,System.IterationPath,System.AreaPath,Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Common.AcceptanceCriteria',
          },
        });

        allWorkItems.push(...detailsResponse.data.value.map((item: any) => this.mapToWorkItem(item)));
      }

      console.log(`[ADO API] Successfully fetched ${allWorkItems.length} work items`);
      return allWorkItems;
    } catch (error) {
      console.error('Error searching work items:', error);
      throw error;
    }
  }

  /**
   * Get all non-closed work items for AI context
   * Returns up to 500 items to provide comprehensive context while staying within limits
   */
  async getAllNonClosedWorkItems(): Promise<WorkItem[]> {
    try {
      if (!this.project) {
        throw new Error('A project must be specified for WIQL queries.');
      }

      const query = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.State] <> 'Closed' ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC`;

      // Use the existing searchWorkItems method but we'll fetch more details
      const queryResponse = await this.client.post('/wit/wiql', {
        query: query,
      });

      const workItemIds = queryResponse.data.workItems.map((item: any) => item.id);

      if (workItemIds.length === 0) {
        return [];
      }

      // Limit to 500 items to provide good context without overwhelming the AI or exceeding limits
      const limitedIds = workItemIds.slice(0, 500);
      console.log(`[ADO API] Loading ${limitedIds.length} non-closed items for AI context (total available: ${workItemIds.length})`);

      // Fetch in batches of 200 to avoid URL length limits
      const batches: WorkItem[] = [];
      for (let i = 0; i < limitedIds.length; i += 200) {
        const batchIds = limitedIds.slice(i, i + 200);
        const detailsResponse = await this.orgClient.get('/wit/workitems', {
          params: {
            ids: batchIds.join(','),
            fields: 'System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,Microsoft.VSTS.Common.Priority,System.Tags,System.TeamProject,System.IterationPath,System.AreaPath,Microsoft.VSTS.Scheduling.StoryPoints',
          },
        });
        batches.push(...detailsResponse.data.value.map((item: any) => this.mapToWorkItem(item)));
      }

      return batches;
    } catch (error) {
      console.error('[ADO API] Error fetching all non-closed work items:', error);
      return []; // Return empty array on error so AI can still try to answer
    }
  }

  /**
   * Apply global filters to an existing WIQL query
   * Public method to allow applying filters to AI-generated queries
   */
  applyFiltersToQuery(query: string, filters?: GlobalFilters): string {
    console.log('[ADO Service] applyFiltersToQuery called with:', { query, filters });
    const globalFilterConditions = this.buildGlobalFilterConditions(filters);
    console.log('[ADO Service] Built filter conditions:', globalFilterConditions);

    if (!globalFilterConditions) {
      console.log('[ADO Service] No filter conditions, returning original query');
      return query;
    }

    // Split the filter conditions to check for duplicates
    const newConditions = globalFilterConditions.split(' AND ').map(c => c.trim());
    const conditionsToAdd: string[] = [];

    // Only add conditions that don't already exist in the query
    for (const condition of newConditions) {
      if (!query.includes(condition)) {
        conditionsToAdd.push(condition);
      } else {
        console.log('[ADO Service] Skipping duplicate condition:', condition);
      }
    }

    if (conditionsToAdd.length === 0) {
      console.log('[ADO Service] All conditions already in query, returning original');
      return query;
    }

    const conditionsString = conditionsToAdd.join(' AND ');

    // If query has WHERE, we need to wrap existing conditions in parentheses if they contain OR
    let modifiedQuery: string;
    if (query.includes(' WHERE ')) {
      // Extract the WHERE clause
      const whereMatch = query.match(/WHERE (.+?) ORDER BY/);
      if (whereMatch && whereMatch[1]) {
        const existingConditions = whereMatch[1].trim();
        // If existing conditions contain OR, wrap in parentheses for proper precedence
        if (existingConditions.includes(' OR ')) {
          modifiedQuery = query.replace(
            /WHERE (.+?) ORDER BY/,
            `WHERE (${existingConditions}) AND ${conditionsString} ORDER BY`
          );
        } else {
          // No OR operators, simple AND is fine
          modifiedQuery = query.replace(' ORDER BY ', ` AND ${conditionsString} ORDER BY `);
        }
      } else {
        // Fallback: simple append
        modifiedQuery = query.replace(' ORDER BY ', ` AND ${conditionsString} ORDER BY `);
      }
    } else {
      // No WHERE clause, add one
      modifiedQuery = query.replace(' ORDER BY ', ` WHERE ${conditionsString} ORDER BY `);
    }

    console.log('[ADO Service] Modified query:', modifiedQuery);
    return modifiedQuery;
  }

  /**
   * Build global filter conditions to be added to WHERE clause
   */
  private buildGlobalFilterConditions(filters?: GlobalFilters): string {
    console.log('[ADO Service] buildGlobalFilterConditions called with:', filters);

    if (!filters) {
      console.log('[ADO Service] No filters provided');
      return '';
    }

    const conditions: string[] = [];

    // Legacy support for ignoreClosed checkbox
    if (filters.ignoreClosed) {
      console.log('[ADO Service] Adding ignoreClosed condition');
      conditions.push(`[System.State] <> 'Closed'`);
    }

    // New multi-select ignore states filter
    if (Array.isArray(filters.ignoreStates) && filters.ignoreStates.length > 0) {
      console.log('[ADO Service] Adding ignoreStates condition:', filters.ignoreStates);
      const stateConditions = filters.ignoreStates.map(state => `[System.State] <> '${state}'`).join(' AND ');
      conditions.push(`(${stateConditions})`);
    }

    // New multi-select ignore created by filter
    if (Array.isArray(filters.ignoreCreatedBy) && filters.ignoreCreatedBy.length > 0) {
      console.log('[ADO Service] Adding ignoreCreatedBy condition:', filters.ignoreCreatedBy);
      const createdByConditions = filters.ignoreCreatedBy.map(user => `[System.CreatedBy] <> '${user}'`).join(' AND ');
      conditions.push(`(${createdByConditions})`);
    }

    if (filters.onlyMyTickets && filters.currentUser) {
      console.log('[ADO Service] Adding onlyMyTickets condition for:', filters.currentUser);
      conditions.push(`[System.AssignedTo] CONTAINS '${filters.currentUser}'`);
    }

    if (filters.ignoreOlderThanDays) {
      console.log('[ADO Service] Adding ignoreOlderThanDays condition:', filters.ignoreOlderThanDays);
      conditions.push(`[System.ChangedDate] >= @Today - ${filters.ignoreOlderThanDays}`);
    }

    const result = conditions.length > 0 ? conditions.join(' AND ') : '';
    console.log('[ADO Service] Final filter conditions:', result);
    return result;
  }

  /**
   * Build WIQL query based on command and parameters
   */
  buildQuery(command: string, param?: string, filters?: GlobalFilters): string {
    const baseQuery = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems`;
    const globalFilterConditions = this.buildGlobalFilterConditions(filters);

    // Helper function to add filters to existing WHERE clause
    const applyFilters = (query: string): string => {
      if (!globalFilterConditions) return query;
      // If query has WHERE, append with AND, otherwise add WHERE
      if (query.includes(' WHERE ')) {
        return query.replace(' ORDER BY ', ` AND ${globalFilterConditions} ORDER BY `);
      } else {
        return query.replace(' ORDER BY ', ` WHERE ${globalFilterConditions} ORDER BY `);
      }
    };

    if (command.startsWith('/project') && param) {
      return applyFilters(`${baseQuery} WHERE [System.TeamProject] = '${param}' ORDER BY [System.ChangedDate] DESC`);
    }

    if (command.startsWith('/id') && param) {
      // Direct ID lookup - search for specific work item by ID
      return applyFilters(`${baseQuery} WHERE [System.Id] = ${param} ORDER BY [System.ChangedDate] DESC`);
    }

    if (command.startsWith('/board') && param) {
      // Use UNDER operator for AreaPath - Azure DevOps doesn't support CONTAINS with area path fields
      // UNDER matches the area and all child areas hierarchically
      // AreaPath must be fully qualified with project name: ProjectName\AreaPath
      const fullAreaPath = this.project ? `${this.project}\\${param}` : param;
      return applyFilters(`${baseQuery} WHERE [System.AreaPath] UNDER '${fullAreaPath}' ORDER BY [System.ChangedDate] DESC`);
    }

    if (command.startsWith('/created_by') && param) {
      // Use = for exact display name match instead of CONTAINS to avoid partial matches
      return applyFilters(`${baseQuery} WHERE [System.CreatedBy] = '${param}' ORDER BY [System.CreatedDate] DESC`);
    }

    if (command.startsWith('/assigned_to') && param) {
      // Use = for exact display name match instead of CONTAINS to avoid partial matches
      // e.g., "Ericka" won't match "Frederick"
      return applyFilters(`${baseQuery} WHERE [System.AssignedTo] = '${param}' ORDER BY [System.ChangedDate] DESC`);
    }

    if (command.startsWith('/state') && param) {
      return applyFilters(`${baseQuery} WHERE [System.State] = '${param}' ORDER BY [System.ChangedDate] DESC`);
    }

    if (command.startsWith('/type') && param) {
      return applyFilters(`${baseQuery} WHERE [System.WorkItemType] = '${param}' ORDER BY [System.CreatedDate] DESC`);
    }

    if (command.startsWith('/tag') && param) {
      // Support multiple tags separated by commas (AND logic)
      const tags = param.split(',').map(t => t.trim()).filter(t => t);
      if (tags.length > 1) {
        const tagConditions = tags.map(tag => `[System.Tags] CONTAINS '${tag}'`).join(' AND ');
        return applyFilters(`${baseQuery} WHERE ${tagConditions} ORDER BY [System.ChangedDate] DESC`);
      }
      return applyFilters(`${baseQuery} WHERE [System.Tags] CONTAINS '${param}' ORDER BY [System.ChangedDate] DESC`);
    }

    if (command.startsWith('/recent')) {
      return applyFilters(`${baseQuery} WHERE [System.ChangedDate] >= @Today - 7 ORDER BY [System.ChangedDate] DESC`);
    }

    // Default: search in title and description
    const searchTerm = command.startsWith('/') ? command.slice(1).split(' ')[0] : command;
    return applyFilters(`${baseQuery} WHERE [System.Title] CONTAINS '${searchTerm}' OR [System.Description] CONTAINS '${searchTerm}' ORDER BY [System.ChangedDate] DESC`);
  }

  /**
   * Map ADO work item to our WorkItem interface
   */
  private mapToWorkItem(item: any): WorkItem {
    const fields = item.fields;

    return {
      id: item.id.toString(),
      title: fields['System.Title'] || 'Untitled',
      type: fields['System.WorkItemType'] || 'Unknown',
      state: fields['System.State'] || 'Unknown',
      assignedTo: fields['System.AssignedTo']?.displayName || 'Unassigned',
      assignedToEmail: fields['System.AssignedTo']?.uniqueName,
      createdBy: fields['System.CreatedBy']?.displayName || 'Unknown',
      createdByEmail: fields['System.CreatedBy']?.uniqueName,
      createdDate: fields['System.CreatedDate'] || new Date().toISOString(),
      priority: fields['Microsoft.VSTS.Common.Priority'] || 3,
      description: fields['System.Description'] || '',
      tags: fields['System.Tags'] ? fields['System.Tags'].split(';').map((t: string) => t.trim()) : [],
      project: fields['System.TeamProject'] || this.project || 'Unknown',
      changedDate: fields['System.ChangedDate'],
      changedBy: fields['System.ChangedBy']?.displayName,
      changedByEmail: fields['System.ChangedBy']?.uniqueName,
      iterationPath: fields['System.IterationPath'],
      areaPath: fields['System.AreaPath'],
      storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'],
      acceptanceCriteria: fields['Microsoft.VSTS.Common.AcceptanceCriteria'],
    };
  }

  /**
   * Get a single work item by ID
   */
  async getWorkItem(id: string): Promise<WorkItem | null> {
    try {
      const response = await this.client.get(`/wit/workitems/${id}`);
      return this.mapToWorkItem(response.data);
    } catch (error) {
      console.error(`Error fetching work item ${id}:`, error);
      return null;
    }
  }

  /**
   * Get all projects in the organization
   */
  async getProjects(): Promise<{ id: string; name: string; description?: string }[]> {
    try {
      const response = await this.orgClient.get('/projects', {
        params: {
          '$top': 100, // Get up to 100 projects
        },
      });

      return response.data.value.map((project: any) => ({
        id: project.id,
        name: project.name,
        description: project.description,
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  }

  /**
   * Get all teams/boards for a specific project
   */
  async getTeams(projectName?: string): Promise<{ id: string; name: string; projectName: string }[]> {
    try {
      const targetProject = projectName || this.project;

      console.log('[ADO getTeams] Fetching teams for project:', targetProject || 'all projects');
      console.log('[ADO getTeams] OrgClient baseURL:', this.orgClient.defaults.baseURL);

      if (!targetProject) {
        // If no project specified, get teams from all projects
        const projects = await this.getProjects();
        console.log('[ADO getTeams] Fetching teams from', projects.length, 'projects');
        const allTeams = [];

        for (const project of projects) {
          try {
            const url = `/projects/${encodeURIComponent(project.name)}/teams`;
            console.log('[ADO getTeams] Fetching teams for project:', project.name, 'URL:', url);
            const response = await this.orgClient.get(url);
            const teams = response.data.value.map((team: any) => ({
              id: team.id,
              name: team.name,
              projectName: project.name,
            }));
            console.log('[ADO getTeams] Found', teams.length, 'teams for project:', project.name);
            allTeams.push(...teams);
          } catch (error: any) {
            console.warn('[ADO getTeams] Could not fetch teams for project', project.name, ':', {
              status: error.response?.status,
              statusText: error.response?.statusText,
              url: error.config?.url,
              message: error.message,
            });
          }
        }

        console.log('[ADO getTeams] Total teams found:', allTeams.length);
        return allTeams;
      }

      // Get teams for specific project
      const url = `/projects/${encodeURIComponent(targetProject)}/teams`;
      console.log('[ADO getTeams] Fetching teams for single project:', targetProject, 'URL:', url);
      const response = await this.orgClient.get(url);

      const teams = response.data.value.map((team: any) => ({
        id: team.id,
        name: team.name,
        projectName: targetProject,
      }));
      console.log('[ADO getTeams] Found', teams.length, 'teams');

      return teams;
    } catch (error: any) {
      console.error('[ADO getTeams] Error fetching teams:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        message: error.message,
      });
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get all users from the organization
   */
  async getUsers(): Promise<{ displayName: string; uniqueName: string }[]> {
    try {
      // Use the Graph API to get users - requires vssps subdomain
      const url = `https://vssps.dev.azure.com/${this.organization}/_apis/graph/users?api-version=7.1-preview.1`;
      console.log('[ADO getUsers] Fetching users from Graph API:', url);

      const response = await axios.get(url, {
        headers: {
          Authorization: this.orgClient.defaults.headers.Authorization as string,
          'Content-Type': 'application/json',
        },
        params: {
          '$top': 100,
        },
      });

      const users = response.data.value.map((user: any) => ({
        displayName: user.displayName || user.principalName,
        uniqueName: user.mailAddress || user.principalName,
      }));

      console.log('[ADO getUsers] Found', users.length, 'users');
      return users;
    } catch (error: any) {
      console.error('[ADO getUsers] Error fetching users:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        message: error.message,
      });
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get all unique states from work item types
   */
  async getStates(): Promise<string[]> {
    try {
      // Use the work item types API to get all states
      // If project is specified, get states for that project only
      if (this.project) {
        const response = await this.client.get('/wit/workitemtypes');
        const states = new Set<string>();

        response.data.value.forEach((workItemType: any) => {
          // Each work item type has a states array
          if (workItemType.states && Array.isArray(workItemType.states)) {
            workItemType.states.forEach((state: any) => {
              states.add(state.name);
            });
          }
        });

        return Array.from(states).sort();
      }

      // For org-level, get states from all projects
      const projects = await this.getProjects();
      const allStates = new Set<string>();

      for (const project of projects.slice(0, 10)) { // Limit to first 10 projects
        try {
          // Use axios directly with correct URL structure (no double _apis)
          const url = `https://dev.azure.com/${this.organization}/${encodeURIComponent(project.name)}/_apis/wit/workitemtypes?api-version=7.1`;
          const response = await axios.get(url, {
            headers: {
              Authorization: this.orgClient.defaults.headers.Authorization as string,
              'Content-Type': 'application/json',
            },
          });
          response.data.value.forEach((workItemType: any) => {
            if (workItemType.states && Array.isArray(workItemType.states)) {
              workItemType.states.forEach((state: any) => {
                allStates.add(state.name);
              });
            }
          });
        } catch (err) {
          console.warn(`Could not fetch states for project ${project.name}`);
        }
      }

      return Array.from(allStates).sort();
    } catch (error) {
      console.error('Error fetching states:', error);
      // Return default states if API fails
      return ['New', 'Active', 'Resolved', 'Closed', 'Removed'];
    }
  }

  /**
   * Get all work item types
   */
  async getTypes(): Promise<string[]> {
    try {
      // Use the work item types API to get all types
      if (this.project) {
        const response = await this.client.get('/wit/workitemtypes');
        return response.data.value.map((type: any) => type.name).sort();
      }

      // For org-level, get types from all projects
      const projects = await this.getProjects();
      const allTypes = new Set<string>();

      for (const project of projects.slice(0, 10)) { // Limit to first 10 projects
        try {
          // Use axios directly with correct URL structure (no double _apis)
          const url = `https://dev.azure.com/${this.organization}/${encodeURIComponent(project.name)}/_apis/wit/workitemtypes?api-version=7.1`;
          const response = await axios.get(url, {
            headers: {
              Authorization: this.orgClient.defaults.headers.Authorization as string,
              'Content-Type': 'application/json',
            },
          });
          response.data.value.forEach((type: any) => {
            allTypes.add(type.name);
          });
        } catch (err) {
          console.warn(`Could not fetch types for project ${project.name}`);
        }
      }

      return Array.from(allTypes).sort();
    } catch (error) {
      console.error('Error fetching types:', error);
      // Return default types if API fails
      return ['Bug', 'Task', 'User Story', 'Epic', 'Feature', 'Issue'];
    }
  }

  /**
   * Get related work items for a specific work item by fetching its relations
   */
  async getRelatedWorkItems(workItemId: number): Promise<WorkItem[]> {
    try {
      console.log('[ADO API] 🔍 Fetching related items for work item:', workItemId);

      // SPECIAL DEBUG FOR TICKET 17367
      if (workItemId === 17367) {
        console.log('[ADO API] 🎯 DEBUGGING TICKET 17367 - Expected: 1 Parent (5318), 19 Children');
      }

      // Try org-level client first for cross-project relations support
      // Azure DevOps work items can have relations across projects
      // Format: /{organization}/_apis/wit/workitems/{id}?$expand=Relations
      const response = await this.orgClient.get(`/wit/workitems/${workItemId}`, {
        params: {
          '$expand': 'Relations',
        },
      });

      const workItem = response.data;

      // Enhanced logging: Show raw relations data
      console.log('[ADO API] Raw API response for work item', workItemId, ':', {
        id: workItem.id,
        hasRelations: !!workItem.relations,
        relationsCount: workItem.relations?.length || 0,
        relations: workItem.relations || [],
      });

      if (!workItem.relations || workItem.relations.length === 0) {
        console.log('[ADO API] No relations found for work item:', workItemId);
        return [];
      }

      // Extract work item IDs and relation types from relations
      // Relations have a 'url' property like: https://dev.azure.com/.../workitems/12345
      // and a 'rel' property that indicates the relation type
      const relatedIdsWithTypes: Array<{ id: number; relationType: string }> = [];
      workItem.relations.forEach((relation: any, index: number) => {
        console.log(`[ADO API] Processing relation ${index + 1}:`, {
          url: relation.url,
          rel: relation.rel,
          attributes: relation.attributes,
        });

        // Case-insensitive check for /workItems/ (note: Azure uses camelCase!)
        if (relation.url && relation.url.toLowerCase().includes('/workitems/')) {
          const match = relation.url.match(/\/workitems\/(\d+)$/i); // Case-insensitive regex
          if (match) {
            const id = parseInt(match[1]);
            // Parse relation type from 'rel' field
            // IMPORTANT: Hierarchy-Reverse = Parent, Hierarchy-Forward = Child
            //            (verified from attributes.name in ADO response)
            let relationType = 'Related';
            if (relation.rel) {
              if (relation.rel.includes('Hierarchy-Reverse')) {
                relationType = 'Parent';
              } else if (relation.rel.includes('Hierarchy-Forward')) {
                relationType = 'Child';
              } else if (relation.rel.includes('Dependency-Forward')) {
                relationType = 'Successor';
              } else if (relation.rel.includes('Dependency-Reverse')) {
                relationType = 'Predecessor';
              } else if (relation.rel.includes('Related')) {
                relationType = 'Related';
              }
            }
            console.log(`[ADO API] Parsed relation: ID=${id}, Type=${relationType}, Original rel=${relation.rel}`);
            relatedIdsWithTypes.push({ id, relationType });
          } else {
            console.log(`[ADO API] Could not parse work item ID from URL:`, relation.url);
          }
        } else {
          console.log(`[ADO API] Skipping non-work-item relation:`, relation.url);
        }
      });

      if (relatedIdsWithTypes.length === 0) {
        console.log('[ADO API] No work item relations found after parsing');
        return [];
      }

      console.log('[ADO API] Found', relatedIdsWithTypes.length, 'related work item IDs:', relatedIdsWithTypes);

      // Summary by relation type
      const typeSummary = relatedIdsWithTypes.reduce((acc, item) => {
        acc[item.relationType] = (acc[item.relationType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('[ADO API] 📊 Relations by type:', typeSummary);

      // SPECIAL DEBUG FOR TICKET 17367
      if (workItemId === 17367) {
        console.log('[ADO API] 🎯 TICKET 17367 Summary - Found:', typeSummary);
        console.log('[ADO API] 🎯 Expected: {Parent: 1, Child: 19}');
        console.log('[ADO API] 🎯 All relations:', relatedIdsWithTypes);
      }

      // Fetch details for all related work items
      const detailsResponse = await this.orgClient.get('/wit/workitems', {
        params: {
          ids: relatedIdsWithTypes.map(r => r.id).join(','),
          fields: 'System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.CreatedBy,System.CreatedDate,System.ChangedDate,System.ChangedBy,Microsoft.VSTS.Common.Priority,System.Description,System.Tags,System.TeamProject,System.IterationPath,System.AreaPath,Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Common.AcceptanceCriteria',
        },
      });

      console.log('[ADO API] Details API returned', detailsResponse.data.value?.length || 0, 'work items');

      // Map work items and add relation type
      const relatedWorkItems = detailsResponse.data.value.map((item: any) => {
        const workItem = this.mapToWorkItem(item);
        // Find the relation type for this work item
        const relationInfo = relatedIdsWithTypes.find(r => r.id.toString() === item.id.toString());
        if (relationInfo) {
          workItem.relationType = relationInfo.relationType;
          workItem.relationSource = 'linked';
          console.log(`[ADO API] Mapped work item #${item.id}: ${item.fields['System.Title']} as ${relationInfo.relationType}`);
        }
        return workItem;
      });

      console.log('[ADO API] Successfully fetched', relatedWorkItems.length, 'related work items with types');

      return relatedWorkItems;
    } catch (error: any) {
      console.error('[ADO API] Error fetching related work items:', {
        workItemId,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        responseData: error.response?.data,
        stack: error.stack,
      });
      return [];
    }
  }

  /**
   * Get all unique tags
   */
  async getTags(): Promise<string[]> {
    try {
      // WIQL queries must be scoped to a project in Azure DevOps
      if (!this.project) {
        console.warn('[ADO getTags] Project required for getTags, returning empty array');
        return [];
      }

      console.log('[ADO getTags] Fetching tags for project:', this.project);
      console.log('[ADO getTags] Client baseURL:', this.client.defaults.baseURL);

      // Query for work items with tags - must include System.Id in SELECT
      const query = `SELECT [System.Id], [System.Tags] FROM WorkItems WHERE [System.Tags] <> ''`;

      try {
        const response = await this.client.post('/wit/wiql', {
          query: query,
        });

        console.log('[ADO getTags] WIQL query returned', response.data.workItems?.length || 0, 'work items');

        const workItemIds = response.data.workItems?.map((item: any) => item.id) || [];

        if (workItemIds.length === 0) {
          console.log('[ADO getTags] No work items with tags found');
          return [];
        }

        // Get work items
        const detailsResponse = await this.orgClient.get('/wit/workitems', {
          params: {
            ids: workItemIds.slice(0, 100).join(','),
            fields: 'System.Tags',
          },
        });

        // Extract unique tags
        const tags = new Set<string>();
        detailsResponse.data.value.forEach((item: any) => {
          if (item.fields['System.Tags']) {
            const itemTags = item.fields['System.Tags'].split(';');
            itemTags.forEach((tag: string) => {
              const trimmed = tag.trim();
              if (trimmed) {
                tags.add(trimmed);
              }
            });
          }
        });

        const tagArray = Array.from(tags).sort();
        console.log('[ADO getTags] Found', tagArray.length, 'unique tags');
        return tagArray;
      } catch (wiqlError: any) {
        console.error('[ADO getTags] WIQL query failed:', {
          status: wiqlError.response?.status,
          statusText: wiqlError.response?.statusText,
          url: wiqlError.config?.url,
          baseURL: wiqlError.config?.baseURL,
          message: wiqlError.message,
        });
        // Return empty array on WIQL error so the app continues to work
        return [];
      }
    } catch (error) {
      console.error('[ADO getTags] Error fetching tags:', error);
      return [];
    }
  }

  /**
   * Get all shared queries for the project
   */
  async getQueries(): Promise<{ id: string; name: string; path: string; wiql?: string }[]> {
    try {
      if (!this.project) {
        console.warn('[ADO getQueries] Project required for queries, returning empty array');
        return [];
      }

      console.log('[ADO getQueries] Fetching queries for project:', this.project);

      // Get the query folders and queries
      // $depth=2 will get queries inside folders as well
      const response = await this.client.get('/wit/queries', {
        params: {
          '$depth': 2,
          '$expand': 'all',
        },
      });

      console.log('[ADO getQueries] API response:', response.data);

      const queries: { id: string; name: string; path: string; wiql?: string }[] = [];

      // Recursive function to extract queries from folder structure
      const extractQueries = (items: any[], parentPath: string = '') => {
        if (!items) return;

        items.forEach((item: any) => {
          if (item.isFolder) {
            // Recursively process folder contents
            const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
            if (item.children) {
              extractQueries(item.children, folderPath);
            }
          } else if (item.isPublic !== false && item.wiql) {
            // Only include public/shared queries that have WIQL
            // This filters out folders and link queries
            queries.push({
              id: item.id,
              name: item.name,
              path: parentPath ? `${parentPath}/${item.name}` : item.name,
              wiql: item.wiql,
            });
          }
        });
      };

      // Start extraction from root
      if (response.data.value) {
        extractQueries(response.data.value);
      }

      console.log('[ADO getQueries] Found', queries.length, 'queries');
      return queries;
    } catch (error: any) {
      console.error('[ADO getQueries] Error fetching queries:', {
        project: this.project,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        url: error.config?.url,
        responseData: error.response?.data,
      });
      return [];
    }
  }

  /**
   * Run a saved query by its ID
   */
  async runQuery(queryId: string): Promise<WorkItem[]> {
    try {
      if (!this.project) {
        throw new Error('Project required to run queries');
      }

      console.log('[ADO runQuery] Running query:', queryId);

      // Get the query details to extract the WIQL
      // Need to expand to get the WIQL
      const queryResponse = await this.client.get(`/wit/queries/${queryId}`, {
        params: {
          '$expand': 'wiql',
        },
      });

      console.log('[ADO runQuery] Query response:', queryResponse.data);

      const wiql = queryResponse.data.wiql;

      if (!wiql) {
        throw new Error('Query does not contain WIQL. The query might be a folder or a query that references another query.');
      }

      console.log('[ADO runQuery] Query WIQL:', wiql);

      // Execute the WIQL query
      return await this.searchWorkItems(wiql);
    } catch (error: any) {
      console.error('[ADO runQuery] Error running query:', {
        queryId,
        project: this.project,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Get all comments/discussion for a work item
   */
  async getComments(workItemId: number): Promise<Comment[]> {
    try {
      console.log('[ADO getComments] Fetching comments for work item:', workItemId);

      // Use the project-level client (includes project in URL path)
      // Azure DevOps comments API requires: /{project}/_apis/wit/workitems/{id}/comments
      // Comments API is in preview and requires the -preview flag
      const response = await this.client.get(`/wit/workitems/${workItemId}/comments`, {
        params: {
          '$top': 200, // Get up to 200 comments
          '$expand': 'all',
          'api-version': '7.1-preview.3', // Override default version with preview flag
        },
      });

      console.log('[ADO getComments] API response:', response.data);

      if (!response.data.comments || response.data.comments.length === 0) {
        console.log('[ADO getComments] No comments found for work item:', workItemId);
        return [];
      }

      // Map comments to our Comment interface
      const comments: Comment[] = response.data.comments.map((comment: any) => ({
        id: comment.id,
        text: comment.text || '',
        createdBy: comment.createdBy?.displayName || 'Unknown',
        createdByEmail: comment.createdBy?.uniqueName,
        createdDate: comment.createdDate,
        modifiedBy: comment.modifiedBy?.displayName,
        modifiedByEmail: comment.modifiedBy?.uniqueName,
        modifiedDate: comment.modifiedDate,
      }));

      console.log('[ADO getComments] Found', comments.length, 'comments');
      return comments;
    } catch (error: any) {
      console.error('[ADO getComments] Error fetching comments:', {
        workItemId,
        project: this.project,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        responseData: error.response?.data,
      });
      // Return empty array instead of throwing
      return [];
    }
  }
}
