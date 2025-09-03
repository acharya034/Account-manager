const body = document.body;
const toggleMode = document.getElementById('toggleMode');
const searchInput = document.getElementById('searchInput');
const entriesList = document.getElementById('entriesList');
const noResults = document.getElementById('noResults');
const addButton = document.getElementById('addButton');
const addModal = document.getElementById('addModal');
const entryType = document.getElementById('entryType');
const addForm = document.getElementById('addForm');
const coreFields = document.getElementById('coreFields');
const toggleOptional = document.getElementById('toggleOptional');
const optionalFields = document.getElementById('optionalFields');
const cancelAdd = document.getElementById('cancelAdd');
const modalTitle = document.getElementById('modalTitle');
const detailsModal = document.getElementById('detailsModal');
const detailsContent = document.getElementById('detailsContent');
const editEntry = document.getElementById('editEntry');
const closeDetails = document.getElementById('closeDetails');
const copyAll = document.getElementById('copyAll');
const exportData = document.getElementById('exportData');
const importFile = document.getElementById('importFile');
const toast = document.getElementById('toast');

let currentEditId = null;
let debounceTimeout;
let db;

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AccountManager', 1);
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      const store = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
      store.createIndex('type', 'type', { unique: false });
    };
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };
    request.onerror = () => reject('Failed to open IndexedDB');
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
    const mode = localStorage.getItem('mode') || 'light';
    if (mode === 'dark') body.classList.add('dark');
    toggleMode.textContent = mode === 'dark' ? '☀️' : '🌙';
    loadEntries();
  } catch (error) {
    showToast('Initialization failed');
    console.error('Init error:', error);
  }
});

// Dark/Light Mode Toggle
toggleMode.addEventListener('click', () => {
  body.classList.toggle('dark');
  const mode = body.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem('mode', mode);
  toggleMode.textContent = mode === 'dark' ? '☀️' : '🌙';
});

// Modal Close on Backdrop Click or Esc
addModal.addEventListener('click', (e) => {
  if (e.target === addModal) closeAddModal();
});
detailsModal.addEventListener('click', (e) => {
  if (e.target === detailsModal) closeDetailsModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAddModal();
    closeDetailsModal();
  }
});

