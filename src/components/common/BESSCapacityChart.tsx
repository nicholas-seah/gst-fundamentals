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

interface ScenarioData {
  historical: (number | null)[];
  conservative: (number | null)[];
  moderate: (number | null)[];
  aggressive: (number | null)[];
}

interface BessApiResponse {
  success: boolean;
  data?: {
    years: string[]; // Now monthly labels like "Jan 2023"
    scenarios: ScenarioData;
    rawData: any[];
  };
  metadata?: {
    totalRecords: number;
    yearRange: string;
    lastUpdated: string;
    artificialYears?: number[];
    databaseYears?: number[];
  };
  message?: string;
  error?: string;
}

const BESSCapacityChart: React.FC = () => {
  // State for real data
  const [realData, setRealData] = useState<BessApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Mock data (fallback)
  const mockYears = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const mockData: ScenarioData = {
    historical: [13000, 15500, 18200, 21800, 26500, null, null, null, null, null, null], // Historical ends at 2024
    conservative: [null, null, null, null, null, 30000, 34000, 38000, 42000, 46000, 50000],
    moderate: [null, null, null, null, null, 32000, 38000, 45000, 53000, 62000, 72000],
    aggressive: [null, null, null, null, null, 35000, 45000, 58000, 74000, 95000, 120000],
  };

  // Fetch real data on component mount
  useEffect(() => {
    const fetchBessData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching BESS capacity data...');
        const response = await fetch('/api/ercot-bess-data');
        const result: BessApiResponse = await response.json();
        
        console.log('BESS API response:', result);
        
         if (result.success && result.data) {
           setRealData(result);
           console.log('BESS data loaded successfully:', {
             years: result.data.years.length,
             records: result.metadata?.totalRecords || 0
           });
           
           // Debug: Show first and last few labels to understand the data
           console.log('First 5 labels:', result.data.years.slice(0, 5));
           console.log('Last 5 labels:', result.data.years.slice(-5));
         } else {
          throw new Error(result.error || 'Failed to fetch BESS data');
        }
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('BESS data fetch error:', err);
        setError(`Database connection failed: ${errorMessage}`);
        
        // Don't fail completely - fall back to mock data
        console.log('Falling back to mock data');
        
      } finally {
        setLoading(false);
      }
    };
    
    fetchBessData();
  }, []);

  // Determine which data to use (monthly labels from API or fallback to mock years)
  const years = realData?.data?.years || mockYears.map(y => `Jan ${y}`);
  const scenarioData = realData?.data?.scenarios || mockData;

  // Scenario selection state
  const [selectedScenarios, setSelectedScenarios] = useState({
    historical: true,
    conservative: true,
    moderate: true,
    aggressive: true,
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState('capacity');

  // Export format state
  const [exportFormat, setExportFormat] = useState('CSV');

  const handleExportData = () => {
    let csvData;
    
    csvData = years.map(year => {
      const yearIndex = years.indexOf(year);
      const historical = scenarioData.historical[yearIndex];
      const conservative = scenarioData.conservative[yearIndex];
      const moderate = scenarioData.moderate[yearIndex];
      const aggressive = scenarioData.aggressive[yearIndex];
      
      // Determine data source for historical data
      let historicalSource = '';
      if (historical !== null) {
        if (realData?.metadata?.databaseYears?.includes(year)) {
          historicalSource = 'Database';
        } else {
          historicalSource = 'Artificial';
        }
      }
      
      // Determine data source for projections
      let projectionSource = '';
      if (conservative !== null || moderate !== null || aggressive !== null) {
        projectionSource = 'Sample';
      }
      
      return {
        Year: year,
        Historical_MW: historical || '',
        Historical_Source: historicalSource,
        Conservative_MW: conservative || '',
        Moderate_MW: moderate || '',
        Aggressive_MW: aggressive || '',
        Projection_Source: projectionSource
      };
    });

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map((row: any) => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ercot_bess_capacity_2020_2030_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleScenarioToggle = (scenario: keyof typeof selectedScenarios) => {
    setSelectedScenarios(prev => ({ ...prev, [scenario]: !prev[scenario] }));
  };

  // Prepare chart data
  const datasets = [];
  
  if (selectedScenarios.historical) {
    datasets.push({
      label: realData ? 'Historical Data (Database)' : 'Historical (Sample)',
      data: scenarioData.historical,
      borderColor: '#6366F1',
      backgroundColor: 'transparent', // Remove fill
      borderWidth: 2,
      pointRadius: 1, // Smaller points
      pointHoverRadius: 4,
      tension: 0.1,
      fill: false, // Ensure no fill
    });
  }

  // Get the 2024 historical value for connecting lines
  const year2024Index = years.indexOf(2024);
  const year2025Index = years.indexOf(2025);
  const historical2024Value = year2024Index >= 0 ? scenarioData.historical[year2024Index] : null;

  if (selectedScenarios.conservative) {
    datasets.push({
      label: 'Conservative Growth (Sample)',
      data: scenarioData.conservative,
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 2.5,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2,
    });
    
    // Add connector line from 2024 historical to 2025 conservative
    if (historical2024Value !== null && year2025Index >= 0 && scenarioData.conservative[year2025Index] !== null) {
      const connectorData = new Array(years.length).fill(null);
      connectorData[year2024Index] = historical2024Value;
      connectorData[year2025Index] = scenarioData.conservative[year2025Index];
      
      datasets.push({
        label: 'Conservative Connector',
        data: connectorData,
        borderColor: '#9CA3AF',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        showInLegend: false,
      });
    }
  }

  if (selectedScenarios.moderate) {
    datasets.push({
      label: 'Moderate Growth (Sample)',
      data: scenarioData.moderate,
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2.5,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2,
    });
    
    // Add connector line from 2024 historical to 2025 moderate
    if (historical2024Value !== null && year2025Index >= 0 && scenarioData.moderate[year2025Index] !== null) {
      const connectorData = new Array(years.length).fill(null);
      connectorData[year2024Index] = historical2024Value;
      connectorData[year2025Index] = scenarioData.moderate[year2025Index];
      
      datasets.push({
        label: 'Moderate Connector',
        data: connectorData,
        borderColor: '#9CA3AF',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        showInLegend: false,
      });
    }
  }

  if (selectedScenarios.aggressive) {
    datasets.push({
      label: 'Aggressive Growth (Sample)',
      data: scenarioData.aggressive,
      borderColor: '#8B5CF6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      borderWidth: 2.5,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2,
    });
    
    // Add connector line from 2024 historical to 2025 aggressive
    if (historical2024Value !== null && year2025Index >= 0 && scenarioData.aggressive[year2025Index] !== null) {
      const connectorData = new Array(years.length).fill(null);
      connectorData[year2024Index] = historical2024Value;
      connectorData[year2025Index] = scenarioData.aggressive[year2025Index];
      
      datasets.push({
        label: 'Aggressive Connector',
        data: connectorData,
        borderColor: '#9CA3AF',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        showInLegend: false,
      });
    }
  }

  // Create year-only labels for every other year, positioned at the start of each year
  const chartLabels = years.map((label, index) => {
    if (typeof label === 'string' && label.startsWith('Jan')) {
      // Extract year from "Jan 2023" and show just "2023"
      const year = parseInt(label.split(' ')[1]);
      // Show every other year (odd years: 2023, 2025, 2027, etc.)
      if (year % 2 === 1) {
        return year.toString();
      }
    }
    return ''; // Hide labels for other months and even years
  });
  
  const chartData = {
    labels: chartLabels, // Year labels positioned at January (start of each year)
    datasets: datasets,
  };

  // Generate capacity data for tables
  const capacityData = years.map((year, index) => {
    const historical = scenarioData.historical[index];
    const conservative = scenarioData.conservative[index];
    const moderate = scenarioData.moderate[index];
    const aggressive = scenarioData.aggressive[index];
    
    // Calculate YoY growth for historical data
    let growth = '−';
    if (historical !== null && index > 0) {
      const prevHistorical = scenarioData.historical[index - 1];
      if (prevHistorical !== null && prevHistorical > 0) {
        const growthRate = ((historical - prevHistorical) / prevHistorical) * 100;
        growth = `+${Math.round(growthRate)}%`;
      }
    }
    
    return {
      year,
      historical: historical !== null ? historical : '−',
      conservative: conservative !== null ? conservative : '−',
      moderate: moderate !== null ? moderate : '−',
      aggressive: aggressive !== null ? aggressive : '−',
      growth
    };
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            family: 'Inter, sans-serif',
            size: 11,
            weight: 400,
          },
          usePointStyle: true,
          pointStyle: 'line',
          padding: 12,
          color: '#4B5563',
          filter: function(legendItem: any) {
            // Hide connector lines from legend
            return !legendItem.text.includes('Connector');
          }
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
        filter: function(tooltipItem: any) {
          // Hide connector lines from tooltips
          return !tooltipItem.dataset.label.includes('Connector');
        },
         callbacks: {
           title: function(context: any) {
             // Show the full month/year in tooltip (from original years array)
             const dataIndex = context[0].dataIndex;
             const fullLabel = years[dataIndex];
             return `Month: ${fullLabel}`;
           },
           label: function(context: any) {
             if (context.parsed.y === null) return undefined;
             return `${context.dataset.label}: ${(context.parsed.y / 1000).toFixed(1)}K MW`;
           }
         }
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: '#E5E7EB',
          lineWidth: 1,
        },
        ticks: {
          font: {
            family: 'Inter, sans-serif',
            size: 12,
            weight: 400,
          },
          color: '#6B7280',
          padding: 8,
          maxRotation: 0,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'BESS Capacity (MW)',
          font: {
            family: 'Inter, sans-serif',
            size: 14,
            weight: 500,
          },
          color: '#374151',
          padding: { top: 0, bottom: 8 },
        },
        min: 0,
        // Dynamic max based on actual data with small headroom
        max: Math.ceil((Math.max(...scenarioData.historical.filter(v => v !== null)) || 40000) * 1.1 / 5000) * 5000,
        ticks: {
          // Dynamic step size based on data range  
          stepSize: Math.ceil((Math.max(...scenarioData.historical.filter(v => v !== null)) || 40000) / 8 / 2500) * 2500,
          callback: function(value: any) {
            return (Number(value) / 1000).toFixed(0) + 'K';
          },
          font: {
            family: 'JetBrains Mono, monospace',
            size: 12,
            weight: 400,
          },
          color: '#6B7280',
          padding: 8,
        },
        grid: {
          color: '#E5E7EB',
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

  // Mock table data
  // const capacityData = [
  //   { year: 2022, historical: 2100, conservative: '−', moderate: '−', aggressive: '−', growth: '−' },
  //   { year: 2023, historical: 3800, conservative: '−', moderate: '−', aggressive: '−', growth: '+81%' },
  //   { year: 2024, historical: 7900, conservative: '−', moderate: '−', aggressive: '−', growth: '+108%' },
  //   { year: 2025, historical: 10700, conservative: '−', moderate: '−', aggressive: '−', growth: '+35%' },
  //   { year: 2026, historical: 11400, conservative: '−', moderate: '−', aggressive: '−', growth: '+7%' },
  //   { year: 2030, historical: '−', conservative: 20000, moderate: 28000, aggressive: 44000, growth: '15-40%' },
  // ];

  const renderScenarioCheckbox = (key: keyof typeof selectedScenarios, label: string, description: string) => (
    <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
      <input
        type="checkbox"
        id={key}
        checked={selectedScenarios[key]}
        onChange={() => handleScenarioToggle(key)}
        className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
      />
      <div className="flex-1">
        <label htmlFor={key} className="text-sm font-medium text-gray-900 cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <p>Loading BESS capacity data from database...</p>
        </div>
      )}
      
      {/* Error State with Fallback */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Using sample data:</strong> {error}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Chart shows representative data. Database connection will be restored automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chart content - only show when not loading */}
      {!loading && (
        <>
          {/* Scenario Analysis & Export Tools */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gs-dark">Scenario Analysis & Export Tools</h3>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-3 py-1 bg-white"
                >
                  <option value="CSV">CSV</option>
                  <option value="JSON">JSON</option>
                </select>
                <button className="text-sm bg-white border border-gray-300 rounded px-3 py-1 hover:bg-gray-50 flex items-center gap-2" onClick={handleExportData}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Data
                </button>
                <button className="text-sm bg-white border border-gray-300 rounded px-3 py-1 hover:bg-gray-50 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Export Chart
                </button>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Select Scenarios to Display</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {renderScenarioCheckbox('historical', 'Historical Data', '2020-2024 Database + Artificial')}
                {renderScenarioCheckbox('conservative', 'Conservative Growth', '2025-2030 Low growth scenario')}
                {renderScenarioCheckbox('moderate', 'Moderate Growth', '2025-2030 Medium growth scenario')}
                {renderScenarioCheckbox('aggressive', 'Aggressive Growth', '2025-2030 High growth scenario')}
              </div>
            </div>
          </div>

          {/* Chart and Key Insights Layout */}
          <div className="space-y-6">
            {/* Chart Area */}
            <div className="h-96 w-full">
              <Line data={chartData} options={options} />
            </div>

            {/* Key Insights */}
            <div className="bg-gray-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gs-dark mb-3">Key Insights</h4>
              <ul className="space-y-3 text-xs text-gray-600">
                {observationsData.bessCapacity.map((observation, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1 h-1 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span>{observation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tabbed Tables */}
          <div>
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { key: 'capacity', label: 'Capacity Summary' },
                  { key: 'growth', label: 'Growth Analysis' },
                  { key: 'scenarios', label: 'Future Scenarios' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-4">
              {activeTab === 'capacity' && (
                <div className="overflow-x-auto">
                  <h4 className="text-base font-semibold text-gs-dark mb-3">BESS Capacity by Year & Scenario</h4>
                  <table className="w-full text-sm border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left p-3 font-medium text-gray-600">Year</th>
                        <th className="text-center p-3 font-medium text-gray-600">Historical (MW)</th>
                        <th className="text-center p-3 font-medium text-gray-600">Conservative (MW)</th>
                        <th className="text-center p-3 font-medium text-gray-600">Moderate (MW)</th>
                        <th className="text-center p-3 font-medium text-gray-600">Aggressive (MW)</th>
                        <th className="text-center p-3 font-medium text-gray-600">YoY Growth</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {capacityData.map((row, index) => (
                        <tr key={row.year} className={index < capacityData.length - 1 ? "border-b border-gray-200" : ""}>
                          <td className="p-3 text-gs-dark font-semibold">{row.year}</td>
                          <td className="p-3 text-center text-gs-dark">
                            {typeof row.historical === 'number' ? Math.round(row.historical).toLocaleString() : row.historical}
                          </td>
                          <td className="p-3 text-center text-gs-dark">
                            {typeof row.conservative === 'number' ? Math.round(row.conservative).toLocaleString() : row.conservative}
                          </td>
                          <td className="p-3 text-center text-gs-dark">
                            {typeof row.moderate === 'number' ? Math.round(row.moderate).toLocaleString() : row.moderate}
                          </td>
                          <td className="p-3 text-center text-gs-dark">
                            {typeof row.aggressive === 'number' ? Math.round(row.aggressive).toLocaleString() : row.aggressive}
                          </td>
                          <td className="p-3 text-center text-green-600">{row.growth}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'growth' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-base font-semibold text-gs-dark mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Historical Growth Analysis (2020-2024)
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">2020-2021 Growth:</span>
                        <span className="font-mono text-green-600">+19%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">2021-2022 Growth:</span>
                        <span className="font-mono text-green-600">+17%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">2022-2023 Growth:</span>
                        <span className="font-mono text-green-600">+20%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">2023-2024 Growth:</span>
                        <span className="font-mono text-green-600">+22%</span>
                      </div>
                      <hr className="my-2" />
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-700">Average Annual Growth:</span>
                        <span className="font-mono text-green-600">20%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-base font-semibold text-gs-dark mb-3">Capacity Milestones</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">13 GW Baseline:</span>
                        <span className="font-mono text-gs-dark">2020</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">15 GW Milestone:</span>
                        <span className="font-mono text-gs-dark">2021</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">20 GW Milestone:</span>
                        <span className="font-mono text-gs-dark">~2023</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">25+ GW Target:</span>
                        <span className="font-mono text-gs-dark">2024</span>
                      </div>
                      <hr className="my-2" />
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-700">Data Sources:</span>
                        <span className="font-mono text-gs-dark">DB + Artificial</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'scenarios' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-3 bg-green-500 rounded"></div>
                      <h4 className="text-base font-semibold text-gs-dark">Conservative Growth</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Steady deployment with moderate policy support</p>
                    <div className="space-y-2 text-sm">
                      <div><strong>2030 Projection</strong></div>
                      <div>Total Capacity: <span className="font-mono">50,000 MW</span></div>
                      <div>Growth from 2024: <span className="font-mono">89%</span></div>
                      <div>CAGR 2025-2030: <span className="font-mono">~11%</span></div>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-3 bg-orange-500 rounded"></div>
                      <h4 className="text-base font-semibold text-gs-dark">Moderate Growth</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Accelerated deployment with strong policy support</p>
                    <div className="space-y-2 text-sm">
                      <div><strong>2030 Projection</strong></div>
                      <div>Total Capacity: <span className="font-mono">72,000 MW</span></div>
                      <div>Growth from 2024: <span className="font-mono">172%</span></div>
                      <div>CAGR 2025-2030: <span className="font-mono">~18%</span></div>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-3 bg-purple-500 rounded"></div>
                      <h4 className="text-base font-semibold text-gs-dark">Aggressive Growth</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Rapid deployment with maximum policy and market support</p>
                    <div className="space-y-2 text-sm">
                      <div><strong>2030 Projection</strong></div>
                      <div>Total Capacity: <span className="font-mono">120,000 MW</span></div>
                      <div>Growth from 2024: <span className="font-mono">353%</span></div>
                      <div>CAGR 2025-2030: <span className="font-mono">~29%</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BESSCapacityChart; 