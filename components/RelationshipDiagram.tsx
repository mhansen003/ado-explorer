'use client';

import { WorkItem } from '@/types';
import { ArrowUp, ArrowDown, Link2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

interface RelationshipDiagramProps {
  currentWorkItem: WorkItem;
  relatedWorkItems: WorkItem[];
  onNavigate: (workItem: WorkItem) => void;
}

interface PositionedWorkItem extends WorkItem {
  x: number;
  y: number;
  level: number;
}

export default function RelationshipDiagram({
  currentWorkItem,
  relatedWorkItems,
  onNavigate,
}: RelationshipDiagramProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipItem, setTooltipItem] = useState<PositionedWorkItem | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Group work items by relationship type
  const parents = relatedWorkItems.filter(item => item.relationType === 'Parent');
  const children = relatedWorkItems.filter(item => item.relationType === 'Child');
  const related = relatedWorkItems.filter(item => item.relationType === 'Related');
  const successors = relatedWorkItems.filter(item => item.relationType === 'Successor');
  const predecessors = relatedWorkItems.filter(item => item.relationType === 'Predecessor');
  const others = relatedWorkItems.filter(item =>
    !['Parent', 'Child', 'Related', 'Successor', 'Predecessor'].includes(item.relationType || '')
  );

  // Calculate positions for hierarchical layout
  const CARD_WIDTH = 420;
  const CARD_HEIGHT = 200;
  const VERTICAL_GAP = 140;
  const HORIZONTAL_GAP = 60;

  // Position current item in the center
  const centerX = 400;
  const centerY = 300;

  // Position parents above (multiple levels if needed)
  const positionedParents: PositionedWorkItem[] = parents.map((item, index) => ({
    ...item,
    x: centerX + (index - (parents.length - 1) / 2) * (CARD_WIDTH + HORIZONTAL_GAP),
    y: centerY - VERTICAL_GAP - CARD_HEIGHT,
    level: -1,
  }));

  // Position children below (multiple levels if needed)
  const positionedChildren: PositionedWorkItem[] = children.map((item, index) => ({
    ...item,
    x: centerX + (index - (children.length - 1) / 2) * (CARD_WIDTH + HORIZONTAL_GAP),
    y: centerY + VERTICAL_GAP + CARD_HEIGHT,
    level: 1,
  }));

  // Position related items to the right
  const positionedRelated: PositionedWorkItem[] = related.map((item, index) => ({
    ...item,
    x: centerX + CARD_WIDTH + HORIZONTAL_GAP + 100,
    y: centerY + (index - (related.length - 1) / 2) * (CARD_HEIGHT + 30),
    level: 0,
  }));

  // Position predecessors to the left
  const positionedPredecessors: PositionedWorkItem[] = predecessors.map((item, index) => ({
    ...item,
    x: centerX - CARD_WIDTH - HORIZONTAL_GAP - 100,
    y: centerY + (index - (predecessors.length - 1) / 2) * (CARD_HEIGHT + 30) - 60,
    level: 0,
  }));

  // Position successors to the right below related
  const positionedSuccessors: PositionedWorkItem[] = successors.map((item, index) => ({
    ...item,
    x: centerX + CARD_WIDTH + HORIZONTAL_GAP + 100,
    y: centerY + (index - (successors.length - 1) / 2) * (CARD_HEIGHT + 30) + 60,
    level: 0,
  }));

  // Position other items below children
  const positionedOthers: PositionedWorkItem[] = others.map((item, index) => ({
    ...item,
    x: centerX + (index - (others.length - 1) / 2) * (CARD_WIDTH + HORIZONTAL_GAP),
    y: centerY + VERTICAL_GAP * 2 + CARD_HEIGHT * 2,
    level: 2,
  }));

  const allPositionedItems = [
    ...positionedParents,
    ...positionedChildren,
    ...positionedRelated,
    ...positionedPredecessors,
    ...positionedSuccessors,
    ...positionedOthers,
  ];

  // Calculate SVG viewBox to fit all items
  const minX = Math.min(centerX, ...allPositionedItems.map(item => item.x)) - CARD_WIDTH / 2 - 50;
  const maxX = Math.max(centerX, ...allPositionedItems.map(item => item.x)) + CARD_WIDTH / 2 + 50;
  const minY = Math.min(centerY, ...allPositionedItems.map(item => item.y)) - CARD_HEIGHT / 2 - 50;
  const maxY = Math.max(centerY, ...allPositionedItems.map(item => item.y)) + CARD_HEIGHT / 2 + 50;

  const viewBoxWidth = maxX - minX;
  const viewBoxHeight = maxY - minY;

  // Helper function to get relationship color
  const getRelationshipColor = (relationType?: string) => {
    switch (relationType) {
      case 'Parent': return '#34d399'; // emerald-400
      case 'Child': return '#fbbf24'; // amber-400
      case 'Related': return '#22d3ee'; // cyan-400
      case 'Successor': return '#a78bfa'; // violet-400
      case 'Predecessor': return '#fb923c'; // orange-400
      default: return '#60a5fa'; // blue-400
    }
  };

  // Helper function to get relationship styles
  const getRelationshipStyles = (relationType?: string) => {
    switch (relationType) {
      case 'Parent':
        return 'border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20';
      case 'Child':
        return 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/20';
      case 'Related':
        return 'border-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20';
      case 'Successor':
        return 'border-violet-500 bg-violet-500/10 hover:bg-violet-500/20';
      case 'Predecessor':
        return 'border-orange-500 bg-orange-500/10 hover:bg-orange-500/20';
      default:
        return 'border-blue-500 bg-blue-500/10 hover:bg-blue-500/20';
    }
  };

  // Helper function to get relationship icon
  const getRelationshipIcon = (relationType?: string) => {
    switch (relationType) {
      case 'Parent': return <ArrowUp className="w-5 h-5" />;
      case 'Child': return <ArrowDown className="w-5 h-5" />;
      case 'Successor': return <ArrowRight className="w-5 h-5" />;
      case 'Predecessor': return <ArrowLeft className="w-5 h-5" />;
      default: return <Link2 className="w-5 h-5" />;
    }
  };

  // Generate SVG paths for connections
  const generatePath = (fromX: number, fromY: number, toX: number, toY: number, relationType?: string) => {
    const startX = fromX;
    const startY = fromY;
    const endX = toX;
    const endY = toY;

    // Use curved paths for more organic look
    const midY = (startY + endY) / 2;

    return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  };

  if (relatedWorkItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Link2 className="w-20 h-20 text-rh-text-secondary mb-6 opacity-50" />
        <p className="text-rh-text-secondary text-xl font-medium">No relationships found</p>
        <p className="text-rh-text-secondary text-base mt-3">This work item has no linked relationships in Azure DevOps</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-gradient-to-br from-rh-dark via-rh-card to-rh-dark">
      <svg
        className="w-full"
        style={{ minHeight: '600px', height: `${viewBoxHeight + 100}px` }}
        viewBox={`${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Draw connection lines */}
        <defs>
          {/* Define arrow markers for different colors */}
          {['emerald', 'amber', 'cyan', 'violet', 'orange', 'blue'].map(color => (
            <marker
              key={`arrow-${color}`}
              id={`arrow-${color}`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path
                d="M0,0 L0,6 L9,3 z"
                fill={getRelationshipColor(color === 'emerald' ? 'Parent' : color === 'amber' ? 'Child' : color === 'cyan' ? 'Related' : color === 'violet' ? 'Successor' : color === 'orange' ? 'Predecessor' : 'Other')}
              />
            </marker>
          ))}
        </defs>

        {/* Draw lines from current item to parents */}
        {positionedParents.map(parent => {
          const color = getRelationshipColor(parent.relationType);
          const markerColor = 'emerald';
          return (
            <g key={`line-parent-${parent.id}`}>
              <path
                d={generatePath(
                  centerX,
                  centerY - CARD_HEIGHT / 2,
                  parent.x,
                  parent.y + CARD_HEIGHT / 2
                )}
                stroke={color}
                strokeWidth="4"
                fill="none"
                opacity={hoveredId === parent.id || hoveredId === currentWorkItem.id ? 1 : 0.4}
                className="transition-opacity duration-300"
                markerEnd={`url(#arrow-${markerColor})`}
              />
            </g>
          );
        })}

        {/* Draw lines from current item to children */}
        {positionedChildren.map(child => {
          const color = getRelationshipColor(child.relationType);
          const markerColor = 'amber';
          return (
            <g key={`line-child-${child.id}`}>
              <path
                d={generatePath(
                  centerX,
                  centerY + CARD_HEIGHT / 2,
                  child.x,
                  child.y - CARD_HEIGHT / 2
                )}
                stroke={color}
                strokeWidth="4"
                fill="none"
                opacity={hoveredId === child.id || hoveredId === currentWorkItem.id ? 1 : 0.4}
                className="transition-opacity duration-300"
                markerEnd={`url(#arrow-${markerColor})`}
              />
            </g>
          );
        })}

        {/* Draw lines to related items */}
        {positionedRelated.map(item => {
          const color = getRelationshipColor(item.relationType);
          const markerColor = 'cyan';
          return (
            <g key={`line-related-${item.id}`}>
              <path
                d={`M ${centerX + CARD_WIDTH / 2} ${centerY} L ${item.x - CARD_WIDTH / 2} ${item.y}`}
                stroke={color}
                strokeWidth="3"
                strokeDasharray="6,6"
                fill="none"
                opacity={hoveredId === item.id || hoveredId === currentWorkItem.id ? 1 : 0.3}
                className="transition-opacity duration-300"
                markerEnd={`url(#arrow-${markerColor})`}
              />
            </g>
          );
        })}

        {/* Draw lines to predecessors */}
        {positionedPredecessors.map(item => {
          const color = getRelationshipColor(item.relationType);
          const markerColor = 'orange';
          return (
            <g key={`line-predecessor-${item.id}`}>
              <path
                d={`M ${centerX - CARD_WIDTH / 2} ${centerY} L ${item.x + CARD_WIDTH / 2} ${item.y}`}
                stroke={color}
                strokeWidth="3"
                strokeDasharray="6,6"
                fill="none"
                opacity={hoveredId === item.id || hoveredId === currentWorkItem.id ? 1 : 0.3}
                className="transition-opacity duration-300"
                markerEnd={`url(#arrow-${markerColor})`}
              />
            </g>
          );
        })}

        {/* Draw lines to successors */}
        {positionedSuccessors.map(item => {
          const color = getRelationshipColor(item.relationType);
          const markerColor = 'violet';
          return (
            <g key={`line-successor-${item.id}`}>
              <path
                d={`M ${centerX + CARD_WIDTH / 2} ${centerY} L ${item.x - CARD_WIDTH / 2} ${item.y}`}
                stroke={color}
                strokeWidth="3"
                strokeDasharray="6,6"
                fill="none"
                opacity={hoveredId === item.id || hoveredId === currentWorkItem.id ? 1 : 0.3}
                className="transition-opacity duration-300"
                markerEnd={`url(#arrow-${markerColor})`}
              />
            </g>
          );
        })}

        {/* Draw lines to other items */}
        {positionedOthers.map(item => {
          const color = getRelationshipColor(item.relationType);
          const markerColor = 'blue';
          return (
            <g key={`line-other-${item.id}`}>
              <path
                d={generatePath(
                  centerX,
                  centerY + CARD_HEIGHT / 2,
                  item.x,
                  item.y - CARD_HEIGHT / 2
                )}
                stroke={color}
                strokeWidth="3"
                strokeDasharray="4,4"
                fill="none"
                opacity={hoveredId === item.id || hoveredId === currentWorkItem.id ? 1 : 0.3}
                className="transition-opacity duration-300"
                markerEnd={`url(#arrow-${markerColor})`}
              />
            </g>
          );
        })}

        {/* Render work item cards as foreignObject for HTML content */}
        {/* Current work item (center, prominent) */}
        <foreignObject
          x={centerX - CARD_WIDTH / 2}
          y={centerY - CARD_HEIGHT / 2}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
        >
          <div
            className="w-full h-full p-6 border-4 border-rh-green bg-rh-green/20 rounded-lg shadow-2xl backdrop-blur cursor-pointer transform transition-all duration-300 hover:scale-105"
            onMouseEnter={(e) => {
              setHoveredId(currentWorkItem.id);
              setTooltipItem({ ...currentWorkItem, x: centerX, y: centerY, level: 0 });
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltipPosition({ x: rect.right + 10, y: rect.top });
            }}
            onMouseLeave={() => {
              setHoveredId(null);
              setTooltipItem(null);
              setTooltipPosition(null);
            }}
            style={{
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-mono text-rh-green font-bold">#{currentWorkItem.id}</span>
              <span className="text-sm px-3 py-1.5 rounded bg-rh-green/30 text-rh-green border border-rh-green/50 font-semibold">
                CURRENT
              </span>
            </div>
            <p className="text-base text-rh-text font-semibold line-clamp-3 mb-2">{currentWorkItem.title}</p>
            <div className="flex gap-2 mt-3">
              <span className="text-sm px-3 py-1 rounded bg-rh-card border border-rh-border text-rh-text-secondary">
                {currentWorkItem.type}
              </span>
              <span className="text-sm px-3 py-1 rounded bg-rh-card border border-rh-border text-rh-text-secondary">
                {currentWorkItem.state}
              </span>
            </div>
          </div>
        </foreignObject>

        {/* Related work items */}
        {allPositionedItems.map(item => {
          const styles = getRelationshipStyles(item.relationType);
          const icon = getRelationshipIcon(item.relationType);
          const color = getRelationshipColor(item.relationType);

          return (
            <foreignObject
              key={item.id}
              x={item.x - CARD_WIDTH / 2}
              y={item.y - CARD_HEIGHT / 2}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
            >
              <div
                className={`w-full h-full p-5 border-2 ${styles} rounded-lg shadow-lg backdrop-blur cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl`}
                onClick={() => onNavigate(item)}
                onMouseEnter={(e) => {
                  setHoveredId(item.id);
                  setTooltipItem(item);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPosition({ x: rect.right + 10, y: rect.top });
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                  setTooltipItem(null);
                  setTooltipPosition(null);
                }}
                style={{
                  boxShadow: hoveredId === item.id ? `0 0 20px ${color}80` : undefined,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base font-mono font-semibold" style={{ color }}>
                    #{item.id}
                  </span>
                  {item.relationType && (
                    <span
                      className="text-sm px-2.5 py-1 rounded flex items-center gap-1.5 font-medium"
                      style={{
                        backgroundColor: `${color}30`,
                        color: color,
                        borderColor: `${color}60`,
                        borderWidth: '1px',
                      }}
                    >
                      {icon}
                      {item.relationType}
                    </span>
                  )}
                </div>
                <p className="text-sm text-rh-text line-clamp-3 mb-3 leading-relaxed">{item.title}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-sm px-2.5 py-1 rounded bg-rh-card/70 border border-rh-border text-rh-text-secondary">
                    {item.type}
                  </span>
                  <span className="text-sm px-2.5 py-1 rounded bg-rh-card/70 border border-rh-border text-rh-text-secondary">
                    {item.state}
                  </span>
                </div>
              </div>
            </foreignObject>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="fixed bottom-6 right-6 bg-rh-card/95 backdrop-blur border border-rh-border rounded-lg p-5 shadow-xl">
        <h4 className="text-sm font-semibold text-rh-text mb-4 uppercase tracking-wide">Relationship Types</h4>
        <div className="space-y-3">
          {[
            { type: 'Parent', icon: <ArrowUp className="w-4 h-4" />, color: '#34d399' },
            { type: 'Child', icon: <ArrowDown className="w-4 h-4" />, color: '#fbbf24' },
            { type: 'Related', icon: <Link2 className="w-4 h-4" />, color: '#22d3ee' },
            { type: 'Predecessor', icon: <ArrowLeft className="w-4 h-4" />, color: '#fb923c' },
            { type: 'Successor', icon: <ArrowRight className="w-4 h-4" />, color: '#a78bfa' },
          ].map(({ type, icon, color }) => (
            <div key={type} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded border-2 flex items-center justify-center"
                style={{ borderColor: color, backgroundColor: `${color}20` }}
              >
                <div style={{ color }}>{icon}</div>
              </div>
              <span className="text-sm text-rh-text-secondary font-medium">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Tooltip */}
      {tooltipItem && tooltipPosition && (() => {
        const tooltipWidth = 384; // w-96 = 24rem = 384px
        const tooltipMaxHeight = window.innerHeight * 0.8; // 80vh
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Check if tooltip would go off-screen to the right
        let left = tooltipPosition.x;
        if (left + tooltipWidth > viewportWidth - 20) {
          // Position to the left of the card instead
          left = tooltipPosition.x - tooltipWidth - 20;
        }

        // Ensure tooltip doesn't go off left edge
        left = Math.max(10, left);

        // Check if tooltip would go off-screen vertically
        let top = tooltipPosition.y;
        if (top + tooltipMaxHeight > viewportHeight - 20) {
          // Adjust upward to fit on screen
          top = viewportHeight - tooltipMaxHeight - 20;
        }
        top = Math.max(10, top);

        return (
          <div
            className="fixed z-[200] w-96 bg-rh-dark/98 backdrop-blur-xl border-2 border-rh-green rounded-xl shadow-2xl p-6 pointer-events-none"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >

          {/* Header */}
          <div className="mb-4 pb-4 border-b border-rh-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl font-mono font-bold text-rh-green">#{tooltipItem.id}</span>
              <span className="px-2 py-1 text-xs rounded bg-rh-green/20 text-rh-green border border-rh-green/50 font-semibold">
                {tooltipItem.relationType}
              </span>
            </div>
            <h3 className="text-base font-semibold text-rh-text leading-tight">{tooltipItem.title}</h3>
          </div>

          {/* Metadata Grid */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-rh-text-secondary min-w-24">Type:</span>
              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40 font-medium">
                {tooltipItem.type}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-rh-text-secondary min-w-24">State:</span>
              <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/40 font-medium">
                {tooltipItem.state}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-rh-text-secondary min-w-24">Priority:</span>
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40 font-medium">
                P{tooltipItem.priority}
              </span>
            </div>

            {tooltipItem.storyPoints !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-rh-text-secondary min-w-24">Story Points:</span>
                <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/40 font-medium">
                  {tooltipItem.storyPoints} pts
                </span>
              </div>
            )}

            {tooltipItem.assignedTo && (
              <div className="flex items-start gap-2">
                <span className="text-rh-text-secondary min-w-24">Assigned To:</span>
                <span className="text-rh-text">{tooltipItem.assignedTo}</span>
              </div>
            )}

            {tooltipItem.project && (
              <div className="flex items-start gap-2">
                <span className="text-rh-text-secondary min-w-24">Project:</span>
                <span className="text-rh-text">{tooltipItem.project}</span>
              </div>
            )}

            {tooltipItem.areaPath && (
              <div className="flex items-start gap-2">
                <span className="text-rh-text-secondary min-w-24">Area:</span>
                <span className="text-rh-text text-xs">{tooltipItem.areaPath}</span>
              </div>
            )}

            {tooltipItem.iterationPath && (
              <div className="flex items-start gap-2">
                <span className="text-rh-text-secondary min-w-24">Iteration:</span>
                <span className="text-rh-text text-xs">{tooltipItem.iterationPath}</span>
              </div>
            )}

            {tooltipItem.tags && tooltipItem.tags.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-rh-text-secondary min-w-24">Tags:</span>
                <div className="flex flex-wrap gap-1">
                  {tooltipItem.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-xs rounded bg-rh-card border border-rh-border text-rh-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {tooltipItem.changedDate && (
              <div className="flex items-start gap-2">
                <span className="text-rh-text-secondary min-w-24">Last Updated:</span>
                <span className="text-rh-text text-xs">{new Date(tooltipItem.changedDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {tooltipItem.description && (
            <div className="mt-4 pt-4 border-t border-rh-border">
              <span className="text-sm text-rh-text-secondary font-semibold mb-2 block">Description:</span>
              <div
                className="text-sm text-rh-text-secondary leading-relaxed line-clamp-4"
                dangerouslySetInnerHTML={{ __html: tooltipItem.description }}
              />
            </div>
          )}
          </div>
        );
      })()}
    </div>
  );
}
