import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const peakHour = url.searchParams.get('peakHour') || 'ON_PEAK'; // Default to ON_PEAK
    const specificDate = url.searchParams.get('date'); // Optional specific curve date
    const contractTerm = url.searchParams.get('contractTerm') || 'Calendar'; // Default to Calendar
    
    console.log('Fetching Heat Rate futures data for peak hour:', peakHour, specificDate ? `and date: ${specificDate}` : 'for latest date', `contract term: ${contractTerm}`);
    
    let targetCurveDate;
    
    // Get dynamic year ranges for both power and gas with this contract term
    const powerYearsResult = await ercotDb.$queryRaw<Array<{ min_year: number; max_year: number }>>`
      SELECT 
        MIN(EXTRACT(YEAR FROM "Contract_Begin")) as min_year,
        MAX(EXTRACT(YEAR FROM "Contract_Begin")) as max_year
      FROM "ERCOT"."OTCGH_Calendar_Curves_PW"
      WHERE "Contract_Term" = ${contractTerm}
        AND "Market" IN ('Houston', 'South', 'North', 'West_TX', 'SP_15')
        AND "Peak_Hour" = ${peakHour}
    `;
    
    const gasYearsResult = await ercotDb.$queryRaw<Array<{ min_year: number; max_year: number }>>`
      SELECT 
        MIN(EXTRACT(YEAR FROM "Contract_Begin")) as min_year,
        MAX(EXTRACT(YEAR FROM "Contract_Begin")) as max_year
      FROM "ERCOT"."OTCGH_Calendar_Curves_NG"
      WHERE "Contract_Term" = ${contractTerm}
        AND "Market" IN ('HSC', 'KATY', 'WAHA', 'EP WEST TX', 'SOCAL CITYGATE')
    `;
    
    const minYear = Math.max(powerYearsResult[0]?.min_year || 2025, gasYearsResult[0]?.min_year || 2025);
    const maxYear = Math.min(powerYearsResult[0]?.max_year || 2034, gasYearsResult[0]?.max_year || 2034);
    console.log(`Dynamic year range for ${contractTerm} heat rate: ${minYear} to ${maxYear}`);

    if (specificDate) {
      targetCurveDate = specificDate;
      console.log('Using specified curve date:', targetCurveDate);
    } else {
      // Get the latest curve date that exists in BOTH power and gas tables for this contract term
      const latestCurveDateResult = await ercotDb.$queryRaw<Array<{ latest_curve_date: Date }>>`
        SELECT MIN(max_date) as latest_curve_date
        FROM (
          SELECT MAX("Curve_Date") as max_date
          FROM "ERCOT"."OTCGH_Calendar_Curves_PW"
          WHERE "Contract_Term" = ${contractTerm}
            AND "Market" IN ('Houston', 'South', 'North', 'West_TX', 'SP_15')
            AND "Peak_Hour" = ${peakHour}
            AND EXTRACT(YEAR FROM "Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
          UNION ALL
          SELECT MAX("Curve_Date") as max_date  
          FROM "ERCOT"."OTCGH_Calendar_Curves_NG"
          WHERE "Contract_Term" = ${contractTerm}
            AND "Market" IN ('HSC', 'KATY', 'WAHA', 'EP WEST TX', 'SOCAL CITYGATE')
            AND EXTRACT(YEAR FROM "Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
        ) combined_dates
      `;
      
      targetCurveDate = latestCurveDateResult[0]?.latest_curve_date;
      console.log('Latest common curve date:', targetCurveDate);
      
      if (!targetCurveDate) {
        throw new Error('No common curve date found between power and gas data');
      }
    }

    // Get Power data for the target curve date
    const powerData = await ercotDb.$queryRaw<Array<{
      Market: string;
      Mid: number | string;
      ATC: number | string;
      Contract_Begin: Date;
      Curve_Date: Date;
    }>>`
      SELECT "Market", "Mid", "ATC", "Contract_Begin", "Curve_Date"
      FROM "ERCOT"."OTCGH_Calendar_Curves_PW"
      WHERE "Curve_Date" = ${targetCurveDate}::date
        AND "Contract_Term" = ${contractTerm}
        AND "Market" IN ('Houston', 'South', 'North', 'West_TX', 'SP_15')
        AND "Peak_Hour" = ${peakHour === 'ATC' ? 'ON_PEAK' : peakHour}
        AND EXTRACT(YEAR FROM "Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
      ORDER BY "Market" ASC, "Contract_Begin" ASC
    `;

    // Get Natural Gas data for the same curve date
    const gasData = await ercotDb.$queryRaw<Array<{
      Market: string;
      FP: number | string;
      Contract_Begin: Date;
      Curve_Date: Date;
    }>>`
      SELECT "Market", "FP", "Contract_Begin", "Curve_Date"
      FROM "ERCOT"."OTCGH_Calendar_Curves_NG"
      WHERE "Curve_Date" = ${targetCurveDate}::date
        AND "Contract_Term" = ${contractTerm}
        AND "Market" IN ('HSC', 'KATY', 'WAHA', 'EP WEST TX', 'SOCAL CITYGATE')
        AND EXTRACT(YEAR FROM "Contract_Begin") BETWEEN ${minYear} AND ${maxYear}
      ORDER BY "Market" ASC, "Contract_Begin" ASC
    `;

    console.log(`Retrieved ${powerData.length} power data points and ${gasData.length} gas data points`);

    // Create hub mapping (Power Hub → Gas Hub)
    const hubMapping: { [key: string]: string } = {
      'Houston': 'HSC',
      'South': 'KATY', 
      'North': 'WAHA',
      'West_TX': 'EP WEST TX',
      'SP_15': 'SOCAL CITYGATE'
    };

    // Create market display names
    const marketDisplayNames: { [key: string]: string } = {
      'Houston': 'Houston',
      'South': 'ERCOT South',
      'North': 'ERCOT North', 
      'West_TX': 'ERCOT West',
      'SP_15': 'SP 15'
    };

    // Group power data by market and year/month-year
    const powerByMarketYear: { [key: string]: { [key: string]: number } } = {};
    powerData.forEach(row => {
      const market = row.Market;
      // Use ATC column if peakHour is 'ATC', otherwise use Mid column
      const price = Number(peakHour === 'ATC' ? row.ATC : row.Mid);
      
      if (!powerByMarketYear[market]) {
        powerByMarketYear[market] = {};
      }
      
      if (contractTerm === 'Calendar') {
        // For Calendar contracts, group by year
        const year = new Date(row.Contract_Begin).getFullYear();
        powerByMarketYear[market][year] = price;
      } else {
        // For Month contracts, group by month-year combination
        const contractDate = new Date(row.Contract_Begin);
        const year = contractDate.getFullYear();
        const month = contractDate.getMonth(); // 0-11
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthYear = `${monthNames[month]} ${year}`;
        
        powerByMarketYear[market][monthYear] = price;
      }
    });

    // Group gas data by market and year/month-year
    const gasByMarketYear: { [key: string]: { [key: string]: number } } = {};
    gasData.forEach(row => {
      const market = row.Market;
      const price = Number(row.FP);
      
      if (!gasByMarketYear[market]) {
        gasByMarketYear[market] = {};
      }
      
      if (contractTerm === 'Calendar') {
        // For Calendar contracts, group by year
        const year = new Date(row.Contract_Begin).getFullYear();
        gasByMarketYear[market][year] = price;
      } else {
        // For Month contracts, group by month-year combination
        const contractDate = new Date(row.Contract_Begin);
        const year = contractDate.getFullYear();
        const month = contractDate.getMonth(); // 0-11
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthYear = `${monthNames[month]} ${year}`;
        
        gasByMarketYear[market][monthYear] = price;
      }
    });

    // Calculate heat rates and build table data
    const markets = ['Houston', 'South', 'North', 'West_TX', 'SP_15'];
    
    let years;
    if (contractTerm === 'Calendar') {
      years = Array.from({length: maxYear - minYear + 1}, (_, i) => minYear + i); // 2025, 2026, etc.
    } else {
      // For Month contracts, get the actual available month-year combinations from both datasets
      const availableMonthYears = new Set<string>();
      
      // Add available months from power data
      powerData.forEach(row => {
        const contractDate = new Date(row.Contract_Begin);
        const year = contractDate.getFullYear();
        const month = contractDate.getMonth(); // 0-11
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthYear = `${monthNames[month]} ${year}`;
        availableMonthYears.add(monthYear);
      });
      
      // Add available months from gas data
      gasData.forEach(row => {
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
      
      console.log(`Available heat rate month-year combinations: ${years.length} (${years.slice(0, 5).join(', ')}...)`);
    }
    
    const tableData = markets.map(powerMarket => {
      const gasMarket = hubMapping[powerMarket];
      const marketData: { [key: string]: number | string | null } = {
        market: marketDisplayNames[powerMarket] || powerMarket
      };
      
      let totalHeatRate = 0;
      let heatRateCount = 0;
      
      // Calculate heat rate for each year/month-year
      years.forEach(yearOrMonthYear => {
        const powerPrice = powerByMarketYear[powerMarket]?.[yearOrMonthYear];
        const gasPrice = gasByMarketYear[gasMarket]?.[yearOrMonthYear];
        
        if (powerPrice !== undefined && gasPrice !== undefined && gasPrice > 0) {
          const heatRate = powerPrice / gasPrice; // MMBtu/MWh
          marketData[yearOrMonthYear.toString()] = Number(heatRate.toFixed(2));
          totalHeatRate += heatRate;
          heatRateCount++;
        } else {
          marketData[yearOrMonthYear.toString()] = null; // Missing data
        }
      });
      
      // Calculate 10-year average heat rate (only for Calendar contracts)
      let tenYearAvg = null;
      if (contractTerm === 'Calendar') {
        tenYearAvg = heatRateCount > 0 ? Number((totalHeatRate / heatRateCount).toFixed(2)) : null;
        marketData['tenYearStrip'] = tenYearAvg;
      }
      
      console.log(`${powerMarket} → ${gasMarket}: ${heatRateCount} heat rates${contractTerm === 'Calendar' ? `, avg = ${tenYearAvg}` : ' (no avg for Month)'}`);
      
      return marketData;
    });

    const response = {
      success: true,
      message: 'Heat Rate futures data calculated successfully',
      data: {
        tableData,
        years,
        markets: markets.map(m => marketDisplayNames[m] || m),
        peakHour
      },
      metadata: {
        powerDataPoints: powerData.length,
        gasDataPoints: gasData.length,
        latestCurveDate: typeof targetCurveDate === 'string' ? targetCurveDate : (targetCurveDate ? new Date(targetCurveDate).toISOString().split('T')[0] : null),
        units: 'MMBtu/MWh',
        dateRange: `${minYear}-${maxYear}`,
        powerSource: 'ERCOT.OTCGH_Calendar_Curves_PW',
        gasSource: 'ERCOT.OTCGH_Calendar_Curves_NG',
        peakHour,
        contractTerm,
        yearRange: { minYear, maxYear },
        hubMapping
      }
    };

    console.log('Heat Rate futures data processed successfully:', response.metadata);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to fetch Heat Rate futures data:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isDatabaseError = errorMessage.includes('connect') || errorMessage.includes('database') || errorMessage.includes('ENOTFOUND');
    
    if (isDatabaseError) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Database not configured for production environment',
        error: 'Heat Rate futures require DATABASE_URL_THIRD environment variable to connect to analytics_workspace database',
        requiresConfiguration: true
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch Heat Rate futures data',
      error: errorMessage
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
