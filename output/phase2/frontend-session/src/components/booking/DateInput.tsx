'use client';

import type { InputHTMLAttributes } from 'react';

function openPicker(input: HTMLInputElement) {
  try {
    if (!input.showPicker) return false;
    input.showPicker();
    return true;
  } catch {
    // Embedded browsers may deny showPicker; keep native keyboard editing available.
    input.focus();
    return false;
  }
}

export function DateInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <input
      {...props}
      type="date"
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented && openPicker(event.currentTarget)) event.preventDefault();
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          openPicker(event.currentTarget);
        }
      }}
    />
  );
}
