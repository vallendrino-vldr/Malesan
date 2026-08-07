/**
 * The warm glow behind the dashboard.
 *
 * `AmbientIdle` is a foreground object with a size; this is the layer behind
 * everything, so the page sits in warmth instead of on flat black. Three
 * low-alpha blobs drifting on long loops — DESIGN.md §1's "warm ambient glow
 * behind active surfaces", done in CSS rather than the WebGL it rules out.
 *
 * Server component: no state, no handlers, all motion is CSS. It ships no
 * JavaScript. `aria-hidden` because it carries no meaning, `z-0` and
 * `pointer-events-none` (both in `.ambient-field`) because its one job is to
 * never get in the way of the content above it.
 *
 * The parent must be `position: relative` and the content above it `z-10` or
 * higher, or the blobs paint over the tiles.
 */
export function AmbientField() {
  return (
    <div aria-hidden="true" className="ambient-field">
      <div className="ambient-field__orbit" />
      <div className="ambient-field__blob ambient-field__blob--a" />
      <div className="ambient-field__blob ambient-field__blob--b" />
      <div className="ambient-field__blob ambient-field__blob--c" />
    </div>
  );
}
