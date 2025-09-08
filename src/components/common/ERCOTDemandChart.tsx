import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import observationsData from '../../Key Insights/bullet-points.json';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ERCOTChartData {
  success: boolean;
  data: {
    labels: string[];
    datasets: Array<{
      year: string;
      data: number[];
    }>;
  };
  metadata: {
    rawDataPoints: number;
    years: number[];
    zones: string[];
    units?: string;
  };
}

const ERCOTDemandChart: React.FC = () => {
  const [chartData, setChartData] = useState<ERCOTChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Color palette for years with more distinct colors
  const getColorForYear = (year: string, index: number) => {
    const colorPalette = [
      { year: '2021', color: '#94A3B8' }, // Slate 400 - Light gray-blue
      { year: '2022', color: '#60A5FA' }, // Blue 400 - Light blue  
      { year: '2023', color: '#3B82F6' }, // Blue 500 - Medium blue
      { year: '2024', color: '#1D4ED8' }, // Blue 700 - Dark blue
      { year: '2025', color: '#1E40AF' }, // Blue 800 - Very dark blue
      { year: '2026', color: '#0F172A' }, // Slate 900 - Nearly black
    ];
    
    const yearColor = colorPalette.find(c => c.year === year);
    return yearColor ? yearColor.color : '#3B82F6'; // Default to blue 500
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/ercot-chart-data');
        const result: ERCOTChartData = await response.json();
        
        if (result.success) {
          setChartData(result);
          setError(null);
        } else {
          setError('Failed to load ERCOT data');
        }
      } catch (err) {
        setError('Error fetching ERCOT data');
        console.error('Error fetching ERCOT data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Transform data for Chart.js
  const data = chartData ? {
    labels: chartData.data.labels,
    datasets: chartData.data.datasets.map((dataset) => {
      const color = getColorForYear(dataset.year, 0);
      return {
        label: dataset.year,
        data: dataset.data,
        borderColor: color,
        backgroundColor: `${color}1A`, // 10% opacity
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        // Ensure colors are properly available for tooltips
        pointBackgroundColor: color,
        pointBorderColor: color,
      };
    }),
  } : { labels: [], datasets: [] };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            family: 'Inter, sans-serif',
            size: 12,
            weight: 400,
          },
          usePointStyle: true,
          pointStyle: 'rect',
          padding: 16,
          color: '#4B5563', // Gray 600
          boxWidth: 20,
          boxHeight: 3,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleFont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          weight: 600,
        },
        bodyFont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          weight: 400,
        },
        borderColor: '#E5E7EB',
        borderWidth: 1,
        cornerRadius: 4,
        displayColors: true,
        usePointStyle: false,
        boxWidth: 12,
        boxHeight: 12,
        boxPadding: 2,
        callbacks: {
          title: function(context: any) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `Month: ${months[context[0].dataIndex]}`;
          },
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} MW Avg.`;
          },
          afterBody: function() {
            return 'Weather-normalized';
          },
          labelColor: function(context: any) {
            return {
              borderColor: '#FFFFFF',
              backgroundColor: context.dataset.borderColor,
              borderWidth: 1,
            };
          }
        }
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: '#E5E7EB', // Gray 200
          lineWidth: 1,
        },
        ticks: {
          font: {
            family: 'Inter, sans-serif',
            size: 12,
            weight: 400,
          },
          color: '#6B7280', // Gray 500
          padding: 8,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Demand (MW Avg.)',
          font: {
            family: 'Inter, sans-serif',
            size: 14,
            weight: 500,
          },
          color: '#374151', // Gray 700
          padding: { top: 0, bottom: 8 },
        },
        ticks: {
          callback: function(value: any) {
            return (Number(value) / 1000).toFixed(1) + 'K';
          },
          font: {
            family: 'JetBrains Mono, monospace',
            size: 12,
            weight: 400,
          },
          color: '#6B7280', // Gray 500
          padding: 8,
        },
        grid: {
          color: '#E5E7EB', // Gray 200
          lineWidth: 1,
        },
      },
    },
    elements: {
      line: {
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
      },
      point: {
        borderWidth: 0,
      },
    },
    layout: {
      padding: 24,
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  // Calculate summary data from real data
  const summaryData = chartData ? chartData.data.datasets.map((dataset, index) => {
    // Filter out null values to only use actual data points
    const actualData = dataset.data.filter((val: number | null) => val !== null && val > 0) as number[];
    
    if (actualData.length === 0) {
      return {
        year: dataset.year,
        peak: 0,
        low: 0,
        average: 0,
        growth: '-',
      };
    }
    
    const peak = Math.max(...actualData);
    const low = Math.min(...actualData);
    const average = Math.round(actualData.reduce((sum, val) => sum + val, 0) / actualData.length);
    
    // Calculate growth vs previous year
    let growth: string = '-';
    if (index > 0) {
      const prevDataset = chartData.data.datasets[index - 1];
      const prevActualData = prevDataset.data.filter((val: number | null) => val !== null && val > 0) as number[];
      
      if (prevActualData.length > 0) {
        const prevAverage = Math.round(prevActualData.reduce((sum, val) => sum + val, 0) / prevActualData.length);
        const growthPercent = ((average - prevAverage) / prevAverage) * 100;
        growth = `${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}%`;
      }
    }
    
    return {
      year: dataset.year,
      peak,
      low,
      average,
      growth,
    };
  }) : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-gray-500">Loading ERCOT data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart and Observations Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chart Area */}
        <div className="lg:col-span-3">
          <div className="h-96 w-full">
            <Line data={data} options={options} />
          </div>
        </div>

        {/* Key Observations */}
        <div className="lg:col-span-1">
          <div className="bg-gray-100 rounded-lg p-4 h-full">
            <h4 className="text-sm font-semibold text-gs-dark mb-3">Key Observations</h4>
            <ul className="space-y-3 text-xs text-gray-600">
              {observationsData.structuralDemand.map((observation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{observation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Data Summary Table */}
      <div>
        <h4 className="text-sm font-semibold text-gs-dark mb-3">Data Summary</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-gray-200 rounded-lg">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left p-3 font-medium text-gray-600">Year</th>
                <th className="text-center p-3 font-medium text-gray-600">Peak (MW Avg.)</th>
                <th className="text-center p-3 font-medium text-gray-600">Low (MW Avg.)</th>
                <th className="text-center p-3 font-medium text-gray-600">Average (MW Avg.)</th>
                <th className="text-center p-3 font-medium text-gray-600">Growth vs prev year</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {summaryData.map((row, index) => (
                <tr key={row.year} className={index < summaryData.length - 1 ? "border-b border-gray-200" : ""}>
                  <td className="p-3 text-gs-dark font-semibold">{row.year}</td>
                  <td className="p-3 text-center text-gs-dark">{row.peak.toLocaleString()}</td>
                  <td className="p-3 text-center text-gs-dark">{row.low.toLocaleString()}</td>
                  <td className="p-3 text-center text-gs-dark">{row.average.toLocaleString()}</td>
                  <td className="p-3 text-center text-gray-600">
                    <span className={row.growth !== '-' ? (row.growth.startsWith('+') ? 'text-green-600' : 'text-red-600') : 'text-gray-500'}>
                      {row.growth}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ERCOTDemandChart; 