// Form Rendering
async function renderForm(type, entry = {}, isEdit = false) {
  coreFields.innerHTML = '';
  optionalFields.innerHTML = '';
  const emails = await getAllEntries().then(entries => 
    new Set(entries.filter(e => e.type === 'email').map(e => e.username).filter(u => u))
  );
  if (type === 'email') {
    coreFields.innerHTML = `
      <input type="text" id="fullName" placeholder="Full Name (required)" value="${entry.fullName || ''}" required>
      <input type="text" id="username" placeholder="Username/Email (required)" value="${entry.username || ''}" required>
      <div class="password-field">
        <input type="password" id="password" placeholder="Password" value="${entry.password || (isEdit ? '' : generatePassword())}">
        ${isEdit ? '' : '<button type="button" id="generatePassword">Generate</button>'}
        <button type="button" id="togglePassword">👀</button>
        <button type="button" id="copyPassword">📋</button>
      </div>
    `;
    optionalFields.innerHTML = `
      <input type="date" id="dob" placeholder="Date of Birth" value="${entry.dob || ''}">
      <select id="gender">
        <option value="" ${!entry.gender ? 'selected' : ''}>Gender</option>
        <option value="male" ${entry.gender === 'male' ? 'selected' : ''}>Male</option>
        <option value="female" ${entry.gender === 'female' ? 'selected' : ''}>Female</option>
        <option value="other" ${entry.gender === 'other' ? 'selected' : ''}>Other</option>
      </select>
      <input type="email" id="recoveryEmail" list="emailList" placeholder="Recovery Email (optional)" value="${entry.recoveryEmail || ''}">
      <datalist id="emailList">
        ${Array.from(emails).map(e => `<option value="${e}">`).join('')}
      </datalist>
      <input type="tel" id="phone" placeholder="Recovery Phone (optional)" value="${entry.phone || ''}">
      <textarea id="notes" placeholder="Notes (e.g., external data)">${entry.notes || ''}</textarea>
      <input type="text" id="customField" placeholder="Custom Field (e.g., Security Question)" value="${entry.customField || ''}">
    `;
  } else if (type === 'website') {
    const websites = await getAllEntries().then(entries => 
      new Set(entries.filter(e => e.type === 'website').map(e => e.websiteName).filter(w => w))
    );
    const categories = await getAllEntries().then(entries => 
      new Set(entries.filter(e => e.type === 'website').map(e => e.category).filter(c => c))
    );
    coreFields.innerHTML = `
      <input type="text" id="websiteName" list="websiteNames" placeholder="Website/App Name (required)" value="${entry.websiteName || ''}" required>
      <datalist id="websiteNames">
        ${Array.from(websites).map(w => `<option value="${w}">`).join('')}
      </datalist>
      <input type="text" id="username" list="emailList" placeholder="Username/Email (required)" value="${entry.username || ''}" required>
      <datalist id="emailList">
        ${Array.from(emails).map(e => `<option value="${e}">`).join('')}
      </datalist>
      <div class="password-field">
        <input type="password" id="password" placeholder="Password" value="${entry.password || (isEdit ? '' : generatePassword())}">
        ${isEdit ? '' : '<button type="button" id="generatePassword">Generate</button>'}
        <button type="button" id="togglePassword">👀</button>
        <button type="button" id="copyPassword">📋</button>
      </div>
    `;
    optionalFields.innerHTML = `
      <input type="text" id="category" list="categories" placeholder="Category/Tags (e.g., Social, Work)" value="${entry.category || ''}">
      <datalist id="categories">
        ${Array.from(categories).map(c => `<option value="${c}">`).join('')}
      </datalist>
      <textarea id="notes" placeholder="Notes (e.g., external data)">${entry.notes || ''}</textarea>
      <input type="text" id="customField" placeholder="Custom Field (e.g., API Key)" value="${entry.customField || ''}">
    `;
  }
  // Attach event listeners for password buttons
  const toggleBtn = document.getElementById('togglePassword');
  const generateBtn = document.getElementById('generatePassword');
  const copyBtn = document.getElementById('copyPassword');
  const passwordInput = document.getElementById('password');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      toggleBtn.textContent = type === 'password' ? '👀' : '🙈';
    });
  }
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      passwordInput.value = generatePassword();
    });
  }
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(passwordInput.value).then(() => {
        copyBtn.textContent = '✅';
        setTimeout(() => copyBtn.textContent = '📋', 2000);
        showToast('Password copied');
      }).catch(() => showToast('Copy failed'));
    });
  }
}

// Add/Edit Modal
addButton.addEventListener('click', () => {
  currentEditId = null;
  modalTitle.textContent = 'Add New Entry';
  entryType.value = '';
  coreFields.innerHTML = '';
  optionalFields.innerHTML = '';
  optionalFields.classList.add('hidden');
  toggleOptional.textContent = '+ More Options';
  addModal.classList.remove('hidden');
});

cancelAdd.addEventListener('click', closeAddModal);

function closeAddModal() {
  addModal.classList.add('hidden');
  addForm.reset();
  coreFields.innerHTML = '';
  optionalFields.innerHTML = '';
  optionalFields.classList.add('hidden');
  toggleOptional.textContent = '+ More Options';
  currentEditId = null;
  entryType.value = '';
}

toggleOptional.addEventListener('click', () => {
  optionalFields.classList.toggle('hidden');
  toggleOptional.textContent = optionalFields.classList.contains('hidden') ? '+ More Options' : '− Hide Options';
});

entryType.addEventListener('change', () => {
  const type = entryType.value;
  if (type) renderForm(type, {}, false);
});

