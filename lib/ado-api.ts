import axios, { AxiosInstance } from 'axios';
import { WorkItem } from '@/types';

export class ADOService {
  private client: AxiosInstance;
  private organization: string;
  private project: string;

  constructor(organization: string, project: string, personalAccessToken: string) {
    this.organization = organization;
    this.project = project;

    // Create base64 encoded PAT for Basic Auth
    const auth = Buffer.from(`:${personalAccessToken}`).toString('base64');

    this.client = axios.create({
      baseURL: `https://dev.azure.com/${organization}/${project}/_apis`,
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
   */
  async searchWorkItems(query: string): Promise<WorkItem[]> {
    try {
      // First, execute the query to get work item IDs
      const queryResponse = await this.client.post('/wit/wiql', {
        query: query,
      });

      const workItemIds = queryResponse.data.workItems.map((item: any) => item.id);

      if (workItemIds.length === 0) {
        return [];
      }

      // Then, get the full details of each work item
      const detailsResponse = await this.client.get('/wit/workitems', {
        params: {
          ids: workItemIds.join(','),
          fields: 'System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.CreatedBy,System.CreatedDate,Microsoft.VSTS.Common.Priority,System.Description,System.Tags',
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
      project: this.project,
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
}
