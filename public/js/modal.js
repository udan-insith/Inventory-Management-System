/* Generic modal open/close with backdrop click + Escape to dismiss. */
window.modalHelper = (function () {
  function open(backdropEl) {
    backdropEl.classList.add('open');
    backdropEl.setAttribute('aria-hidden', 'false');
    const firstInput = backdropEl.querySelector('input, textarea, select, button');
    if (firstInput) setTimeout(() => firstInput.focus(), 60);
  }

  function close(backdropEl) {
    backdropEl.classList.remove('open');
    backdropEl.setAttribute('aria-hidden', 'true');
  }

  function wireDismiss(backdropEl) {
    backdropEl.addEventListener('click', (e) => {
      if (e.target === backdropEl) close(backdropEl);
    });
    backdropEl.querySelectorAll('[data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', () => close(backdropEl));
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach((el) => close(el));
    }
  });

  return { open, close, wireDismiss };
})();
