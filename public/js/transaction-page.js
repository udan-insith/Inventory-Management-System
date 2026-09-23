const txnType = document.body.dataset.txnType; // 'issue' | 'receive'
let allItems = [];
let currentTxnLines = []; // [{ itemId, name, quantity }]

const txnItemModal = document.getElementById('txn-item-modal');
const uploadLetterModal = document.getElementById('upload-letter-modal');
[txnItemModal, uploadLetterModal].forEach((m) => modalHelper.wireDismiss(m));

document.addEventListener('shell-ready', async () => {
  populateBranchDropdown();
  document.getElementById('txn-date').value = new Date().toISOString().slice(0, 10);
  await loadItemsCatalog();
  loadLetterStatus();
  applyPreselectedItem();
});

function populateBranchDropdown() {
  const select = document.getElementById('txn-branch');
  const branches = window.BOC_BRANCHES || [];
  select.innerHTML =
    '<option value="">Select a branch…</option>' +
    branches.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
}

async function loadItemsCatalog() {
  try {
    const { items } = await api.get('/api/items');
    allItems = items;
  } catch (e) {
    toast('Could not load the item list.', 'error');
  }
}

// If the user arrived here by clicking Issue/Receive on a specific item
// card on the Stock page, jump straight into "add item" with it selected.
function applyPreselectedItem() {
  const raw = sessionStorage.getItem('preselectItem');
  if (!raw) return;
  sessionStorage.removeItem('preselectItem');
  try {
    const { id } = JSON.parse(raw);
    if (allItems.some((i) => i.id === id)) {
      openAddItemModal(id);
    }
  } catch (e) {
    // ignore malformed sessionStorage content
  }
}

// ------------------------- Items list -------------------------
function renderTxnItemsList() {
  const wrap = document.getElementById('txn-items-list');
  if (currentTxnLines.length === 0) {
    wrap.innerHTML = '<div class="txn-items-empty">No items added yet.</div>';
    return;
  }
  wrap.innerHTML = currentTxnLines
    .map(
      (line, i) => `
      <div class="txn-item-row" style="animation-delay:${i * 25}ms">
        <span>${escapeHtml(line.name)}<span class="qty">× ${line.quantity}</span></span>
        <button type="button" class="remove-line-btn" data-index="${i}" aria-label="Remove">&times;</button>
      </div>`
    )
    .join('');

  wrap.querySelectorAll('.remove-line-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTxnLines.splice(Number(btn.dataset.index), 1);
      renderTxnItemsList();
    });
  });
}

function openAddItemModal(preselectItemId) {
  const select = document.getElementById('txn-item-select');
  const eligible = txnType === 'issue' ? allItems.filter((i) => i.balance > 0) : allItems;

  select.innerHTML =
    '<option value="">Select an item…</option>' +
    eligible.map((i) => `<option value="${i.id}">${escapeHtml(i.name)} (${i.balance} in stock)</option>`).join('');

  document.getElementById('txn-item-form').reset();
  if (preselectItemId) select.value = String(preselectItemId);
  hideError('txn-item-error');
  modalHelper.open(txnItemModal);
  setTimeout(() => document.getElementById('txn-item-amount').focus(), 60);
}

document.getElementById('txn-add-item-btn').addEventListener('click', () => openAddItemModal());

document.getElementById('txn-item-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const itemId = Number(document.getElementById('txn-item-select').value);
  const amount = Math.trunc(Number(document.getElementById('txn-item-amount').value));

  if (!itemId) return showError('txn-item-error', 'Choose an item.');
  if (!amount || amount <= 0) return showError('txn-item-error', 'Enter an amount greater than 0.');

  const item = allItems.find((i) => i.id === itemId);
  const alreadyQueued = currentTxnLines.find((l) => l.itemId === itemId)?.quantity || 0;
  if (txnType === 'issue' && amount + alreadyQueued > item.balance) {
    return showError('txn-item-error', `Only ${item.balance} of "${item.name}" in stock.`);
  }

  const existingLine = currentTxnLines.find((l) => l.itemId === itemId);
  if (existingLine) {
    existingLine.quantity += amount;
  } else {
    currentTxnLines.push({ itemId, name: item.name, quantity: amount });
  }

  renderTxnItemsList();
  modalHelper.close(txnItemModal);
});

