'use client';

import { useState } from 'react';
import { WorkItem } from '@/types';
import { X, User, Calendar, AlertCircle, Tag, ExternalLink, Sparkles, FileText, Share2, CheckSquare, Target, TrendingUp, Link2 } from 'lucide-react';

interface WorkItemDetailModalProps {
  workItem: WorkItem;
  onClose: () => void;
}

type AIAction = 'releaseNotes' | 'summary' | 'testCases' | 'acceptanceCriteria' | 'complexity' | 'relatedItems';

export default function WorkItemDetailModal({ workItem, onClose }: WorkItemDetailModalProps) {
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);

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

      setAiResult(data.result);
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
    { id: 'releaseNotes' as AIAction, label: 'Release Notes', icon: FileText, description: 'Generate release notes' },
    { id: 'summary' as AIAction, label: 'Share Summary', icon: Share2, description: 'Create shareable summary' },
    { id: 'testCases' as AIAction, label: 'Test Cases', icon: CheckSquare, description: 'Generate test scenarios' },
    { id: 'acceptanceCriteria' as AIAction, label: 'Acceptance Criteria', icon: Target, description: 'Define acceptance criteria' },
    { id: 'complexity' as AIAction, label: 'Analyze Complexity', icon: TrendingUp, description: 'Estimate effort' },
    { id: 'relatedItems' as AIAction, label: 'Find Related', icon: Link2, description: 'Suggest related items' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
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
            onClick={onClose}
            className="p-2 hover:bg-rh-border rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-rh-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
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
                <span className="text-rh-text font-medium">{workItem.assignedTo}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Created by:</span>
                <span className="text-rh-text font-medium">{workItem.createdBy}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Created:</span>
                <span className="text-rh-text font-medium">
                  {new Date(workItem.createdDate).toLocaleDateString()}
                </span>
              </div>

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
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-rh-text mb-2">Description</h3>
            <div className="bg-rh-dark border border-rh-border rounded-lg p-4 text-sm text-rh-text-secondary max-h-40 overflow-y-auto">
              {workItem.description || 'No description available.'}
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

          {/* AI Actions */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-rh-green" />
              <h3 className="text-sm font-semibold text-rh-text">AI-Powered Actions</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {aiActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAIAction(action.id)}
                    disabled={loading}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeAction === action.id
                        ? 'bg-rh-green/20 text-rh-green border border-rh-green'
                        : 'bg-rh-dark border border-rh-border text-rh-text hover:border-rh-green hover:bg-rh-border'
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
                {aiResult && !loading && (
                  <button
                    onClick={copyToClipboard}
                    className="text-xs text-rh-green hover:text-green-400 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                )}
              </div>
              <div className="bg-rh-dark border border-rh-border rounded-lg p-4 text-sm text-rh-text-secondary max-h-60 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-rh-green border-t-transparent"></div>
                    <span>Generating with AI...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">{aiResult}</pre>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-rh-border">
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
    </div>
  );
}
