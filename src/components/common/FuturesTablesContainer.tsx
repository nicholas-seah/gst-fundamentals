import React, { useState } from 'react';
import NaturalGasFuturesTable from './NaturalGasFuturesTable';
import PowerFuturesTable from './PowerFuturesTable';
import HeatRateFuturesTable from './HeatRateFuturesTable';
import ComparisonView from './ComparisonView';

const FuturesTablesContainer: React.FC = () => {
  const [viewMode, setViewMode] = useState<'current' | 'comparison'>('current');
  const [contractTerm, setContractTerm] = useState<'Calendar' | 'Month'>('Calendar');

  return (
    <div className="space-y-6">
      {/* Master Toggles */}
      <div className="flex justify-between items-center">
        {/* Contract Term Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setContractTerm('Calendar')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              contractTerm === 'Calendar' 
                ? 'bg-gray-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setContractTerm('Month')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              contractTerm === 'Month' 
                ? 'bg-gray-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Month
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('current')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'current' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Latest Curve
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'comparison' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Comparison
          </button>
        </div>
      </div>

      {/* Content based on selected mode */}
      {viewMode === 'current' && (
        <>
          {/* Natural Gas Futures Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <NaturalGasFuturesTable contractTerm={contractTerm} />
          </div>
          
          {/* Power Futures Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <PowerFuturesTable contractTerm={contractTerm} />
          </div>
          
          {/* Heat Rate Futures Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <HeatRateFuturesTable contractTerm={contractTerm} />
          </div>
        </>
      )}

      {viewMode === 'comparison' && (
        <ComparisonView contractTerm={contractTerm} />
      )}
    </div>
  );
};

export default FuturesTablesContainer;