// ------------------------- Submit -------------------------
document.getElementById('txn-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const branchName = document.getElementById('txn-branch').value;
  const date = document.getElementById('txn-date').value;
  const eventName = document.getElementById('txn-event').value.trim();
  const submitBtn = document.getElementById('txn-submit-btn');

  if (!branchName) return showError('txn-error', 'Choose a branch.');
  if (!eventName) return showError('txn-error', 'Give this event a name.');
  if (!date) return showError('txn-error', 'Pick a date.');
  if (currentTxnLines.length === 0) return showError('txn-error', 'Add at least one item.');

  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.innerHTML = '<span class="spinner"></span> Saving…';
  hideError('txn-error');

  try {
    await api.post('/api/transactions', {
      type: txnType,
      branchName,
      eventName,
      date,
      items: currentTxnLines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
    });

    toast(txnType === 'issue' ? 'Gifts issued and logged.' : 'Stock received and logged.');
    currentTxnLines = [];
    renderTxnItemsList();
    document.getElementById('txn-form').reset();
    document.getElementById('txn-date').value = new Date().toISOString().slice(0, 10);
    await loadItemsCatalog();
  } catch (err) {
    showError('txn-error', err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// ------------------------- Print (letter + generated details sheet) -------------------------
document.getElementById('txn-print-btn').addEventListener('click', async () => {
  const branchName = document.getElementById('txn-branch').value;
  const date = document.getElementById('txn-date').value;
  const eventName = document.getElementById('txn-event').value.trim();

  if (!branchName || !eventName || !date || currentTxnLines.length === 0) {
    toast('Fill in the branch, date, event and at least one item before printing.', 'error');
    return;
  }

  const rows = currentTxnLines
    .map((l) => `<tr><td>${escapeHtml(l.name)}</td><td>${l.quantity}</td></tr>`)
    .join('');

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <h1>${txnType === 'issue' ? 'Issue Gifts — Details' : 'Receive Gifts — Details'}</h1>
      <div class="meta">Gift Storage<br/>Printed ${new Date().toLocaleString()}</div>
    </div>
    <p><strong>Branch:</strong> ${escapeHtml(branchName)}<br/>
       <strong>Date:</strong> ${escapeHtml(date)}<br/>
       <strong>Event:</strong> ${escapeHtml(eventName)}</p>
    <table class="print-table">
      <thead><tr><th>Item</th><th>Quantity</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${printFooterHtml()}`;
  window.print();

  try {
    const res = await fetch(`/api/letters/${txnType}/file`, { credentials: 'same-origin' });
    if (!res.ok) {
      toast('Details sheet printed. No letter has been uploaded yet, so only that was printed.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const frame = document.getElementById('letter-print-frame');
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (err) {
        window.open(url, '_blank');
      }
    };
    frame.src = url;
  } catch (err) {
    // details sheet already printed — letter step is a bonus, fail quietly
  }
});

// ------------------------- Letter status + upload -------------------------
async function loadLetterStatus() {
  const subEl = document.getElementById('letter-sub');
  const uploadBtn = document.getElementById('upload-letter-btn');

  try {
    const { letter, canUpload } = await api.get(`/api/letters/${txnType}`);
    if (letter) {
      subEl.textContent = `Uploaded by ${letter.uploadedBy} on ${new Date(letter.uploadedAt).toLocaleDateString()}`;
      uploadBtn.style.display = 'none';
    } else {
      subEl.textContent = canUpload
        ? 'Not uploaded yet — you can upload it once.'
        : 'Not uploaded yet. Printing will only produce the details sheet until it is.';
      uploadBtn.style.display = canUpload ? 'inline-flex' : 'none';
    }
  } catch (e) {
    subEl.textContent = 'Could not check status.';
  }
}

document.getElementById('upload-letter-btn').addEventListener('click', () => {
  document.getElementById('upload-letter-form').reset();
  hideError('upload-letter-error');
  modalHelper.open(uploadLetterModal);
});

document.getElementById('upload-letter-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('letter-file').files[0];
  const submitBtn = document.getElementById('upload-letter-submit');

  if (!file) return showError('upload-letter-error', 'Choose a PDF file.');
  if (file.type !== 'application/pdf') return showError('upload-letter-error', 'The letter must be a PDF file.');

  const formData = new FormData();
  formData.append('letter', file);

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Uploading…';

  try {
    await api.upload(`/api/letters/${txnType}/upload`, formData);
    toast('Letter uploaded. This is now the file everyone will print.');
    modalHelper.close(uploadLetterModal);
    loadLetterStatus();
  } catch (err) {
    showError('upload-letter-error', err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload';
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
