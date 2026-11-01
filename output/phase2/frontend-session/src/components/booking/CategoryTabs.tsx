'use client';

import { SearchTab } from '@/types';
import { Icon, IconName } from '@/components/ui/Icons';

interface CategoryTabItem {
  id: SearchTab;
  label: string;
  icon: IconName;
}

const categories: CategoryTabItem[] = [
  { id: 'flights', label: 'Flight', icon: 'plane' },
  { id: 'visa', label: 'Visa', icon: 'fileText' },
  { id: 'hotels', label: 'Hotel', icon: 'hotel' },
  { id: 'packages', label: 'Holiday', icon: 'palmtree' },
];

interface CategoryTabsProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
}

export function CategoryTabs({ activeTab, onTabChange }: CategoryTabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % categories.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + categories.length) % categories.length;
    } else {
      return;
    }
    e.preventDefault();
    onTabChange(categories[nextIndex].id);
    const tabEl = document.getElementById(`category-tab-${categories[nextIndex].id}`);
    tabEl?.focus();
  };

  return (
    <div className="relative z-30 flex justify-center -mb-[30px] px-4 pointer-events-auto">
      <nav
        role="tablist"
        aria-label="Travel categories"
        className="inline-flex items-center p-1.5 bg-white border border-slate-200/90 rounded-xs shadow-[0_10px_30px_rgba(0,0,0,0.08)] h-[58px] sm:h-[62px] gap-1 sm:gap-1.5 max-w-full overflow-x-auto no-scrollbar"
      >
        {categories.map((cat, idx) => {
          const isActive = activeTab === cat.id;

          return (
            <button
              key={cat.id}
              id={`category-tab-${cat.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`category-panel-${cat.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(cat.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xs text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1D24] ${
                isActive
                  ? 'bg-[#8B1D24] text-white shadow-md'
                  : 'bg-transparent text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50/80'
              }`}
            >
              {/* Icon container */}
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xs flex items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-red-50 text-[#8B1D24]'
                }`}
              >
                <Icon
                  name={cat.icon}
                  size={15}
                  className={cat.id === 'flights' ? 'transform -rotate-45' : ''}
                />
              </div>

              <span>{cat.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
