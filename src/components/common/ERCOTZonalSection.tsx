import React, { useState, useEffect } from 'react';
import YoYDemandChart from './YoYDemandChart';
import observationsData from '../../Key Insights/bullet-points.json';

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

const ERCOTZonalSection: React.FC = () => {
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
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-gray-500">Loading ERCOT zonal data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart and Observations Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chart Area */}
        <div className="lg:col-span-3">
          <YoYDemandChart data={chartData?.data || { labels: [], datasets: [] }} />
        </div>

        {/* Key Observations */}
        <div className="lg:col-span-1">
          <div className="bg-gray-100 rounded-lg p-4 h-96">
            <h4 className="text-sm font-semibold text-gs-dark mb-3">Key Observations</h4>
            <ul className="space-y-3 text-xs text-gray-600">
              {observationsData.zonalDemand.map((observation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{observation}</span>
                </li>
              ))}
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

export default ERCOTZonalSection; 