// Save Entry
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = entryType.value;
  if (!type) {
    showToast('Please select an entry type');
    return;
  }
  try {
    let entry = { type };
    const now = new Date().toISOString();
    if (type === 'email') {
      entry.fullName = document.getElementById('fullName')?.value || '';
      entry.username = document.getElementById('username')?.value || '';
      entry.password = document.getElementById('password')?.value || generatePassword();
      if (!entry.fullName || !entry.username) {
        showToast('Full Name and Username/Email are required');
        return;
      }
      if (!optionalFields.classList.contains('hidden')) {
        entry.dob = document.getElementById('dob')?.value || '';
        entry.gender = document.getElementById('gender')?.value || '';
        entry.recoveryEmail = document.getElementById('recoveryEmail')?.value || '';
        entry.phone = document.getElementById('phone')?.value || '';
        entry.notes = document.getElementById('notes')?.value || '';
        entry.customField = document.getElementById('customField')?.value || '';
      }
    } else if (type === 'website') {
      entry.websiteName = document.getElementById('websiteName')?.value || '';
      entry.username = document.getElementById('username')?.value || '';
      entry.password = document.getElementById('password')?.value || generatePassword();
      if (!entry.websiteName || !entry.username) {
        showToast('Website/App Name and Username/Email are required');
        return;
      }
      if (!optionalFields.classList.contains('hidden')) {
        entry.category = document.getElementById('category')?.value || '';
        entry.notes = document.getElementById('notes')?.value || '';
        entry.customField = document.getElementById('customField')?.value || '';
      }
    }
    if (currentEditId !== null) {
      entry.id = currentEditId;
      entry.updatedAt = now;
      entry.createdAt = entry.createdAt || now; // Preserve original createdAt
    } else {
      entry.createdAt = now;
      entry.updatedAt = now;
    }
    const transaction = db.transaction(['entries'], 'readwrite');
    const store = transaction.objectStore('entries');
    if (currentEditId !== null) {
      store.put(entry);
    } else {
      store.add(entry);
    }
    await transaction.complete;
    closeAddModal();
    searchInput.value = ''; // Clear search to show all entries
    loadEntries();
    showToast(currentEditId !== null ? 'Entry updated' : 'Entry added');
  } catch (error) {
    showToast('Error saving entry: ' + error.message);
    console.error('Save error:', error);
  }
});

// Search
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => loadEntries(searchInput.value.toLowerCase()), 300);
});

// Load Entries
async function loadEntries(query = '') {
  try {
    const entries = await getAllEntries();
    entriesList.innerHTML = '';
    let hasResults = false;
    entries.forEach((entry) => {
      const name = entry.type === 'email' ? entry.username : entry.websiteName;
      const match = !query || Object.values(entry).some(val => val && val.toString().toLowerCase().includes(query));
      if (match) {
        const div = document.createElement('div');
        div.className = 'entry';
        div.innerHTML = `<h3>${name}</h3>`;
        div.addEventListener('click', () => showDetails(entry.id));
        entriesList.appendChild(div);
        hasResults = true;
      }
    });
    noResults.classList.toggle('hidden', hasResults || query === '');
  } catch (error) {
    showToast('Error loading entries');
    console.error('Load error:', error);
    noResults.classList.remove('hidden');
  }
}

// Get All Entries
function getAllEntries() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['entries'], 'readonly');
    const store = transaction.objectStore('entries');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('Error fetching entries');
  });
}

