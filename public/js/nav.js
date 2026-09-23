/* Renders the ledger-spine sidebar into #sidebar-root, guards the page
   behind a valid session, and exposes window.currentUser for page scripts. */
(async function () {
  const page = document.body.dataset.page || '';

  let session;
  try {
    session = await api.get('/api/me');
  } catch (e) {
    window.location.href = '/login.html';
    return;
  }

  const user = session.user;
  window.currentUser = user;

  // Simple monochrome line icons (not emoji) — reads cleaner for official use.
  const icons = {
    dashboard: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1"/><rect x="11" y="2.5" width="6.5" height="6.5" rx="1"/><rect x="2.5" y="11" width="6.5" height="6.5" rx="1"/><rect x="11" y="11" width="6.5" height="6.5" rx="1"/></svg>',
    stock: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 6.2 10 2.5l7.5 3.7v7.6L10 17.5l-7.5-3.7z"/><path d="M2.5 6.2 10 9.9l7.5-3.7M10 9.9v7.6"/></svg>',
    issue: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 15 15 5M8 5h7v7"/></svg>',
    receive: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M15 5 5 15M12 15H5V8"/></svg>',
    requests: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5.5 2.5h6l3 3v12h-9z"/><path d="M11 2.5v3.3h3.3M7.3 11h5.4M7.3 13.8h5.4"/></svg>',
    history: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10.5" r="7"/><path d="M10 6.8v3.9l2.6 1.6M6.5 2.5h7" stroke-linecap="round"/></svg>',
    users: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7.3" cy="6.8" r="2.6"/><path d="M2.3 16c0-2.9 2.2-5 5-5s5 2.1 5 5" stroke-linecap="round"/><circle cx="14.2" cy="7.3" r="2.1"/><path d="M13.2 11.3c2.2.4 3.8 2.3 3.8 4.7" stroke-linecap="round"/></svg>',
  };

  const navItems = [
    { key: 'dashboard', href: '/dashboard.html', label: 'Dashboard', icon: icons.dashboard, adminOnly: false },
    { key: 'stock', href: '/stock.html', label: 'Stock', icon: icons.stock, adminOnly: false },
    { key: 'issue', href: '/issue.html', label: 'Issue', icon: icons.issue, adminOnly: false },
    { key: 'receive', href: '/receive.html', label: 'Receive', icon: icons.receive, adminOnly: false },
    { key: 'requests', href: '/requests.html', label: 'Requests', icon: icons.requests, adminOnly: false },
    { key: 'history', href: '/history.html', label: 'History', icon: icons.history, adminOnly: false },
    { key: 'users', href: '/users.html', label: 'Users', icon: icons.users, adminOnly: true },
  ];

  const linksHtml = navItems
    .filter((item) => !item.adminOnly || user.role === 'admin')
    .map((item) => {
      const activeClass = item.key === page ? ' active' : '';
      return `<li><a class="nav-link${activeClass}" href="${item.href}"><span class="nav-icon">${item.icon}</span>${item.label}</a></li>`;
    })
    .join('');

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="brand">Gift Storage</div>
    <div class="brand-sub">Bank of Ceylon &mdash; Western Province South</div>
    <ul class="nav-list">${linksHtml}</ul>
    <div class="sidebar-footer">
      <div class="sidebar-user">${escapeHtml(user.displayName)}</div>
      <div class="sidebar-role">${user.role === 'admin' ? 'Admin' : 'Normal user'}</div>
      <button class="logout-btn" id="logout-btn">Log out</button>
    </div>
  `;

  const root = document.getElementById('sidebar-root');
  root.replaceWith(sidebar);

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      // ignore - we're logging out regardless
    }
    window.location.href = '/login.html';
  });

  // Let the page know the shell is ready (so it can start loading its data).
  document.dispatchEvent(new CustomEvent('shell-ready', { detail: { user } }));
})();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
