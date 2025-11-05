'use client';

import { useState, useEffect, useRef } from 'react';
import { ChartData, WorkItem } from '@/types';
import { ChevronDown } from 'lucide-react';
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import EmailButton from './EmailButton';
import { captureElementAsImage, sendEmailReport } from '@/lib/email-utils';

interface WorkItemChartProps {
  chartData: ChartData;
  workItems?: WorkItem[];
}

// Color palette for charts
const COLORS = [
  '#10B981', // Green
  '#3B82F6', // Blue
  '#F59E0B', // Orange
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Dark Orange
];

export default function WorkItemChart({ chartData, workItems }: WorkItemChartProps) {
  const { chartType, dataKey: initialDataKey } = chartData;
  const [currentDataKey, setCurrentDataKey] = useState<'state' | 'type' | 'priority' | 'assignedTo' | 'createdBy' | 'project' | 'areaPath' | 'changedBy' | 'iterationPath' | 'storyPoints' | 'tags'>(initialDataKey);
  const [currentData, setCurrentData] = useState(chartData.data);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleEmailChart = async () => {
    if (!workItems || workItems.length === 0 || !chartRef.current) {
      throw new Error('No data to send');
    }

    // Capture chart as image
    const chartCapture = await captureElementAsImage(
      chartRef.current,
      `${chartType} Chart - ${currentDataKey}`
    );

    // Send email with chart and data
    const result = await sendEmailReport({
      searchParams: {
        chartType,
        groupBy: currentDataKey,
      },
      workItems,
      charts: [chartCapture],
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }
  };

  // Available pivot options
  const pivotOptions = [
    { value: 'state', label: 'State' },
    { value: 'type', label: 'Type' },
    { value: 'priority', label: 'Priority' },
    { value: 'assignedTo', label: 'Assigned To' },
    { value: 'createdBy', label: 'Created By' },
    { value: 'project', label: 'Project' },
    { value: 'areaPath', label: 'Area' },
    { value: 'changedBy', label: 'Changed By' },
    { value: 'iterationPath', label: 'Sprint/Iteration' },
    { value: 'storyPoints', label: 'Story Points' },
    { value: 'tags', label: 'Tags' },
  ];

  // Recalculate chart data when pivot point changes
  useEffect(() => {
    if (workItems && currentDataKey !== initialDataKey) {
      // Dynamically import chart utils to recalculate data
      import('@/lib/chart-utils').then(({ processWorkItemsToChartData }) => {
        const newChartData = processWorkItemsToChartData(workItems, chartType, currentDataKey);
        setCurrentData(newChartData.data);
      });
    } else {
      setCurrentData(chartData.data);
    }
  }, [currentDataKey, workItems, chartType, initialDataKey, chartData.data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-rh-card border border-rh-border rounded-lg p-3 shadow-lg">
          <p className="text-rh-text font-medium">{payload[0].name}</p>
          <p className="text-rh-green text-sm">
            Count: <span className="font-bold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={currentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {currentData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="value" fill="#10B981" radius={[8, 8, 0, 0]}>
                {currentData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                strokeWidth={3}
                dot={{ fill: '#10B981', r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={currentData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="text-rh-text-secondary">Unsupported chart type</div>;
    }
  };

  return (
    <div ref={chartRef} className="bg-rh-card border border-rh-border rounded-lg p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-rh-text">
          {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
        </h3>
        <div className="flex items-center gap-4">
          {/* Email Chart Button */}
          {workItems && workItems.length > 0 && (
            <EmailButton
              onClick={handleEmailChart}
              variant="icon"
              size="sm"
            />
          )}

          {/* Pivot Point Dropdown */}
          {workItems && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-rh-dark border border-rh-border rounded hover:border-rh-green transition-colors"
              >
                <span className="text-rh-text-secondary">Group by:</span>
                <span className="text-rh-text font-medium">
                  {pivotOptions.find(o => o.value === currentDataKey)?.label}
                </span>
                <ChevronDown className="w-4 h-4 text-rh-text-secondary" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-rh-card border border-rh-border rounded-lg shadow-2xl z-50 overflow-hidden">
                  <div className="p-1">
                    {pivotOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setCurrentDataKey(option.value as any);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                          currentDataKey === option.value
                            ? 'bg-rh-green/20 text-rh-green'
                            : 'text-rh-text hover:bg-rh-border'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <span className="text-sm text-rh-text-secondary">
            {currentData.reduce((sum, item) => sum + item.value, 0)} total items
          </span>
        </div>
      </div>
      {renderChart()}
    </div>
  );
}
