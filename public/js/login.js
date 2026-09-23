(async function () {
  // If already logged in, skip straight to the dashboard.
  try {
    await api.get('/api/me');
    window.location.href = '/dashboard.html';
    return;
  } catch (e) {
    // not logged in — show the form
  }

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('show');
    void errorBox.offsetWidth;
    errorBox.classList.add('show');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      showError('Enter both a username and a password.');
      return;
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="spinner"></span> Logging in…';

    try {
      await api.post('/api/auth/login', { username, password });
      window.location.href = '/dashboard.html';
    } catch (err) {
      showError(err.message || 'Incorrect username or password.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
})();
