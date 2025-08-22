import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { loadMockSupplyCurveData, type OfferCurveSegment } from '../../lib/csvLoader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface SupplyCurveSegment {
  source: string;
  capacity: number;
  marginalCost: number;
  color: string;
  cumulativeStart: number;
  cumulativeEnd: number;
  resourceName?: string;
}

interface ResourceTypeSummary {
  capacity: number;
  marginalCost: number;
  color: string;
}

const SupplyCurveDashboard: React.FC = () => {
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
  const [loading, setLoading] = useState(true); // Start with loading=true for initial data fetch
  const [error, setError] = useState<string | null>(null);
  const [realData, setRealData] = useState<any>(null);
  const [realMetadata, setRealMetadata] = useState<any>(null); // Store API metadata
  const [rtLoadData, setRtLoadData] = useState<any>(null); // Store actual RT Load data
  
  const [csvMockData, setCsvMockData] = useState<OfferCurveSegment[]>([]);
  const [csvDataLoaded, setCsvDataLoaded] = useState(false);
  
  // Calculate days between today and the most recent available data (2025-04-20)
  const getMostRecentDataDate = () => {
    return new Date('2025-04-20'); // Most recent data available from GridStatus API
  };

  const getBufferDays = () => {
    const today = new Date();
    const mostRecentData = getMostRecentDataDate();
    const timeDiff = today.getTime() - mostRecentData.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  // Set default date to 60 days ago (the most recent allowed date)
  useEffect(() => {
    const date = new Date();
    date.setDate(date.getDate() - 60); // 60 days ago (most recent allowed)
    const defaultDate = date.toISOString().split('T')[0];
    console.log('Setting default date (60 days ago):', defaultDate);
    setSelectedDate(defaultDate);
    setAppliedDate(defaultDate);
    
    // Set default time values
    const defaultHour = '00 (12 AM)';
    const defaultMinute = '00';
    setAppliedHour(defaultHour);
    setAppliedMinute(defaultMinute);
    setAppliedScenario('Current Grid');
    
    // Don't auto-fetch real data - show mock data by default for testing
    console.log('Using mock data for visualization testing');
    setLoading(false);
    
    // Uncomment this line to auto-fetch real data:
    // fetchGridStatusData(defaultDate, defaultHour, defaultMinute);
  }, []);

  // Load CSV mock data on component mount
  useEffect(() => {
    const loadCSVData = async () => {
      try {
        const data = await loadMockSupplyCurveData();
        setCsvMockData(data);
        setCsvDataLoaded(true);
        
        // Debug information
        const totalCapacity = data.reduce((sum, point) => sum + point.mw, 0);
        const priceRange = data.length > 0 ? {
          min: Math.min(...data.map(d => d.price)),
          max: Math.max(...data.map(d => d.price))
        } : { min: 0, max: 0 };
        const resourceTypes = [...new Set(data.map(d => d.resource_type))];
        
        console.log(`✅ CSV Data Loaded Successfully:`);
        console.log(`📊 Total segments: ${data.length.toLocaleString()}`);
        console.log(`⚡ Total capacity: ${totalCapacity.toLocaleString()} MW`);
        console.log(`💰 Price range: $${priceRange.min} to $${priceRange.max}/MWh`);
        console.log(`🏭 Resource types: ${resourceTypes.join(', ')}`);
        
        // Show first few segments as example
        if (data.length > 0) {
          console.log(`📋 First 5 segments:`, data.slice(0, 5));
        }
        
      } catch (error) {
        console.error('❌ Failed to load CSV data:', error);
        setCsvDataLoaded(true); // Still set to true to stop loading state
      }
    };
    
    loadCSVData();
  }, []);

  // Use CSV mock data when available, otherwise use fallback
  const mockSupplyCurveData = useMemo(() => {
    if (csvDataLoaded && csvMockData.length > 0) {
      return csvMockData;
    }
    
    // Fallback data if CSV loading fails
    return [];
  }, [csvMockData, csvDataLoaded]);

  // Calculate date constraints for Current Grid scenario
  const getDateConstraints = () => {
    if (marketScenario === 'Current Grid') {
      const today = new Date();
      
      // Most recent allowed date is 60 days ago
      // All dates BEFORE this are valid (older historical data)
      // All dates AFTER this are invalid (too recent)
      const maxAllowedDate = new Date();
      maxAllowedDate.setDate(today.getDate() - 60);
      
      const constraints = {
        min: undefined, // Allow all historical dates (no restriction on old dates)
        max: maxAllowedDate.toISOString().split('T')[0] // 60 days ago is the MOST RECENT allowed
      };
      
      console.log('Date constraints applied:', constraints);
      console.log('Today:', today.toISOString().split('T')[0]);
      console.log('Most recent allowed date (60 days ago):', constraints.max);
      return constraints;
    }
    return { min: undefined, max: undefined };
  };

  // Handle date change with validation
  const handleDateChange = (newDate: string) => {
    console.log('Date change attempted:', newDate);
    
    if (marketScenario === 'Current Grid') {
      const today = new Date();
      const selectedDateTime = new Date(newDate);
      
      // Calculate the most recent allowed date (60 days ago)
      const maxAllowedDate = new Date();
      maxAllowedDate.setDate(today.getDate() - 60);
      
      console.log('Today:', today.toISOString());
      console.log('Selected date:', selectedDateTime.toISOString());
      console.log('Most recent allowed date (60 days ago):', maxAllowedDate.toISOString());
      
      // Check if date is 60 days ago or older (valid)
      if (selectedDateTime <= maxAllowedDate) {
        setSelectedDate(newDate);
        setInvalidDateMessage(''); // Clear error message on valid selection
        console.log('Date accepted:', newDate);
      } else {
        // Date is too recent (less than 60 days ago)
        const maxDateString = maxAllowedDate.toLocaleDateString();
        const errorMsg = `Only dates from ${maxDateString} (60 days ago) or older are available for Current Grid scenario.`;
        setInvalidDateMessage(errorMsg);
        console.log('Date rejected - too recent:', newDate, 'Error:', errorMsg);
        // Do not update selectedDate if invalid
      }
    } else {
      // For other scenarios, allow any date
      setSelectedDate(newDate);
      setInvalidDateMessage(''); // Clear error message for other scenarios
    }
  };

  // Handle market scenario changes and adjust date if needed
  useEffect(() => {
    setInvalidDateMessage(''); // Clear error message when scenario changes
    
    if (marketScenario === 'Current Grid') {
      const today = new Date();
      const selectedDateTime = new Date(selectedDate);
      
      // Calculate the most recent allowed date (60 days ago)
      const maxAllowedDate = new Date();
      maxAllowedDate.setDate(today.getDate() - 60);
      
      // If selected date is too recent (newer than 60 days ago), reset to 60 days ago
      if (selectedDateTime > maxAllowedDate) {
        const safeDate = new Date();
        safeDate.setDate(safeDate.getDate() - 60); // Default to exactly 60 days ago
        const validDateString = safeDate.toISOString().split('T')[0];
        setSelectedDate(validDateString);
        console.log('Date adjusted to safe value (60 days ago):', validDateString);
      }
    }
  }, [marketScenario, selectedDate]);

  const dateConstraints = getDateConstraints();

  // Fetch actual RT Load data from database
  const fetchRTLoadData = async (date: string, hour: string, minute: string) => {
    try {
      const hourNum = hour.split(' ')[0]; // Extract hour number from "00 (12 AM)"
      const apiUrl = `/api/ercot-rtload?date=${date}&hour=${hourNum}&minute=${minute}`;
      console.log('Fetching RT Load data from:', apiUrl);
      
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch RT Load data');
      }
      
      setRtLoadData(result.data);
      console.log('RT Load data loaded successfully:', result.data.rtLoad, 'MW');
      return result.data;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown RT Load error';
      console.error('RT Load API error:', errorMessage);
      console.log('RT Load unavailable, will use default demand value');
      
      // Don't set error for RT Load - just log and continue with default
      setRtLoadData(null);
      return null;
    }
  };

  // Fetch real data from GridStatus API via Python bridge AND RT Load data
  const fetchGridStatusData = async (date: string, hour: string, minute: string) => {
    setLoading(true);
    setError(null); // Clear any previous errors
    
    try {
      // Fetch both supply curve data and RT Load data in parallel
      console.log('Fetching both supply curve and RT Load data...');
      
      const [supplyResult, rtLoadResult] = await Promise.allSettled([
        // Supply curve data
        (async () => {
          const hourNum = hour.split(' ')[0]; // Extract hour number from "00 (12 AM)"
          const apiUrl = `/api/gridstatus-python-bridge?date=${date}&hour=${hourNum}&minute=${minute}`;
          console.log('Making API call to Python bridge:', apiUrl);
          
          const response = await fetch(apiUrl);
          console.log('Python bridge response status:', response.status);
          
          const result = await response.json();
          console.log('Python bridge response data:', result);
          
          if (!result.success) {
            throw new Error(result.message || 'Failed to fetch supply data');
          }
          
          return result; // Return full result object with data and metadata
        })(),
        
        // RT Load data
        fetchRTLoadData(date, hour, minute)
      ]);
      
      // Handle supply curve data result
      if (supplyResult.status === 'fulfilled') {
        setRealData(supplyResult.value.data); // Extract data from full response
        setRealMetadata(supplyResult.value.metadata); // Extract metadata from full response
        console.log('GridStatus data loaded successfully via Python bridge:', supplyResult.value);
      } else {
        throw supplyResult.reason;
      }
      
      // RT Load data is handled in fetchRTLoadData function (won't throw error)
      console.log('RT Load result:', rtLoadResult.status === 'fulfilled' ? rtLoadResult.value : 'Failed');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Data fetching error:', err);
      console.log('Falling back to mock data due to API error');
      setError(`GridStatus API unavailable: ${errorMessage}`);
      
      // Fall back to mock data - don't leave user with blank screen
      setRealData(null);
      setRealMetadata(null); // Clear metadata on error
    } finally {
      setLoading(false);
    }
  };

  // Handle apply button click
  const handleApply = async () => {
    setAppliedDate(selectedDate);
    setAppliedHour(selectedHour);
    setAppliedMinute(selectedMinute);
    setAppliedScenario(marketScenario);
    
    // Fetch real data if Current Grid scenario
    if (marketScenario === 'Current Grid') {
      await fetchGridStatusData(selectedDate, selectedHour, selectedMinute);
    } else {
      // Use mock data for other scenarios
      setRealData(null);
      setRealMetadata(null); // Clear metadata for mock data
      setError(null);
    }
  };

  // Check if settings have changed
  const hasChanges = selectedDate !== appliedDate || selectedHour !== appliedHour || selectedMinute !== appliedMinute || marketScenario !== appliedScenario;

  // Calculate statistics from real or mock data (memoized to prevent unnecessary recalculations)
  const stats = useMemo(() => {
    // Determine the actual demand - use RT Load if available, otherwise fall back to estimate
    let actualDemand = 50000; // Default fallback
    
    if (rtLoadData && rtLoadData.rtLoad) {
      actualDemand = rtLoadData.rtLoad; // Use actual RT Load from database
      console.log(`Using actual RT Load: ${actualDemand} MW`);
    } else {
      let sourceData;
      let totalCapacity = 0;
      
      if (realData && realData.rawSupplyCurve) {
        sourceData = realData.rawSupplyCurve;
        totalCapacity = realData.totalCapacity || 0;
      } else {
        sourceData = mockSupplyCurveData;
        totalCapacity = mockSupplyCurveData.reduce((sum, point) => sum + point.mw, 0);
      }
      
      if (sourceData && sourceData.length > 0) {
        // For mock data, use a realistic demand scenario based on actual capacity
        if (!realData) {
          // Calculate total capacity from CSV data
          const totalCSVCapacity = mockSupplyCurveData.reduce((sum, point) => sum + point.mw, 0);
          
          if (totalCSVCapacity > 0) {
            // Use 70-80% of available capacity as demand for realistic load factor
            actualDemand = Math.round(totalCSVCapacity * 0.75);
            console.log(`📊 CSV data analysis: Total capacity: ${totalCSVCapacity.toLocaleString()} MW, Setting demand to ${actualDemand.toLocaleString()} MW (75% load factor)`);
          } else {
            actualDemand = 40000; // fallback for 40 GW
          }
        } else {
      // Estimate demand as 70% of total capacity if no RT Load data
      actualDemand = Math.min(totalCapacity * 0.7, 80000); // Cap at 80GW
        }
        console.log(`Using calculated demand: ${actualDemand} MW`);
    } else {
      console.log(`Using default demand: ${actualDemand} MW`);
      }
    }
    
    let sourceData;
    let totalCapacity = 0;
    
    if (realData && realData.rawSupplyCurve) {
      sourceData = realData.rawSupplyCurve;
      totalCapacity = realData.totalCapacity || 0;
    } else {
      sourceData = mockSupplyCurveData;
      totalCapacity = mockSupplyCurveData.reduce((sum, point) => sum + point.mw, 0);
    }
    
    if (sourceData && sourceData.length > 0) {
      // Find clearing price by finding the price at demand level
      let clearingPrice = 50; // Default
      let marginalResourceType = 'TBD'; // Track the resource type setting the price
      let cumulativeCapacity = 0;
      
      // Calculate capacity-weighted average cost for dispatched units
      let dispatchedCapacity = 0;
      let weightedCostSum = 0;
      
      // Sort by price for merit order
      const sortedData = [...sourceData].sort((a, b) => a.price - b.price);
      
      for (const point of sortedData) {
        if (cumulativeCapacity + point.mw >= actualDemand) {
          clearingPrice = point.price;
          marginalResourceType = point.resource_type || 'Unknown';
          
          // Add the partial capacity of the marginal unit
          const marginalCapacity = actualDemand - cumulativeCapacity;
          dispatchedCapacity += marginalCapacity;
          weightedCostSum += point.price * marginalCapacity;
          break;
        }
        
        // This unit is fully dispatched
        cumulativeCapacity += point.mw;
        dispatchedCapacity += point.mw;
        weightedCostSum += point.price * point.mw;
      }
      
      // Calculate capacity-weighted average generation cost
      const avgGenCost = dispatchedCapacity > 0 ? weightedCostSum / dispatchedCapacity : 0;
      
      // Calculate dispatched units by resource type (only units at or below clearing price)
      const dispatchedUnits: { [key: string]: number } = {};
      let runningCapacity = 0;
      
      for (const point of sortedData) {
        const resourceType = point.resource_type || 'OTHER';
        
        if (runningCapacity + point.mw >= actualDemand) {
          // This is the marginal unit - only partially dispatched
          const partialDispatch = actualDemand - runningCapacity;
          dispatchedUnits[resourceType] = (dispatchedUnits[resourceType] || 0) + partialDispatch;
          break;
        } else {
          // This unit is fully dispatched
          dispatchedUnits[resourceType] = (dispatchedUnits[resourceType] || 0) + point.mw;
          runningCapacity += point.mw;
        }
      }
      
      // Calculate renewable mix
      const renewableTypes = ['WIND', 'PVGR', 'SOLAR'];
      const renewableCapacity = sortedData
        .filter(point => renewableTypes.includes(point.resource_type))
        .reduce((sum, point) => sum + point.mw, 0);
      
      const renewableMix = totalCapacity > 0 ? (renewableCapacity / totalCapacity) * 100 : 0;
      
      return {
        totalDemand: Math.round(actualDemand),
        clearingPrice: Math.round(clearingPrice * 100) / 100, // Two decimal places
        gridUtilization: totalCapacity > 0 ? Math.round((actualDemand / totalCapacity) * 100) : 0,
        renewableMix: Math.round(renewableMix * 10) / 10,
        avgGenCost: Math.round(avgGenCost * 100) / 100, // Capacity-weighted average, two decimal places
        marginalUnit: marginalResourceType, // Actual resource type setting the clearing price
        reserveMargin: totalCapacity > 0 ? Math.round(((totalCapacity - actualDemand) / actualDemand) * 10000) / 100 : 0, // (Available - Demand) / Demand * 100, two decimal places
        dispatchedUnits: dispatchedUnits // Only units at or below clearing price
      };
    } else {
      // No data available
      return {
        totalDemand: Math.round(actualDemand),
        clearingPrice: 0,
        gridUtilization: 0,
        renewableMix: 0,
        avgGenCost: 0,
        marginalUnit: 'No Data',
        reserveMargin: 0,
        dispatchedUnits: {}
      };
    }
  }, [rtLoadData, realData, mockSupplyCurveData]); // Include mockSupplyCurveData in dependencies

  // Enhanced color mapping that exactly matches the Python code
  const getColorForResourceType = (resourceType: string): string => {
    const resource_colors: { [key: string]: string } = {
      'WIND': '#32CD32',      // Bright green
      'PVGR': '#FFD700',      // Gold for solar PV
      'SOLAR': '#FFD700',     // Gold for solar
      'HYDRO': '#4169E1',     // Royal blue
      'NUCLEAR': '#8A2BE2',   // Blue violet
      'COAL': '#8B4513',      // Saddle brown
      'GAS': '#FF4500',       // Orange red
      'STEAM': '#FF6347',     // Tomato
      'CC': '#FF8C00',        // Dark orange for combined cycle
      'GT': '#FFA500',        // Orange for gas turbine
      'BIOMASS': '#228B22',   // Forest green
      'LANDFILL': '#556B2F',  // Dark olive green
      'PWRSTR': '#9932CC',    // Dark orchid for power storage/batteries
      'ESR': '#9932CC',       // Dark orchid for energy storage
      'DC': '#FF1493',        // Deep pink for DC tie
      'SYNC_COND': '#708090', // Slate gray
      'OTHER': '#696969',     // Dim gray
      'UNKNOWN': '#A9A9A9'    // Dark gray
    };
    
    // Handle common variations and abbreviations (matching Python logic)
    const resourceTypeUpper = String(resourceType || '').toUpperCase();
    
    // Direct matches
    if (resource_colors[resourceTypeUpper]) {
      return resource_colors[resourceTypeUpper];
    }
    
    // Partial matches for resource types (matching Python logic exactly)
    if (resourceTypeUpper.includes('WIND')) {
      return resource_colors['WIND'];
    } else if (resourceTypeUpper.includes('SOLAR') || resourceTypeUpper.includes('PV')) {
      return resource_colors['PVGR'];
    } else if (resourceTypeUpper.includes('HYDRO')) {
      return resource_colors['HYDRO'];
    } else if (resourceTypeUpper.includes('NUCLEAR')) {
      return resource_colors['NUCLEAR'];
    } else if (resourceTypeUpper.includes('COAL')) {
      return resource_colors['COAL'];
    } else if (resourceTypeUpper.includes('GAS') || resourceTypeUpper.includes('NG')) {
      return resource_colors['GAS'];
    } else if (resourceTypeUpper.includes('CC') || resourceTypeUpper.includes('COMBINED')) {
      return resource_colors['CC'];
    } else if (resourceTypeUpper.includes('GT') || resourceTypeUpper.includes('TURBINE')) {
      return resource_colors['GT'];
    } else if (resourceTypeUpper.includes('STEAM')) {
      return resource_colors['STEAM'];
    } else if (resourceTypeUpper.includes('BIOMASS') || resourceTypeUpper.includes('BIO')) {
      return resource_colors['BIOMASS'];
    } else if (resourceTypeUpper.includes('BESS') || resourceTypeUpper.includes('BATTERY') || resourceTypeUpper.includes('STORAGE')) {
      return resource_colors['PWRSTR'];
    } else {
      return resource_colors['OTHER'];
    }
  };

  // Custom symlog transformation function (matching Python's symlog behavior)
  const symlogTransform = (value: number, linthresh: number = 10): number => {
    if (Math.abs(value) <= linthresh) {
      // Linear region for small values
      return value;
    } else if (value > linthresh) {
      // Logarithmic region for positive values
      return linthresh + Math.log10(value / linthresh);
    } else {
      // Logarithmic region for negative values
      return -linthresh - Math.log10(Math.abs(value) / linthresh);
    }
  };

  // Inverse symlog transformation for tick labels
  const symlogInverse = (transformedValue: number, linthresh: number = 10): number => {
    if (Math.abs(transformedValue) <= linthresh) {
      return transformedValue;
    } else if (transformedValue > linthresh) {
      return linthresh * Math.pow(10, transformedValue - linthresh);
    } else {
      return -linthresh * Math.pow(10, Math.abs(transformedValue) - linthresh);
    }
  };

  // Prepare chart data for stacked bar supply curve (memoized to prevent unnecessary recalculations)
  const chartData = useMemo(() => {
    let dataToUse: SupplyCurveSegment[];
    
    if (realData && realData.rawSupplyCurve) {
      // Use real GridStatus data - sort by price first
      const sortedData = [...realData.rawSupplyCurve].sort((a, b) => a.price - b.price);
      
      // Calculate cumulative capacity for each point
      let cumulativeCapacity = 0;
      dataToUse = sortedData.map((point: any) => {
        const segmentStart = cumulativeCapacity;
        cumulativeCapacity += point.mw;
        
        return {
          source: point.resource_type || 'OTHER',
        capacity: point.mw,
        marginalCost: point.price,
          color: getColorForResourceType(point.resource_type || 'OTHER'),
          cumulativeStart: segmentStart,
          cumulativeEnd: cumulativeCapacity,
          resourceName: point.resource_name
        };
      });
      
      console.log('Individual bar chart data preparation:', {
        realDataPoints: realData.rawSupplyCurve.length,
        processedSegments: dataToUse.length,
        totalCapacity: cumulativeCapacity,
        priceRange: {
          min: Math.min(...dataToUse.map(d => d.marginalCost)),
          max: Math.max(...dataToUse.map(d => d.marginalCost))
        }
      });
    } else {
      // Use mock data - already sorted by price
      let cumulativeCapacity = 0;
      dataToUse = mockSupplyCurveData.map((point: any) => {
        const segmentStart = cumulativeCapacity;
        cumulativeCapacity += point.mw;
        
        return {
          source: point.resource_type || 'OTHER',
          capacity: point.mw,
          marginalCost: point.price,
          color: getColorForResourceType(point.resource_type || 'OTHER'),
          cumulativeStart: segmentStart,
          cumulativeEnd: cumulativeCapacity,
          resourceName: point.resource_name
        };
      });
      
      console.log('Mock data chart preparation:', {
        mockDataPoints: mockSupplyCurveData.length,
        processedSegments: dataToUse.length,
        totalCapacity: cumulativeCapacity,
        priceRange: {
          min: Math.min(...dataToUse.map(d => d.marginalCost)),
          max: Math.max(...dataToUse.map(d => d.marginalCost))
        }
      });
    }
    
    const datasets: any[] = [];
    
    // Create individual bar charts positioned at exact x-coordinates
    if (dataToUse.length > 0) {
      // Create individual thin vertical bars for each generator (like the reference image)
      dataToUse.forEach((segment, index) => {
        const color = getColorForResourceType(segment.source);
        
        // Create a very thin vertical bar for each generator
        const startX = segment.cumulativeStart;
        const endX = segment.cumulativeEnd;
        const barWidth = endX - startX;
        
        // Only create visible bars if they have reasonable width
        if (barWidth > 0.1) {
          // Apply symlog transformation to Y values
          const transformedPrice = symlogTransform(segment.marginalCost);
          const transformedZero = symlogTransform(0);
          
          // Create rectangle: (start,0) -> (start,price) -> (end,price) -> (end,0)
          const barData = [
            { x: startX, y: transformedZero },
            { x: startX, y: transformedPrice },
            { x: endX, y: transformedPrice },
            { x: endX, y: transformedZero },
            { x: startX, y: transformedZero } // Close the shape
          ];
        
        datasets.push({
            type: 'line',
            label: `${segment.source}_${index}`,
            data: barData,
          borderColor: color,
            backgroundColor: color,
            borderWidth: 0.0,
          pointRadius: 0,
            fill: true,
          tension: 0,
            showInLegend: false,
        });
        }
      });
      
      console.log(`Created ${dataToUse.length} individual thin vertical bars with symlog transformation`);
    }
    
    // Calculate price range for demand line positioning (use transformed values)
    const priceRange = dataToUse.length > 0 ? {
      min: Math.min(...dataToUse.map((s: SupplyCurveSegment) => symlogTransform(s.marginalCost))),
      max: Math.max(...dataToUse.map((s: SupplyCurveSegment) => symlogTransform(s.marginalCost)))
    } : { min: symlogTransform(-50), max: symlogTransform(300) };
    
    // Add some padding to the range
    const yPadding = Math.max(Math.abs(priceRange.max - priceRange.min) * 0.1, 1);
    const demandLineMin = priceRange.min - yPadding;
    const demandLineMax = priceRange.max + yPadding;
    
    // Add demand line (vertical line at demand quantity)
    datasets.push({
      type: 'line',
      label: 'Demand Level',
      data: [
        { x: stats.totalDemand, y: demandLineMin },
        { x: stats.totalDemand, y: demandLineMax }
      ],
      borderColor: '#DC2626',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [8, 4],
      pointRadius: 0,
      fill: false,
      showInLegend: false,
    });
    
    // Horizontal line at $0 (transformed)
    const maxCapacity = dataToUse.length > 0 ? Math.max(...dataToUse.map(d => d.cumulativeEnd)) : stats.totalDemand * 1.2;
    const transformedZero = symlogTransform(0);
    datasets.push({
      type: 'line',
      label: 'Zero Price Line',
      data: [
        { x: 0, y: transformedZero },
        { x: maxCapacity, y: transformedZero }
      ],
      borderColor: '#DC2626',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [3, 3],
      pointRadius: 0,
      fill: false,
      showInLegend: false,
    });
    
    console.log(`Total datasets including lines: ${datasets.length}`);
    return { datasets };
  }, [realData, stats, mockSupplyCurveData]);

  const prepareSupplyCurveData = () => chartData;

  // Get legend data (memoized to prevent unnecessary recalculations)
  const legendData = useMemo(() => {
    let sourceData;
    
    if (realData && realData.rawSupplyCurve) {
      sourceData = realData.rawSupplyCurve;
    } else {
      sourceData = mockSupplyCurveData;
    }
    
    if (sourceData && sourceData.length > 0) {
      // Get unique resource types from the data
      const resourceTypeStrings = sourceData.map((point: any) => point.resource_type as string).filter(Boolean);
      const uniqueResourceTypes: string[] = [];
      resourceTypeStrings.forEach((type: string) => {
        if (!uniqueResourceTypes.includes(type)) {
          uniqueResourceTypes.push(type);
        }
      });
      return uniqueResourceTypes.map(type => ({
        source: type,
        color: getColorForResourceType(type)
      }));
    } else {
      return [];
    }
  }, [realData, mockSupplyCurveData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          padding: 8,
          font: {
            size: 10
          },
          color: '#FFFFFF', // White text for dark theme
        filter: function(legendItem: any, chartData: any) {
            // Only show resource types, hide lines
          return legendItem.text !== 'Demand Level' && 
                   legendItem.text !== 'Zero Price Line';
          },
          generateLabels: function(chart: any) {
            // Generate custom legend based on our resource types
            return legendData.map(item => ({
              text: item.source,
              fillStyle: item.color,
              strokeStyle: item.color,
              lineWidth: 0,
              hidden: false,
              datasetIndex: -1
            }));
          }
        },
        maxHeight: 100,
        maxWidth: 300
      },
      tooltip: {
        backgroundColor: '#2F2F2F', // Dark background
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        borderColor: '#FFFFFF',
        borderWidth: 1,
        filter: function(tooltipItem: any) {
          // Hide demand line and zero price line from tooltips
          return tooltipItem.dataset.label !== 'Demand Level' &&
                 tooltipItem.dataset.label !== 'Zero Price Line';
        },
        callbacks: {
          label: function(context: any) {
            const datasetLabel = context.dataset.label;
            
            // Extract segment info from dataset label (format: "RESOURCETYPE_INDEX")
            if (datasetLabel && datasetLabel.includes('_')) {
              const [resourceType, indexStr] = datasetLabel.split('_');
              const index = parseInt(indexStr);
              
              // Find the corresponding segment in our data
              let sourceData = realData?.rawSupplyCurve || mockSupplyCurveData;
              if (sourceData && sourceData[index]) {
                const segment = sourceData[index];
                return [
                  `Load: ${Math.round(context.parsed.x).toLocaleString()} MW`,
                  `Offer price: $${context.parsed.y}/MWh`,
                  `Fuel: ${resourceType}`,
                  `Generator: ${segment.resource_name || 'N/A'}`,
                  `Offer MW: ${Math.round(segment.mw).toLocaleString()} MW`
                ];
              }
            }
            
            return `${context.dataset.label}: $${context.parsed.y}/MWh`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: {
          display: true,
          text: 'Load (MW)',
          font: { size: 14, weight: 'bold' as const },
          color: '#FFFFFF' // White text for dark theme
        },
        grid: { 
          display: true, 
          color: '#FFFFFF',
          lineWidth: 0.5
        },
        ticks: {
          color: '#FFFFFF', // White text for dark theme
          font: { size: 12 },
          callback: function(value: any) {
            // Format x-axis like Python code: 0, 10k, 20k, etc.
            if (value === 0) return '0';
            if (value >= 1000) {
              return `${Math.round(value / 1000)}k`;
            }
            return value.toString();
          }
        }
      },
      y: {
        type: 'linear' as const, // Use linear to handle negative values (symlog equivalent)
        title: {
          display: true,
          text: 'Offer Price',
          font: { size: 14, weight: 'bold' as const },
          color: '#FFFFFF' // White text for dark theme
        },
        grid: { 
          color: '#FFFFFF',
          lineWidth: 0.5
        },
        afterDataLimits: (scale: any) => {
          // Set bounds using symlog transformation (matching Python logic)
          const dataToUse = realData?.rawSupplyCurve || mockSupplyCurveData;
          if (dataToUse && dataToUse.length > 0) {
            const prices = dataToUse.map((d: any) => d.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            // Transform min/max to symlog space and add margin
            scale.min = symlogTransform(minPrice < 0 ? minPrice * 1.2 : Math.min(-250, minPrice * 0.8));
            scale.max = symlogTransform(maxPrice * 1.2);
            
            // Create symlog-like tick distribution in transformed space
            const realTicks = [];
            
            // Negative values
            if (minPrice < 0) {
              realTicks.push(-5000, -2500, -1000, -500, -250, -100, -50, -25, -10, -1);
            }
            
            // Zero and positive values  
            realTicks.push(0, 1, 10, 25, 50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000);
            
            // Transform real price values to symlog space and filter
            const transformedTicks = realTicks
              .map(price => ({ real: price, transformed: symlogTransform(price) }))
              .filter(tick => tick.transformed >= scale.min && tick.transformed <= scale.max);
            
            // Override the tick generation with transformed values
            scale.ticks = transformedTicks.map(tick => ({ value: tick.transformed }));
          } else {
            scale.min = symlogTransform(-250);
            scale.max = symlogTransform(5000);
          }
        },
        ticks: {
          color: '#FFFFFF', // White text for dark theme
          font: { size: 12 },
          callback: function(value: any) {
            // Convert transformed value back to real price using inverse symlog
            const realPrice = symlogInverse(Number(value));
            
            // Format using Python's format_price_labels logic
            if (realPrice === 0) return '0';
            if (Math.abs(realPrice) < 1) return realPrice.toFixed(1);
            if (Math.abs(realPrice) < 500) return Math.round(realPrice).toString();
            if (Math.abs(realPrice) < 1000) return Math.round(realPrice/500)*500;
            // For values >= 1000, show in thousands
            if (realPrice % 1000 === 0) {
              return `${Math.round(realPrice/1000)}k`;
            } else {
              return `${(realPrice/1000).toFixed(1)}k`;
            }
          },
          maxTicksLimit: 15
        }
      }
    },
    elements: {
      line: {
        tension: 0,
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
      mode: 'nearest' as const,
    },
    // Dark theme styling
    backgroundColor: '#2F2F2F',
    color: '#FFFFFF'
  };

  // Generate hour options (without minutes now)
  const hourOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour24 = i.toString().padStart(2, '0');
    const hour12 = i === 0 ? '12 AM' : i === 12 ? '12 PM' : i < 12 ? `${i} AM` : `${i - 12} PM`;
    hourOptions.push(`${hour24} (${hour12})`);
  }

  // Generate minute options (15-minute increments)
  const minuteOptions = ['00', '15', '30', '45'];

  // Function to get full time display
  const getTimeDisplay = (hour: string, minute: string) => {
    const hourPart = hour.split(' ')[0]; // Gets "00" from "00 (12 AM)"
    return `${hourPart}:${minute}`;
  };

  // CSV Export function
  const handleExportData = () => {
    let csvData;
    
    if (realData && realData.rawSupplyCurve) {
      // Export real GridStatus scheduled output data
      csvData = realData.rawSupplyCurve.map((point: any) => ({
        ResourceName: point.resource_name,
        ResourceType: point.resource_type,
        MarginalCost: point.price,
        ScheduledOutput_MW: point.mw,
        CumulativeCapacity: point.cumulativeCapacity
      }));
    } else {
      // No data available
      csvData = [{
        ResourceName: 'No Data Available',
        ResourceType: 'N/A',
        MarginalCost: 'N/A',
        ScheduledOutput_MW: 'N/A',
        CumulativeCapacity: 'N/A'
      }];
    }

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map((row: any) => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generation_scheduled_output_${selectedDate.replace(/-/g, '')}_${selectedHour.split(' ')[0].replace(':', '')}${selectedMinute}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Custom CSS for date picker disabled dates */}
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
        }
        
        /* Style for invalid date state */
        input[type="date"]:invalid {
          border-color: #DC2626;
        }
      `}</style>
      
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
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              min={dateConstraints.min}
              max={dateConstraints.max}
              required
              title={marketScenario === 'Current Grid' ? 
                `Select a date from ${dateConstraints.max} or older` : 
                'Select a date'
              }
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
              {loading ? 'Loading...' : 'Apply'}
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
        {/* Chart Section */}
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
          
          {loading && (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mb-4"></div>
              <p className="text-white">Loading real ERCOT market data...</p>
              <p className="text-sm text-gray-300 mt-2">Fetching scheduled generator output from GridStatus API</p>
              <p className="text-sm text-gray-300">Fetching actual demand from ERCOT database</p>
            </div>
          )}
          {!loading && error && (
            <div>
              <div className="h-96 relative bg-gray-800">
                <Chart type="line" data={chartData} options={chartOptions} />
              </div>
              <div className="mt-4 p-3 bg-yellow-900 border border-yellow-600 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-200">
                      <strong>Using mock data:</strong> {error}
                    </p>
                    <p className="text-xs text-yellow-300 mt-1">
                      Chart shows sample data. Try refreshing or selecting a different date.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {!loading && !error && (
            <div>
              <div className="h-96 relative bg-gray-800">
                <Chart type="line" data={chartData} options={chartOptions} />
              </div>
              {/* Data source indicator */}
              <div className="mt-2 text-xs text-gray-400 text-center">
                {realData ? 
                  <>
                    Supply: {realData.dataPoints.toLocaleString()} segments from {realMetadata?.originalDataPoints || 'N/A'} units • Total: {realData.totalCapacity?.toLocaleString() || 'N/A'} MW
                    {rtLoadData && rtLoadData.isExactMatch && (
                      <> • Demand: {rtLoadData.rtLoad.toLocaleString()} MW (exact match)</>
                    )}
                    {rtLoadData && !rtLoadData.isExactMatch && (
                      <> • Demand: {rtLoadData.rtLoad.toLocaleString()} MW (⚠️ {Math.round(rtLoadData.timeDifferenceSeconds / 60)}min offset from {rtLoadData.datetime})</>
                    )}
                    {!rtLoadData && (
                      <> • Demand: Estimated from capacity</>
                    )}
                    {realData.totalCapacity && rtLoadData && rtLoadData.rtLoad > realData.totalCapacity && (
                      <div className="text-red-400 font-bold mt-1">🚨 IMPOSSIBLE: Demand exceeds total supply! Check console for debugging info.</div>
                    )}
                  </> : 
                  <>
                    Supply: Mock data • 
                    {rtLoadData ? 
                      `Demand: ${rtLoadData.rtLoad.toLocaleString()} MW` :
                      'Demand: Default estimate'
                    }
                  </>
                }
              </div>
            </div>
          )}

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
                {stats.dispatchedUnits ? (
                  Object.entries(stats.dispatchedUnits)
                    .filter(([type, capacity]) => capacity > 0) // Only show units with dispatched capacity
                    .sort(([, a], [, b]) => (b as number) - (a as number)) // Sort by capacity descending
                    .map(([type, capacity]) => (
                    <div key={type} className="flex justify-between">
                      <span>{type}:</span>
                      <span className="font-mono">{Math.round(capacity as number)}MW</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500">No dispatch data available</div>
                )}
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

export default SupplyCurveDashboard; 