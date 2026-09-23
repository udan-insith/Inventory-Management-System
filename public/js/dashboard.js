document.addEventListener('shell-ready', async ({ detail }) => {
  const user = detail.user;
  document.getElementById('welcome-heading').textContent = `Welcome, ${user.displayName.split(' ')[0]}`;

  const cards = [
    { href: '/stock.html', glyph: '&#128230;', title: 'Stock', desc: 'View item balances, photos, and logs.', theme: '' },
    { href: '/issue.html', glyph: '&#8599;', title: 'Issue', desc: 'Send gifts out to a branch for an event.', theme: 'clay' },
    { href: '/receive.html', glyph: '&#8600;', title: 'Receive', desc: 'Bring new stock into the storage.', theme: '' },
    { href: '/requests.html', glyph: '&#128203;', title: 'Requests', desc: 'Log a branch request with its supporting document.', theme: '' },
    { href: '/history.html', glyph: '&#128220;', title: 'History', desc: 'Every Issue and Receive entry, automatically logged.', theme: '' },
  ];
  if (user.role === 'admin') {
    cards.push({ href: '/users.html', glyph: '&#128101;', title: 'Users', desc: 'Add, rename or remove Normal User accounts.', theme: 'clay' });
  }

  const grid = document.getElementById('nav-card-grid');
  grid.innerHTML = cards
    .map(
      (c, i) => `
      <a class="nav-card ${c.theme}" href="${c.href}" style="animation-delay:${i * 40}ms">
        <div class="glyph">${c.glyph}</div>
        <h3>${c.title}</h3>
        <p>${c.desc}</p>
      </a>`
    )
    .join('');

  try {
    const [{ items }, { history }] = await Promise.all([api.get('/api/items'), api.get('/api/history')]);

    const totalItems = items.length;
    const totalUnits = items.reduce((sum, it) => sum + it.balance, 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = history.filter((h) => h.log_date === today).length;

    const statEls = document.querySelectorAll('.stat-value');
    statEls[0].classList.remove('skeleton');
    statEls[0].style = '';
    statEls[0].textContent = '0';
    animateNumber(statEls[0], totalItems);

    statEls[1].classList.remove('skeleton');
    statEls[1].style = '';
    statEls[1].textContent = '0';
    animateNumber(statEls[1], totalUnits);

    statEls[2].classList.remove('skeleton');
    statEls[2].style = '';
    statEls[2].textContent = '0';
    animateNumber(statEls[2], todayCount);
  } catch (e) {
    toast('Could not load storage stats.', 'error');
  }
});
