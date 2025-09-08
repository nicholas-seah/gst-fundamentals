import React, { useState, useEffect, useRef } from 'react';

interface ChartConfig {
  data: any[];
  layout: any;
  config: any;
}

interface SupplyCurveResponse {
  success: boolean;
  message?: string;
  chartConfig?: ChartConfig;
  dataPoints?: number;
  error?: string;
  details?: string;
}

export const JSSupplyCurveDashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState('2025-06-11');
  const [selectedHour, setSelectedHour] = useState('00 (12 AM)');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedScenario, setSelectedScenario] = useState('Current Grid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartConfig | null>(null);
  
  const plotRef = useRef<HTMLDivElement>(null);

  const generateChart = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Generating JavaScript supply curve...');
      
      const response = await fetch('/api/generate-supply-curve-js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          hour: selectedHour,
          minute: selectedMinute,
          scenario: selectedScenario
        })
      });
      
      const result: SupplyCurveResponse = await response.json();
      
      if (result.success && result.chartConfig) {
        setChartData(result.chartConfig);
        console.log(`Chart generated successfully with ${result.dataPoints} data points`);
      } else {
        setError(result.error || 'Failed to generate chart');
        console.error('Chart generation failed:', result.error);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error generating chart:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Plotly from CDN and render chart when chartData changes
  useEffect(() => {
    if (chartData && plotRef.current) {
      // Check if Plotly is already loaded
      if (typeof window !== 'undefined' && (window as any).Plotly) {
        try {
          const Plotly = (window as any).Plotly;
          Plotly.newPlot(plotRef.current!, chartData.data, chartData.layout, chartData.config);
          console.log('Chart rendered successfully with existing Plotly');
          
          // Fix toolbar positioning after render
          setTimeout(() => {
            const modebar = plotRef.current?.querySelector('.modebar');
            if (modebar) {
              (modebar as HTMLElement).style.cssText = `
                position: absolute !important;
                top: 10px !important;
                right: 10px !important;
                background: rgba(255, 255, 255, 0.9) !important;
                border: 1px solid #ddd !important;
                border-radius: 6px !important;
                padding: 4px !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
                z-index: 1000 !important;
                display: flex !important;
                flex-direction: row !important;
                width: auto !important;
                height: auto !important;
              `;
            }
          }, 100);
        } catch (plotError) {
          console.error('Error rendering Plotly chart:', plotError);
          setError(`Failed to render chart: ${plotError.message}`);
        }
        return;
      }

      // Load Plotly from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-2.26.0.min.js';
      script.onload = () => {
        try {
          console.log('Plotly loaded from CDN');
          const Plotly = (window as any).Plotly;
          if (Plotly && typeof Plotly.newPlot === 'function') {
            Plotly.newPlot(plotRef.current!, chartData.data, chartData.layout, chartData.config);
            console.log('Chart rendered successfully');
            
            // Fix toolbar positioning after render
            setTimeout(() => {
              const modebar = plotRef.current?.querySelector('.modebar');
              if (modebar) {
                (modebar as HTMLElement).style.cssText = `
                  position: absolute !important;
                  top: 10px !important;
                  right: 10px !important;
                  background: rgba(255, 255, 255, 0.9) !important;
                  border: 1px solid #ddd !important;
                  border-radius: 6px !important;
                  padding: 4px !important;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
                  z-index: 1000 !important;
                  display: flex !important;
                  flex-direction: row !important;
                  width: auto !important;
                  height: auto !important;
                `;
              }
            }, 100);
          } else {
            throw new Error('Plotly.newPlot is not available');
          }
        } catch (plotError) {
          console.error('Error rendering Plotly chart:', plotError);
          setError(`Failed to render chart: ${plotError.message}`);
        }
      };
      script.onerror = () => {
        console.error('Failed to load Plotly from CDN');
        setError('Failed to load charting library from CDN');
      };
      
      document.head.appendChild(script);
      
      // Cleanup function to remove script
      return () => {
        document.head.removeChild(script);
      };
    }
  }, [chartData]);

  // Generate initial chart on mount
  useEffect(() => {
    generateChart();
  }, []);

  const hourOptions = Array.from({ length: 24 }, (_, i) => {
    const hour24 = i.toString().padStart(2, '0');
    const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    const ampm = i < 12 ? 'AM' : 'PM';
    return `${hour24} (${hour12} ${ampm})`;
  });

  const minuteOptions = ['00', '15', '30', '45'];

  const scenarioOptions = ['Current Grid', 'High Renewables', 'Low Demand', 'Peak Demand'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Market Conditions & Analysis Tools
            </h1>
            <p className="text-gray-600">
              JavaScript Implementation - Interactive ERCOT supply curve visualization
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option>CSV</option>
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
              Export Data
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Hour Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🕐 Select Hour
            </label>
            <select
              value={selectedHour}
              onChange={(e) => setSelectedHour(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {hourOptions.map(hour => (
                <option key={hour} value={hour}>{hour}</option>
              ))}
            </select>
          </div>

          {/* Minute Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ⏰ Select Minute
            </label>
            <select
              value={selectedMinute}
              onChange={(e) => setSelectedMinute(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {minuteOptions.map(minute => (
                <option key={minute} value={minute}>{minute}</option>
              ))}
            </select>
          </div>

          {/* Scenario Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Market Scenario
            </label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {scenarioOptions.map(scenario => (
                <option key={scenario} value={scenario}>{scenario}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Apply Button */}
        <div className="mt-4">
          <button
            onClick={generateChart}
            disabled={loading}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              loading
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Generating...' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Market Stats (Mock Data for Now) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">101,989</div>
          <div className="text-sm text-gray-600">Demand (MW)</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">$25.5</div>
          <div className="text-sm text-gray-600">Clearing Price ($/MWh)</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">75%</div>
          <div className="text-sm text-gray-600">Grid Utilization</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">45.2%</div>
          <div className="text-sm text-gray-600">Renewable Mix</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">$32.75</div>
          <div className="text-sm text-gray-600">Avg Gen Cost</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">CCGT90</div>
          <div className="text-sm text-gray-600">Marginal Unit</div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Supply Curve - Current Grid (Interactive) - JavaScript Version
          </h2>
          <div className="text-sm text-gray-500">
            {selectedDate} at {selectedHour.split(' ')[0]}:{selectedMinute}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-600 mr-2">⚠️</div>
              <div>
                <div className="font-medium text-red-800">Chart generation failed</div>
                <div className="text-red-600 text-sm mt-1">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <div className="text-gray-500">Generating chart with JavaScript...</div>
            </div>
          </div>
        )}

        {/* Chart Container */}
        {!loading && !error && (
          <div 
            ref={plotRef}
            className="w-full h-96 border border-gray-200 rounded-lg relative"
            style={{ 
              minHeight: '400px',
              // Custom CSS for Plotly toolbar positioning
            }}
          />
        )}
        
        {/* Custom CSS for Plotly toolbar */}
        <style jsx global>{`
          .js-plotly-plot .plotly .modebar {
            position: absolute !important;
            top: 10px !important;
            right: 10px !important;
            background: rgba(255, 255, 255, 0.9) !important;
            border: 1px solid #ddd !important;
            border-radius: 6px !important;
            padding: 4px !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            z-index: 1000 !important;
          }
          
          .js-plotly-plot .plotly .modebar-group {
            display: inline-flex !important;
            flex-direction: row !important;
            margin: 0 2px !important;
          }
          
          .js-plotly-plot .plotly .modebar-btn {
            margin: 0 1px !important;
          }
          
          /* Force horizontal layout */
          .js-plotly-plot .plotly .modebar {
            width: auto !important;
            height: auto !important;
            flex-direction: row !important;
            display: flex !important;
          }
        `}</style>

        {/* Chart Info */}
        <div className="mt-4 text-sm text-gray-500 text-center">
          Supply: JavaScript Implementation • Data: Mock offer curve data • Hover, zoom, and pan enabled
        </div>
      </div>
    </div>
  );
};

export default JSSupplyCurveDashboard;
