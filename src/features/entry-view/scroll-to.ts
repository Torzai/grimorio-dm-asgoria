/**
 * Scrolls a part of the page (a history entry, a thematic block) to the top of the pane and
 * flashes it once through its [data-flash] animation; `focus` gets the focus without scrolling
 * again. Returns the cleanup for an effect.
 */
export function scrollAndFlash(element: HTMLElement, focus?: HTMLElement | null): () => void {
  element.scrollIntoView({ block: 'start' });
  focus?.focus({ preventScroll: true });
  element.dataset.flash = '';
  const stop = () => delete element.dataset.flash;
  element.addEventListener('animationend', stop, { once: true });
  return () => {
    element.removeEventListener('animationend', stop);
    stop();
  };
}
