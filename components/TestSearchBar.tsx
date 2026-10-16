'use client';

// TestSearchBar — action search bar in the spirit of KokonutUI's Action Search
// Bar (https://kokonutui.com/docs/navigation/action-search-bar): debounced
// input, shortcut hint, animated action-suggestions dropdown, full keyboard
// navigation (↑/↓/Enter/Escape) with ARIA combobox semantics.
// Converted to TypeScript + vanilla CSS; lucide → heroicons.

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import './TestSearchBar.css';

export interface SearchItem {
  id: string;
  num: number;
  title: string;
}

interface TestSearchBarProps {
  items: SearchItem[];
  placeholder?: string;
  maxResults?: number;
  onSelect: (item: SearchItem) => void;
  onRandom?: () => void;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function TestSearchBar({
  items,
  placeholder = 'Tìm đề…',
  maxResults = 8,
  onSelect,
  onRandom,
}: TestSearchBarProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dq = useDebounced(q.trim().toLowerCase(), 120);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    if (!dq) return [];
    return items
      .filter(
        (t) =>
          t.title.toLowerCase().includes(dq) ||
          String(t.num) === dq ||
          `đề ${t.num}` === dq,
      )
      .slice(0, maxResults);
  }, [dq, items, maxResults]);

  const showList = open && (dq ? true : !!onRandom);
  const rows = dq ? results : [];

  useEffect(() => {
    setActive(0);
  }, [dq, open]);

  /* "/" focuses the bar when not typing elsewhere */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing =
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (item: SearchItem) => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    onSelect(item);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && rows.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % rows.length);
    } else if (e.key === 'ArrowUp' && rows.length > 0) {
      e.preventDefault();
      setActive((a) => (a - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      if (dq && rows[active]) choose(rows[active]);
      else if (!dq && onRandom) {
        setOpen(false);
        onRandom();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="tsb-wrap">
      <div className="tsb-bar">
        <MagnifyingGlassIcon width={17} height={17} className="tsb-icon" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onInputKey}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={rows[active] ? `${listId}-${rows[active].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {q ? (
          <button
            type="button"
            className="tsb-clear"
            aria-label="Xóa tìm kiếm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        ) : (
          <kbd className="tsb-kbd">/</kbd>
        )}
      </div>

      <AnimatePresence>
        {showList && (
          <motion.div
            className="tsb-drop"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {dq ? (
              results.length > 0 ? (
                <>
                  <p className="tsb-label">
                    {results.length} đề phù hợp
                  </p>
                  <ul role="listbox" id={listId} className="tsb-list">
                    {results.map((t, i) => (
                      <li key={t.id} role="option" aria-selected={i === active}>
                        <button
                          type="button"
                          id={`${listId}-${t.id}`}
                          className={`tsb-row${i === active ? ' active' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choose(t)}
                          onMouseEnter={() => setActive(i)}
                        >
                          <span className="tsb-row-t">{t.title}</span>
                          <span className="tsb-row-go">
                            Mở đề
                            <ArrowRightIcon width={14} height={14} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="tsb-hint">↑↓ di chuyển · Enter mở đề · Esc đóng</p>
                </>
              ) : (
                <p className="tsb-empty">
                  Không tìm thấy đề nào khớp “{q.trim()}”.
                </p>
              )
            ) : (
              onRandom && (
                <button
                  type="button"
                  className="tsb-row tsb-action"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setOpen(false);
                    onRandom();
                  }}
                >
                  <SparklesIcon width={16} height={16} />
                  <span>Đề ngẫu nhiên</span>
                </button>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
