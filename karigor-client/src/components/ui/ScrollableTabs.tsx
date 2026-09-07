import React, { useRef, useState, useEffect, useCallback } from 'react';

interface ScrollableTabsProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const ScrollableTabs: React.FC<ScrollableTabsProps> = ({
  children,
  className = '',
  containerClassName = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, children]);

  const scrollByAmount = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative group ${containerClassName}`}>
      {/* Left Scroll Affordance Button & Fade Gradient */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-4 bg-gradient-to-r from-gray-50 via-gray-50/80 to-transparent dark:from-gray-950 dark:via-gray-950/80 pointer-events-none">
          <button
            type="button"
            onClick={() => scrollByAmount(-180)}
            aria-label="Scroll tabs left"
            className="w-7 h-7 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 pointer-events-auto hover:scale-110 active:scale-95 transition text-xs cursor-pointer ml-0.5"
          >
            ‹
          </button>
        </div>
      )}

      {/* Main Horizontal Tab Track */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={`overflow-x-auto scroll-smooth no-scrollbar flex items-center ${className}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>

      {/* Right Scroll Affordance Button & Fade Gradient */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-4 bg-gradient-to-l from-gray-50 via-gray-50/80 to-transparent dark:from-gray-950 dark:via-gray-950/80 pointer-events-none">
          <button
            type="button"
            onClick={() => scrollByAmount(180)}
            aria-label="Scroll tabs right"
            className="w-7 h-7 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 pointer-events-auto hover:scale-110 active:scale-95 transition text-xs cursor-pointer mr-0.5"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};
