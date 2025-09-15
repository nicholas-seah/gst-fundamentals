import React, { useState, useEffect, useRef } from 'react';
import CurveDateCalendar from './CurveDateCalendar';

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
  actualDemand?: number | null;
  debugInfo?: {
    totalCapacity: number;
    priceRange: { min: number; max: number };
    timestamp: string;
  };
  error?: string;
  details?: string;
}

export const JSSupplyCurveDashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState('2025-06-11');
  const [selectedHour, setSelectedHour] = useState('00 (12 AM)');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedResourceStatuses, setSelectedResourceStatuses] = useState<string[]>(['All']);
  const [exportFormat, setExportFormat] = useState('CSV');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartConfig | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [actualDemand, setActualDemand] = useState<number | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  
  const plotRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const generateChart = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 STARTING: Generating JavaScript supply curve...');
      console.log(`📅 Selected: ${selectedDate}, ${selectedHour}, ${selectedMinute}`);
      console.log(`🔧 Resource Statuses: ${selectedResourceStatuses.join(', ')}`);
      
      console.log('📡 Making API call to /api/generate-supply-curve-js...');
      
      const response = await fetch('/api/generate-supply-curve-js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          hour: selectedHour,
          minute: selectedMinute,
          resourceStatuses: selectedResourceStatuses
        })
      });
      
      const result: SupplyCurveResponse = await response.json();
      
      if (result.success && result.chartConfig) {
        setChartData(result.chartConfig);
        setActualDemand(result.actualDemand);
        console.log(`Chart generated successfully with ${result.dataPoints} data points`);
        if (result.actualDemand) {
          console.log(`Actual demand: ${result.actualDemand} MW`);
        }
        
        // Log debug info from API for easier viewing
        if (result.debugInfo) {
          console.log('🔍 SUPPLY CURVE DEBUG INFO:');
          console.log(`📊 Total Capacity: ${result.debugInfo.totalCapacity.toFixed(1)} MW`);
          console.log(`📈 Price Range: $${result.debugInfo.priceRange.min.toFixed(2)} to $${result.debugInfo.priceRange.max.toFixed(2)}`);
          console.log(`🎯 Demand vs Capacity: ${result.actualDemand} MW / ${result.debugInfo.totalCapacity.toFixed(1)} MW = ${((result.actualDemand / result.debugInfo.totalCapacity) * 100).toFixed(1)}%`);
        }
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

  // Fetch available dates from database
  const fetchAvailableDates = async () => {
    try {
      setDatesLoading(true);
      const response = await fetch('/api/available-supply-curve-dates');
      const result = await response.json();
      
      if (result.success) {
        setAvailableDates(result.dates);
        console.log(`Loaded ${result.dates.length} available dates`);
        
        // Set default date to the most recent available date
        if (result.dates.length > 0) {
          const latestDate = result.dates[0]; // Dates are ordered DESC
          setSelectedDate(latestDate);
        }
      } else {
        console.error('Failed to load available dates');
      }
    } catch (err) {
      console.error('Error fetching available dates:', err);
    } finally {
      setDatesLoading(false);
    }
  };

  // Load available dates and generate initial chart
  useEffect(() => {
    fetchAvailableDates();
  }, []);
  
  // Generate chart when date is set
  useEffect(() => {
    if (selectedDate && !datesLoading) {
      generateChart();
    }
  }, [selectedDate, datesLoading]);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hourOptions = Array.from({ length: 24 }, (_, i) => {
    const hour24 = i.toString().padStart(2, '0');
    const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    const ampm = i < 12 ? 'AM' : 'PM';
    return `${hour24} (${hour12} ${ampm})`;
  });

  const minuteOptions = ['00', '15', '30', '45'];

  // Common telemetered_resource_status values in ERCOT data
  const resourceStatusOptions = [
    'All',
    'ON', 
    'OFF',
    'ONREG',
    'ONTEST', 
    'OUT',
    'EMRSWGR',
    'STARTUP'
  ];

  // Handle checkbox changes for resource status
  const handleStatusToggle = (status: string) => {
    if (status === 'All') {
      setSelectedResourceStatuses(['All']);
    } else {
      const newStatuses = selectedResourceStatuses.includes(status)
        ? selectedResourceStatuses.filter(s => s !== status && s !== 'All')
        : [...selectedResourceStatuses.filter(s => s !== 'All'), status];
      
      setSelectedResourceStatuses(newStatuses.length > 0 ? newStatuses : ['All']);
    }
  };

  // Get display text for selected statuses
  const getStatusDisplayText = () => {
    if (selectedResourceStatuses.includes('All')) {
      return 'All Statuses';
    }
    if (selectedResourceStatuses.length === 1) {
      return selectedResourceStatuses[0];
    }
    return `${selectedResourceStatuses.length} Selected`;
  };

  return (
    <div className="space-y-4">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Market Conditions
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option>CSV</option>
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
              Export Data
            </button>
          </div>
        </div>

        {/* Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Select Date
            </label>
            <CurveDateCalendar
              selectedDate={selectedDate}
              onChange={setSelectedDate}
              availableDates={availableDates}
              disabled={datesLoading}
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

          {/* Resource Status Filter */}
          <div className="relative" ref={statusDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resource Status
            </label>
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex justify-between items-center"
            >
              <span className="truncate">{getStatusDisplayText()}</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {statusDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {resourceStatusOptions.map(status => (
                  <label
                    key={status}
                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedResourceStatuses.includes(status)}
                      onChange={() => handleStatusToggle(status)}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{status}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Apply Button */}
          <div>
            <button
              onClick={generateChart}
              disabled={loading}
              className={`w-full px-6 py-2 rounded-md font-medium transition-colors ${
                loading
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Generating...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">
            {actualDemand ? actualDemand.toLocaleString() : '101,989'}
          </div>
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

      {/* Chart Section with Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Chart */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Generation Offer Curve
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
            <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ height: '600px' }}>
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
              className="w-full border border-gray-200 rounded-lg relative"
              style={{ 
                height: '600px', // Increased from 400px to 600px
                minHeight: '600px',
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

        </div>

        {/* Market Analysis Sidebar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="space-y-6">
            {/* Market Analysis Header */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                📊 Market Analysis
              </h3>
              <div className="text-sm text-gray-600">
                Analysis at 101,989 MW
              </div>
            </div>

            {/* Key Metrics */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Clearing Price:</span>
                <span className="text-sm font-medium text-gray-900">$25.5/MWh</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Marginal Unit:</span>
                <span className="text-sm font-medium text-gray-900">CCGT90</span>
              </div>
            </div>

            {/* Dispatched Units */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Dispatched Units</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">WIND:</span>
                  <span className="text-sm font-medium text-gray-900">28,500MW</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">CCGT90:</span>
                  <span className="text-sm font-medium text-gray-900">25,000MW</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">PVGR:</span>
                  <span className="text-sm font-medium text-gray-900">15,200MW</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">NUC:</span>
                  <span className="text-sm font-medium text-gray-900">8,500MW</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">PWRSTR:</span>
                  <span className="text-sm font-medium text-gray-900">8,164MW</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">HYDRO:</span>
                  <span className="text-sm font-medium text-gray-900">4,200MW</span>
                </div>
              </div>
            </div>

            {/* Market Conditions */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Market Conditions</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Load Factor:</span>
                  <span className="text-sm font-medium text-gray-900">75%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Reserve Margin:</span>
                  <span className="text-sm font-medium text-gray-900">33.3%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Renewable Gen:</span>
                  <span className="text-sm font-medium text-gray-900">45.2%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JSSupplyCurveDashboard;
