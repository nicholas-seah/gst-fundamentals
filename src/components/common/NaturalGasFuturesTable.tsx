import React, { useState, useEffect } from 'react';

interface NaturalGasFuturesData {
  success: boolean;
  data?: {
    tableData: Array<{
      market: string;
      [year: string]: number | string | null;
      tenYearStrip: number | null;
    }>;
    years: number[];
    markets: string[];
  };
  metadata?: {
    rawDataPoints: number;
    latestCurveDate: string | null;
    units: string;
    dateRange: string;
    dataSource: string;
  };
  message?: string;
  error?: string;
  requiresConfiguration?: boolean;
}

interface Props {
  contractTerm: 'Calendar' | 'Month';
}

const NaturalGasFuturesTable: React.FC<Props> = ({ contractTerm }) => {
  const [data, setData] = useState<NaturalGasFuturesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/natural-gas-futures?contractTerm=${contractTerm}`);
        const result: NaturalGasFuturesData = await response.json();
        
        if (result.success) {
          setData(result);
          setError(null);
        } else {
          setError('Failed to load Natural Gas futures data');
        }
      } catch (err) {
        setError('Error fetching Natural Gas futures data');
        console.error('Error fetching Natural Gas futures data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contractTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-gray-500">Loading Natural Gas futures data...</div>
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

  return (
    <div className="space-y-4">
             {/* Table Header Info */}
       <div>
         <h3 className="text-lg font-semibold text-gray-900">Natural Gas Futures</h3>
         <p className="text-sm text-gray-600">
           Fixed price forward curve in {data.metadata.units}
         </p>
       </div>

      {/* Futures Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-700 sticky left-0 bg-gray-50">Settlement Point</th>
              {data.data.years.map(year => (
                <th key={year} className="text-center p-3 font-medium text-gray-700 min-w-[80px]">
                  {year}
                </th>
              ))}
                             {contractTerm === 'Calendar' && (
                 <th className="text-center p-3 font-medium text-gray-700 min-w-[100px] bg-blue-50">
                   10-Year Strip
                 </th>
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
                  <td key={year} className="p-3 text-center text-gray-800">
                    {formatPrice(row[year.toString()])}
                  </td>
                ))}
                                 {contractTerm === 'Calendar' && (
                   <td className="p-3 text-center font-semibold text-blue-700 bg-blue-50">
                     {formatPrice(row.tenYearStrip)}
                   </td>
                 )}
              </tr>
            ))}
          </tbody>
                 </table>
       </div>
       
       {/* Source text at bottom right - outside scrollable area */}
       <div className="text-right mt-2">
         <div className="text-xs text-gray-400">
           Source: OTCGH {data.metadata.latestCurveDate || 'N/A'}
         </div>
       </div>

     </div>
  );
};

export default NaturalGasFuturesTable;
