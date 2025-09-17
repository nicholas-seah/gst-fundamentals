import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const peakHour = url.searchParams.get('peakHour') || 'ON_PEAK'; // Default to ON_PEAK
    const specificDate = url.searchParams.get('date'); // Optional specific curve date
    const contractTerm = url.searchParams.get('contractTerm') || 'Calendar'; // Default to Calendar
    
    console.log('Fetching Power futures data for peak hour:', peakHour, specificDate ? `and date: ${specificDate}` : 'for latest date', `contract term: ${contractTerm}`);
    
    // For now, use fixed years for Calendar contracts to ensure it works
    let minYear, maxYear;
    if (contractTerm === 'Calendar') {
      minYear = 2025;
      maxYear = 2050; // 25-year extrapolated curve (2025-2050)
    } else {
      // Get dynamic years for Month contracts
      const availableYearsResult = await ercotDb.$queryRaw<Array<{ min_year: number; max_year: number }>>`
        SELECT 
          MIN(EXTRACT(YEAR FROM "Contract_Begin")) as min_year,
          MAX(EXTRACT(YEAR FROM "Contract_Begin")) as max_year
        FROM "ERCOT"."OTCGH_Calendar_Curves_PW_Extrapolated_25YR"
        WHERE "Contract_Term" = ${contractTerm}
          AND "Market" IN ('South', 'North', 'Houston', 'SP_15', 'West_TX')
          AND "Peak_Hour" = ${peakHour}
      `;
      
      minYear = availableYearsResult[0]?.min_year || 2025;
      maxYear = availableYearsResult[0]?.max_year || 2050; // 25-year extrapolated curve fallback
    }
    console.log(`Year range for ${contractTerm} power: ${minYear} to ${maxYear}`);

    let rawData;
    
    if (specificDate) {
      // Query for specific date
      rawData = await ercotDb.$queryRaw<Array<{
        Market: string;
        Mid: number | string;
        Contract_Begin: Date;
        Curve_Date: Date;
        Peak_Hour: string;
        Contract_Term: string;
      }>>`
        SELECT "Market", "Mid", "ATC", "Contract_Begin", "Curve_Date", "Peak_Hour", "Contract_Term"
        FROM "ERCOT"."OTCGH_Calendar_Curves_PW_Extrapolated_25YR"
        WHERE "Curve_Date" = ${specificDate}::date
          AND "Contract_Term" = ${contractTerm}
          AND "Market" IN ('South', 'North', 'Houston', 'SP_15', 'West_TX')
          AND "Peak_Hour" = ${peakHour === 'ATC' ? 'ON_PEAK' : peakHour}
          AND EXTRACT(YEAR FROM "Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
        ORDER BY "Market" ASC, "Contract_Begin" ASC
      `;
    } else {
      // Query for latest curve date (existing logic)
      rawData = await ercotDb.$queryRaw<Array<{
        Market: string;
        Mid: number | string;
        Contract_Begin: Date;
        Curve_Date: Date;
        Peak_Hour: string;
        Contract_Term: string;
      }>>`
        WITH latest_curve_date AS (
          SELECT MAX("Curve_Date") as max_curve_date
          FROM "ERCOT"."OTCGH_Calendar_Curves_PW_Extrapolated_25YR"
          WHERE "Contract_Term" = ${contractTerm}
            AND "Market" IN ('South', 'North', 'Houston', 'SP_15', 'West_TX')
            AND "Peak_Hour" = ${peakHour === 'ATC' ? 'ON_PEAK' : peakHour}
            AND EXTRACT(YEAR FROM "Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
        )
        SELECT pw."Market", pw."Mid", pw."ATC", pw."Contract_Begin", pw."Curve_Date", pw."Peak_Hour", pw."Contract_Term"
        FROM "ERCOT"."OTCGH_Calendar_Curves_PW_Extrapolated_25YR" pw
        CROSS JOIN latest_curve_date lc
        WHERE pw."Curve_Date" = lc.max_curve_date
          AND pw."Contract_Term" = ${contractTerm}
          AND pw."Market" IN ('South', 'North', 'Houston', 'SP_15', 'West_TX')
          AND pw."Peak_Hour" = ${peakHour === 'ATC' ? 'ON_PEAK' : peakHour}
          AND EXTRACT(YEAR FROM pw."Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
        ORDER BY pw."Market" ASC, pw."Contract_Begin" ASC
      `;
    }

    console.log(`Retrieved ${rawData.length} power futures data points for ${peakHour}`);
    
    // Debug: Log the raw data to understand what we're getting
    console.log('Raw power data breakdown:');
    const marketCounts = {};
    const yearCounts = {};
    rawData.forEach(row => {
      const market = row.Market;
      const year = new Date(row.Contract_Begin).getFullYear();
      marketCounts[market] = (marketCounts[market] || 0) + 1;
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    console.log('Records per market:', marketCounts);
    console.log('Records per year:', yearCounts);

    // Transform the data into the table structure
    const markets = ['Houston', 'South', 'North', 'West_TX', 'SP_15'];
    
    let years;
    if (contractTerm === 'Calendar') {
      years = Array.from({length: maxYear - minYear + 1}, (_, i) => minYear + i); // 2025, 2026, etc.
    } else {
      // For Month contracts, get the actual available month-year combinations from the data
      const availableMonthYears = new Set<string>();
      rawData.forEach(row => {
        const contractDate = new Date(row.Contract_Begin);
        const year = contractDate.getFullYear();
        const month = contractDate.getMonth(); // 0-11
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthYear = `${monthNames[month]} ${year}`;
        availableMonthYears.add(monthYear);
      });
      
      // Sort the available month-years chronologically
      years = Array.from(availableMonthYears).sort((a, b) => {
        const [monthA, yearA] = a.split(' ');
        const [monthB, yearB] = b.split(' ');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const yearDiff = parseInt(yearA) - parseInt(yearB);
        if (yearDiff !== 0) return yearDiff;
        
        return monthNames.indexOf(monthA) - monthNames.indexOf(monthB);
      });
      
      console.log(`Available power month-year combinations: ${years.length} (${years.slice(0, 5).join(', ')}...)`);
    }
    
    // Create market display names mapping
    const marketDisplayNames: { [key: string]: string } = {
      'Houston': 'Houston',
      'South': 'ERCOT South', 
      'North': 'ERCOT North',
      'West_TX': 'ERCOT West',
      'SP_15': 'SP 15'
    };

    // Group data by market and year/month-year
    const dataByMarketYear: { [key: string]: { [key: string]: number } } = {};
    
    rawData.forEach(row => {
      const market = row.Market;
      // Use ATC column if peakHour is 'ATC', otherwise use Mid column
      const price = Number(peakHour === 'ATC' ? row.ATC : row.Mid); // Convert to number for calculations
      
      // Debug logging for first few rows
      if (market === 'Houston' && Object.keys(dataByMarketYear).length < 3) {
        console.log(`Power debug: ${market}, Peak: ${peakHour}, Mid: ${row.Mid}, ATC: ${row.ATC}, Using: ${price}`);
      }
      
      if (!dataByMarketYear[market]) {
        dataByMarketYear[market] = {};
      }
      
      if (contractTerm === 'Calendar') {
        // For Calendar contracts, group by year
        const year = new Date(row.Contract_Begin).getFullYear();
        dataByMarketYear[market][year] = price;
      } else {
        // For Month contracts, group by month-year combination
        const contractDate = new Date(row.Contract_Begin);
        const year = contractDate.getFullYear();
        const month = contractDate.getMonth(); // 0-11
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthYear = `${monthNames[month]} ${year}`;
        
        dataByMarketYear[market][monthYear] = price;
      }
    });

    // Filter out month-year columns with insufficient data (only for Month contracts)
    if (contractTerm === 'Month') {
      const minMarketsWithData = 3; // At least 3 out of 5 settlement points must have data
      const filteredYears = years.filter(monthYear => {
        let marketsWithData = 0;
        markets.forEach(market => {
          if (dataByMarketYear[market]?.[monthYear] !== undefined && dataByMarketYear[market]?.[monthYear] !== null) {
            marketsWithData++;
          }
        });
        return marketsWithData >= minMarketsWithData;
      });
      
      console.log(`Power filtered month-years: ${filteredYears.length}/${years.length} columns kept (${years.length - filteredYears.length} sparse columns removed)`);
      if (filteredYears.length !== years.length) {
        const removedColumns = years.filter(y => !filteredYears.includes(y));
        console.log(`Power removed sparse columns: ${removedColumns.join(', ')}`);
      }
      
      years = filteredYears;
    }

    // Build the table data structure
    const tableData = markets.map(market => {
      const marketData: { [key: string]: number | string | null } = {
        market: marketDisplayNames[market] || market
      };
      
      // Add data for each year/month-year
      years.forEach(yearOrMonthYear => {
        const price = dataByMarketYear[market]?.[yearOrMonthYear];
        if (price !== undefined && price !== null) {
          marketData[yearOrMonthYear.toString()] = Number(price.toFixed(2)); // Round to 2 decimal places
        } else {
          marketData[yearOrMonthYear.toString()] = null; // No data available
        }
      });
      
      // Calculate multiple strip averages (only for Calendar contracts)
      if (contractTerm === 'Calendar') {
        // 10-Year Strip (2025-2034)
        const tenYearPrices = [];
        for (let year = 2025; year <= 2034; year++) {
          const price = dataByMarketYear[market]?.[year];
          if (price !== undefined && price !== null) {
            tenYearPrices.push(price);
          }
        }
        const tenYearAvg = tenYearPrices.length > 0 
          ? Number((tenYearPrices.reduce((sum, p) => sum + p, 0) / tenYearPrices.length).toFixed(2))
          : null;
        marketData['tenYearStrip'] = tenYearAvg;
        
        // 25-Year Strip (2025-2049)
        const twentyFiveYearPrices = [];
        for (let year = 2025; year <= 2049; year++) {
          const price = dataByMarketYear[market]?.[year];
          if (price !== undefined && price !== null) {
            twentyFiveYearPrices.push(price);
          }
        }
        const twentyFiveYearAvg = twentyFiveYearPrices.length > 0
          ? Number((twentyFiveYearPrices.reduce((sum, p) => sum + p, 0) / twentyFiveYearPrices.length).toFixed(2))
          : null;
        marketData['twentyFiveYearStrip'] = twentyFiveYearAvg;
        
        // Total Strip (2025-2050, entire curve)
        const totalPrices = [];
        for (let year = 2025; year <= 2050; year++) {
          const price = dataByMarketYear[market]?.[year];
          if (price !== undefined && price !== null) {
            totalPrices.push(price);
          }
        }
        const totalAvg = totalPrices.length > 0
          ? Number((totalPrices.reduce((sum, p) => sum + p, 0) / totalPrices.length).toFixed(2))
          : null;
        marketData['totalStrip'] = totalAvg;
      }
      
      const priceCount = years.filter(y => marketData[y.toString()] !== null).length;
      console.log(`${market}: ${priceCount} prices${contractTerm === 'Calendar' ? `, 10Y avg = ${marketData['tenYearStrip']}, 25Y avg = ${marketData['twentyFiveYearStrip']}, Total avg = ${marketData['totalStrip']}` : ' (no avg for Month)'}`);
      
      return marketData;
    });

    // Get the latest curve date for metadata
    const latestCurveDate = rawData.length > 0 
      ? Math.max(...rawData.map(row => new Date(row.Curve_Date).getTime()))
      : null;

    const response = {
      success: true,
      message: 'Power futures data retrieved successfully',
      data: {
        tableData,
        years,
        markets: markets.map(m => marketDisplayNames[m] || m),
        peakHour
      },
      metadata: {
        rawDataPoints: rawData.length,
        latestCurveDate: latestCurveDate ? new Date(latestCurveDate).toISOString().split('T')[0] : null,
        units: '$/MWh',
        dateRange: `${minYear}-${maxYear}`,
        dataSource: 'ERCOT.OTCGH_Calendar_Curves_PW_Extrapolated_25YR',
        peakHour,
        contractTerm,
        yearRange: { minYear, maxYear }
      }
    };

    console.log('Power futures data processed successfully:', response.metadata);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to fetch Power futures data:', error);
    
    // Check if this is a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isDatabaseError = errorMessage.includes('connect') || errorMessage.includes('database') || errorMessage.includes('ENOTFOUND');
    
    if (isDatabaseError) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Database not configured for production environment',
        error: 'Power futures require DATABASE_URL_THIRD environment variable to connect to analytics_workspace database',
        requiresConfiguration: true
      }), {
        status: 503, // Service Unavailable
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch Power futures data',
      error: errorMessage
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
