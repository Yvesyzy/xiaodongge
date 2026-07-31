import { useCallback, useEffect, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import type { RatingModifier } from "./types";

const MIN = 0.5;
const MAX = 10;
const STEP = 0.5;

type RatingSliderProps = {
  value: number | null;
  modifier: RatingModifier | null;
  onChange: (rating: number | null, modifier: RatingModifier | null) => void;
  name?: string;
  showModifier?: boolean;
  label?: string;
};

export default function RatingSlider({ value, modifier, onChange, name = "rating", showModifier = true, label = "评分" }: RatingSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? 0);
  const [localModifier, setLocalModifier] = useState<RatingModifier | null>(modifier);

  // 同步外部 value prop 变化（草稿恢复、编辑模式加载）
  useEffect(() => { setLocalValue(value ?? 0); }, [value]);
  useEffect(() => { setLocalModifier(modifier); }, [modifier]);

  const ratingToPercent = useCallback((rating: number) => ((rating - MIN) / (MAX - MIN)) * 100, []);
  const percentToRating = useCallback((percent: number) => {
    const raw = MIN + (percent / 100) * (MAX - MIN);
    return Math.round(raw / STEP) * STEP;
  }, []);

  const updateFromPosition = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const rating = percentToRating(percent);
    setLocalValue(rating);
  }, [percentToRating]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    event.preventDefault();
    setDragging(true);
    updateFromPosition(event.clientX);
  }, [updateFromPosition]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragging) return;
    updateFromPosition(event.clientX);
  }, [dragging, updateFromPosition]);

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (localValue >= MIN) {
      onChange(localValue, localModifier);
    }
  }, [dragging, localValue, localModifier, onChange]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!dragging) return;
    const touch = event.touches[0];
    if (touch) updateFromPosition(touch.clientX);
  }, [dragging, updateFromPosition]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
    if (localValue >= MIN) {
      onChange(localValue, localModifier);
    }
  }, [localValue, localModifier, onChange]);

  const toggleModifier = useCallback((mod: RatingModifier) => {
    const next = localModifier === mod ? null : mod;
    setLocalModifier(next);
    if (localValue >= MIN) {
      onChange(localValue, next);
    }
  }, [localModifier, localValue, onChange]);

  const clearRating = useCallback(() => {
    setLocalValue(0);
    setLocalModifier(null);
    onChange(null, null);
  }, [onChange]);

  // 拖动中显示 localValue（实时反馈），非拖动时显示 value（已提交值）
  const displayValue = dragging ? localValue : (value ?? localValue);
  const activeValue = value ?? localValue;
  const percent = ratingToPercent(Math.max(MIN, dragging ? localValue : activeValue));
  const hasValue = displayValue >= MIN;
  const displayModifier = modifier ?? localModifier;

  const markValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <section className="rating-slider-section">
      <div className="rating-slider-head">
        <strong>{label}</strong>
        {hasValue ? (
          <span className={`rating-display${dragging ? " dragging" : ""}`}>
            <button type="button" className="rating-clear" onClick={clearRating} aria-label="清除评分">x</button>
            <em className="rating-number">{displayValue}</em>
            {displayModifier ? <sup className={`rating-mod ${displayModifier === "+" ? "plus" : "minus"}`}>{displayModifier}</sup> : null}
            <small>/10</small>
          </span>
        ) : (
          <span className="rating-placeholder">拖动滑块打分</span>
        )}
      </div>
      <div
        ref={trackRef}
        className={`rating-track${dragging ? " dragging" : ""}${hasValue ? " has-value" : ""}`}
        role="slider"
        aria-label="评分滑块"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={hasValue ? displayValue : 0}
        aria-valuetext={hasValue ? `${displayValue}${displayModifier ?? ""}` : "未评分"}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={(event) => { event.preventDefault(); setDragging(true); updateFromPosition(event.touches[0].clientX); }}
        onTouchMove={(event) => { event.preventDefault(); handleTouchMove(event); }}
        onTouchEnd={handleTouchEnd}
      >
        <div className="rating-track-bg" />
        <div className="rating-track-fill" style={{ width: `${percent}%` }} />
        <div className="rating-track-thumb" style={{ left: `${percent}%` }}>
          <span className="thumb-inner" />
        </div>
        {markValues.map((mark) => (
          <span
            key={mark}
            className={`rating-mark${mark <= displayValue ? " active" : ""}`}
            style={{ left: `${ratingToPercent(mark)}%` }}
          >
            <span className="mark-label">{mark}</span>
          </span>
        ))}
      </div>
      {showModifier ? (
        <div className="rating-modifier-row">
          <button
            type="button"
            className={`rating-mod-btn minus${displayModifier === "-" ? " active" : ""}`}
            onClick={() => toggleModifier("-")}
            disabled={!hasValue}
            aria-label="减号修饰"
          >
            <span className="mod-icon">-</span>
            <small>稍逊</small>
          </button>
          <button
            type="button"
            className={`rating-mod-btn plus${displayModifier === "+" ? " active" : ""}`}
            onClick={() => toggleModifier("+")}
            disabled={!hasValue}
            aria-label="加号修饰"
          >
            <span className="mod-icon">+</span>
            <small>略优</small>
          </button>
        </div>
      ) : null}
      <input type="hidden" name={name} value={hasValue ? String(displayValue) : ""} />
      <input type="hidden" name={`${name}Modifier`} value={displayModifier ?? ""} />
    </section>
  );
}
