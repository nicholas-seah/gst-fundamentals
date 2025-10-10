import React, { useState, useEffect } from 'react';

interface HeatRateFuturesData {
  success: boolean;
  data?: {
    tableData: Array<{
      market: string;
      [year: string]: number | string | null;
      tenYearStrip: number | null;
      twentyFiveYearStrip: number | null;
      totalStrip: number | null;
    }>;
    years: number[];
    markets: string[];
    peakHour: string;
  };
  metadata?: {
    powerDataPoints: number;
    gasDataPoints: number;
    latestCurveDate: string | null;
    updateTimeUTC: string | null;
    units: string;
    dateRange: string;
    powerSource: string;
    gasSource: string;
    peakHour: string;
    hubMapping: { [key: string]: string };
  };
  message?: string;
  error?: string;
  requiresConfiguration?: boolean;
}

interface Props {
  contractTerm: 'Calendar' | 'Month';
}

const HeatRateFuturesTable: React.FC<Props> = ({ contractTerm }) => {
  const [data, setData] = useState<HeatRateFuturesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeakHour, setSelectedPeakHour] = useState<'ON_PEAK' | '1800-2200' | 'ATC'>('ON_PEAK'); // Default to ON_PEAK (0700-2200)
  const [showDetails, setShowDetails] = useState(false);

  const fetchData = async (peakHour: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/heat-rate-futures?peakHour=${peakHour}&contractTerm=${contractTerm}`);
      const result: HeatRateFuturesData = await response.json();
      
      if (result.success) {
        setData(result);
        setError(null);
      } else {
        setError('Failed to load Heat Rate futures data');
      }
    } catch (err) {
      setError('Error fetching Heat Rate futures data');
      console.error('Error fetching Heat Rate futures data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedPeakHour);
  }, [selectedPeakHour, contractTerm]);

  const handlePeakHourChange = (peakHour: 'ON_PEAK' | '1800-2200' | 'ATC') => {
    setSelectedPeakHour(peakHour);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
          <div className="text-gray-500">Loading Heat Rate futures data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  const formatHeatRate = (rate: number | string | null): string => {
    if (rate === null || rate === undefined) return '—';
    if (typeof rate === 'string') return rate;
    return rate.toFixed(2);
  };

  // Helper function to check if a year/month-year represents January (start of year)
  const isJanuary = (yearOrMonthYear: string | number): boolean => {
    if (contractTerm === 'Month') {
      // For month contracts, check if it starts with "Jan"
      return typeof yearOrMonthYear === 'string' && yearOrMonthYear.startsWith('Jan ');
    }
    return false; // Calendar contracts don't need January highlighting
  };

  return (
    <div className="space-y-4">
      {/* Table Header Info */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Heat Rate Futures</h3>
          <p className="text-sm text-gray-600">
            Forward curve heat rates in MMBtu / MWh
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Peak Hour Toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Peak Hour:</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handlePeakHourChange('ON_PEAK')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  selectedPeakHour === 'ON_PEAK' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                0700-2200
              </button>
              <button
                onClick={() => handlePeakHourChange('1800-2200')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  selectedPeakHour === '1800-2200' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                1800-2200
              </button>
              <button
                onClick={() => handlePeakHourChange('ATC')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  selectedPeakHour === 'ATC' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ATC
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Heat Rate Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-700 sticky left-0 bg-gray-50">Settlement Point</th>
              {data.data?.years.map(year => (
                <th 
                  key={year} 
                  className={`text-center p-3 font-medium min-w-[80px] ${
                    isJanuary(year) 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700'
                  }`}
                >
                  {year}
                </th>
              ))}
              {contractTerm === 'Calendar' && (
                <>
                  <th className="text-center p-3 font-medium text-gray-700 min-w-[100px] bg-blue-50">
                    10-Year Strip
                  </th>
                  <th className="text-center p-3 font-medium text-gray-700 min-w-[100px] bg-green-50">
                    25-Year Strip
                  </th>
                  <th className="text-center p-3 font-medium text-gray-700 min-w-[100px] bg-purple-50">
                    Total Strip
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="font-mono">
            {data.data?.tableData.map((row, index) => (
              <tr 
                key={row.market} 
                className={`${index < (data.data?.tableData.length || 0) - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50`}
              >
                <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white hover:bg-gray-50">
                  {row.market}
                </td>
                {data.data?.years.map(year => (
                  <td 
                    key={year} 
                    className={`p-3 text-center ${
                      isJanuary(year) 
                        ? 'bg-blue-50 text-blue-800 font-semibold' 
                        : 'text-gray-800'
                    }`}
                  >
                    {formatHeatRate(row[year.toString()])}
                  </td>
                ))}
                {contractTerm === 'Calendar' && (
                  <>
                    <td className="p-3 text-center font-semibold text-blue-700 bg-blue-50">
                      {formatHeatRate(row.tenYearStrip)}
                    </td>
                    <td className="p-3 text-center font-semibold text-green-700 bg-green-50">
                      {formatHeatRate(row.twentyFiveYearStrip)}
                    </td>
                    <td className="p-3 text-center font-semibold text-purple-700 bg-purple-50">
                      {formatHeatRate(row.totalStrip)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Source text at bottom right - outside scrollable area */}
      <div className="text-right mt-2 space-y-1">
        <div className="text-xs text-gray-400">
          Source: OTCGH {data.metadata?.latestCurveDate || 'N/A'}
        </div>
        <div className="text-xs text-gray-400">
          Updated: {data.metadata?.updateTimeUTC || 'N/A'} (UTC)
        </div>
      </div>

      {/* More Details Dropdown */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg 
            className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          More Details
        </button>
        
        {showDetails && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="font-medium text-blue-900 mb-2 text-sm">Heat Rate Definitions</h4>
            <div className="grid grid-cols-1 gap-2 text-xs text-blue-800">
              <div><strong>Houston:</strong> Houston Hub / Houston Ship Channel</div>
              <div><strong>ERCOT West:</strong> West Texas Hub / El Paso</div>
              <div><strong>ERCOT South:</strong> South Hub / Katy</div>
              <div><strong>ERCOT North:</strong> North Hub / Waha</div>
              <div><strong>SP 15:</strong> SP 15 / SoCal Citygate</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default HeatRateFuturesTable;
