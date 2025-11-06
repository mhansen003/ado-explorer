/**
 * Collection Query Detector
 * Detects when user is asking for ADO collections and fetches the appropriate data
 */

export type CollectionType = 'projects' | 'teams' | 'users' | 'states' | 'types' | 'tags' | 'none';

export interface CollectionDetectionResult {
  type: CollectionType;
  confidence: 'high' | 'medium' | 'low';
  keywords: string[];
}

/**
 * Detect if a user query is asking for a specific ADO collection
 */
export function detectCollectionQuery(query: string): CollectionDetectionResult {
  const lowerQuery = query.toLowerCase().trim();

  // Projects - HIGH confidence patterns
  if (
    /^(list|show|get|display|what|all)\s+(all\s+)?(of\s+)?(the\s+)?projects?/i.test(lowerQuery) ||
    lowerQuery === 'projects' ||
    lowerQuery === 'list projects' ||
    lowerQuery === 'show me projects' ||
    lowerQuery === 'all projects'
  ) {
    return { type: 'projects', confidence: 'high', keywords: ['projects', 'list'] };
  }

  // Teams - HIGH confidence patterns
  if (
    /^(list|show|get|display|what|all)\s+(all\s+)?(of\s+)?(the\s+)?(teams?|boards?)/i.test(lowerQuery) ||
    lowerQuery === 'teams' ||
    lowerQuery === 'boards' ||
    lowerQuery === 'list teams' ||
    lowerQuery === 'show me teams'
  ) {
    return { type: 'teams', confidence: 'high', keywords: ['teams', 'boards'] };
  }

  // Users - HIGH confidence patterns
  if (
    /^(list|show|get|display|what|all)\s+(all\s+)?(of\s+)?(the\s+)?(users?|people|members?|team members?)/i.test(lowerQuery) ||
    lowerQuery === 'users' ||
    lowerQuery === 'people' ||
    lowerQuery === 'team members' ||
    lowerQuery === 'who is in the org' ||
    lowerQuery.match(/who('s| is) in (the )?(org|organization|team)/i)
  ) {
    return { type: 'users', confidence: 'high', keywords: ['users', 'people', 'members'] };
  }

  // States - HIGH confidence patterns
  if (
    /^(what|list|show|get|display)\s+(all\s+)?(of\s+)?(the\s+)?(work item\s+)?states?/i.test(lowerQuery) ||
    lowerQuery === 'states' ||
    lowerQuery.match(/what states? (are )?(available|exist)/i) ||
    lowerQuery.match(/available states/i)
  ) {
    return { type: 'states', confidence: 'high', keywords: ['states', 'available'] };
  }

  // Types - HIGH confidence patterns
  if (
    /^(what|list|show|get|display)\s+(all\s+)?(of\s+)?(the\s+)?(work item\s+)?types?/i.test(lowerQuery) ||
    lowerQuery === 'types' ||
    lowerQuery.match(/what types? (of work items?)? (are )?(available|exist)/i) ||
    lowerQuery.match(/available (work item\s+)?types/i) ||
    lowerQuery.match(/what.*work item types/i)
  ) {
    return { type: 'types', confidence: 'high', keywords: ['types', 'work item'] };
  }

  // Tags - HIGH confidence patterns
  if (
    /^(what|list|show|get|display)\s+(all\s+)?(of\s+)?(the\s+)?tags?/i.test(lowerQuery) ||
    lowerQuery === 'tags' ||
    lowerQuery.match(/what tags? (are )?(available|exist|being used)/i) ||
    lowerQuery.match(/available tags/i)
  ) {
    return { type: 'tags', confidence: 'high', keywords: ['tags', 'available'] };
  }

  return { type: 'none', confidence: 'low', keywords: [] };
}

/**
 * Fetch collection data from internal APIs
 */
export async function fetchCollectionData(
  type: CollectionType,
  baseUrl: string = 'http://localhost:3000'
): Promise<{ data: any; count: number; error?: string }> {
  if (type === 'none') {
    return { data: null, count: 0 };
  }

  try {
    const endpoint = {
      projects: '/api/projects',
      teams: '/api/boards',
      users: '/api/users',
      states: '/api/states',
      types: '/api/types',
      tags: '/api/tags',
    }[type];

    console.log(`[Collection Detector] Fetching ${type} from ${endpoint}`);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Collection Detector] Error fetching ${type}:`, errorText);
      return {
        data: null,
        count: 0,
        error: `Failed to fetch ${type}: ${response.statusText}`
      };
    }

    const result = await response.json();

    // Extract the array from the response
    const data = result[type] || result.teams || result.boards || result.users || result.states || result.types || result.tags || [];

    console.log(`[Collection Detector] Fetched ${data.length} ${type}`);

    return { data, count: data.length };
  } catch (error: any) {
    console.error(`[Collection Detector] Exception fetching ${type}:`, error.message);
    return {
      data: null,
      count: 0,
      error: `Exception fetching ${type}: ${error.message}`
    };
  }
}

/**
 * Format collection data as context for Claude
 */
export function formatCollectionContext(type: CollectionType, data: any[]): string {
  if (!data || data.length === 0) {
    return `No ${type} found.`;
  }

  let context = `\n\n<collection_data type="${type}" count="${data.length}">\n`;

  switch (type) {
    case 'projects':
      context += 'Projects in the organization:\n';
      data.forEach((project, idx) => {
        context += `${idx + 1}. ${project.name || project.Name}`;
        if (project.description || project.Description) {
          context += ` - ${project.description || project.Description}`;
        }
        context += ` (State: ${project.state || project.State || 'Active'})\n`;
      });
      break;

    case 'teams':
      context += 'Teams/Boards in the organization:\n';
      data.forEach((team, idx) => {
        context += `${idx + 1}. ${team.name || team.Name}`;
        if (team.projectName || team.ProjectName) {
          context += ` (Project: ${team.projectName || team.ProjectName})`;
        }
        context += '\n';
      });
      break;

    case 'users':
      context += 'Users in the organization:\n';
      data.forEach((user, idx) => {
        context += `${idx + 1}. ${user.displayName || user.name || 'Unknown'}`;
        if (user.emailAddress || user.email) {
          context += ` <${user.emailAddress || user.email}>`;
        }
        context += '\n';
      });
      break;

    case 'states':
      context += 'Available work item states:\n';
      data.forEach((state, idx) => {
        const stateName = typeof state === 'string' ? state : (state.name || state.Name || state);
        context += `${idx + 1}. ${stateName}\n`;
      });
      break;

    case 'types':
      context += 'Available work item types:\n';
      data.forEach((type, idx) => {
        const typeName = typeof type === 'string' ? type : (type.name || type.Name || type);
        context += `${idx + 1}. ${typeName}\n`;
      });
      break;

    case 'tags':
      context += 'Tags used in work items:\n';
      data.forEach((tag, idx) => {
        const tagName = typeof tag === 'string' ? tag : (tag.name || tag.Name || tag);
        context += `${idx + 1}. ${tagName}\n`;
      });
      break;
  }

  context += '</collection_data>\n\n';
  context += `Please format this ${type} data into a beautiful markdown table or list for the user. Include helpful context and suggest next steps.`;

  return context;
}