// Details Modal
async function showDetails(id) {
  try {
    const transaction = db.transaction(['entries'], 'readonly');
    const store = transaction.objectStore('entries');
    const request = store.get(id);
    request.onsuccess = () => {
      const entry = request.result;
      let html = '';
      let copyableFields = [];
      if (entry.type === 'email') {
        html = `
          <p><strong>Full Name:</strong> ${entry.fullName || 'N/A'} <button class="copy-btn" data-text="${entry.fullName || ''}">📋</button></p>
          <p><strong>Username/Email:</strong> ${entry.username} <button class="copy-btn" data-text="${entry.username}">📋</button></p>
          <p><strong>Password:</strong> <span class="password-hidden">••••••••</span> <button class="copy-btn" data-text="${entry.password}">📋</button> <button class="toggle-password-details" data-text="${entry.password}">👀</button></p>
          <p><strong>DOB:</strong> ${entry.dob || 'N/A'}</p>
          <p><strong>Gender:</strong> ${entry.gender || 'N/A'}</p>
          <p><strong>Recovery Email:</strong> ${entry.recoveryEmail || 'N/A'} <button class="copy-btn" data-text="${entry.recoveryEmail || ''}">📋</button></p>
          <p><strong>Recovery Phone:</strong> ${entry.phone || 'N/A'}</p>
          <p><strong>Notes:</strong> ${entry.notes || 'N/A'}</p>
          <p><strong>Custom Field:</strong> ${entry.customField || 'N/A'} <button class="copy-btn" data-text="${entry.customField || ''}">📋</button></p>
          <p><strong>Created At:</strong> ${entry.createdAt || 'N/A'}</p>
          <p><strong>Updated At:</strong> ${entry.updatedAt || 'N/A'}</p>
        `;
        copyableFields = [
          `Full Name: ${entry.fullName || 'N/A'}`,
          `Username/Email: ${entry.username}`,
          `Password: ${entry.password}`,
          `Recovery Email: ${entry.recoveryEmail || 'N/A'}`,
          `Custom Field: ${entry.customField || 'N/A'}`
        ].filter(f => !f.includes('N/A'));
      } else if (entry.type === 'website') {
        html = `
          <p><strong>Website/App Name:</strong> ${entry.websiteName}</p>
          <p><strong>Category/Tags:</strong> ${entry.category || 'N/A'}</p>
          <p><strong>Notes:</strong> ${entry.notes || 'N/A'}</p>
          <p><strong>Username/Email:</strong> ${entry.username} <button class="copy-btn" data-text="${entry.username}">📋</button></p>
          <p><strong>Password:</strong> <span class="password-hidden">••••••••</span> <button class="copy-btn" data-text="${entry.password}">📋</button> <button class="toggle-password-details" data-text="${entry.password}">👀</button></p>
          <p><strong>Custom Field:</strong> ${entry.customField || 'N/A'} <button class="copy-btn" data-text="${entry.customField || ''}">📋</button></p>
          <p><strong>Created At:</strong> ${entry.createdAt || 'N/A'}</p>
          <p><strong>Updated At:</strong> ${entry.updatedAt || 'N/A'}</p>
        `;
        copyableFields = [
          `Website/App Name: ${entry.websiteName}`,
          `Username/Email: ${entry.username}`,
          `Password: ${entry.password}`,
          `Custom Field: ${entry.customField || 'N/A'}`
        ].filter(f => !f.includes('N/A'));
      }
      detailsContent.innerHTML = html;
      detailsModal.classList.remove('hidden');
      editEntry.onclick = () => editDetails(id);
      copyAll.onclick = () => {
        navigator.clipboard.writeText(copyableFields.join('\n')).then(() => {
          showToast('All fields copied');
        }).catch(() => showToast('Copy failed'));
      };
      detailsContent.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(btn.dataset.text).then(() => {
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = '📋', 2000);
            showToast('Field copied');
          }).catch(() => showToast('Copy failed'));
        });
      });
      detailsContent.querySelectorAll('.toggle-password-details').forEach(btn => {
        btn.addEventListener('click', () => {
          const span = btn.previousElementSibling.previousElementSibling;
          if (span.classList.contains('password-hidden')) {
            span.textContent = btn.dataset.text;
            span.classList.remove('password-hidden');
            btn.textContent = '🙈';
          } else {
            span.textContent = '••••••••';
            span.classList.add('password-hidden');
            btn.textContent = '👀';
          }
        });
      });
    };
    request.onerror = () => showToast('Error fetching entry details');
  } catch (error) {
    showToast('Error showing details');
    console.error('Details error:', error);
  }
}

function closeDetailsModal() {
  detailsModal.classList.add('hidden');
  detailsContent.innerHTML = '';
}

closeDetails.addEventListener('click', closeDetailsModal);

