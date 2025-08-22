import React, { useState, useEffect, useMemo } from 'react';

const PlotlySupplyCurveDashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState('00 (12 AM)');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [marketScenario, setMarketScenario] = useState('Current Grid');
  const [exportFormat, setExportFormat] = useState('CSV');
  const [appliedDate, setAppliedDate] = useState('');
  const [appliedHour, setAppliedHour] = useState('00 (12 AM)');
  const [appliedMinute, setAppliedMinute] = useState('00');
  const [appliedScenario, setAppliedScenario] = useState('Current Grid');
  const [invalidDateMessage, setInvalidDateMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  // Mock statistics for the dashboard (you can make these dynamic later)
  const stats = useMemo(() => ({
    totalDemand: 89564,
    clearingPrice: 25.50,
    gridUtilization: 75,
    renewableMix: 45.2,
    avgGenCost: 32.75,
    marginalUnit: 'CCGT90',
    reserveMargin: 33.3,
    dispatchedUnits: {
      'WIND': 28500,
      'PVGR': 15200,
      'CCGT90': 25000,
      'NUC': 8500,
      'HYDRO': 4200,
      'PWRSTR': 8164
    }
  }), []);

  // Set default date to match CSV data
  useEffect(() => {
    const defaultDate = '2025-06-11'; // Match CSV data
    const defaultHour = '02 (2 AM)';
    const defaultMinute = '00';
    
    setSelectedDate(defaultDate);
    setAppliedDate(defaultDate);
    setAppliedHour(defaultHour);
    setAppliedMinute(defaultMinute);
    setAppliedScenario('Current Grid');
    
    // Generate initial chart
    regenerateChart(defaultDate, defaultHour, defaultMinute, 'Current Grid');
  }, []);

  const regenerateChart = async (date: string, hour: string, minute: string, scenario: string) => {
    setChartLoading(true);
    setChartError(null);
    
    try {
      console.log(`🔄 Regenerating chart for ${date} ${hour}:${minute} (${scenario})`);
      
      // Call the API to regenerate the chart
      const response = await fetch('/api/generate-supply-curve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: date,
          hour: hour,
          minute: minute,
          scenario: scenario
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate chart');
      }

      // Force iframe reload with timestamp to bypass cache
      const iframe = document.getElementById('plotly-chart-iframe') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = `/supply_curve_plotly.html?t=${Date.now()}`;
      }
      
      console.log('✅ Chart regenerated successfully');
      
    } catch (error) {
      console.error('❌ Error regenerating chart:', error);
      setChartError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setChartLoading(false);
    }
  };

  // Handle apply button click
  const handleApply = async () => {
    setAppliedDate(selectedDate);
    setAppliedHour(selectedHour);
    setAppliedMinute(selectedMinute);
    setAppliedScenario(marketScenario);
    
    setLoading(true);
    await regenerateChart(selectedDate, selectedHour, selectedMinute, marketScenario);
    setLoading(false);
  };

  // Check if settings have changed
  const hasChanges = selectedDate !== appliedDate || selectedHour !== appliedHour || selectedMinute !== appliedMinute || marketScenario !== appliedScenario;

  const handleIframeLoad = () => {
    setChartLoading(false);
  };

  // Generate hour options
  const hourOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour24 = i.toString().padStart(2, '0');
    const hour12 = i === 0 ? '12 AM' : i === 12 ? '12 PM' : i < 12 ? `${i} AM` : `${i - 12} PM`;
    hourOptions.push(`${hour24} (${hour12})`);
  }

  // Generate minute options
  const minuteOptions = ['00', '15', '30', '45'];

  // Function to get full time display
  const getTimeDisplay = (hour: string, minute: string) => {
    const hourPart = hour.split(' ')[0];
    return `${hourPart}:${minute}`;
  };

  // CSV Export function (placeholder)
  const handleExportData = () => {
    console.log('Export functionality - would export the current chart data');
    // You can implement CSV export of the Python-processed data here
  };

  return (
    <div className="space-y-6">
      {/* Market Conditions & Analysis Tools */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Market Conditions & Analysis Tools</h2>
          <div className="flex items-center space-x-4">
            <select 
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              <option value="CSV">CSV</option>
            </select>
            <button 
              onClick={handleExportData}
              className="flex items-center px-4 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Data
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <svg className="w-4 h-4 inline mr-1 align-middle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            {invalidDateMessage && (
              <p className="mt-2 text-sm text-red-500">{invalidDateMessage}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <svg className="w-4 h-4 inline mr-1 align-middle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Select Hour
            </label>
            <select
              value={selectedHour}
              onChange={(e) => setSelectedHour(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              {hourOptions.map(hour => (
                <option key={hour} value={hour}>{hour}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <svg className="w-4 h-4 inline mr-1 align-middle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Select Minute
            </label>
            <select
              value={selectedMinute}
              onChange={(e) => setSelectedMinute(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              {minuteOptions.map(minute => (
                <option key={minute} value={minute}>{minute}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Market Scenario</label>
            <select
              value={marketScenario}
              onChange={(e) => setMarketScenario(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="Current Grid">Current Grid</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleApply}
              disabled={!hasChanges || loading}
              className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                hasChanges && !loading
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Generating...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.totalDemand.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Demand (MW)</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">${stats.clearingPrice}</div>
          <div className="text-sm text-gray-600">Clearing Price ($/MWh)</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.gridUtilization}%</div>
          <div className="text-sm text-gray-600">Grid Utilization</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.renewableMix}%</div>
          <div className="text-sm text-gray-600">Renewable Mix</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">${stats.avgGenCost}</div>
          <div className="text-sm text-gray-600">Avg Gen Cost</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.marginalUnit}</div>
          <div className="text-sm text-gray-600">Marginal Unit</div>
        </div>
      </div>

      {/* Main Chart and Analysis Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chart Section - Python Plotly */}
        <div className="lg:col-span-3 bg-gray-800 rounded-lg shadow-sm border border-gray-600 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Supply Curve - {appliedScenario}
              </h3>
            </div>
            <div className="text-sm text-gray-300">
              {appliedDate} at {getTimeDisplay(appliedHour, appliedMinute)}
            </div>
          </div>
          
          {chartLoading && (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mb-4"></div>
              <p className="text-white">Generating supply curve chart...</p>
              <p className="text-sm text-gray-300 mt-2">Processing ERCOT market data with Python Plotly</p>
            </div>
          )}
          
          {chartError && (
            <div className="mt-4 p-3 bg-red-900 border border-red-600 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-200">
                    <strong>Chart generation failed:</strong> {chartError}
                  </p>
                  <p className="text-xs text-red-300 mt-1">
                    Make sure Python and required packages are installed.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {!chartLoading && !chartError && (
            <div className="h-96 relative bg-gray-800">
              <iframe
                id="plotly-chart-iframe"
                src={`/supply_curve_plotly.html?t=${Date.now()}`}
                className="w-full h-full border-none rounded"
                onLoad={handleIframeLoad}
                title="Supply Curve Chart"
              />
            </div>
          )}

          {/* Data source indicator */}
          <div className="mt-2 text-xs text-gray-400 text-center">
            Supply: Python Plotly visualization • Data: {stats.totalDemand.toLocaleString()} MW demand • 2,589 generator segments
          </div>
        </div>

        {/* Market Analysis Panel */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Market Analysis
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Analysis at {stats.totalDemand.toLocaleString()} MW</span>
                </div>
                <div className="flex justify-between">
                  <span>Clearing Price:</span>
                  <span className="font-mono">${stats.clearingPrice}/MWh</span>
                </div>
                <div className="flex justify-between">
                  <span>Marginal Unit:</span>
                  <span className="font-mono">{stats.marginalUnit}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Dispatched Units</h4>
              <div className="space-y-1 text-xs">
                {Object.entries(stats.dispatchedUnits)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([type, capacity]) => (
                  <div key={type} className="flex justify-between">
                    <span>{type}:</span>
                    <span className="font-mono">{Math.round(capacity as number).toLocaleString()}MW</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Market Conditions</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Load Factor:</span>
                  <span className="font-mono">{stats.gridUtilization}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Reserve Margin:</span>
                  <span className="font-mono">{stats.reserveMargin}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Renewable Gen:</span>
                  <span className="font-mono">{stats.renewableMix}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlotlySupplyCurveDashboard; 