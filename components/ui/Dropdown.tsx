/**
 * @file Dropdown.tsx
 * @description Lightweight popover menu: a trigger plus a floating panel of items,
 * with click-outside + Escape to dismiss and a scale-in entrance. Headless-ish —
 * pass any trigger node and a list of items.
 */
import React, { useEffect, useRef, useState } from 'react';
import { cn } from './cn';

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = 'right', className, menuClassName }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-2 min-w-[12rem] origin-top overflow-hidden rounded-2xl bg-white p-1.5 shadow-soft-lg ring-1 ring-slate-900/5',
            'animate-in fade-in zoom-in-95 duration-150',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { item.onSelect(); setOpen(false); }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition',
                'disabled:cursor-not-allowed disabled:opacity-50',
                item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              {item.icon && <span className="flex-shrink-0 text-slate-400">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
