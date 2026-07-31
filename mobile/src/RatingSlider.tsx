import { useCallback, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import type { RatingModifier } from "./types";

const MIN = 0.5;
const MAX = 10;
const STEP = 0.5;
const STEPS = (MAX - MIN) / STEP + 1;

type RatingSliderProps = {
  value: number | null;
  modifier: RatingModifier | null;
  onChange: (rating: number | null, modifier: RatingModifier | null) => void;
};

export default function RatingSlider({ value, modifier, onChange }: RatingSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? 0);
  const [localModifier, setLocalModifier] = useState<RatingModifier | null>(modifier);

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

  const displayValue = value ?? 0;
  const percent = ratingToPercent(Math.max(MIN, displayValue));
  const hasValue = value !== null;
  const displayModifier = modifier ?? localModifier;

  const markValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <section className="rating-slider-section">
      <div className="rating-slider-head">
        <strong>评分</strong>
        {hasValue ? (
          <span className="rating-display">
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
        onTouchStart={(event) => { setDragging(true); updateFromPosition(event.touches[0].clientX); }}
        onTouchMove={handleTouchMove}
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
      <input type="hidden" name="rating" value={hasValue ? String(displayValue) : ""} />
      <input type="hidden" name="ratingModifier" value={displayModifier ?? ""} />
    </section>
  );
}