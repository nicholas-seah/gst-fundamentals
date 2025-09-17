import React, { useState, useEffect, useRef } from 'react';

interface DateRangeSliderProps {
  availableDates: (string | number)[];
  selectedRange: [number, number]; // indices of start and end
  onRangeChange: (range: [number, number]) => void;
  contractTerm: 'Calendar' | 'Month';
}

const DateRangeSlider: React.FC<DateRangeSliderProps> = ({
  availableDates,
  selectedRange,
  onRangeChange,
  contractTerm
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [tempRange, setTempRange] = useState<[number, number]>(selectedRange);

  useEffect(() => {
    setTempRange(selectedRange);
  }, [selectedRange]);

  const handleMouseDown = (handle: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(handle);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (availableDates.length - 1));

    setTempRange(prev => {
      if (isDragging === 'start') {
        return [Math.min(index, prev[1]), prev[1]];
      } else {
        return [prev[0], Math.max(index, prev[0])];
      }
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      onRangeChange(tempRange);
      setIsDragging(null);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, tempRange]);

  const formatLabel = (date: string | number): string => {
    if (contractTerm === 'Calendar') {
      return date.toString();
    } else {
      // For Month contracts, show abbreviated format
      return typeof date === 'string' ? date : date.toString();
    }
  };

  const getHandlePosition = (index: number): number => {
    return (index / (availableDates.length - 1)) * 100;
  };

  const currentRange = isDragging ? tempRange : selectedRange;
  const startPos = getHandlePosition(currentRange[0]);
  const endPos = getHandlePosition(currentRange[1]);

  return (
    <div className="space-y-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg shadow-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-blue-800">
            Date Range:
          </h4>
          <div className="text-sm text-blue-800 font-bold">
            {formatLabel(availableDates[currentRange[0]])} - {formatLabel(availableDates[currentRange[1]])}
          </div>
        </div>
        <button
          onClick={() => onRangeChange([0, availableDates.length - 1])}
          className="px-3 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="relative">
        {/* Slider Track */}
        <div 
          ref={sliderRef}
          className="relative h-1 bg-gray-200 rounded-full cursor-pointer"
        >
          {/* Active Range */}
          <div
            className="absolute h-1 bg-blue-500 rounded-full"
            style={{
              left: `${startPos}%`,
              width: `${endPos - startPos}%`
            }}
          />

          {/* Start Handle */}
          <div
            className="absolute w-5 h-5 bg-blue-600 border-2 border-white rounded-full shadow-md cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-1/2"
            style={{ 
              left: `${startPos}%`,
              top: '50%'
            }}
            onMouseDown={handleMouseDown('start')}
          />

          {/* End Handle */}
          <div
            className="absolute w-5 h-5 bg-blue-600 border-2 border-white rounded-full shadow-md cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-1/2"
            style={{ 
              left: `${endPos}%`,
              top: '50%'
            }}
            onMouseDown={handleMouseDown('end')}
          />
        </div>

        {/* Tick Marks */}
        <div className="relative mt-2">
          <div className="flex justify-between text-xs text-gray-400">
            {Array.from({ length: 5 }, (_, i) => {
              const index = Math.floor((i / 4) * (availableDates.length - 1));
              return (
                <span key={i} className="text-center">
                  {formatLabel(availableDates[index])}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateRangeSlider;
