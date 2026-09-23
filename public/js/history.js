let allHistory = [];
const sortState = { field: 'log_date', direction: 'desc' };

document.addEventListener('shell-ready', loadHistory);

async function loadHistory() {
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="muted" style="padding:14px;">Loading…</td></tr>';
  try {
    const { history } = await api.get('/api/history');
    allHistory = history;
    populateFilter('item-filter', history.map((h) => h.item_name), 'All items');
    populateFilter('branch-filter', history.map((h) => h.branch_name), 'All branches');
    wireSortableHeaders(document.getElementById('history-table'), sortState, renderTable);
    renderTable();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" class="muted" style="padding:14px;">Could not load history.</td></tr>';
    toast(e.message || 'Failed to load history.', 'error');
  }
}

function populateFilter(selectId, values, allLabel) {
  const select = document.getElementById(selectId);
  const unique = Array.from(new Set(values)).sort();
  select.innerHTML =
    `<option value="all">${allLabel}</option>` +
    unique.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

['type-filter', 'item-filter', 'branch-filter', 'date-from', 'date-to'].forEach((id) => {
  document.getElementById(id).addEventListener('change', renderTable);
});

document.getElementById('clear-filters-btn').addEventListener('click', () => {
  document.getElementById('type-filter').value = 'all';
  document.getElementById('item-filter').value = 'all';
  document.getElementById('branch-filter').value = 'all';
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
  renderTable();
});

function getFiltered() {
  const type = document.getElementById('type-filter').value;
  const item = document.getElementById('item-filter').value;
  const branch = document.getElementById('branch-filter').value;
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;

  let rows = allHistory.filter(
    (h) =>
      (type === 'all' || h.type === type) &&
      (item === 'all' || h.item_name === item) &&
      (branch === 'all' || h.branch_name === branch)
  );
  rows = filterByDateRange(rows, 'log_date', from, to);
  rows = sortRows(rows, sortState.field, sortState.direction);
  return rows;
}

function renderTable() {
  const rows = getFiltered();
  const tbody = document.getElementById('history-tbody');
  document.getElementById('history-count').textContent = `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="muted" style="padding:14px;">No entries match this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      (h) => `
      <tr>
        <td>${h.log_date}</td>
        <td><span class="pill ${h.type === 'issue' ? 'out' : 'in'}">${h.type === 'issue' ? 'Issue' : 'Receive'}</span></td>
        <td>${escapeHtml(h.item_name)}</td>
        <td>${h.type === 'issue' ? '−' : '+'}${h.quantity}</td>
        <td>${escapeHtml(h.branch_name)}</td>
        <td>${escapeHtml(h.event_name)}</td>
        <td>${h.balance_after}</td>
        <td>${escapeHtml(h.logged_by || '—')}</td>
      </tr>`
    )
    .join('');
}

document.getElementById('print-history-btn').addEventListener('click', () => {
  const rows = getFiltered();
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;

  const body = rows
    .map(
      (h) => `
      <tr>
        <td>${h.log_date}</td>
        <td>${h.type === 'issue' ? 'Issue' : 'Receive'}</td>
        <td>${escapeHtml(h.item_name)}</td>
        <td>${h.type === 'issue' ? '−' : '+'}${h.quantity}</td>
        <td>${escapeHtml(h.branch_name)}</td>
        <td>${escapeHtml(h.event_name)}</td>
        <td>${h.balance_after}</td>
        <td>${escapeHtml(h.logged_by || '—')}</td>
      </tr>`
    )
    .join('');

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <h1>Total History</h1>
      <div class="meta">Gift Storage — Bank of Ceylon, Western Province South<br/>
        Date range: ${describeDateRange(from, to)}<br/>
        Printed ${new Date().toLocaleString()}</div>
    </div>
    <table class="print-table">
      <thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Qty</th><th>Branch</th><th>Event</th><th>Balance after</th><th>Logged by</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${printFooterHtml()}`;

  window.print();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
