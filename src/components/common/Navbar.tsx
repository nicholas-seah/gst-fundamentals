import React, { useState, useEffect } from 'react';

const Navbar: React.FC = () => {
  const [isLoadDropdownOpen, setIsLoadDropdownOpen] = useState(false);
  const [isSupplyStackDropdownOpen, setIsSupplyStackDropdownOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  // Track current path for active state
  useEffect(() => {
    setCurrentPath(window.location.pathname);
    
    // Listen for navigation changes (for client-side routing)
    const handlePopstate = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopstate);
    
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, []);

  const loadDropdownItems = [
    { name: 'Structural Demand', href: '/fundamentals/load/weather-normalized-load' },
  ];

  const supplyStackDropdownItems = [
    { name: 'Generation Supply Stack', href: '/fundamentals/supply-stack/generation-supply-stack' },
    { name: 'BESS Capacity', href: '/fundamentals/supply-stack/bess-capacity' },
  ];

  // Determine active states for new navigation
  const isNaturalGasActive = currentPath === '/fundamentals/natural-gas';
  const isLoadActive = currentPath.startsWith('/fundamentals/load/');
  const isSupplyStackActive = currentPath.startsWith('/fundamentals/supply-stack/');

  return (
    <nav className="bg-white border-b border-gray-200 h-16">
      <div className="max-w-7xl mx-auto h-16 flex items-center px-4 sm:px-6 lg:px-8" style={{ fontFamily: `'Inter', system-ui, -apple-system, sans-serif` }}>
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center">
          <a href="/fundamentals" className="flex items-center">
            <img src="/logo.svg" alt="Energy Dashboard" className="h-8 w-auto cursor-pointer" />
            <span className="ml-3 text-xl font-semibold text-gray-900" style={{ fontFamily: `'Inter', system-ui, -apple-system, sans-serif` }}>
              Fundamentals
            </span>
          </a>
        </div>
        
        {/* Navigation */}
        <div className="hidden sm:flex sm:ml-6 flex h-full space-x-8">
          {/* Natural Gas Tab */}
          <a
            href="/fundamentals/natural-gas"
            className={`h-full flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-150 border-b-2 ${
              isNaturalGasActive 
                ? 'border-indigo-500 text-gray-900' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            style={{ fontFamily: `'Inter', system-ui, -apple-system, sans-serif` }}
          >
            Natural Gas
          </a>

          {/* Load Dropdown */}
          <div 
            className="relative h-full flex items-center"
            onMouseEnter={() => setIsLoadDropdownOpen(true)}
            onMouseLeave={() => setIsLoadDropdownOpen(false)}
          >
            <button
              className={`h-full flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-150 border-b-2 ${
                isLoadActive 
                  ? 'border-indigo-500 text-gray-900' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={{ fontFamily: `'Inter', system-ui, -apple-system, sans-serif` }}
            >
              Load
              <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            {isLoadDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                <div className="py-1">
                  {loadDropdownItems.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                      style={{ fontFamily: `'Inter', system-ui, -apple-system, sans-serif` }}
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Supply Stack Dropdown */}
          <div 
            className="relative h-full flex items-center"
            onMouseEnter={() => setIsSupplyStackDropdownOpen(true)}
            onMouseLeave={() => setIsSupplyStackDropdownOpen(false)}
          >
            <button
              className={`h-full flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-150 border-b-2 ${
                isSupplyStackActive 
                  ? 'border-indigo-500 text-gray-900' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={{ fontFamily: `'Inter', system-ui, -apple-system, sans-serif` }}
            >
              Supply Stack
              <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            {isSupplyStackDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                <div className="py-1">
                  {supplyStackDropdownItems.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                      style={{ fontFamily: `'Inter', system-ui, -apple-system, sans-serif` }}
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 