import React, { useEffect, useState } from 'react';

export default function Navbar() {
  // State for active page detection
  const [currentPath, setCurrentPath] = useState('');
  
  // useEffect to detect current page
  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  // Helper functions for active state detection
  const isLikedayActive = currentPath.includes('/likeday');
  const isPCMActive = currentPath.includes('/pcm/');
  const isMLActive = currentPath.includes('/ml');
  const isGOOPActive = currentPath.includes('/goop');

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
              <div className="bg-white p-1 flex items-center justify-center">
                <img src="/GST_logo.svg" alt="GridStor Analytics Logo" className="w-6 h-6" />
              </div>
            </a>
            
            {/* Market Ops Brand Name */}
            <a 
              href="/market-ops" 
              className="text-lg font-semibold hover:text-gray-300 transition-colors"
            >
              Market Ops
            </a>
            
            {/* Main Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              
              {/* Likeday Tab */}
              <a
                href="/market-ops/likeday"
                className={`text-sm font-medium transition-colors px-3 py-1 ${
                  isLikedayActive ? 'text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                Likeday
              </a>

              {/* PCM Dropdown */}
              <div className="relative group">
                <button className={`text-sm font-medium transition-colors px-3 py-1 flex items-center gap-1 ${
                  isPCMActive ? 'text-white' : 'text-gray-300 hover:text-white'
                }`}>
                  PCM
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menu */}
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-1">
                    <a href="/market-ops/pcm/caiso-forecast" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      CAISO Forecast
                    </a>
                    <a href="/market-ops/pcm/goleta" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Goleta
                    </a>
                  </div>
                </div>
              </div>

              {/* ML Tab */}
              <a
                href="/market-ops/ml"
                className={`text-sm font-medium transition-colors px-3 py-1 ${
                  isMLActive ? 'text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                ML
              </a>

              {/* GOOP Tab */}
              <a
                href="/market-ops/goop"
                className={`text-sm font-medium transition-colors px-3 py-1 ${
                  isGOOPActive ? 'text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                GOOP
              </a>
              
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
}