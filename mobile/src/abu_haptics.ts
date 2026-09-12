/**
 * Light tactile tick on press, so a tap is confirmed without looking.
 *
 * Sound cues are deliberately not used: this app plays music while it is being
 * used, and UI audio would fight whatever is in the headphones. A short haptic
 * tick is the channel that stays quiet.
 *
 * Degrades to a silent no-op when the WebView has no vibrator or the app was not
 * granted android.permission.VIBRATE — both are normal on desktop browsers.
 */

const TICK_MS = 8;
const PRESSABLE = "button, summary, a[href], [role='button']";

export function installPressHaptics(): () => void {
  const vibrate = typeof navigator === "undefined" ? undefined : navigator.vibrate;
  if (typeof vibrate !== "function") return () => {};

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const control = target.closest(PRESSABLE);
    if (!control) return;
    if (control.matches(":disabled") || control.getAttribute("aria-disabled") === "true") return;

    // Some browsers reject the call instead of returning false; a failed tick
    // must never break the tap that is already in flight.
    try {
      vibrate.call(navigator, [TICK_MS]);
    } catch {
      /* no vibrator: the visual press feedback still carries the interaction */
    }
  };

  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  return () => document.removeEventListener("pointerdown", onPointerDown);
}
