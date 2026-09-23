let usersList = [];
let editingUserId = null;

const addUserModal = document.getElementById('add-user-modal');
const editUserModal = document.getElementById('edit-user-modal');
const changeMyCredentialsModal = document.getElementById('change-my-credentials-modal');
[addUserModal, editUserModal, changeMyCredentialsModal].forEach((m) => modalHelper.wireDismiss(m));

document.addEventListener('shell-ready', ({ detail }) => {
  if (detail.user.role !== 'admin') {
    toast('Only admins can manage users.', 'error');
    window.location.href = '/dashboard.html';
    return;
  }
  renderMyAccount();
  loadUsers();
});

function renderMyAccount() {
  const user = window.currentUser;
  document.getElementById('my-account-sub').textContent = `Logged in as ${user.displayName} (${user.username})`;
}

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="muted" style="padding:14px;">Loading…</td></tr>';
  try {
    const { users } = await api.get('/api/users');
    usersList = users;
    renderUsers();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted" style="padding:14px;">Could not load users.</td></tr>';
    toast(e.message || 'Failed to load users.', 'error');
  }
}

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = usersList
    .map((u) => {
      const isAdmin = u.role === 'admin';
      const actions = isAdmin
        ? '<span class="muted">Protected</span>'
        : `
          <button class="btn btn-outline btn-sm rename-btn" data-id="${u.id}">Edit</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${u.id}">Delete</button>`;
      return `
        <tr>
          <td>${escapeHtml(u.display_name)}</td>
          <td>${escapeHtml(u.username)}</td>
          <td><span class="pill ${u.role}">${isAdmin ? 'Admin' : 'Normal User'}</span></td>
          <td>${actions}</td>
        </tr>`;
    })
    .join('');

  tbody.querySelectorAll('.rename-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteUser(Number(btn.dataset.id)));
  });
}

// ------------------------- Add User -------------------------
document.getElementById('add-user-btn').addEventListener('click', () => {
  document.getElementById('add-user-form').reset();
  hideError('add-user-error');
  modalHelper.open(addUserModal);
});

document.getElementById('add-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const displayName = document.getElementById('new-user-display-name').value.trim();
  const username = document.getElementById('new-user-username').value.trim();
  const password = document.getElementById('new-user-password').value;
  const submitBtn = document.getElementById('add-user-submit');

  if (!displayName || !username || !password) return showError('add-user-error', 'Fill in every field.');
  if (password.length < 6) return showError('add-user-error', 'Password should be at least 6 characters.');

  submitBtn.disabled = true;
  try {
    await api.post('/api/users', { username, displayName, password });
    toast(`${displayName} added as a Normal User.`);
    modalHelper.close(addUserModal);
    await loadUsers();
  } catch (err) {
    showError('add-user-error', err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ------------------------- Rename User -------------------------
function openEditModal(userId) {
  const user = usersList.find((u) => u.id === userId);
  if (!user) return;
  editingUserId = userId;
  document.getElementById('edit-user-display-name').value = user.display_name;
  document.getElementById('edit-user-username').value = user.username;
  document.getElementById('edit-user-password').value = '';
  hideError('edit-user-error');
  modalHelper.open(editUserModal);
}

document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingUserId) return;

  const displayName = document.getElementById('edit-user-display-name').value.trim();
  const username = document.getElementById('edit-user-username').value.trim();
  const password = document.getElementById('edit-user-password').value;
  const submitBtn = document.getElementById('edit-user-submit');

  if (!displayName || !username) return showError('edit-user-error', 'Fill in every field.');
  if (password && password.length < 6) return showError('edit-user-error', 'New password should be at least 6 characters.');

  const payload = { username, displayName };
  if (password) payload.password = password;

  submitBtn.disabled = true;
  try {
    await api.put(`/api/users/${editingUserId}`, payload);
    toast(password ? 'User updated and password reset.' : 'User updated.');
    modalHelper.close(editUserModal);
    await loadUsers();
  } catch (err) {
    showError('edit-user-error', err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ------------------------- Change My Username / Password -------------------------
document.getElementById('change-my-credentials-btn').addEventListener('click', () => {
  document.getElementById('change-my-credentials-form').reset();
  hideError('change-my-credentials-error');
  modalHelper.open(changeMyCredentialsModal);
});

document.getElementById('change-my-credentials-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById('my-current-password').value;
  const newUsername = document.getElementById('my-new-username').value.trim();
  const newPassword = document.getElementById('my-new-password').value;
  const newPasswordConfirm = document.getElementById('my-new-password-confirm').value;
  const submitBtn = document.getElementById('change-my-credentials-submit');

  if (!currentPassword) return showError('change-my-credentials-error', 'Enter your current password.');
  if (!newUsername && !newPassword) {
    return showError('change-my-credentials-error', 'Enter a new username and/or a new password.');
  }
  if (newPassword && newPassword.length < 6) {
    return showError('change-my-credentials-error', 'New password should be at least 6 characters.');
  }
  if (newPassword !== newPasswordConfirm) {
    return showError('change-my-credentials-error', 'New password and confirmation do not match.');
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    const { user } = await api.put('/api/users/me', { currentPassword, newUsername, newPassword });
    window.currentUser.username = user.username;
    renderMyAccount();
    toast('Your login details have been updated.');
    modalHelper.close(changeMyCredentialsModal);
  } catch (err) {
    showError('change-my-credentials-error', err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }
});

// ------------------------- Delete User -------------------------
async function deleteUser(userId) {
  const user = usersList.find((u) => u.id === userId);
  if (!user) return;
  if (!confirm(`Remove ${user.display_name} (${user.username})? This can't be undone.`)) return;

  try {
    await api.del(`/api/users/${userId}`);
    toast(`${user.display_name} removed.`);
    await loadUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ------------------------- Reset Application (testing only) -------------------------
document.getElementById('reset-app-btn').addEventListener('click', async () => {
  const sure = confirm(
    'This wipes every item (and photo), every Issue/Receive entry, Total History, both letters, and every received request (and its file), then recreates the 5 default accounts. Everyone will need to log in again.\n\nThis cannot be undone. Reset the application?'
  );
  if (!sure) return;

  const btn = document.getElementById('reset-app-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Resetting…';

  try {
    await api.post('/api/reset');
    window.location.href = '/login.html';
  } catch (err) {
    toast(err.message || 'Could not reset the application.', 'error');
    btn.disabled = false;
    btn.textContent = 'Reset Application';
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
