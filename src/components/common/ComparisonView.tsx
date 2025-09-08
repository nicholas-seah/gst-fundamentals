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
import CurveDateCalendar from './CurveDateCalendar';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface CurveData {
  success: boolean;
  data?: {
    tableData: Array<{
      market: string;
      [year: string]: number | string | null;
      tenYearStrip: number | null;
    }>;
    years: number[];
    markets: string[];
    peakHour?: string;
  };
  metadata?: {
    latestCurveDate: string | null;
    units: string;
    dateRange: string;
    dataSource: string;
    peakHour?: string;
  };
  message?: string;
  error?: string;
}

interface AvailableDatesData {
  success: boolean;
  data: {
    dates: string[];
    count: number;
  };
}

interface Props {
  contractTerm: 'Calendar' | 'Month';
}

interface SelectedCurve {
  id: string;
  date: string;
  curveType: 'gas' | 'power' | 'heat';
  peakHour: 'ON_PEAK' | '1800-2200' | 'ATC';
  hub: string;
  data: CurveData | null;
  loading: boolean;
}

const ComparisonView: React.FC<Props> = ({ contractTerm }) => {
  // Available dates
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  
  // Curve selection controls
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCurveType, setSelectedCurveType] = useState<'gas' | 'power' | 'heat'>('gas');
  const [selectedPeakHour, setSelectedPeakHour] = useState<'ON_PEAK' | '1800-2200' | 'ATC'>('ON_PEAK');
  const [selectedHub, setSelectedHub] = useState<string>('');
  
  // Multiple curves management
  const [selectedCurves, setSelectedCurves] = useState<SelectedCurve[]>([]);

  // Chart visibility controls
  const [visibleHubs, setVisibleHubs] = useState<{ [hub: string]: boolean }>({});

  // Fetch available dates on mount and when contract term changes
  useEffect(() => {
    const fetchAvailableDates = async () => {
      try {
        const response = await fetch(`/api/curve-dates?contractTerm=${contractTerm}`);
        const result: AvailableDatesData = await response.json();
        
        if (result.success) {
          setAvailableDates(result.data.dates);
          // Set default baseline date to today's gas price (most recent date)
          if (result.data.dates.length > 0) {
            setBaselineDate(result.data.dates[0]); // Most recent date
          }
        }
      } catch (err) {
        console.error('Error fetching available dates:', err);
      }
    };

    fetchAvailableDates();
    
    // Reset state when contract term changes
    setSelectedDate('');
    setSelectedCurves([]);
  }, [contractTerm]);

  // Add curve to the chart
  const handleAddCurve = async () => {
    if (!selectedDate || !selectedCurveType || !selectedHub) return;
    
    // Check if this exact curve already exists
    const curveId = `${selectedDate}-${selectedCurveType}-${selectedHub}-${selectedPeakHour}`;
    const existingCurve = selectedCurves.find(curve => curve.id === curveId);
    if (existingCurve) {
      alert('This curve is already added to the chart');
      return;
    }
    
    // Create new curve entry
    const newCurve: SelectedCurve = {
      id: curveId,
      date: selectedDate,
      curveType: selectedCurveType,
      peakHour: selectedPeakHour,
      hub: selectedHub,
      data: null,
      loading: true
    };
    
    // Add to curves list
    setSelectedCurves(prev => [...prev, newCurve]);
    
    // Fetch data for this curve
    try {
      const endpoint = getApiEndpoint(selectedCurveType, selectedDate, selectedPeakHour);
      const response = await fetch(endpoint);
      const result: CurveData = await response.json();
      
      // Update the curve with fetched data
      setSelectedCurves(prev => 
        prev.map(curve => 
          curve.id === curveId 
            ? { ...curve, data: result.success ? result : null, loading: false }
            : curve
        )
      );
      
    } catch (err) {
      console.error('Error fetching curve data:', err);
      // Update curve to show error state
      setSelectedCurves(prev => 
        prev.map(curve => 
          curve.id === curveId 
            ? { ...curve, data: null, loading: false }
            : curve
        )
      );
    }
  };

  // Remove curve from chart
  const handleRemoveCurve = (curveId: string) => {
    setSelectedCurves(prev => prev.filter(curve => curve.id !== curveId));
  };

  // Remove all curves from chart
  const handleRemoveAllCurves = () => {
    setSelectedCurves([]);
  };

  // Format date for display in selected curves
  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getApiEndpoint = (curveType: string, date: string, peakHour?: string) => {
    const peakParam = (curveType === 'power' || curveType === 'heat') ? `&peakHour=${peakHour}` : '';
    const contractParam = `&contractTerm=${contractTerm}`;
    
    switch (curveType) {
      case 'gas':
        return `/api/natural-gas-futures?date=${date}${contractParam}`;
      case 'power':
        return `/api/power-futures?date=${date}${peakParam}${contractParam}`;
      case 'heat':
        return `/api/heat-rate-futures?date=${date}${peakParam}${contractParam}`;
      default:
        return '';
    }
  };

  const fetchBaselineData = async () => {
    try {
      setBaselineLoading(true);
      const endpoint = getApiEndpoint(baselineCurveType, baselineDate, baselinePeakHour);
      const response = await fetch(endpoint);
      const result: CurveData = await response.json();
      
      if (result.success) {
        setBaselineData(result);
      } else {
        console.error('Failed to load baseline data');
        setBaselineData(null);
      }
    } catch (err) {
      console.error('Error fetching baseline data:', err);
      setBaselineData(null);
    } finally {
      setBaselineLoading(false);
    }
  };

  const fetchComparisonData = async () => {
    try {
      setComparisonLoading(true);
      const endpoint = getApiEndpoint(baselineCurveType, comparisonDate, baselinePeakHour);
      const response = await fetch(endpoint);
      const result: CurveData = await response.json();
      
      if (result.success) {
        setComparisonData(result);
      } else {
        console.error('Failed to load comparison data');
        setComparisonData(null);
      }
    } catch (err) {
      console.error('Error fetching comparison data:', err);
      setComparisonData(null);
    } finally {
      setComparisonLoading(false);
    }
  };

  const formatPrice = (price: number | string | null): string => {
    if (price === null || price === undefined) return '—';
    if (typeof price === 'string') return price;
    
    // Format based on curve type
    if (baselineCurveType === 'gas') {
      return price.toFixed(2); // Natural gas: 2 decimals
    } else if (baselineCurveType === 'power') {
      return price.toFixed(2); // Power: 2 decimals
    } else {
      return price.toFixed(2); // Heat rate: 2 decimals
    }
  };

  const getCurveTypeLabel = (curveType: string) => {
    switch (curveType) {
      case 'gas': return 'Natural Gas Futures';
      case 'power': return 'Power Futures';
      case 'heat': return 'Heat Rate Futures';
      default: return 'Futures';
    }
  };

  const getCurveTypeUnits = (curveType: string) => {
    switch (curveType) {
      case 'gas': return '$/MMBtu';
      case 'power': return '$/MWh';
      case 'heat': return 'MMBtu/MWh';
      default: return '';
    }
  };

  const getHubColor = (hub: string) => {
    const hubColors = {
      'HSC': '#3B82F6',           // Blue
      'Katy': '#10B981',          // Green  
      'Waha': '#F59E0B',          // Orange
      'Henry': '#EF4444',         // Red
      'El Paso': '#8B5CF6',       // Purple
      'SoCal City': '#06B6D4',    // Cyan
      'Houston': '#3B82F6',       // Blue
      'ERCOT South': '#10B981',   // Green
      'ERCOT North': '#F59E0B',   // Orange
      'ERCOT West': '#8B5CF6',    // Purple
      'SP 15': '#06B6D4'          // Cyan
    };
    return hubColors[hub] || '#6B7280';
  };

  const getCurveColor = (curve: SelectedCurve) => {
    // Generate distinct color for each curve
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#84CC16'];
    const index = selectedCurves.findIndex(c => c.id === curve.id);
    return colors[index % colors.length];
  };

  const getHubOptions = (curveType: 'gas' | 'power' | 'heat') => {
    if (curveType === 'gas') {
      return [
        { value: 'HSC', label: 'HSC' },
        { value: 'Katy', label: 'Katy' },
        { value: 'Waha', label: 'Waha' },
        { value: 'Henry', label: 'Henry' },
        { value: 'El Paso', label: 'El Paso' },
        { value: 'SoCal City', label: 'SoCal City' },
      ];
    } else {
      // Power and Heat Rate use the same hubs
      return [
        { value: 'Houston', label: 'Houston' },
        { value: 'ERCOT South', label: 'ERCOT South' },
        { value: 'ERCOT North', label: 'ERCOT North' },
        { value: 'ERCOT West', label: 'ERCOT West' },
        { value: 'SP 15', label: 'SP 15' },
      ];
    }
  };

  const renderMultiCurveChart = () => {
    if (selectedCurves.length === 0) return null;

    // Get all curves with data
    const curvesWithData = selectedCurves.filter(curve => curve.data?.data);
    if (curvesWithData.length === 0) return null;

    // Use the first curve to determine years structure
    const firstCurve = curvesWithData[0];
    const years = firstCurve.data?.data?.years || [];
    
    const datasets = [];

    // Add datasets for each selected curve (only the selected hub)
    curvesWithData.forEach((curve, curveIndex) => {
      if (!curve.data?.data?.tableData) return;

      // Find the specific hub row for this curve
      const hubRow = curve.data.data.tableData.find(row => row.market === curve.hub);
      if (!hubRow) return;

      const data = years.map(year => {
        const price = hubRow[year.toString()];
        return typeof price === 'number' ? price : null;
      });

      // Create unique line for this specific curve with distinct color
      const curveColor = getCurveColor(curve);

      datasets.push({
        label: `${curve.hub} (${formatDateForDisplay(curve.date)})`,
        data: data,
        borderColor: curveColor,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [], // All solid lines
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      });
    });

    const chartData = {
      labels: years,
      datasets: datasets
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // We have our own hub toggles
        },
        title: {
          display: false,
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleFont: {
            family: 'Inter, sans-serif',
            size: 12,
          },
          bodyFont: {
            family: 'JetBrains Mono, monospace',
            size: 11,
          },
          itemSort: function(a: any, b: any) {
            // Sort tooltip items by hub name alphabetically
            const aHub = a.dataset.label.split(' (')[0];
            const bHub = b.dataset.label.split(' (')[0];
            return aHub.localeCompare(bHub);
          },
          callbacks: {
            label: function(context: any) {
              const value = context.parsed.y;
              if (value === null) return undefined;
              const curveType = curvesWithData[0]?.curveType || 'gas';
              return `${context.dataset.label}: $${value.toFixed(2)}`;
            }
          }
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: contractTerm === 'Calendar' ? 'Year' : 'Month',
            font: {
              family: 'Inter, sans-serif',
              size: 12,
              weight: 500,
            },
          },
          grid: {
            color: '#E5E7EB',
          },
          ticks: {
            maxRotation: contractTerm === 'Month' ? 45 : 0, // Rotate labels for Month contracts
          },
        },
        y: {
          title: {
            display: true,
            text: `Price (${curvesWithData.length > 0 ? getCurveTypeUnits(curvesWithData[0].curveType) : ''})`,
            font: {
              family: 'Inter, sans-serif',
              size: 12,
              weight: 500,
            },
          },
          grid: {
            color: '#E5E7EB',
          },
          ticks: {
            callback: function(value: any) {
              return '$' + Number(value).toFixed(2);
            },
            font: {
              family: 'JetBrains Mono, monospace',
              size: 11,
            },
          },
        },
      },
      elements: {
        point: {
          borderWidth: 0,
        },
      },
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
    };

    return <Line data={chartData} options={options} />;
  };

  const renderPercentageChangeTable = () => {
    if (!baselineData?.data || !comparisonData?.data) return null;

    // Calculate percentage changes
    const changeData = baselineData.data.tableData.map(baselineRow => {
      const comparisonRow = comparisonData.data?.tableData.find(row => row.market === baselineRow.market);
      if (!comparisonRow) return null;

      const changeRow: { [key: string]: number | string | null } = {
        market: baselineRow.market
      };

      // Calculate change for each year
      baselineData.data?.years.forEach(year => {
        const baselinePrice = baselineRow[year.toString()];
        const comparisonPrice = comparisonRow[year.toString()];
        
        if (baselinePrice && comparisonPrice && 
            typeof baselinePrice === 'number' && typeof comparisonPrice === 'number' &&
            comparisonPrice !== 0) {
          const percentChange = ((baselinePrice - comparisonPrice) / comparisonPrice) * 100;
          changeRow[year.toString()] = percentChange;
          
          // Debug logging for first few calculations
          if (year <= 2026 && baselineRow.market === 'HSC') {
            console.log(`${baselineRow.market} ${year}: Baseline=${baselinePrice}, Comparison=${comparisonPrice}, Change=${percentChange.toFixed(2)}%`);
          }
        } else {
          changeRow[year.toString()] = null;
        }
      });

      // Calculate change for 10-year strip
      const baselineStrip = baselineRow.tenYearStrip;
      const comparisonStrip = comparisonRow.tenYearStrip;
      
      if (baselineStrip && comparisonStrip && 
          typeof baselineStrip === 'number' && typeof comparisonStrip === 'number' &&
          comparisonStrip !== 0) {
        const stripChange = ((baselineStrip - comparisonStrip) / comparisonStrip) * 100;
        changeRow.tenYearStrip = stripChange;
      } else {
        changeRow.tenYearStrip = null;
      }

      return changeRow;
    }).filter(row => row !== null);

    const formatPercentChange = (change: number | string | null): string => {
      if (change === null || change === undefined) return '—';
      if (typeof change === 'string') return change;
      
      const formatted = change.toFixed(1);
      return change > 0 ? `+${formatted}%` : `${formatted}%`;
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border-2 border-green-300 p-6">
        <div className="space-y-4">
          {/* Table Header */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Percentage Change</h3>
            <p className="text-sm text-gray-600">
              Change from {comparisonDate} to {baselineDate} • Positive values indicate price increases
            </p>
          </div>

          {/* Percentage Change Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-700 sticky left-0 bg-gray-50">Hub</th>
                  {baselineData.data?.years.map(year => (
                    <th key={year} className="text-center p-3 font-medium text-gray-700 min-w-[80px]">
                      {year}
                    </th>
                  ))}
                  {contractTerm === 'Calendar' && (
                    <th className="text-center p-3 font-medium text-gray-700 min-w-[100px] bg-green-50">
                      10-Year Strip
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="font-mono">
                {changeData.map((row, index) => (
                  <tr 
                    key={row?.market} 
                    className={`${index < changeData.length - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50`}
                  >
                    <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white hover:bg-gray-50">
                      {row?.market}
                    </td>
                    {baselineData.data?.years.map(year => {
                      const change = row?.[year.toString()];
                      const changeValue = typeof change === 'number' ? change : null;
                      return (
                        <td 
                          key={year} 
                          className={`p-3 text-center ${
                            changeValue === null ? 'text-gray-400' :
                            changeValue > 0 ? 'text-green-600' : 
                            changeValue < 0 ? 'text-red-600' : 'text-gray-800'
                          }`}
                        >
                          {formatPercentChange(change)}
                        </td>
                      );
                    })}
                    {contractTerm === 'Calendar' && (
                      <td className={`p-3 text-center font-semibold bg-green-50 ${
                        typeof row?.tenYearStrip === 'number' ? (
                          row.tenYearStrip > 0 ? 'text-green-700' : 
                          row.tenYearStrip < 0 ? 'text-red-700' : 'text-gray-700'
                        ) : 'text-gray-400'
                      }`}>
                        {formatPercentChange(row?.tenYearStrip)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          

        </div>
      </div>
    );
  };

  const renderPriceChangeTable = () => {
    if (!baselineData?.data || !comparisonData?.data) return null;

    // Calculate price differences
    const priceChangeData = baselineData.data.tableData.map(baselineRow => {
      const comparisonRow = comparisonData.data?.tableData.find(row => row.market === baselineRow.market);
      if (!comparisonRow) return null;

      const changeRow: { [key: string]: number | string | null } = {
        market: baselineRow.market
      };

      // Calculate price difference for each year
      baselineData.data?.years.forEach(year => {
        const baselinePrice = baselineRow[year.toString()];
        const comparisonPrice = comparisonRow[year.toString()];
        
        if (baselinePrice && comparisonPrice && 
            typeof baselinePrice === 'number' && typeof comparisonPrice === 'number') {
          const priceDiff = baselinePrice - comparisonPrice;
          changeRow[year.toString()] = priceDiff;
        } else {
          changeRow[year.toString()] = null;
        }
      });

      // Calculate price difference for 10-year strip
      const baselineStrip = baselineRow.tenYearStrip;
      const comparisonStrip = comparisonRow.tenYearStrip;
      
      if (baselineStrip && comparisonStrip && 
          typeof baselineStrip === 'number' && typeof comparisonStrip === 'number') {
        const stripDiff = baselineStrip - comparisonStrip;
        changeRow.tenYearStrip = stripDiff;
      } else {
        changeRow.tenYearStrip = null;
      }

      return changeRow;
    }).filter(row => row !== null);

    const formatPriceChange = (change: number | string | null): string => {
      if (change === null || change === undefined) return '—';
      if (typeof change === 'string') return change;
      
      const formatted = change.toFixed(2);
      return change > 0 ? `+${formatted}` : formatted;
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border-2 border-purple-300 p-6">
        <div className="space-y-4">
          {/* Table Header */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Price Change</h3>
            <p className="text-sm text-gray-600">
              Price difference from {comparisonDate} to {baselineDate} in {getCurveTypeUnits(baselineCurveType)}
            </p>
          </div>

          {/* Price Change Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-700 sticky left-0 bg-gray-50">Hub</th>
                  {baselineData.data?.years.map(year => (
                    <th key={year} className="text-center p-3 font-medium text-gray-700 min-w-[80px]">
                      {year}
                    </th>
                  ))}
                  {contractTerm === 'Calendar' && (
                    <th className="text-center p-3 font-medium text-gray-700 min-w-[100px] bg-purple-50">
                      10-Year Strip
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="font-mono">
                {priceChangeData.map((row, index) => (
                  <tr 
                    key={row?.market} 
                    className={`${index < priceChangeData.length - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50`}
                  >
                    <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white hover:bg-gray-50">
                      {row?.market}
                    </td>
                    {baselineData.data?.years.map(year => {
                      const change = row?.[year.toString()];
                      const changeValue = typeof change === 'number' ? change : null;
                      return (
                        <td 
                          key={year} 
                          className={`p-3 text-center ${
                            changeValue === null ? 'text-gray-400' :
                            changeValue > 0 ? 'text-green-600' : 
                            changeValue < 0 ? 'text-red-600' : 'text-gray-800'
                          }`}
                        >
                          {formatPriceChange(change)}
                        </td>
                      );
                    })}
                    {contractTerm === 'Calendar' && (
                      <td className={`p-3 text-center font-semibold bg-purple-50 ${
                        typeof row?.tenYearStrip === 'number' ? (
                          row.tenYearStrip > 0 ? 'text-green-700' : 
                          row.tenYearStrip < 0 ? 'text-red-700' : 'text-gray-700'
                        ) : 'text-gray-400'
                      }`}>
                        {formatPriceChange(row?.tenYearStrip)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Initialize hub visibility when first curve is added
  useEffect(() => {
    if (selectedCurves.length > 0 && selectedCurves[0].data?.data?.tableData && Object.keys(visibleHubs).length === 0) {
      const initialVisibility: { [hub: string]: boolean } = {};
      selectedCurves[0].data.data.tableData.forEach(row => {
        initialVisibility[row.market] = true; // All hubs visible by default
      });
      setVisibleHubs(initialVisibility);
    }
  }, [selectedCurves]);

  const toggleHubVisibility = (hub: string) => {
    setVisibleHubs(prev => ({
      ...prev,
      [hub]: !prev[hub]
    }));
  };

  const renderLineChart = () => {
    if (!baselineData?.data || !comparisonData?.data) return null;

    const hubColors = {
      'HSC': '#3B82F6',           // Blue
      'Katy': '#10B981',          // Green  
      'Waha': '#F59E0B',          // Orange
      'Henry': '#EF4444',         // Red
      'El Paso': '#8B5CF6',       // Purple
      'SoCal City': '#06B6D4',    // Cyan
      'Houston': '#3B82F6',       // Blue
      'ERCOT South': '#10B981',   // Green
      'ERCOT North': '#F59E0B',   // Orange
      'ERCOT West': '#8B5CF6',    // Purple
      'SP 15': '#06B6D4'          // Cyan
    };

    const years = baselineData.data.years;
    const datasets = [];

    // Add baseline datasets (solid lines)
    baselineData.data.tableData.forEach(row => {
      if (!visibleHubs[row.market]) return;

      const data = years.map(year => {
        const price = row[year.toString()];
        return typeof price === 'number' ? price : null;
      });

      datasets.push({
        label: `${row.market} (${baselineDate})`,
        data: data,
        borderColor: hubColors[row.market] || '#6B7280',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [], // Solid line
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      });
    });

    // Add comparison datasets (dashed lines)
    comparisonData.data.tableData.forEach(row => {
      if (!visibleHubs[row.market]) return;

      const data = years.map(year => {
        const price = row[year.toString()];
        return typeof price === 'number' ? price : null;
      });

      datasets.push({
        label: `${row.market} (${comparisonDate})`,
        data: data,
        borderColor: hubColors[row.market] || '#6B7280',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5], // Dashed line
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      });
    });

    const chartData = {
      labels: years,
      datasets: datasets
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // Remove the legend
        },
        title: {
          display: true,
          text: `${getCurveTypeLabel(baselineCurveType)} Comparison Chart`,
          font: {
            family: 'Inter, sans-serif',
            size: 14,
            weight: 600,
          },
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleFont: {
            family: 'Inter, sans-serif',
            size: 12,
          },
          bodyFont: {
            family: 'JetBrains Mono, monospace',
            size: 11,
          },
          itemSort: function(a: any, b: any) {
            // Sort tooltip items by hub name alphabetically
            const aHub = a.dataset.label.split(' (')[0]; // Extract hub name before date
            const bHub = b.dataset.label.split(' (')[0];
            return aHub.localeCompare(bHub);
          },
          callbacks: {
            label: function(context: any) {
              const value = context.parsed.y;
              if (value === null) return undefined;
              return `${context.dataset.label}: $${value.toFixed(2)}`;
            }
          }
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Year',
            font: {
              family: 'Inter, sans-serif',
              size: 12,
              weight: 500,
            },
          },
          grid: {
            color: '#E5E7EB',
          },
        },
        y: {
          title: {
            display: true,
            text: `Price (${getCurveTypeUnits(baselineCurveType)})`,
            font: {
              family: 'Inter, sans-serif',
              size: 12,
              weight: 500,
            },
          },
          grid: {
            color: '#E5E7EB',
          },
          ticks: {
            callback: function(value: any) {
              return '$' + Number(value).toFixed(2);
            },
            font: {
              family: 'JetBrains Mono, monospace',
              size: 11,
            },
          },
        },
      },
      elements: {
        point: {
          borderWidth: 0,
        },
      },
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-300 p-6">
        <div className="space-y-4">
          {/* Chart Header with Hub Toggles */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Curve Comparison Chart</h3>
              <p className="text-sm text-gray-600">
                Solid lines: {baselineDate} • Dashed lines: {comparisonDate}
              </p>
            </div>
            
            {/* Hub Visibility Toggles */}
            <div className="flex flex-wrap gap-2">
              {baselineData.data.tableData.map(row => (
                <button
                  key={row.market}
                  onClick={() => toggleHubVisibility(row.market)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                    visibleHubs[row.market]
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-500 border border-gray-300'
                  }`}
                >
                  <div 
                    className="w-3 h-0.5 rounded"
                    style={{ backgroundColor: hubColors[row.market] || '#6B7280' }}
                  />
                  {row.market}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="h-96">
            <Line data={chartData} options={options} />
          </div>
        </div>
      </div>
    );
  };

  const renderTable = (data: CurveData | null, loading: boolean, title: string, borderColor: string) => (
    <div className={`bg-white rounded-lg shadow-sm border-2 ${borderColor} p-6`}>
      <div className="space-y-4">
        {/* Table Header */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">
              Forward curve prices in {getCurveTypeUnits(baselineCurveType)}
              {(baselineCurveType === 'power' || baselineCurveType === 'heat') && 
                ` • Peak: ${baselinePeakHour === 'ON_PEAK' ? '0700-2200' : '1800-2200'}`
              }
            </p>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
              <div className="text-sm text-gray-500">Loading...</div>
            </div>
          </div>
        ) : data && data.success ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-700 sticky left-0 bg-gray-50">Hub</th>
                    {data.data?.years.map(year => (
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
                  {data.data?.tableData.map((row, index) => (
                    <tr 
                      key={row.market} 
                      className={`${index < (data.data?.tableData.length || 0) - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50`}
                    >
                      <td className="p-3 font-semibold text-gray-900 sticky left-0 bg-white hover:bg-gray-50">
                        {row.market}
                      </td>
                      {data.data?.years.map(year => (
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
          </>
        ) : (
          <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
            <div className="text-gray-500">No data available</div>
          </div>
        )}
        
        {/* Source text at bottom right - outside scrollable area */}
        {data && data.success && (
          <div className="text-right mt-2">
            <div className="text-xs text-gray-400">
              Source: OTCGH {data.metadata?.latestCurveDate || 'N/A'}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const isDateAvailable = (dateStr: string) => {
    return availableDates.includes(dateStr);
  };

  const handleQuickComparison = (daysAgo: number) => {
    if (!baselineDate) return;
    
    // Calculate target date
    const baseDate = new Date(baselineDate);
    let targetDate = new Date(baseDate);
    
    console.log(`Quick comparison from baseline: ${baselineDate}`);
    
    if (daysAgo === 30) {
      // For 1 month ago, subtract exactly 1 month to get same day of previous month
      targetDate.setMonth(targetDate.getMonth() - 1);
      console.log(`Target date for 1 month ago: ${targetDate.toISOString().split('T')[0]}`);
    } else if (daysAgo === 90) {
      // For 3 months ago, subtract exactly 3 months
      targetDate.setMonth(targetDate.getMonth() - 3);
      console.log(`Target date for 3 months ago: ${targetDate.toISOString().split('T')[0]}`);
    } else {
      // For 1 week ago, subtract 7 days
      targetDate.setDate(targetDate.getDate() - daysAgo);
      console.log(`Target date for ${daysAgo} days ago: ${targetDate.toISOString().split('T')[0]}`);
    }
    
    // Find the closest available date to the target date
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    // Look for exact match first
    if (availableDates.includes(targetDateStr)) {
      console.log(`Found exact match: ${targetDateStr}`);
      setComparisonDate(targetDateStr);
      return;
    }
    
    console.log(`No exact match for ${targetDateStr}, finding closest available date...`);
    
    // Find closest available date (within reasonable range)
    let closestDate = '';
    let closestDiff = Infinity;
    
    availableDates.forEach(date => {
      const dateObj = new Date(date);
      const diff = Math.abs(dateObj.getTime() - targetDate.getTime());
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      
      // Only consider dates within 7 days of target and earlier than baseline
      if (daysDiff <= 7 && dateObj < baseDate && diff < closestDiff) {
        closestDate = date;
        closestDiff = diff;
        console.log(`Candidate date: ${date}, days diff: ${daysDiff.toFixed(1)}`);
      }
    });
    
    if (closestDate) {
      console.log(`Selected closest date: ${closestDate}`);
      setComparisonDate(closestDate);
    } else {
      console.log('No close match found, using fallback...');
      // Fallback: find any date before baseline
      const earlierDates = availableDates.filter(date => new Date(date) < baseDate);
      if (earlierDates.length > 0) {
        console.log(`Fallback date: ${earlierDates[0]}`);
        setComparisonDate(earlierDates[0]); // Most recent date before baseline
      }
    }
  };



  return (
    <div className="space-y-6">
      {/* Curve Selection Controls */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Curve Selection</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Mark Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mark Date</label>
            <CurveDateCalendar
              selectedDate={selectedDate}
              availableDates={availableDates}
              onChange={setSelectedDate}
              disabled={false}
              placeholder="Select Date"
            />
          </div>

          {/* Curve Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Curve Type</label>
            <select
              value={selectedCurveType}
              onChange={(e) => setSelectedCurveType(e.target.value as 'gas' | 'power' | 'heat')}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-white"
            >
              <option value="gas">Natural Gas</option>
              <option value="power">Power</option>
              <option value="heat">Heat Rate</option>
            </select>
          </div>

          {/* Settlement Point */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Point</label>
            <select
              value={selectedHub}
              onChange={(e) => setSelectedHub(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-white"
            >
              <option value="">Select Settlement Point</option>
              {getHubOptions(selectedCurveType).map(hub => (
                <option key={hub.value} value={hub.value}>{hub.label}</option>
              ))}
            </select>
          </div>

          {/* Peak Hour (only for power/heat) */}
          {(selectedCurveType === 'power' || selectedCurveType === 'heat') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peak Hour</label>
              <select
                value={selectedPeakHour}
                onChange={(e) => setSelectedPeakHour(e.target.value as 'ON_PEAK' | '1800-2200' | 'ATC')}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-white"
              >
                <option value="ON_PEAK">0700-2200</option>
                <option value="1800-2200">1800-2200</option>
                <option value="ATC">ATC</option>
              </select>
            </div>
          )}

          {/* Add Curve Button */}
          <div className="flex items-end">
            <button
              onClick={handleAddCurve}
              disabled={!selectedDate || !selectedHub}
              className={`w-full px-4 py-2 text-sm font-medium rounded transition-colors ${
                (selectedDate && selectedHub) 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Add Curve
            </button>
          </div>
        </div>
      </div>

       {/* Line Chart - Main Feature */}
       <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-300 p-6">
         <div className="space-y-4">
           {/* Chart Header */}
           <div>
             <h3 className="text-lg font-semibold text-gray-900">Multi-Curve Comparison Chart</h3>
             <p className="text-sm text-gray-600">
               {selectedCurves.length} curve{selectedCurves.length > 1 ? 's' : ''} selected
             </p>
           </div>

           {/* Chart */}
           <div className="h-96">
             {selectedCurves.length > 0 ? (
               renderMultiCurveChart()
             ) : (
               <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                 <div className="text-center">
                   <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                   </svg>
                   <h4 className="mt-2 text-sm font-medium text-gray-900">No curves selected</h4>
                   <p className="mt-1 text-sm text-gray-500">Add curves using the controls above to start comparing</p>
                 </div>
               </div>
             )}
           </div>
         </div>
       </div>

       {/* Selected Curves Management */}
       <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
         <div className="flex items-center justify-between mb-4">
           <h3 className="text-lg font-semibold text-gray-900">Selected Curves</h3>
           {selectedCurves.length > 0 && (
             <button
               onClick={handleRemoveAllCurves}
               className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors border border-red-300"
             >
               Remove All
             </button>
           )}
         </div>
         
         {selectedCurves.length > 0 ? (
           <div className="space-y-3">
             {selectedCurves.map(curve => (
               <div key={curve.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                 <div className="flex items-center gap-3">
                   <div className="flex items-center gap-2">
                     <div 
                       className="w-4 h-1 rounded"
                       style={{ backgroundColor: getCurveColor(curve) }}
                     />
                     <span className="font-medium text-gray-900">
                       {curve.hub}
                     </span>
                   </div>
                   <span className="text-sm text-gray-600">
                     {getCurveTypeLabel(curve.curveType)} • {formatDateForDisplay(curve.date)}
                     {(curve.curveType === 'power' || curve.curveType === 'heat') && 
                       ` • ${curve.peakHour === 'ON_PEAK' ? '0700-2200' : curve.peakHour === '1800-2200' ? '1800-2200' : 'ATC'}`
                     }
                   </span>
                   {curve.loading && (
                     <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                   )}
                 </div>
                 <button
                   onClick={() => handleRemoveCurve(curve.id)}
                   className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                 >
                   Remove
                 </button>
               </div>
             ))}
           </div>
         ) : (
           <div className="text-center py-8">
             <div className="text-gray-500">No curves selected</div>
             <div className="text-sm text-gray-400 mt-1">Use the curve selection controls above to add curves to the chart</div>
           </div>
         )}
       </div>
    </div>
  );
};

export default ComparisonView;
