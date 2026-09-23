let items = [];
let photoTargetItemId = null;
let logItem = null;

const addItemModal = document.getElementById('add-item-modal');
const changePhotoModal = document.getElementById('change-photo-modal');
const logModal = document.getElementById('log-modal');

[addItemModal, changePhotoModal, logModal].forEach((m) => modalHelper.wireDismiss(m));

document.addEventListener('shell-ready', () => {
  loadItems();
});

// ------------------------- Item grid -------------------------
async function loadItems() {
  const grid = document.getElementById('item-grid');
  grid.innerHTML = '<div class="muted">Loading items…</div>';
  try {
    const { items: fetched } = await api.get('/api/items');
    items = fetched;
    renderGrid();
  } catch (e) {
    grid.innerHTML = '<div class="empty-state">Could not load items.</div>';
    toast(e.message || 'Failed to load items.', 'error');
  }
}

document.getElementById('item-search').addEventListener('input', renderGrid);

function renderGrid() {
  const grid = document.getElementById('item-grid');
  const query = document.getElementById('item-search').value.trim().toLowerCase();
  const visible = query ? items.filter((i) => i.name.toLowerCase().includes(query)) : items;

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state">No items yet — add the first one with "Add New Item".</div>';
    return;
  }
  if (visible.length === 0) {
    grid.innerHTML = `<div class="empty-state">No items match "${escapeHtml(query)}".</div>`;
    return;
  }

  grid.innerHTML = visible
    .map((item, i) => {
      const deleteBtn =
        window.currentUser && window.currentUser.role === 'admin'
          ? `<button class="item-delete-btn" data-item-id="${item.id}" title="Delete item" aria-label="Delete ${escapeHtml(item.name)}">&times;</button>`
          : '';
      const photoInner = item.image_path
        ? `<img src="${item.image_path}" alt="${escapeHtml(item.name)}" />`
        : '<span class="placeholder-icon">&#127873;</span>';
      const lowStockBadge =
        item.balance <= item.low_stock_threshold ? '<span class="low-stock-badge">Low stock</span>' : '';

      return `
      <div class="item-card" data-item-id="${item.id}" style="animation-delay:${i * 30}ms">
        ${deleteBtn}
        <div class="item-photo" data-item-id="${item.id}" title="Change photo">
          ${lowStockBadge}
          ${photoInner}
        </div>
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-balance-row">
          <span class="item-balance" id="balance-${item.id}">${item.balance}</span>
          <span class="item-balance-label">in stock</span>
        </div>
        <div class="item-actions-3">
          <button class="btn btn-clay btn-sm issue-btn" data-item-id="${item.id}">Issue</button>
          <button class="btn btn-primary btn-sm receive-btn" data-item-id="${item.id}">Receive</button>
          <button class="btn btn-outline btn-sm view-log-btn" data-item-id="${item.id}">View Log</button>
        </div>
      </div>`;
    })
    .join('');

  grid.querySelectorAll('.issue-btn').forEach((btn) => {
    btn.addEventListener('click', () => goToTransactionPage('issue', Number(btn.dataset.itemId)));
  });
  grid.querySelectorAll('.receive-btn').forEach((btn) => {
    btn.addEventListener('click', () => goToTransactionPage('receive', Number(btn.dataset.itemId)));
  });
  grid.querySelectorAll('.view-log-btn').forEach((btn) => {
    btn.addEventListener('click', () => openLogModal(Number(btn.dataset.itemId)));
  });
  grid.querySelectorAll('.item-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(Number(btn.dataset.itemId));
    });
  });
  grid.querySelectorAll('.item-photo').forEach((el) => {
    el.addEventListener('click', () => openChangePhotoModal(Number(el.dataset.itemId)));
  });
}

// Sends the user to the dedicated Issue/Receive page with this item
// pre-selected, so they only need to type the amount and click Add.
function goToTransactionPage(type, itemId) {
  const item = items.find((i) => i.id === itemId);
  if (!item) return;
  sessionStorage.setItem('preselectItem', JSON.stringify({ id: item.id, name: item.name }));
  window.location.href = type === 'issue' ? '/issue.html' : '/receive.html';
}

async function deleteItem(itemId) {
  const item = items.find((i) => i.id === itemId);
  if (!item) return;
  if (!confirm(`Delete "${item.name}"? It'll be gone from Stock, but its entries stay in Total History.`)) return;

  try {
    await api.del(`/api/items/${itemId}`);
    toast(`"${item.name}" deleted.`);
    await loadItems();
  } catch (err) {
    toast(err.message || 'Could not delete that item.', 'error');
  }
}

// ------------------------- Add New Item -------------------------
document.getElementById('add-item-btn').addEventListener('click', () => {
  document.getElementById('add-item-form').reset();
  document.getElementById('new-item-balance').value = 0;
  document.getElementById('new-item-low-stock').value = 5;
  hideError('add-item-error');
  modalHelper.open(addItemModal);
});

