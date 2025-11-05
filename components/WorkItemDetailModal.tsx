'use client';

import { useState, useMemo, useEffect } from 'react';
import { WorkItem, Comment } from '@/types';
import { X, User, Calendar, AlertCircle, Tag, ExternalLink, Sparkles, FileText, Share2, CheckSquare, Target, TrendingUp, Link2, MessageSquare, ArrowUp, ArrowDown, Network, Maximize2 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RelationshipDiagram from './RelationshipDiagram';
import RelationshipModal from './RelationshipModal';

interface WorkItemDetailModalProps {
  workItem: WorkItem;
  onClose: () => void;
  breadcrumbTrail?: WorkItem[]; // Trail of work items navigated through
  onCloseAll?: () => void; // Close all modals in the stack
}

type AIAction = 'releaseNotes' | 'summary' | 'testCases' | 'acceptanceCriteria' | 'complexity' | 'relatedItems';

export default function WorkItemDetailModal({ workItem, onClose, breadcrumbTrail = [], onCloseAll }: WorkItemDetailModalProps) {
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [relatedWorkItems, setRelatedWorkItems] = useState<WorkItem[] | null>(null);
  const [selectedRelatedItem, setSelectedRelatedItem] = useState<WorkItem | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'discussion' | 'relationships'>('details');
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [hasFetchedComments, setHasFetchedComments] = useState(false);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [hasFetchedRelationships, setHasFetchedRelationships] = useState(false);
  const [showFullScreenRelationships, setShowFullScreenRelationships] = useState(false);

  // Current trail includes all previous items plus this one
  const currentTrail = [...breadcrumbTrail, workItem];

  // Reset comments and relationships state when work item changes
  useEffect(() => {
    setComments([]);
    setHasFetchedComments(false);
    setLoadingComments(false);
    setRelatedWorkItems(null);
    setHasFetchedRelationships(false);
    setLoadingRelationships(false);
  }, [workItem.id]);

  // Fetch comments when discussion tab is opened
  useEffect(() => {
    const fetchComments = async () => {
      if (activeTab === 'discussion' && !hasFetchedComments && !loadingComments) {
        setLoadingComments(true);
        setHasFetchedComments(true);

        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
          const response = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workItemId: parseInt(workItem.id) }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const data = await response.json();

          if (response.ok) {
            setComments(data.comments || []);
          } else {
            console.error('Failed to fetch comments:', data.error);
            // Set empty array on error so UI shows "no comments" message instead of spinning
            setComments([]);
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.error('Comments fetch timed out after 10 seconds');
          } else {
            console.error('Error fetching comments:', error);
          }
          // Set empty array on error so UI shows "no comments" message instead of spinning
          setComments([]);
        } finally {
          setLoadingComments(false);
        }
      }
    };

    fetchComments();
  }, [activeTab, workItem.id, hasFetchedComments, loadingComments]);

  // Fetch relationships when relationships tab is opened
  useEffect(() => {
    const fetchRelationships = async () => {
      if (activeTab === 'relationships' && !hasFetchedRelationships && !loadingRelationships) {
        setLoadingRelationships(true);
        setHasFetchedRelationships(true);

        try {
          const response = await fetch('/api/ai-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'relatedItems',
              workItem,
            }),
          });

          const data = await response.json();

          if (response.ok && data.relatedWorkItems) {
            setRelatedWorkItems(data.relatedWorkItems);
          } else {
            console.error('Failed to fetch relationships:', data.error);
            setRelatedWorkItems([]);
          }
        } catch (error: any) {
          console.error('Error fetching relationships:', error);
          setRelatedWorkItems([]);
        } finally {
          setLoadingRelationships(false);
        }
      }
    };

    fetchRelationships();
  }, [activeTab, workItem.id, hasFetchedRelationships, loadingRelationships]);

  // Sanitize the HTML description to prevent XSS attacks
  const sanitizedDescription = useMemo(() => {
    if (!workItem.description) return null;
    return DOMPurify.sanitize(workItem.description, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'div', 'span'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    });
  }, [workItem.description]);

  // Build Azure DevOps URL
  const getAdoUrl = () => {
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION || 'cmgfidev';
    const project = workItem.project || 'TheSingularity';
    return `https://dev.azure.com/${organization}/${project}/_workitems/edit/${workItem.id}`;
  };

  const handleOpenInAdo = () => {
    window.open(getAdoUrl(), '_blank');
  };

  const handleAIAction = async (action: AIAction) => {
    setLoading(true);
    setActiveAction(action);
    setAiResult(null);
    setRelatedWorkItems(null);

    try {
      const response = await fetch('/api/ai-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          workItem,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate AI content');
      }

      // Handle related items specially
      if (action === 'relatedItems' && data.relatedWorkItems) {
        console.log('[WorkItemDetailModal] Received related items:', data.relatedWorkItems.map((item: WorkItem) => ({
          id: item.id,
          title: item.title,
          relationType: item.relationType,
          relationSource: item.relationSource,
        })));
        setRelatedWorkItems(data.relatedWorkItems);
        setAiResult(data.relatedWorkItems.length > 0
          ? `Found ${data.relatedWorkItems.length} related work items. Click on any item below to view details.`
          : 'No related work items found.'
        );
      } else {
        setAiResult(data.result);
      }
    } catch (error: any) {
      setAiResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (aiResult) {
      navigator.clipboard.writeText(aiResult);
    }
  };

  const aiActions = [
    {
      id: 'releaseNotes' as AIAction,
      label: 'Release Notes',
      icon: FileText,
      description: 'Generate release notes',
      colors: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        hover: 'hover:bg-blue-500/20 hover:border-blue-500',
        active: 'bg-blue-500/20 border-blue-500',
      }
    },
    {
      id: 'summary' as AIAction,
      label: 'Share Summary',
      icon: Share2,
      description: 'Create shareable summary',
      colors: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        hover: 'hover:bg-purple-500/20 hover:border-purple-500',
        active: 'bg-purple-500/20 border-purple-500',
      }
    },
    {
      id: 'testCases' as AIAction,
      label: 'Test Cases',
      icon: CheckSquare,
      description: 'Generate test scenarios',
      colors: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        text: 'text-green-400',
        hover: 'hover:bg-green-500/20 hover:border-green-500',
        active: 'bg-green-500/20 border-green-500',
      }
    },
    {
      id: 'acceptanceCriteria' as AIAction,
      label: 'Acceptance Criteria',
      icon: Target,
      description: 'Define acceptance criteria',
      colors: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        hover: 'hover:bg-amber-500/20 hover:border-amber-500',
        active: 'bg-amber-500/20 border-amber-500',
      }
    },
    {
      id: 'complexity' as AIAction,
      label: 'Analyze Complexity',
      icon: TrendingUp,
      description: 'Estimate effort',
      colors: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        hover: 'hover:bg-orange-500/20 hover:border-orange-500',
        active: 'bg-orange-500/20 border-orange-500',
      }
    },
    {
      id: 'relatedItems' as AIAction,
      label: 'Find Related',
      icon: Link2,
      description: 'Suggest related items',
      colors: {
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        text: 'text-cyan-400',
        hover: 'hover:bg-cyan-500/20 hover:border-cyan-500',
        active: 'bg-cyan-500/20 border-cyan-500',
      }
    },
  ];

  // Use onCloseAll to close entire modal stack, or onClose for single level
  const handleClose = onCloseAll || onClose;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={handleClose}>
      <div className="bg-rh-card border border-rh-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-rh-border">
          <div className="flex items-center gap-3">
            <span className="text-lg font-mono text-rh-green">{workItem.id}</span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-rh-green/10 text-rh-green">
              {workItem.type}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-rh-border rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-rh-text-secondary" />
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        {breadcrumbTrail.length > 0 && (
          <div className="px-6 py-3 bg-rh-dark border-b border-rh-border">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {breadcrumbTrail.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRelatedItem(item)}
                    className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                  >
                    #{item.id}
                  </button>
                  <span className="text-rh-text-secondary">/</span>
                </div>
              ))}
              <span className="text-rh-text font-medium">#{workItem.id}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-rh-border">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-rh-green border-b-2 border-rh-green'
                : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Details
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'discussion'
                ? 'text-rh-green border-b-2 border-rh-green'
                : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Discussion
            {comments.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-rh-green/20 text-rh-green">
                {comments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('relationships')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'relationships'
                ? 'text-rh-green border-b-2 border-rh-green'
                : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            <Network className="w-4 h-4" />
            Relationships
            {relatedWorkItems && relatedWorkItems.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-rh-green/20 text-rh-green">
                {relatedWorkItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className={`${activeTab === 'relationships' ? 'p-0' : 'p-6'} overflow-y-auto max-h-[calc(90vh-176px)]`}>
          {activeTab === 'details' ? (
            <>
              <h2 className="text-2xl font-semibold text-rh-text mb-6">
                {workItem.title}
              </h2>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">State:</span>
                <span className="text-rh-text font-medium">{workItem.state}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Assigned to:</span>
                {workItem.assignedToEmail ? (
                  <a
                    href={`mailto:${workItem.assignedToEmail}`}
                    className="text-rh-text font-medium hover:text-rh-green transition-colors hover:underline"
                  >
                    {workItem.assignedTo}
                  </a>
                ) : (
                  <span className="text-rh-text font-medium">{workItem.assignedTo}</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Created by:</span>
                {workItem.createdByEmail ? (
                  <a
                    href={`mailto:${workItem.createdByEmail}`}
                    className="text-rh-text font-medium hover:text-rh-green transition-colors hover:underline"
                  >
                    {workItem.createdBy}
                  </a>
                ) : (
                  <span className="text-rh-text font-medium">{workItem.createdBy}</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Created:</span>
                <span className="text-rh-text font-medium">
                  {new Date(workItem.createdDate).toLocaleDateString()}
                </span>
              </div>

              {workItem.changedBy && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-rh-text-secondary" />
                  <span className="text-rh-text-secondary">Last changed by:</span>
                  {workItem.changedByEmail ? (
                    <a
                      href={`mailto:${workItem.changedByEmail}`}
                      className="text-rh-text font-medium hover:text-rh-green transition-colors hover:underline"
                    >
                      {workItem.changedBy}
                    </a>
                  ) : (
                    <span className="text-rh-text font-medium">{workItem.changedBy}</span>
                  )}
                </div>
              )}

              {workItem.areaPath && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-rh-text-secondary">Area:</span>
                  <span className="text-rh-text font-medium text-xs">{workItem.areaPath}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Priority:</span>
                <span className="text-rh-text font-medium">P{workItem.priority}</span>
              </div>

              {workItem.project && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-rh-text-secondary">Project:</span>
                  <span className="text-rh-text font-medium">{workItem.project}</span>
                </div>
              )}

              {workItem.changedDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-rh-text-secondary" />
                  <span className="text-rh-text-secondary">Last changed:</span>
                  <span className="text-rh-text font-medium">
                    {new Date(workItem.changedDate).toLocaleDateString()}
                  </span>
                </div>
              )}

              {workItem.storyPoints !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-rh-text-secondary">Story Points:</span>
                  <span className="text-rh-text font-medium">{workItem.storyPoints}</span>
                </div>
              )}

              {workItem.iterationPath && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-rh-text-secondary">Iteration:</span>
                  <span className="text-rh-text font-medium text-xs">{workItem.iterationPath}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-rh-text mb-2">Description</h3>
            <div className="bg-rh-dark border border-rh-border rounded-lg p-4 text-sm max-h-60 overflow-y-auto prose prose-invert prose-sm max-w-none prose-headings:text-rh-text prose-p:text-rh-text-secondary prose-strong:text-rh-text prose-ul:text-rh-text-secondary prose-ol:text-rh-text-secondary prose-li:text-rh-text-secondary prose-code:text-rh-green prose-code:bg-rh-card prose-pre:bg-rh-card prose-pre:border prose-pre:border-rh-border prose-a:text-rh-green hover:prose-a:text-green-400 prose-blockquote:border-rh-green prose-blockquote:text-rh-text-secondary">
              {sanitizedDescription ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
              ) : (
                <p className="text-rh-text-secondary italic">No description available.</p>
              )}
            </div>
          </div>

          {/* Tags */}
          {workItem.tags && workItem.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-rh-text mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {workItem.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-rh-dark border border-rh-border rounded-full text-xs text-rh-text"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Acceptance Criteria */}
          {workItem.acceptanceCriteria && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-rh-text mb-2">Acceptance Criteria</h3>
              <div className="bg-rh-dark border border-rh-border rounded-lg p-4 text-sm max-h-60 overflow-y-auto prose prose-invert prose-sm max-w-none prose-headings:text-rh-text prose-p:text-rh-text-secondary prose-strong:text-rh-text prose-ul:text-rh-text-secondary prose-ol:text-rh-text-secondary prose-li:text-rh-text-secondary prose-code:text-rh-green prose-code:bg-rh-card prose-pre:bg-rh-card prose-pre:border prose-pre:border-rh-border prose-a:text-rh-green hover:prose-a:text-green-400 prose-blockquote:border-rh-green prose-blockquote:text-rh-text-secondary">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(workItem.acceptanceCriteria, {
                  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'],
                  ALLOWED_ATTR: ['class'],
                }) }} />
              </div>
            </div>
          )}

          {/* AI Actions */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-rh-green" />
              <h3 className="text-sm font-semibold text-rh-text">AI-Powered Actions</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {aiActions.map((action) => {
                const Icon = action.icon;
                const isActive = activeAction === action.id;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAIAction(action.id)}
                    disabled={loading}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      isActive
                        ? `${action.colors.active} ${action.colors.text}`
                        : `${action.colors.bg} ${action.colors.border} ${action.colors.text} ${action.colors.hover}`
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Result */}
          {(loading || aiResult) && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-rh-text">AI Result</h3>
                {aiResult && !loading && !relatedWorkItems && (
                  <button
                    onClick={copyToClipboard}
                    className="text-xs text-rh-green hover:text-green-400 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                )}
              </div>
              <div className="bg-rh-dark border border-rh-border rounded-lg p-4 text-sm max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center gap-2 text-rh-text-secondary">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-rh-green border-t-transparent"></div>
                    <span>Generating with AI...</span>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-rh-text prose-p:text-rh-text-secondary prose-strong:text-rh-text prose-ul:text-rh-text-secondary prose-ol:text-rh-text-secondary prose-li:text-rh-text-secondary prose-code:text-rh-green prose-code:bg-rh-card prose-pre:bg-rh-card prose-pre:border prose-pre:border-rh-border prose-a:text-rh-green hover:prose-a:text-green-400 prose-blockquote:border-rh-green prose-blockquote:text-rh-text-secondary">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {aiResult || ''}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Related Work Items */}
          {relatedWorkItems && relatedWorkItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-rh-text mb-3">Related Work Items ({relatedWorkItems.length})</h3>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {relatedWorkItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedRelatedItem(item)}
                    className="flex items-center justify-between p-3 bg-rh-dark border border-rh-border rounded-lg hover:border-cyan-500 hover:bg-cyan-500/10 transition-all text-left group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-cyan-400">#{item.id}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rh-card border border-rh-border text-rh-text-secondary">
                          {item.type}
                        </span>
                        <span className="text-xs text-rh-text-secondary">{item.state}</span>
                        {item.relationType && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                            item.relationType === 'Parent'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : item.relationType === 'Child'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : item.relationSource === 'linked'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                              : item.relationSource === 'tag'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          }`}>
                            {item.relationType === 'Parent' && <ArrowUp className="w-3 h-3" />}
                            {item.relationType === 'Child' && <ArrowDown className="w-3 h-3" />}
                            {item.relationType}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-rh-text group-hover:text-cyan-400 transition-colors line-clamp-2">
                        {item.title}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-rh-text-secondary group-hover:text-cyan-400 transition-colors flex-shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

            </>
          ) : activeTab === 'discussion' ? (
            /* Discussion Tab */
            <div>
              <h2 className="text-2xl font-semibold text-rh-text mb-6">Discussion</h2>

              {loadingComments ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-rh-text-secondary">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-rh-green border-t-transparent"></div>
                    <span>Loading discussion...</span>
                  </div>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-rh-text-secondary mb-4 opacity-50" />
                  <p className="text-rh-text-secondary text-lg">No comments yet</p>
                  <p className="text-rh-text-secondary text-sm mt-2">Be the first to start the discussion</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment, index) => (
                    <div
                      key={comment.id}
                      className="bg-rh-dark border border-rh-border rounded-lg p-4 hover:border-rh-green/30 transition-colors"
                    >
                      {/* Comment Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rh-green/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-rh-green" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {comment.createdByEmail ? (
                                <a
                                  href={`mailto:${comment.createdByEmail}`}
                                  className="text-sm font-medium text-rh-text hover:text-rh-green transition-colors hover:underline"
                                >
                                  {comment.createdBy}
                                </a>
                              ) : (
                                <span className="text-sm font-medium text-rh-text">{comment.createdBy}</span>
                              )}
                              <span className="text-xs text-rh-text-secondary">
                                {new Date(comment.createdDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {comment.modifiedDate && comment.modifiedDate !== comment.createdDate && (
                              <span className="text-xs text-rh-text-secondary italic">
                                (edited {new Date(comment.modifiedDate).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-rh-text-secondary">#{index + 1}</span>
                      </div>

                      {/* Comment Body */}
                      <div className="prose prose-invert prose-sm max-w-none prose-p:text-rh-text-secondary prose-strong:text-rh-text prose-ul:text-rh-text-secondary prose-ol:text-rh-text-secondary prose-li:text-rh-text-secondary prose-code:text-rh-green prose-code:bg-rh-card prose-a:text-rh-green hover:prose-a:text-green-400 ml-11">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(comment.text, {
                              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'code', 'pre', 'div', 'span', 'blockquote'],
                              ALLOWED_ATTR: ['href', 'target', 'rel'],
                            })
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Relationships Tab */
            <div className="h-full relative">
              {loadingRelationships ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-rh-text-secondary">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-rh-green border-t-transparent"></div>
                    <span>Loading relationships...</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Expand Button - Fixed position */}
                  {relatedWorkItems && relatedWorkItems.length > 0 && (
                    <button
                      onClick={() => setShowFullScreenRelationships(true)}
                      className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 bg-rh-green text-rh-dark rounded-lg font-medium hover:bg-green-600 transition-colors shadow-lg"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Expand Full Screen
                    </button>
                  )}

                  <RelationshipDiagram
                    currentWorkItem={workItem}
                    relatedWorkItems={relatedWorkItems || []}
                    onNavigate={setSelectedRelatedItem}
                  />
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-6 mt-6 border-t border-rh-border">
            <button
              onClick={handleOpenInAdo}
              className="flex items-center gap-2 px-4 py-2 bg-rh-green text-rh-dark rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Azure DevOps
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-rh-dark border border-rh-border text-rh-text rounded-lg font-medium hover:bg-rh-border transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Nested Modal for Related Work Item */}
      {selectedRelatedItem && (
        <WorkItemDetailModal
          workItem={selectedRelatedItem}
          onClose={() => setSelectedRelatedItem(null)}
          onCloseAll={handleClose}
          breadcrumbTrail={currentTrail}
        />
      )}

      {/* Full Screen Relationship Modal */}
      {showFullScreenRelationships && relatedWorkItems && (
        <RelationshipModal
          currentWorkItem={workItem}
          relatedWorkItems={relatedWorkItems}
          onClose={() => setShowFullScreenRelationships(false)}
          onNavigate={(item) => {
            setShowFullScreenRelationships(false);
            setSelectedRelatedItem(item);
          }}
        />
      )}
    </div>
  );
}
