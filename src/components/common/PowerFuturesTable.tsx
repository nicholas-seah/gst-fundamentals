import React, { useState, useEffect } from 'react';

interface PowerFuturesData {
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
    rawDataPoints: number;
    latestCurveDate: string | null;
    updateTimeUTC: string | null;
    units: string;
    dateRange: string;
    dataSource: string;
    peakHour: string;
  };
  message?: string;
  error?: string;
  requiresConfiguration?: boolean;
}

interface Props {
  contractTerm: 'Calendar' | 'Month';
}

const PowerFuturesTable: React.FC<Props> = ({ contractTerm }) => {
  const [data, setData] = useState<PowerFuturesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeakHour, setSelectedPeakHour] = useState<'ON_PEAK' | '1800-2200' | 'ATC'>('ON_PEAK'); // Default to ON_PEAK (maps to 0700-2200)

  const fetchData = async (peakHour: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/power-futures?peakHour=${peakHour}&contractTerm=${contractTerm}`);
      const result: PowerFuturesData = await response.json();
      
      if (result.success) {
        setData(result);
        setError(null);
      } else {
        setError('Failed to load Power futures data');
      }
    } catch (err) {
      setError('Error fetching Power futures data');
      console.error('Error fetching Power futures data:', err);
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
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-gray-500">Loading Power futures data...</div>
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

  const formatPrice = (price: number | string | null): string => {
    if (price === null || price === undefined) return '—';
    if (typeof price === 'string') return price;
    return price.toFixed(2);
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
          <h3 className="text-lg font-semibold text-gray-900">Power Futures</h3>
          <p className="text-sm text-gray-600">
            Mid forward curve prices in {data.metadata?.units}
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

      {/* Futures Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-700 sticky left-0 bg-gray-50">Settlement Point</th>
              {data.data.years.map(year => (
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
            {data.data.tableData.map((row, index) => (
              <tr 
                key={row.market} 
                className={`${index < data.data.tableData.length - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50`}
              >
                <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white hover:bg-gray-50">
                  {row.market}
                </td>
                {data.data.years.map(year => (
                  <td 
                    key={year} 
                    className={`p-3 text-center ${
                      isJanuary(year) 
                        ? 'bg-blue-50 text-blue-800 font-semibold' 
                        : 'text-gray-800'
                    }`}
                  >
                    {formatPrice(row[year.toString()])}
                  </td>
                ))}
                {contractTerm === 'Calendar' && (
                  <>
                    <td className="p-3 text-center font-semibold text-blue-700 bg-blue-50">
                      {formatPrice(row.tenYearStrip)}
                    </td>
                    <td className="p-3 text-center font-semibold text-green-700 bg-green-50">
                      {formatPrice(row.twentyFiveYearStrip)}
                    </td>
                    <td className="p-3 text-center font-semibold text-purple-700 bg-purple-50">
                      {formatPrice(row.totalStrip)}
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

    </div>
  );
};

export default PowerFuturesTable;
