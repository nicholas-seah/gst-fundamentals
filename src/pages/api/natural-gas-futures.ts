import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const specificDate = url.searchParams.get('date'); // Optional specific curve date
    const contractTerm = url.searchParams.get('contractTerm') || 'Calendar'; // Default to Calendar
    
    console.log('Fetching Natural Gas futures data...', specificDate ? `for date: ${specificDate}` : 'for latest date', `contract term: ${contractTerm}`);
    
    let rawData;
    
    // For now, use fixed years for Calendar contracts to ensure it works
    let minYear, maxYear;
    if (contractTerm === 'Calendar') {
      minYear = 2025;
      maxYear = 2034;
    } else {
      // Get dynamic years for Month contracts
      const availableYearsResult = await ercotDb.$queryRaw<Array<{ min_year: number; max_year: number }>>`
        SELECT 
          MIN(EXTRACT(YEAR FROM "Contract_Begin")) as min_year,
          MAX(EXTRACT(YEAR FROM "Contract_Begin")) as max_year
        FROM "ERCOT"."OTCGH_Calendar_Curves_NG"
        WHERE "Contract_Term" = ${contractTerm}
          AND "Market" IN ('HSC', 'EP WEST TX', 'WAHA', 'SOCAL CITYGATE', 'HENRY BASIS', 'KATY')
      `;
      
      minYear = availableYearsResult[0]?.min_year || 2025;
      maxYear = availableYearsResult[0]?.max_year || 2035;
    }
    console.log(`Year range for ${contractTerm}: ${minYear} to ${maxYear}`);

    if (specificDate) {
      // Query for specific date
      rawData = await ercotDb.$queryRaw<Array<{
        Market: string;
        FP: number | string;
        Contract_Begin: Date;
        Curve_Date: Date;
        Contract_Term: string;
      }>>`
        SELECT "Market", "FP", "Contract_Begin", "Curve_Date", "Contract_Term"
        FROM "ERCOT"."OTCGH_Calendar_Curves_NG"
        WHERE "Curve_Date" = ${specificDate}::date
          AND "Contract_Term" = ${contractTerm}
          AND "Market" IN ('HSC', 'EP WEST TX', 'WAHA', 'SOCAL CITYGATE', 'HENRY BASIS', 'KATY')
          AND EXTRACT(YEAR FROM "Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
        ORDER BY "Market" ASC, "Contract_Begin" ASC
      `;
    } else {
      // Query for latest curve date (existing logic)
      rawData = await ercotDb.$queryRaw<Array<{
        Market: string;
        FP: number | string;
        Contract_Begin: Date;
        Curve_Date: Date;
        Contract_Term: string;
      }>>`
        WITH latest_curve_date AS (
          SELECT MAX("Curve_Date") as max_curve_date
          FROM "ERCOT"."OTCGH_Calendar_Curves_NG"
          WHERE "Contract_Term" = ${contractTerm}
            AND "Market" IN ('HSC', 'EP WEST TX', 'WAHA', 'SOCAL CITYGATE', 'HENRY BASIS', 'KATY')
            AND EXTRACT(YEAR FROM "Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
        )
        SELECT ng."Market", ng."FP", ng."Contract_Begin", ng."Curve_Date", ng."Contract_Term"
        FROM "ERCOT"."OTCGH_Calendar_Curves_NG" ng
        CROSS JOIN latest_curve_date lc
        WHERE ng."Curve_Date" = lc.max_curve_date
          AND ng."Contract_Term" = ${contractTerm}
          AND ng."Market" IN ('HSC', 'EP WEST TX', 'WAHA', 'SOCAL CITYGATE', 'HENRY BASIS', 'KATY')
          AND EXTRACT(YEAR FROM ng."Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
        ORDER BY ng."Market" ASC, ng."Contract_Begin" ASC
      `;
    }

    console.log(`Retrieved ${rawData.length} natural gas data points`);
    
    // Debug: Log the raw data to understand what we're getting
    console.log('Raw data breakdown:');
    const marketCounts = {};
    const yearCounts = {};
    rawData.forEach(row => {
      const market = row.Market;
      const year = new Date(row.Contract_Begin).getFullYear();
      marketCounts[market] = (marketCounts[market] || 0) + 1;
      yearCounts[year] = (yearCounts[year] || 0) + 1;
      
      // Debug: Log first few Contract_Begin values to see format
      if (Object.keys(yearCounts).length <= 3) {
        console.log(`Debug Contract_Begin: ${row.Contract_Begin}, Parsed Year: ${year}`);
      }
    });
    console.log('Records per market:', marketCounts);
    console.log('Records per year:', yearCounts);

    // Transform the data into the table structure
    const markets = ['HSC', 'KATY', 'WAHA', 'HENRY BASIS', 'EP WEST TX', 'SOCAL CITYGATE'];
    
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
      
      console.log(`Available month-year combinations: ${years.length} (${years.slice(0, 5).join(', ')}...)`);
    }
    
    // Create market display names mapping
    const marketDisplayNames: { [key: string]: string } = {
      'HSC': 'HSC',
      'KATY': 'Katy', 
      'WAHA': 'Waha',
      'HENRY BASIS': 'Henry',
      'EP WEST TX': 'El Paso',
      'SOCAL CITYGATE': 'SoCal City'
    };

    // Group data by market and year/month-year
    const dataByMarketYear: { [key: string]: { [key: string]: number } } = {};
    
    rawData.forEach(row => {
      const market = row.Market;
      const price = Number(row.FP); // Convert to number for calculations
      
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
        
        // Debug log for Month contracts
        if (market === 'HSC' && year <= 2026) {
          console.log(`Month contract: ${market} ${contractDate.toISOString()} -> ${monthYear}, Price: ${price}`);
        }
      }
    });

    // Build the table data structure
    const tableData = markets.map(market => {
      const marketData: { [key: string]: number | string | null } = {
        market: marketDisplayNames[market] || market
      };
      
      let totalPrice = 0;
      let priceCount = 0;
      
      // Add data for each year/month-year and calculate running total
      years.forEach(yearOrMonthYear => {
        const price = dataByMarketYear[market]?.[yearOrMonthYear];
        if (price !== undefined && price !== null) {
          marketData[yearOrMonthYear.toString()] = Number(price.toFixed(2)); // Round to 2 decimal places
          totalPrice += price;
          priceCount++;
        } else {
          marketData[yearOrMonthYear.toString()] = null; // No data available
        }
      });
      
      // Calculate 10-year average (only for Calendar contracts)
      let tenYearAvg = null;
      if (contractTerm === 'Calendar') {
        tenYearAvg = priceCount > 0 ? Number((totalPrice / priceCount).toFixed(2)) : null;
        marketData['tenYearStrip'] = tenYearAvg;
      }
      
      console.log(`${market}: ${priceCount} prices${contractTerm === 'Calendar' ? `, avg = ${tenYearAvg}` : ' (no avg for Month)'}`);
      
      return marketData;
    });

    // Get the latest curve date for metadata
    const latestCurveDate = rawData.length > 0 
      ? Math.max(...rawData.map(row => new Date(row.Curve_Date).getTime()))
      : null;

    const response = {
      success: true,
      message: 'Natural Gas futures data retrieved successfully',
      data: {
        tableData,
        years,
        markets: markets.map(m => marketDisplayNames[m] || m)
      },
      metadata: {
        rawDataPoints: rawData.length,
        latestCurveDate: latestCurveDate ? new Date(latestCurveDate).toISOString().split('T')[0] : null,
        units: '$/MMBtu',
        dateRange: `${minYear}-${maxYear}`,
        dataSource: 'ERCOT.OTCGH_Calendar_Curves_NG',
        contractTerm,
        yearRange: { minYear, maxYear }
      }
    };

    console.log('Natural Gas futures data processed successfully:', response.metadata);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to fetch Natural Gas futures data:', error);
    
    // Check if this is a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isDatabaseError = errorMessage.includes('connect') || errorMessage.includes('database') || errorMessage.includes('ENOTFOUND');
    
    if (isDatabaseError) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Database not configured for production environment',
        error: 'Natural Gas futures require DATABASE_URL_THIRD environment variable to connect to analytics_workspace database',
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
      message: 'Failed to fetch Natural Gas futures data',
      error: errorMessage
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