async function editDetails(id) {
  try {
    const transaction = db.transaction(['entries'], 'readonly');
    const store = transaction.objectStore('entries');
    const request = store.get(id);
    request.onsuccess = () => {
      const entry = request.result;
      currentEditId = id;
      modalTitle.textContent = 'Edit Entry';
      entryType.value = entry.type;
      renderForm(entry.type, entry, true);
      if (entry.dob || entry.gender || entry.recoveryEmail || entry.phone || entry.notes || entry.customField) {
        optionalFields.classList.remove('hidden');
        toggleOptional.textContent = '− Hide Options';
      }
      detailsModal.classList.add('hidden');
      addModal.classList.remove('hidden');
    };
    request.onerror = () => showToast('Error fetching entry for edit');
  } catch (error) {
    showToast('Error editing entry');
    console.error('Edit error:', error);
  }
}

// Generate Password
function generatePassword() {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
}

// Export Data
exportData.addEventListener('click', async () => {
  try {
    const entries = await getAllEntries();
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accounts.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported');
  } catch (error) {
    showToast('Export failed');
    console.error('Export error:', error);
  }
});

// Helper function to check if two entries are equal (ignore id, createdAt, updatedAt)
function isEqualEntry(entry1, entry2) {
  const ignoreKeys = ['id', 'createdAt', 'updatedAt'];
  const e1 = { ...entry1 };
  const e2 = { ...entry2 };
  ignoreKeys.forEach(key => {
    delete e1[key];
    delete e2[key];
  });
  return JSON.stringify(e1) === JSON.stringify(e2);
}

// Helper function to find duplicate entry
async function findDuplicate(importedEntry) {
  const existingEntries = await getAllEntries();
  if (importedEntry.type === 'email') {
    return existingEntries.find(e => e.type === 'email' && e.username === importedEntry.username);
  } else if (importedEntry.type === 'website') {
    return existingEntries.find(e => e.type === 'website' && e.websiteName === importedEntry.websiteName && e.username === importedEntry.username);
  }
  return null;
}

// Import Data
importFile.addEventListener('change', async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedEntries = JSON.parse(event.target.result);
        if (!Array.isArray(importedEntries)) throw new Error('Invalid JSON format');
        const transaction = db.transaction(['entries'], 'readwrite');
        const store = transaction.objectStore('entries');
        let addedCount = 0;
        let skippedCount = 0;
        let replacedCount = 0;
        for (const importedEntry of importedEntries) {
          delete importedEntry.id; // Always remove ID
          const duplicate = await findDuplicate(importedEntry);
          if (duplicate) {
            if (isEqualEntry(importedEntry, duplicate)) {
              // All info same, ignore
              skippedCount++;
              continue;
            } else {
              // Conflict, ask user
              let message = '';
              if (importedEntry.type === 'email') {
                message = `Email entry with username "${importedEntry.username}" already exists. Replace?`;
              } else if (importedEntry.type === 'website') {
                message = `Website entry with name "${importedEntry.websiteName}" and username "${importedEntry.username}" already exists. Replace?`;
              }
              if (window.confirm(message)) {
                // Replace
                importedEntry.id = duplicate.id;
                importedEntry.createdAt = duplicate.createdAt;
                importedEntry.updatedAt = new Date().toISOString();
                store.put(importedEntry);
                replacedCount++;
              } else {
                // Skip
                skippedCount++;
              }
            }
          } else {
            // No duplicate, add new
            const now = new Date().toISOString();
            importedEntry.createdAt = now;
            importedEntry.updatedAt = now;
            store.add(importedEntry);
            addedCount++;
          }
        }
        await transaction.complete;
        searchInput.value = ''; // Clear search to show all entries
        loadEntries();
        showToast(`Data imported: ${addedCount} added, ${replacedCount} replaced, ${skippedCount} skipped`);
      } catch (error) {
        showToast('Invalid JSON file');
        console.error('Import JSON error:', error);
      }
    };
    reader.onerror = () => showToast('Error reading file');
    reader.readAsText(file);
  } catch (error) {
    showToast('Import failed');
    console.error('Import error:', error);
  }
});

// Toast Notification
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}