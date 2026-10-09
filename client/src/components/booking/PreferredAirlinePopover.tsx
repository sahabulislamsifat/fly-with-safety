'use client';

import { useState, useRef, useEffect } from 'react';
import { preferredAirlinesList } from '@/lib/data/site-data';
import { Icon } from '@/components/ui/Icons';

interface PreferredAirlinePopoverProps {
  selectedAirlines: string[];
  onChange: (airlines: string[]) => void;
}

export function PreferredAirlinePopover({
  selectedAirlines,
  onChange,
}: PreferredAirlinePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAirlines = preferredAirlinesList.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.code.toLowerCase().includes(query.toLowerCase())
  );

  const toggleAirline = (name: string) => {
    if (selectedAirlines.includes(name)) {
      onChange(selectedAirlines.filter((a) => a !== name));
    } else {
      onChange([...selectedAirlines, name]);
    }
  };

  const removeAirline = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    onChange(selectedAirlines.filter((a) => a !== name));
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Selected tags + Trigger Button */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {selectedAirlines.map((airline) => (
          <span
            key={airline}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xs bg-red-50 text-[#8B1D24] text-xs font-semibold border border-red-200"
          >
            <span className="truncate max-w-[130px]">{airline}</span>
            <button
              type="button"
              onClick={(e) => removeAirline(e, airline)}
              className="hover:text-red-900 rounded-xs p-0.5"
              aria-label={`Remove ${airline}`}
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs border border-dashed border-neutral-300 hover:border-[#8B1D24] bg-white text-xs font-bold text-[#8B1D24] hover:bg-red-50/40 transition-colors cursor-pointer"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label="Add preferred airline"
        >
          <Icon name="search" size={13} className="text-[#8B1D24]" />
          <span>Add preferred Airline</span>
        </button>
      </div>

      {/* Popover - rounded-xs */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Select preferred airlines"
          className="absolute right-0 bottom-full mb-2 z-50 w-72 sm:w-80 bg-white rounded-xs border border-neutral-200/90 shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100">
            <span className="text-xs font-bold text-neutral-900">Select Preferred Airlines</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 p-1 rounded-xs"
            >
              <Icon name="x" size={14} />
            </button>
          </div>

          <div className="relative mb-3">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter airlines..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#8B1D24]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 py-1">
            {filteredAirlines.map((airline) => {
              const isChecked = selectedAirlines.includes(airline.name);
              return (
                <label
                  key={airline.code}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xs hover:bg-neutral-50 cursor-pointer text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleAirline(airline.name)}
                      className="rounded-xs border-neutral-300 text-[#8B1D24] focus:ring-[#8B1D24]"
                    />
                    <span className="font-medium text-neutral-800">{airline.name}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-neutral-400">
                    {airline.code}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-3 pt-2 border-t border-neutral-100 flex justify-between items-center text-xs">
            <span className="text-[11px] text-neutral-400">
              {selectedAirlines.length} selected
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-xs bg-[#8B1D24] hover:bg-[#74181E] text-white text-[11px] font-bold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
