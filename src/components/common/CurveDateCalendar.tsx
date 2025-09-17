import React, { useState, useRef, useEffect } from 'react';

interface CurveDateCalendarProps {
  selectedDate: string;
  availableDates: string[];
  onChange: (date: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const CurveDateCalendar: React.FC<CurveDateCalendarProps> = ({
  selectedDate,
  availableDates,
  onChange,
  disabled = false,
  placeholder = "Select Date"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) {
      return new Date(selectedDate);
    }
    if (availableDates.length > 0) {
      return new Date(availableDates[0]); // Most recent date
    }
    return new Date();
  });
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Convert available dates to Set for O(1) lookup
  const availableDatesSet = new Set(availableDates);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const isAvailable = availableDatesSet.has(dateStr);
      const isSelected = dateStr === selectedDate;
      
      days.push({
        day,
        dateStr,
        isAvailable,
        isSelected
      });
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleDateClick = (dateStr: string, isAvailable: boolean) => {
    if (isAvailable && !disabled) {
      onChange(dateStr);
      setIsOpen(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return placeholder;
    // Parse YYYY-MM-DD format directly to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month - 1 because Date constructor uses 0-based months
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Date Input Display */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full text-sm border border-gray-300 rounded px-3 py-2 text-left flex items-center justify-between ${
          disabled 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-white hover:bg-gray-50 cursor-pointer'
        }`}
      >
        <span>{formatDisplayDate(selectedDate)}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3 min-w-[280px]">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <h3 className="text-sm font-semibold text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            
            <button
              type="button"
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-xs text-gray-500 text-center py-1 font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={index} className="aspect-square">
                {day ? (
                  <button
                    type="button"
                    onClick={() => handleDateClick(day.dateStr, day.isAvailable)}
                    className={`w-full h-full text-xs rounded flex items-center justify-center transition-colors ${
                      day.isSelected
                        ? 'bg-blue-600 text-white font-semibold'
                        : day.isAvailable
                        ? 'text-gray-900 hover:bg-blue-100 cursor-pointer font-medium'
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                    disabled={!day.isAvailable}
                  >
                    {day.day}
                  </button>
                ) : (
                  <div></div>
                )}
              </div>
            ))}
          </div>

          {/* Available dates count */}
          <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500 text-center">
            {availableDates.length} curve dates available
          </div>
        </div>
      )}
    </div>
  );
};

export default CurveDateCalendar;
