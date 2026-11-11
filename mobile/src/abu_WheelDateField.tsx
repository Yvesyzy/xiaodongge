import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./abu_WheelDateField.css";

const ITEM_H = 44;
const VISIBLE_ROWS = 5;
const PAD_H = ((VISIBLE_ROWS - 1) / 2) * ITEM_H;

type Props = {
  name: string;
  label?: string;
  /** 受控值（速记 / 重听页）；传入时外部变化会同步到输入框 */
  value?: string;
  /** 非受控初始值（完整乐评表单，草稿恢复直接写 DOM value） */
  defaultValue?: string;
  onChange?: (next: string) => void;
  required?: boolean;
  allowClear?: boolean;
  minYear?: number;
  maxYear?: number;
  className?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");
const toValue = (year: number, month: number, day: number) => `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;

function localToday() {
  const date = new Date();
  return toValue(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() + 1 !== month || check.getDate() !== day) return null;
  return { year, month, day };
}

/**
 * 年 / 月 / 日三列独立滚动的日期输入。
 * 保留同名原生 input 作为数据载体：FormData、草稿恢复、既有回归脚本的 fill() 都不需要改。
 */
export function WheelDateField({ name, label, value, defaultValue, onChange, required, allowClear = false, minYear = 1900, maxYear, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value === undefined || !inputRef.current) return;
    if (inputRef.current.value !== value) inputRef.current.value = value;
  }, [value]);

  function commit(next: string) {
    const input = inputRef.current;
    if (input) {
      // 绕过 React 的 value tracker 后派发原生事件：受控页更新 state，
      // 非受控表单同时触发表单 onChange（草稿自动保存），不需要重复调用 onChange。
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, next); else input.value = next;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      onChange?.(next);
    }
    setOpen(false);
  }

  const initial = inputRef.current?.value ?? value ?? defaultValue ?? "";
  return <label className={`abu-wheel-field${className ? ` ${className}` : ""}`}>
    {label ? <span className="abu-wheel-label">{label}</span> : null}
    <span className="abu-wheel-row">
      <input
        ref={inputRef}
        name={name}
        type="text"
        autoComplete="off"
        placeholder="YYYY-MM-DD"
        defaultValue={value ?? defaultValue ?? ""}
        required={required}
        onChange={(event) => onChange?.(event.target.value)}
        onClick={() => setOpen(true)}
        onFocus={(event) => event.currentTarget.select()}
      />
      <button type="button" className="abu-wheel-open" aria-label={`滚动选择${label ?? "日期"}`} onClick={(event) => { event.preventDefault(); setOpen(true); }} aria-haspopup="dialog" aria-expanded={open}>
        <span aria-hidden="true">◫</span>
      </button>
    </span>
    {open && typeof document !== "undefined" ? createPortal(
      <WheelDateSheet
        title={label ?? "日期"}
        initialValue={initial || localToday()}
        hasInitial={!!initial}
        minYear={minYear}
        maxYear={maxYear ?? new Date().getFullYear() + 1}
        allowClear={allowClear}
        onClose={() => setOpen(false)}
        onCommit={commit}
      />,
      document.body,
    ) : null}
  </label>;
}

function WheelDateSheet({ title, initialValue, hasInitial, minYear, maxYear, allowClear, onClose, onCommit }: {
  title: string;
  initialValue: string;
  hasInitial: boolean;
  minYear: number;
  maxYear: number;
  allowClear: boolean;
  onClose: () => void;
  onCommit: (value: string) => void;
}) {
  const parsed = parseDate(initialValue);
  const today = new Date();
  const [year, setYear] = useState(parsed?.year ?? today.getFullYear());
  const [month, setMonth] = useState(parsed?.month ?? today.getMonth() + 1);
  const [day, setDay] = useState(parsed?.day ?? today.getDate());
  const [jumpText, setJumpText] = useState("");
  const [jumpTarget, setJumpTarget] = useState<number | null>(null);
  const [jumpToken, setJumpToken] = useState(0);

  const years = useMemo(() => Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i), [minYear, maxYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const safeDay = Math.min(day, daysInMonth);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function jump() {
    const target = Number(jumpText);
    if (!Number.isInteger(target) || jumpText.trim().length !== 4) return;
    const clamped = Math.min(maxYear, Math.max(minYear, target));
    setJumpTarget(clamped);
    setJumpToken((token) => token + 1);
  }

  return <div className="abu-wheel-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="abu-wheel-sheet" role="dialog" aria-modal="true" aria-label={`滚动选择${title}`}>
      <header className="abu-wheel-head">
        <div><span className="abu-wheel-eyebrow">DATE WHEEL</span><h2>{title}</h2></div>
        <button type="button" className="abu-wheel-close" aria-label="关闭日期选择器" onClick={onClose}>×</button>
      </header>
      <div className="abu-wheel-jump">
        <label>跳到年份<input type="text" inputMode="numeric" value={jumpText} onChange={(event) => setJumpText(event.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); jump(); } }} placeholder={String(year)} aria-label="跳到年份" /></label>
        <button type="button" onClick={jump} disabled={jumpText.length !== 4}>跳转</button>
        <button type="button" onClick={() => onCommit(localToday())}>今天</button>
      </div>
      <div className="abu-wheel-columns">
        <WheelColumn ariaLabel="年" items={years} initial={Math.min(maxYear, Math.max(minYear, year))} onSelect={setYear} jumpTo={jumpTarget} jumpToken={jumpToken} suffix="年" />
        <WheelColumn ariaLabel="月" items={months} initial={month} onSelect={setMonth} suffix="月" />
        {/* 只在天数变化时重定位日期列，避免平滑跳年过程中反复重挂载 */}
        <WheelColumn key={daysInMonth} ariaLabel="日" items={days} initial={safeDay} onSelect={setDay} suffix="日" />
        <div className="abu-wheel-highlight" aria-hidden="true" />
      </div>
      <p className="abu-wheel-hint">三列分别上下滚动；很久以前的年份可以直接输入后跳转，不用一格格滑。</p>
      <div className="abu-wheel-actions">
        {allowClear ? <button type="button" onClick={() => onCommit("")}>清除</button> : null}
        <button type="button" onClick={onClose}>取消</button>
        <button type="button" className="abu-wheel-confirm" onClick={() => onCommit(toValue(year, month, safeDay))}>确定</button>
      </div>
      {!hasInitial ? <p className="abu-wheel-hint">当前未填写日期，滚轮从今天开始。</p> : null}
    </section>
  </div>;
}

function WheelColumn({ ariaLabel, items, initial, onSelect, jumpTo = null, jumpToken = 0, suffix }: {
  ariaLabel: string;
  items: number[];
  initial: number;
  onSelect: (value: number) => void;
  jumpTo?: number | null;
  jumpToken?: number;
  suffix: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef(initial);
  const [active, setActive] = useState(initial);

  useEffect(() => {
    // 只在打开时定位一次；用户自己滚动时不再抢滚动位置。
    const element = ref.current;
    if (!element) return;
    const index = Math.max(0, items.findIndex((item) => item === initial));
    element.scrollTop = index * ITEM_H;
    activeRef.current = items[index] ?? initial;
    setActive(activeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!jumpToken || jumpTo === null || !ref.current) return;
    const index = items.findIndex((item) => item === jumpTo);
    if (index >= 0) ref.current.scrollTo({ top: index * ITEM_H, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToken]);

  function handleScroll() {
    const element = ref.current;
    if (!element) return;
    const index = Math.max(0, Math.min(items.length - 1, Math.round(element.scrollTop / ITEM_H)));
    const next = items[index];
    if (next === undefined || next === activeRef.current) return;
    activeRef.current = next;
    setActive(next);
    onSelect(next);
  }

  return <div className="abu-wheel-col" ref={ref} onScroll={handleScroll} role="listbox" aria-label={ariaLabel}>
    <div className="abu-wheel-pad" style={{ height: PAD_H }} />
    {items.map((item) => <div key={item} className={`abu-wheel-item${item === active ? " is-active" : ""}`} role="option" aria-selected={item === active}>{item}<small>{suffix}</small></div>)}
    <div className="abu-wheel-pad" style={{ height: PAD_H }} />
  </div>;
}
