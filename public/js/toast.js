/* Slide-in toast notifications, replacing alert(). */
(function () {
  function ensureStack() {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  window.toast = function (message, type) {
    type = type === 'error' ? 'error' : 'success';
    const stack = ensureStack();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    stack.appendChild(el);

    const remove = () => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 220);
    };
    setTimeout(remove, 3600);
    el.addEventListener('click', remove);
  };
})();