document.getElementById('add-item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('new-item-name').value.trim();
  const balance = document.getElementById('new-item-balance').value;
  const lowStockThreshold = document.getElementById('new-item-low-stock').value;
  const imageFile = document.getElementById('new-item-image').files[0];
  const submitBtn = document.getElementById('add-item-submit');

  if (!name) return showError('add-item-error', 'Give the item a name.');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('balance', balance || 0);
  formData.append('lowStockThreshold', lowStockThreshold || 5);
  if (imageFile) formData.append('image', imageFile);

  submitBtn.disabled = true;
  try {
    await api.upload('/api/items', formData);
    toast(`"${name}" added to the storage.`);
    modalHelper.close(addItemModal);
    await loadItems();
  } catch (err) {
    showError('add-item-error', err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ------------------------- Change Photo -------------------------
function openChangePhotoModal(itemId) {
  photoTargetItemId = itemId;
  document.getElementById('change-photo-form').reset();
  hideError('change-photo-error');
  modalHelper.open(changePhotoModal);
}

document.getElementById('change-photo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!photoTargetItemId) return;
  const file = document.getElementById('change-photo-file').files[0];
  const submitBtn = document.getElementById('change-photo-submit');
  if (!file) return showError('change-photo-error', 'Choose an image file.');

  const formData = new FormData();
  formData.append('image', file);

  submitBtn.disabled = true;
  try {
    const res = await fetch(`/api/items/${photoTargetItemId}/image`, {
      method: 'PATCH',
      credentials: 'same-origin',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');

    const item = items.find((i) => i.id === photoTargetItemId);
    if (item) item.image_path = data.image_path;
    toast('Photo updated.');
    modalHelper.close(changePhotoModal);
    renderGrid();
  } catch (err) {
    showError('change-photo-error', err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ------------------------- View Log -------------------------
const logSortState = { field: 'log_date', direction: 'desc' };

async function openLogModal(itemId) {
  logItem = items.find((i) => i.id === itemId);
  if (!logItem) return;

  document.getElementById('log-modal-title').textContent = `Log — ${logItem.name}`;
  document.getElementById('log-date-from').value = '';
  document.getElementById('log-date-to').value = '';
  const body = document.getElementById('log-modal-body');
  body.innerHTML = '<div class="muted" style="padding:14px;">Loading…</div>';
  modalHelper.open(logModal);

  try {
    const { logs } = await api.get(`/api/transactions/item/${itemId}`);
    logItem.logs = logs;
    renderLogModalBody();
  } catch (e) {
    body.innerHTML = '<div class="muted" style="padding:14px;">Could not load the log.</div>';
  }
}

function getFilteredLog() {
  if (!logItem || !logItem.logs) return [];
  const from = document.getElementById('log-date-from').value;
  const to = document.getElementById('log-date-to').value;
  let rows = filterByDateRange(logItem.logs, 'log_date', from, to);
  rows = sortRows(rows, logSortState.field, logSortState.direction);
  return rows;
}

function renderLogModalBody() {
  const body = document.getElementById('log-modal-body');
  const rows = getFilteredLog();

  if (!logItem.logs || logItem.logs.length === 0) {
    body.innerHTML = '<div class="muted" style="padding:14px;">No Issue/Receive entries yet for this item.</div>';
    return;
  }
  if (rows.length === 0) {
    body.innerHTML = '<div class="muted" style="padding:14px;">No entries in this date range.</div>';
    return;
  }
  body.innerHTML = renderLogTable(rows);
  wireSortableHeaders(body.querySelector('.log-table'), logSortState, renderLogModalBody);
}

['log-date-from', 'log-date-to'].forEach((id) => {
  document.getElementById(id).addEventListener('change', renderLogModalBody);
});
document.getElementById('log-clear-filter-btn').addEventListener('click', () => {
  document.getElementById('log-date-from').value = '';
  document.getElementById('log-date-to').value = '';
  renderLogModalBody();
});

document.getElementById('log-print-btn').addEventListener('click', () => {
  if (!logItem || !logItem.logs) return;
  const filtered = getFilteredLog();
  const from = document.getElementById('log-date-from').value;
  const to = document.getElementById('log-date-to').value;

  const rows = filtered
    .map(
      (l) => `
      <tr>
        <td>${l.log_date}</td>
        <td>${l.type === 'issue' ? 'Issue' : 'Receive'}</td>
        <td>${l.type === 'issue' ? '−' : '+'}${l.quantity}</td>
        <td>${escapeHtml(l.branch_name)}</td>
        <td>${escapeHtml(l.event_name)}</td>
        <td>${l.balance_after}</td>
        <td>${escapeHtml(l.logged_by || '—')}</td>
      </tr>`
    )
    .join('');

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <h1>Log — ${escapeHtml(logItem.name)}</h1>
      <div class="meta">Gift Storage — Bank of Ceylon, Western Province South<br/>
        Date range: ${describeDateRange(from, to)}<br/>
        Printed ${new Date().toLocaleString()}</div>
    </div>
    <table class="print-table">
      <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Branch</th><th>Event</th><th>Balance after</th><th>Logged by</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${printFooterHtml()}`;

  window.print();
});

function renderLogTable(logs) {
  const rows = logs
    .map(
      (l) => `
      <tr>
        <td>${l.log_date}</td>
        <td><span class="pill ${l.type === 'issue' ? 'out' : 'in'}">${l.type === 'issue' ? 'Issue' : 'Receive'}</span></td>
        <td>${l.type === 'issue' ? '−' : '+'}${l.quantity}</td>
        <td>${escapeHtml(l.branch_name)}</td>
        <td>${escapeHtml(l.event_name)}</td>
        <td>${l.balance_after}</td>
        <td>${escapeHtml(l.logged_by || '—')}</td>
      </tr>`
    )
    .join('');

  return `
    <table class="log-table sortable">
      <thead>
        <tr>
          <th data-sort="log_date">Date</th>
          <th data-sort="type">Type</th>
          <th data-sort="quantity">Qty</th>
          <th data-sort="branch_name">Branch</th>
          <th data-sort="event_name">Event</th>
          <th data-sort="balance_after">Balance after</th>
          <th data-sort="logged_by">Logged by</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}


function showError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
function hideError(id) {
  document.getElementById(id).classList.remove('show');
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
