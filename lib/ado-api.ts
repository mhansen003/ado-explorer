import axios, { AxiosInstance } from 'axios';
import { WorkItem } from '@/types';

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
    this.client = axios.create({
      baseURL: `https://dev.azure.com/${organization}${project ? `/${project}` : ''}/_apis`,
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
      // Use org-level client for cross-project search, project-level for single project
      const apiClient = this.project ? this.client : this.orgClient;

      // First, execute the query to get work item IDs
      const queryResponse = await apiClient.post('/wit/wiql', {
        query: query,
      });

      const workItemIds = queryResponse.data.workItems.map((item: any) => item.id);

      if (workItemIds.length === 0) {
        return [];
      }

      // Then, get the full details of each work item (use org client to get all fields including project)
      const detailsResponse = await this.orgClient.get('/wit/workitems', {
        params: {
          ids: workItemIds.join(','),
          fields: 'System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.CreatedBy,System.CreatedDate,Microsoft.VSTS.Common.Priority,System.Description,System.Tags,System.TeamProject',
        },
      });

      return detailsResponse.data.value.map((item: any) => this.mapToWorkItem(item));
    } catch (error) {
      console.error('Error searching work items:', error);
      throw error;
    }
  }

  /**
   * Build WIQL query based on command and parameters
   */
  buildQuery(command: string, param?: string): string {
    const baseQuery = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems`;

    if (command.startsWith('/project') && param) {
      return `${baseQuery} WHERE [System.TeamProject] = '${param}' ORDER BY [System.ChangedDate] DESC`;
    }

    if (command.startsWith('/board') && param) {
      return `${baseQuery} WHERE [System.AreaPath] CONTAINS '${param}' ORDER BY [System.ChangedDate] DESC`;
    }

    if (command.startsWith('/created_by') && param) {
      return `${baseQuery} WHERE [System.CreatedBy] CONTAINS '${param}' ORDER BY [System.CreatedDate] DESC`;
    }

    if (command.startsWith('/assigned_to') && param) {
      return `${baseQuery} WHERE [System.AssignedTo] CONTAINS '${param}' ORDER BY [System.ChangedDate] DESC`;
    }

    if (command.startsWith('/state') && param) {
      return `${baseQuery} WHERE [System.State] = '${param}' ORDER BY [System.ChangedDate] DESC`;
    }

    if (command.startsWith('/type') && param) {
      return `${baseQuery} WHERE [System.WorkItemType] = '${param}' ORDER BY [System.CreatedDate] DESC`;
    }

    if (command.startsWith('/tag') && param) {
      return `${baseQuery} WHERE [System.Tags] CONTAINS '${param}' ORDER BY [System.ChangedDate] DESC`;
    }

    if (command.startsWith('/recent')) {
      return `${baseQuery} WHERE [System.ChangedDate] >= @Today - 7 ORDER BY [System.ChangedDate] DESC`;
    }

    // Default: search in title and description
    const searchTerm = command.startsWith('/') ? command.slice(1).split(' ')[0] : command;
    return `${baseQuery} WHERE [System.Title] CONTAINS '${searchTerm}' OR [System.Description] CONTAINS '${searchTerm}' ORDER BY [System.ChangedDate] DESC`;
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
      createdBy: fields['System.CreatedBy']?.displayName || 'Unknown',
      createdDate: fields['System.CreatedDate'] || new Date().toISOString(),
      priority: fields['Microsoft.VSTS.Common.Priority'] || 3,
      description: fields['System.Description'] || '',
      tags: fields['System.Tags'] ? fields['System.Tags'].split(';').map((t: string) => t.trim()) : [],
      project: fields['System.TeamProject'] || this.project || 'Unknown',
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

      if (!targetProject) {
        // If no project specified, get teams from all projects
        const projects = await this.getProjects();
        const allTeams = [];

        for (const project of projects) {
          try {
            const response = await this.orgClient.get(`/projects/${project.id}/teams`);
            const teams = response.data.value.map((team: any) => ({
              id: team.id,
              name: team.name,
              projectName: project.name,
            }));
            allTeams.push(...teams);
          } catch (error) {
            console.warn(`Could not fetch teams for project ${project.name}`);
          }
        }

        return allTeams;
      }

      // Get teams for specific project
      const response = await this.orgClient.get(`/projects/${encodeURIComponent(targetProject)}/teams`);

      return response.data.value.map((team: any) => ({
        id: team.id,
        name: team.name,
        projectName: targetProject,
      }));
    } catch (error) {
      console.error('Error fetching teams:', error);
      throw error;
    }
  }

  /**
   * Get all users from the organization
   */
  async getUsers(): Promise<{ displayName: string; uniqueName: string }[]> {
    try {
      // Use the Graph API to get users
      const response = await this.orgClient.get(`/graph/users`, {
        params: {
          '$top': 100,
        },
      });

      return response.data.value.map((user: any) => ({
        displayName: user.displayName || user.principalName,
        uniqueName: user.mailAddress || user.principalName,
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
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
   * Get all unique tags
   */
  async getTags(): Promise<string[]> {
    try {
      // Query for work items with tags - must include System.Id in SELECT
      const query = `SELECT [System.Id], [System.Tags] FROM WorkItems WHERE [System.Tags] <> ''`;
      const response = await (this.project ? this.client : this.orgClient).post('/wit/wiql', {
        query: query,
      });

      const workItemIds = response.data.workItems.map((item: any) => item.id);

      if (workItemIds.length === 0) {
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

      return Array.from(tags).sort();
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  }
}
