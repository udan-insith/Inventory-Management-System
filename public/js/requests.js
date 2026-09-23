let requests = [];
const sortState = { field: 'request_date', direction: 'desc' };

const addRequestModal = document.getElementById('add-request-modal');
modalHelper.wireDismiss(addRequestModal);

document.addEventListener('shell-ready', () => {
  populateBranchDropdown('request-branch', true);
  loadRequests();
});

function populateBranchDropdown(selectId, forForm) {
  const select = document.getElementById(selectId);
  const branches = window.BOC_BRANCHES || [];
  const placeholder = forForm ? '<option value="">Select a branch…</option>' : '<option value="all">All branches</option>';
  select.innerHTML = placeholder + branches.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
}

async function loadRequests() {
  const tbody = document.getElementById('requests-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:14px;">Loading…</td></tr>';
  try {
    const { requests: fetched } = await api.get('/api/requests');
    requests = fetched;
    populateBranchDropdown('branch-filter', false);
    wireSortableHeaders(document.getElementById('requests-table'), sortState, renderTable);
    renderTable();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:14px;">Could not load requests.</td></tr>';
    toast(e.message || 'Failed to load requests.', 'error');
  }
}

['branch-filter', 'date-from', 'date-to'].forEach((id) => {
  document.getElementById(id).addEventListener('change', renderTable);
});
document.getElementById('clear-filters-btn').addEventListener('click', () => {
  document.getElementById('branch-filter').value = 'all';
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
  renderTable();
});

function getFiltered() {
  const branch = document.getElementById('branch-filter').value;
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;

  let rows = requests.filter((r) => branch === 'all' || r.branch_name === branch);
  rows = filterByDateRange(rows, 'request_date', from, to);
  rows = sortRows(rows, sortState.field, sortState.direction);
  return rows;
}

function fileIcon(fileType) {
  if (fileType.startsWith('image/')) return '&#128247;';
  if (fileType === 'application/pdf') return '&#128196;';
  return '&#128221;'; // Word docs
}

function renderTable() {
  const tbody = document.getElementById('requests-tbody');
  const rows = getFiltered();

  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:14px;">No requests logged yet.</td></tr>';
    return;
  }
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:14px;">No requests match this filter.</td></tr>';
    return;
  }

  const isAdmin = window.currentUser && window.currentUser.role === 'admin';

  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${r.request_date}</td>
        <td>${escapeHtml(r.branch_name)}</td>
        <td>${escapeHtml(r.description) || '<span class="muted">—</span>'}</td>
        <td><a class="file-chip" href="/api/requests/${r.id}/file" target="_blank" rel="noopener">${fileIcon(r.file_type)} ${escapeHtml(r.file_name)}</a></td>
        <td>${escapeHtml(r.uploaded_by || '—')}</td>
        <td>${isAdmin ? `<button class="btn btn-danger btn-sm delete-request-btn" data-id="${r.id}">Delete</button>` : ''}</td>
      </tr>`
    )
    .join('');

  tbody.querySelectorAll('.delete-request-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteRequest(Number(btn.dataset.id)));
  });
}

async function deleteRequest(id) {
  if (!confirm('Delete this request and its attached file? This cannot be undone.')) return;
  try {
    await api.del(`/api/requests/${id}`);
    toast('Request deleted.');
    await loadRequests();
  } catch (err) {
    toast(err.message || 'Could not delete that request.', 'error');
  }
}

document.getElementById('print-requests-btn').addEventListener('click', () => {
  const rows = getFiltered();
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;

  const body = rows
    .map(
      (r) => `
      <tr>
        <td>${r.request_date}</td>
        <td>${escapeHtml(r.branch_name)}</td>
        <td>${escapeHtml(r.description) || '—'}</td>
        <td>${escapeHtml(r.file_name)}</td>
        <td>${escapeHtml(r.uploaded_by || '—')}</td>
      </tr>`
    )
    .join('');

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <h1>Received Requests</h1>
      <div class="meta">Gift Storage — Bank of Ceylon, Western Province South<br/>
        Date range: ${describeDateRange(from, to)}<br/>
        Printed ${new Date().toLocaleString()}</div>
    </div>
    <table class="print-table">
      <thead><tr><th>Date</th><th>Branch</th><th>Description</th><th>File</th><th>Uploaded by</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${printFooterHtml()}`;

  window.print();
});

document.getElementById('add-request-btn').addEventListener('click', () => {
  document.getElementById('add-request-form').reset();
  document.getElementById('request-date').value = new Date().toISOString().slice(0, 10);
  hideError('add-request-error');
  modalHelper.open(addRequestModal);
});

document.getElementById('add-request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const branchName = document.getElementById('request-branch').value;
  const date = document.getElementById('request-date').value;
  const description = document.getElementById('request-description').value.trim();
  const file = document.getElementById('request-file').files[0];
  const submitBtn = document.getElementById('add-request-submit');

  if (!branchName) return showError('add-request-error', 'Choose a branch.');
  if (!date) return showError('add-request-error', 'Pick a date.');
  if (!file) return showError('add-request-error', 'Attach a file.');

  const formData = new FormData();
  formData.append('branchName', branchName);
  formData.append('date', date);
  formData.append('description', description);
  formData.append('file', file);

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    await api.upload('/api/requests', formData);
    toast('Request logged.');
    modalHelper.close(addRequestModal);
    await loadRequests();
  } catch (err) {
    showError('add-request-error', err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Request';
  }
});

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
