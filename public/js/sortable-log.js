/* Shared helpers for every log/history table in the app: filtering by a
   date range, and click-to-sort column headers with a visual indicator. */

// Keeps only rows whose `dateField` falls within [from, to] inclusive.
// Empty from/to means "no lower/upper bound".
window.filterByDateRange = function (rows, dateField, from, to) {
  return rows.filter((row) => {
    const value = row[dateField];
    if (!value) return true;
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  });
};

// Generic sort — numeric fields sort numerically, everything else as
// case-insensitive strings. `direction` is 'asc' or 'desc'.
window.sortRows = function (rows, field, direction) {
  const sorted = rows.slice().sort((a, b) => {
    let av = a[field];
    let bv = b[field];
    if (typeof av === 'number' || typeof bv === 'number') {
      av = Number(av) || 0;
      bv = Number(bv) || 0;
    } else {
      av = (av || '').toString().toLowerCase();
      bv = (bv || '').toString().toLowerCase();
    }
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  if (direction === 'desc') sorted.reverse();
  return sorted;
};

// Wires up `<th data-sort="field">` headers inside `tableEl` for
// click-to-sort. `state` is a plain object the caller keeps around, e.g.
// `{ field: 'log_date', direction: 'desc' }` — this function mutates it in
// place and calls `onChange()` whenever the user clicks a header.
window.wireSortableHeaders = function (tableEl, state, onChange) {
  const headers = tableEl.querySelectorAll('th[data-sort]');
  function paint() {
    headers.forEach((th) => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === state.field) {
        th.classList.add(state.direction === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }
  headers.forEach((th) => {
    th.addEventListener('click', () => {
      if (state.field === th.dataset.sort) {
        state.direction = state.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.field = th.dataset.sort;
        state.direction = 'asc';
      }
      paint();
      onChange();
    });
  });
  paint();
};

// A short, human sentence describing the applied date range, for print
// headers — e.g. "1 Sep 2026 – 11 Sep 2026", "From 1 Sep 2026", or "All dates".
window.describeDateRange = function (from, to) {
  const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  if (to) return `Up to ${fmt(to)}`;
  return 'All dates';
};

// A standard footer for every printed document — who printed it and when,
// so a paper copy is self-documenting for an official record.
window.printFooterHtml = function () {
  const name = (window.currentUser && window.currentUser.displayName) || 'Unknown user';
  return `
    <div class="print-footer">
      <span>Printed by ${name}</span>
      <span>Gift Storage Management System — Internal Use Only</span>
    </div>`;
};
