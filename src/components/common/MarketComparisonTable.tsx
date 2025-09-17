import React from 'react';

interface ComparisonRow {
  category: string;
  caisoImpact: string;
  ercotImpact: string;
  difference: string;
  reasons: string[];
}

const MarketComparisonTable: React.FC = () => {
  // Mock data following the structure from your image
  const comparisonData: ComparisonRow[] = [
    {
      category: "Gas Price",
      caisoImpact: "+$0.90/kw-mn per $1.00/mmbtu",
      ercotImpact: "+$0.80/kw-mn per $1.00/mmbtu", 
      difference: "CAISO more sensitive to gas prices by $0.10 of revenue per dollar of gas",
      reasons: [
        "ERCOT has a much deeper and more liquid natural gas market than CAISO. In ERCOT gas generators bid higher the higher the gas price",
        "In CAISO gas generators bid higher the higher the gas price. This could be because bidding rules in CAISO permit higher bidding as gas prices rise, and/or local gas transportation costs increase when the gas price is higher in California"
      ]
    },
    {
      category: "Solar Capacity",
      caisoImpact: "+$0.10/kw-mn per 1 GW of solar",
      ercotImpact: "+$0.20/kw-mn per 1 GW of solar",
      difference: "ERCOT more sensitive to solar capacity by $0.10 of revenue per GW of solar",
      reasons: [
        "In CAISO solar projects have saturated most of the grid capacity in southern California, as a result transmission constraints limit their price impact. The reason solar still influences prices at all is that California exports power to neighbors, especially south-to-north during the winter and early spring to the Pacific Northwest",
        "In ERCOT solar drives down mid-day prices, especially in summer months. In 2025 the majority of solar is being constructed in central and east Texas away from the transmission constrained west Texas"
      ]
    },
    {
      category: "Storage Capacity", 
      caisoImpact: "-$0.20/kw-mn per 1 GW of Storage",
      ercotImpact: "-$0.15/kw-mn per 1 GW of Storage",
      difference: "CAISO more sensitive to storage capacity by $0.05 of revenue per GW of Storage",
      reasons: [
        "Storage resources in CAISO are beginning to saturate the peak energy market hours, that competition leads to lower pricing in peak hours, especially during the shoulder months",
        "In ERCOT high priced hours in the evening peak, storage discharge is only a small percentage of generation about 5% typically, so it does not impact price as much. In CAISO by contrast storage discharge reaches 30%+ of total generation"
      ]
    },
    {
      category: "Hydro Production",
      caisoImpact: "-$0.15/kw-mn per 1 TWh of hydro",
      ercotImpact: "-",
      difference: "N/A",
      reasons: [
        "There is very little hydro production in ERCOT"
      ]
    },
    {
      category: "Load",
      caisoImpact: "-",
      ercotImpact: "+$0.02/kw-mn per 1 TWh of load",
      difference: "N/A", 
      reasons: [
        "Load is not expected to grow enough in CAISO in 2025 to impact revenue"
      ]
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Market Impact Comparison</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left p-4 font-semibold text-white" style={{backgroundColor: '#34D5ED'}}>Category</th>
              <th className="text-center p-4 font-semibold text-gray-700 bg-gray-100">CAISO - Impact on Storage Revenue</th>
              <th className="text-center p-4 font-semibold text-gray-700 bg-gray-100">ERCOT - Impact on Storage Revenue</th>
              <th className="text-center p-4 font-semibold text-gray-700 bg-gray-100">Difference</th>
              <th className="text-center p-4 font-semibold text-gray-700 bg-gray-100">Reasons they are different</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row, index) => (
              <tr key={row.category} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="p-4 font-semibold text-white" style={{backgroundColor: '#34D5ED'}}>
                  {row.category}
                </td>
                <td className="p-4 text-center text-gray-800">
                  {row.caisoImpact}
                </td>
                <td className="p-4 text-center text-gray-800">
                  {row.ercotImpact}
                </td>
                <td className="p-4 text-center text-gray-800">
                  {row.difference}
                </td>
                <td className="p-4 text-gray-700">
                  <ul className="space-y-2">
                    {row.reasons.map((reason, reasonIndex) => (
                      <li key={reasonIndex} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-xs leading-relaxed">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Note: This is sample comparative data for demonstration purposes. Actual market impacts may vary based on current conditions and regulatory changes.
      </div>
    </div>
  );
};

export default MarketComparisonTable;
