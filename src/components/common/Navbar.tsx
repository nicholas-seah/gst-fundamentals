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

  // Determine active states for navigation
  const isNaturalGasActive = currentPath === '/fundamentals/natural-gas';
  const isLoadActive = currentPath.startsWith('/fundamentals/load/');
  const isSupplyStackActive = currentPath.startsWith('/fundamentals/supply-stack/');

  return (
    <header className="bg-[#2A2A2A] text-white shadow-sm">
      <div className="max-w-7xl mx-auto pl-8 pr-4 sm:pl-10 sm:pr-6 lg:pl-16 lg:pr-8">
        <div className="flex justify-between items-center py-3">
          
          {/* LEFT SIDE: Logo + Brand + Navigation */}
          <div className="flex items-center gap-7">
            
            {/* GridStor Logo */}
            <a 
              href="https://gridstoranalytics.com" 
              className="hover:text-gray-300 transition-colors"
            >
              <div className="bg-white p-1 flex items-center justify-center w-8 h-8 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6">
                  <g transform="translate(2, 2) scale(0.875)">
                    <path d="M4 8 L14 8 L14 11 L7 11 L7 21 L14 21 L14 18 L10 18 L10 15 L14 15 L14 24 L4 24 C4 24 4 8 4 8" 
                          fill="#2F3640"/>
                    <path d="M13.5 13 L18 13 L15 17.5 L19 17.5 L14 24 L15.5 17.5 L12.5 17.5 L13.5 13" 
                          fill="#40C4DE"/>
                    <path d="M18 8 L28 8 L28 11 L21 11 L21 15 L28 15 L28 24 L18 24 L18 21 L25 21 L25 18 L18 18 Z" 
                          fill="#2F3640"/>
                  </g>
                </svg>
              </div>
            </a>
            
            {/* Fundamentals Brand Name */}
            <a 
              href="/fundamentals" 
              className="text-lg font-semibold hover:text-gray-300 transition-colors"
            >
              Fundamentals
            </a>
            
            {/* Main Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              
              {/* Natural Gas Tab */}
              <a
                href="/fundamentals/natural-gas"
                className={`text-sm font-medium transition-colors px-3 py-1 ${
                  isNaturalGasActive ? 'text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                Natural Gas
              </a>

              {/* Load Dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setIsLoadDropdownOpen(true)}
                onMouseLeave={() => setIsLoadDropdownOpen(false)}
              >
                <button
                  className={`text-sm font-medium transition-colors px-3 py-1 flex items-center gap-1 ${
                    isLoadActive ? 'text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Load
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menu */}
                {isLoadDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-72 bg-white rounded-md shadow-lg z-50">
                    <div className="py-1">
                      {loadDropdownItems.map((item) => (
                        <a
                          key={item.name}
                          href={item.href}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
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
                className="relative"
                onMouseEnter={() => setIsSupplyStackDropdownOpen(true)}
                onMouseLeave={() => setIsSupplyStackDropdownOpen(false)}
              >
                <button
                  className={`text-sm font-medium transition-colors px-3 py-1 flex items-center gap-1 ${
                    isSupplyStackActive ? 'text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Supply Stack
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menu */}
                {isSupplyStackDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-56 bg-white rounded-md shadow-lg z-50">
                    <div className="py-1">
                      {supplyStackDropdownItems.map((item) => (
                        <a
                          key={item.name}
                          href={item.href}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          {item.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
            </nav>
            
          </div>
          
          {/* RIGHT SIDE: Settings + User Icons */}
          <div className="flex items-center gap-4">
            
            {/* Settings Icon */}
            <button className="text-gray-300 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* User Icon */}
            <button className="text-gray-300 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            
          </div>
          
        </div>
      </div>
    </header>
  );
};

export default Navbar;