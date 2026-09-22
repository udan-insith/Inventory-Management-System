/* Animates the text content of `el` from its current numeric value to
   `to` over `duration` ms, then adds a brief pulse class. Used for balance
   numbers and running totals so changes feel responsive rather than just
   snapping to a new figure. */
window.animateNumber = function (el, to, duration = 450) {
  if (!el) return;
  const from = Number(el.textContent.replace(/[^\d.-]/g, '')) || 0;
  to = Number(to) || 0;

  if (from === to) {
    el.textContent = to;
    return;
  }

  const start = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const current = Math.round(from + (to - from) * eased);
    el.textContent = current;
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = to;
      el.classList.remove('pulse');
      // eslint-disable-next-line no-unused-expressions
      void el.offsetWidth; // restart animation
      el.classList.add('pulse');
    }
  }

  requestAnimationFrame(tick);
};
