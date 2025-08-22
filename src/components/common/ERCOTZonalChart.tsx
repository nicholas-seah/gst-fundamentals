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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ERCOTZonalData {
  success: boolean;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
      borderWidth: number;
      pointRadius: number;
      pointHoverRadius: number;
      tension: number;
    }>;
  };
  metadata: {
    rawDataPoints: number;
    zones: string[];
    years: number[];
    growthYears: number[];
    units: string;
  };
}

const ERCOTZonalChart: React.FC = () => {
  const [chartData, setChartData] = useState<ERCOTZonalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/ercot-zonal-data');
        const result: ERCOTZonalData = await response.json();
        
        if (result.success) {
          setChartData(result);
          setError(null);
        } else {
          setError('Failed to load ERCOT zonal data');
        }
      } catch (err) {
        setError('Error fetching ERCOT zonal data');
        console.error('Error fetching ERCOT zonal data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        display: true,
        text: 'Figure 3 — YoY structural demand growth by month and region',
        font: {
          family: 'Inter, sans-serif',
          size: 16,
          weight: 600,
        },
        color: '#2A2A2A', // GridStor Dark
        padding: { top: 0, bottom: 24 },
        align: 'start' as const,
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
        callbacks: {
          title: function(context: any) {
            const dataIndex = context[0].dataIndex;
            const year = Math.floor(dataIndex / 12) + 2022;
            const month = (dataIndex % 12) + 1;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[month - 1]} ${year}`;
          },
          label: function(context: any) {
            const value = context.parsed.y;
            const sign = value >= 0 ? '+' : '';
            return `${context.dataset.label}: ${sign}${value.toFixed(1)}%`;
          },
          afterBody: function() {
            return 'YoY structural demand growth';
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
            size: 10,
            weight: 400,
          },
          color: '#6B7280', // Gray 500
          padding: 8,
          callback: function(value: any, index: number) {
            const year = Math.floor(index / 12) + 2022;
            const month = (index % 12) + 1;
            if (month === 1) {
              return year.toString();
            }
            return month.toString();
          }
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'YoY increase in structural demand',
          font: {
            family: 'Inter, sans-serif',
            size: 14,
            weight: 500,
          },
          color: '#374151', // Gray 700
          padding: { top: 0, bottom: 8 },
        },
        min: -10,
        max: 25,
        ticks: {
          stepSize: 5,
          callback: function(value: any) {
            return value + '%';
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
        tension: 0.2,
        borderWidth: 2.5,
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
      },
      point: {
        radius: 0,
        hoverRadius: 4,
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

  // Calculate summary data for the regional growth table
  const summaryData = chartData ? chartData.data.datasets.map(dataset => {
    const peak = Math.max(...dataset.data);
    const lowest = Math.min(...dataset.data);
    const average = dataset.data.reduce((sum, val) => sum + val, 0) / dataset.data.length;
    
    // Calculate volatility based on standard deviation
    const variance = dataset.data.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / dataset.data.length;
    const stdDev = Math.sqrt(variance);
    
    let volatility = 'Low';
    if (stdDev > 8) volatility = 'High';
    else if (stdDev > 4) volatility = 'Medium';
    
    return {
      region: dataset.label,
      peak: `+${peak.toFixed(1)}%`,
      lowest: lowest < 0 ? `${lowest.toFixed(1)}%` : `+${lowest.toFixed(1)}%`,
      average: `+${average.toFixed(1)}%`,
      volatility,
      color: dataset.borderColor,
    };
  }) : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-gray-500">Loading ERCOT zonal data...</div>
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
            <Line data={chartData?.data || { labels: [], datasets: [] }} options={options} />
          </div>
        </div>

        {/* Key Observations */}
        <div className="lg:col-span-1">
          <div className="bg-gray-100 rounded-lg p-4 h-full">
            <h4 className="text-sm font-semibold text-gs-dark mb-3">Key Observations</h4>
            <ul className="space-y-3 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>West region shows highest volatility, with peaks exceeding 20% growth in 2022-2024</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Houston region experienced significant decline in 2022 mid-year, reaching -8% growth</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>North region demonstrates most stable growth pattern, typically ranging 0-8%</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>South region shows consistent positive growth with occasional spikes above 10%</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Regional Growth Summary Table */}
      <div>
        <h4 className="text-sm font-semibold text-gs-dark mb-3">Regional Growth Summary</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-gray-200 rounded-lg">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left p-3 font-medium text-gray-600">Region</th>
                <th className="text-center p-3 font-medium text-gray-600">Peak Growth</th>
                <th className="text-center p-3 font-medium text-gray-600">Lowest Growth</th>
                <th className="text-center p-3 font-medium text-gray-600">Average Growth</th>
                <th className="text-center p-3 font-medium text-gray-600">Volatility</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {summaryData.map((row, index) => (
                <tr key={row.region} className={index < summaryData.length - 1 ? "border-b border-gray-200" : ""}>
                  <td className="p-3 text-gs-dark font-semibold flex items-center gap-2">
                    <div 
                      className="w-3 h-1 rounded"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.region}
                  </td>
                  <td className="p-3 text-center text-green-600">{row.peak}</td>
                  <td className="p-3 text-center text-red-600">{row.lowest}</td>
                  <td className="p-3 text-center text-gs-dark">{row.average}</td>
                  <td className="p-3 text-center text-gs-dark">{row.volatility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ERCOTZonalChart; 