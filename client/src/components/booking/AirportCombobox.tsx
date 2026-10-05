'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { searchAirports, Airport } from '@/lib/api/flights';
import { Icon } from '@/components/ui/Icons';

interface AirportComboboxProps {
  label: string;
  value: string;
  onChange: (code: string, airport?: Airport) => void;
  placeholder?: string;
  id?: string;
  error?: string;
}

export function AirportCombobox({
  label,
  value,
  onChange,
  placeholder = 'Search airport or city...',
  id,
  error,
}: AirportComboboxProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listboxId = `${inputId}-listbox`;

  const [query, setQuery] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal display when external value prop changes
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }

  // Fetch airports on query change with debounce
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchAirports(query.trim());
        if (active) {
          setAirports(res.airports || []);
          setHighlightedIndex(0);
        }
      } catch (err) {
        console.error('Failed to search airports:', err);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectAirport = (airport: Airport) => {
    setQuery(airport.code);
    onChange(airport.code, airport);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % (airports.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + airports.length) % (airports.length || 1));
    } else if (e.key === 'Enter' && isOpen && airports[highlightedIndex]) {
      e.preventDefault();
      selectAirport(airports[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <label
        htmlFor={inputId}
        className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
      >
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onChange(val);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full px-3.5 py-2.5 bg-white border rounded-xs text-sm font-medium text-text-primary transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary ${
            error ? 'border-red-500' : 'border-neutral-300 hover:border-neutral-400'
          }`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary">
          {loading ? (
            <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="search" size={16} />
          )}
        </div>
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full min-w-[280px] bg-white border border-neutral-200 rounded-sm shadow-xl max-h-60 overflow-y-auto py-1"
        >
          {airports.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-text-tertiary text-center">
              {loading ? 'Searching airports...' : 'No matching airports found'}
            </div>
          ) : (
            airports.map((airport, idx) => {
              const isSelected = airport.code === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={airport.code}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectAirport(airport);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between text-sm transition-colors ${
                    isHighlighted ? 'bg-brand-primary/10 text-brand-primary' : 'text-text-primary hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-text-primary">
                      {airport.city} ({airport.code})
                    </span>
                    <span className="text-xs text-text-secondary truncate max-w-[200px]">
                      {airport.name}
                    </span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800">
                      {airport.code}
                    </span>
                    <span className="text-[10px] text-text-tertiary">{airport.country}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
