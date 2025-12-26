// === STATE MANAGEMENT ===
const APP_KEY = 'lifeos_data_v1';
let state = {
    transactions: [],
    budget: 0,
    assets: [],
    notes: [],
    tasks: [],
    settings: {
        darkMode: false,
        streak: 0,
        lastLogin: null
    }
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    checkStreak();
    applyTheme();
    renderAll();
    
    // Event Listener for Theme Toggle in Settings
    document.getElementById('setting-theme-toggle').addEventListener('change', (e) => {
        toggleTheme(e.target.checked);
    });
    
    // Header toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const isDark = !state.settings.darkMode;
        document.getElementById('setting-theme-toggle').checked = isDark;
        toggleTheme(isDark);
    });
});

// === CORE FUNCTIONS ===
function loadData() {
    const saved = localStorage.getItem(APP_KEY);
    if (saved) {
        state = JSON.parse(saved);
        // Ensure structure exists if updating from older version
        if(!state.assets) state.assets = [];
    }
}

function saveData() {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
    renderAll();
}

function renderAll() {
    renderDashboard();
    renderTransactions();
    renderAssets();
    renderNotes();
    renderTasks();
    updateSettingsUI();
}

// === NAVIGATION ===
function switchTab(tabId) {
    // Hide all sections
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Show target
    document.getElementById(tabId).classList.add('active');
    
    // Update Nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Simple logic to find nav button based on index or onclick
    // Using a simpler approach: finding the button that calls this function with this ID
    // But since we are inside the function, we manually update based on ID
    const navMap = { 'dashboard': 0, 'tracker': 1, 'notes': 2, 'tasks': 3, 'settings': 4 };
    document.querySelectorAll('.nav-item')[navMap[tabId]].classList.add('active');

    // Update Header Title
    const titles = { 'dashboard': 'Dashboard', 'tracker': 'Wealth', 'notes': 'Notes', 'tasks': 'Daily Tasks', 'settings': 'Settings' };
    document.getElementById('page-title').innerText = titles[tabId];
}

function navTo(tabId) {
    switchTab(tabId);
}

// === THEME ===
function applyTheme() {
    const isDark = state.settings.darkMode;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.getElementById('setting-theme-toggle').checked = isDark;
    document.getElementById('theme-toggle').innerText = isDark ? '☀️' : '🌙';
}

function toggleTheme(isDark) {
    state.settings.darkMode = isDark;
    saveData();
    applyTheme();
}

// === DASHBOARD & LOGIC ===
function renderDashboard() {
    // Calc Finances
    const income = state.transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = state.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expense;

    document.getElementById('dash-balance').innerText = formatMoney(balance);
    document.getElementById('dash-income').innerText = `+${formatMoney(income)}`;
    document.getElementById('dash-expense').innerText = `-${formatMoney(expense)}`;

    // Calc Tasks
    const totalTasks = state.tasks.length;
    const completedTasks = state.tasks.filter(t => t.done).length;
    const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    
    document.getElementById('dash-progress-bar').style.width = `${percent}%`;
    document.getElementById('dash-progress-text').innerText = `${percent}%`;
}

function formatMoney(amount) {
    return '$' + parseFloat(amount).toFixed(2);
}

// === EXPENSE TRACKER ===
function addTransaction() {
    const type = document.getElementById('trans-type').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const desc = document.getElementById('trans-desc').value;
    const cat = document.getElementById('trans-category').value;

    if (!amount || !desc) return alert('Please fill details');

    state.transactions.unshift({
        id: Date.now(),
        type, amount, desc, cat, date: new Date().toLocaleDateString()
    });
    
    // Clear inputs
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-desc').value = '';
    
    saveData();
}

function renderTransactions() {
    const list = document.getElementById('transaction-list');
    list.innerHTML = '';
    
    state.transactions.slice(0, 10).forEach(t => {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <div class="col">
                <span style="font-weight:bold">${t.desc}</span>
                <span class="label">${t.cat} • ${t.date}</span>
            </div>
            <span class="${t.type === 'income' ? 'success' : 'danger'}">
                ${t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}
            </span>
        `;
        list.appendChild(li);
    });

    // Budget Update
    document.getElementById('monthly-budget').value = state.budget || '';
    updateBudgetDisplay();
}

function updateBudget() {
    state.budget = parseFloat(document.getElementById('monthly-budget').value) || 0;
    saveData();
    updateBudgetDisplay();
}

function updateBudgetDisplay() {
    const expense = state.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const remaining = state.budget - expense;
    document.getElementById('budget-status').innerText = `Remaining: ${formatMoney(remaining)}`;
    document.getElementById('budget-status').style.color = remaining < 0 ? 'var(--danger)' : 'var(--text-color)';
}

// === ASSET TRACKER ===
function addAsset() {
    const name = document.getElementById('asset-name').value;
    const invested = parseFloat(document.getElementById('asset-invested').value);
    const current = parseFloat(document.getElementById('asset-current').value);

    if(!name || isNaN(invested) || isNaN(current)) return;

    state.assets.push({ id: Date.now(), name, invested, current });
    
    document.getElementById('asset-name').value = '';
    document.getElementById('asset-invested').value = '';
    document.getElementById('asset-current').value = '';
    saveData();
}

function renderAssets() {
    const list = document.getElementById('asset-list');
    list.innerHTML = '';
    state.assets.forEach((a, index) => {
        const diff = a.current - a.invested;
        const pnlClass = diff >= 0 ? 'success' : 'danger';
        const percent = ((diff / a.invested) * 100).toFixed(1);
        
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <div class="col">
                <span style="font-weight:bold">${a.name}</span>
                <span class="label">Inv: ${a.invested}</span>
            </div>
            <div class="col text-center">
                <span style="font-weight:bold">${a.current}</span>
                <span class="${pnlClass} label">${diff >=0 ? '+' : ''}${diff} (${percent}%)</span>
            </div>
            <button class="icon-btn" onclick="deleteAsset(${index})" style="font-size:1rem; opacity:0.5">🗑️</button>
        `;
        list.appendChild(li);
    });
}

function deleteAsset(index) {
    state.assets.splice(index, 1);
    saveData();
}

// === NOTES ===
let currentNoteId = null;

function renderNotes() {
    const container = document.getElementById('notes-list-container');
    container.innerHTML = '';
    
    state.notes.forEach(note => {
        const div = document.createElement('div');
        div.className = 'card glass note-card';
        div.onclick = (e) => { if(!e.target.classList.contains('delete-note')) editNote(note.id); };
        div.innerHTML = `
            <h3>${note.title || 'Untitled'}</h3>
            <p class="small-text">${note.body.substring(0, 50)}...</p>
            <span class="delete-note" onclick="deleteNote(${note.id})">🗑️</span>
        `;
        container.appendChild(div);
    });
}

function openNote() {
    currentNoteId = null;
    document.getElementById('note-title').value = '';
    document.getElementById('note-body').value = '';
    document.getElementById('note-editor').style.display = 'block';
    document.getElementById('notes-list-container').style.display = 'none';
}

function editNote(id) {
    currentNoteId = id;
    const note = state.notes.find(n => n.id === id);
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-body').value = note.body;
    document.getElementById('note-editor').style.display = 'block';
    document.getElementById('notes-list-container').style.display = 'none';
}

function closeNote() {
    document.getElementById('note-editor').style.display = 'none';
    document.getElementById('notes-list-container').style.display = 'block';
}

function saveNote() {
    const title = document.getElementById('note-title').value;
    const body = document.getElementById('note-body').value;
    
    if (currentNoteId) {
        const note = state.notes.find(n => n.id === currentNoteId);
        note.title = title;
        note.body = body;
        note.updated = Date.now();
    } else {
        state.notes.unshift({ id: Date.now(), title, body, updated: Date.now() });
    }
    saveData();
    closeNote();
}

function deleteNote(id) {
    if(confirm('Delete note?')) {
        state.notes = state.notes.filter(n => n.id !== id);
        saveData();
    }
}

// === TASKS & STREAK ===
function checkStreak() {
    const today = new Date().toDateString();
    if (state.settings.lastLogin !== today) {
        // New day logic
        if (state.settings.lastLogin === new Date(Date.now() - 86400000).toDateString()) {
            state.settings.streak++; // Consecutive day
        } else if (state.settings.lastLogin !== today) {
            // Missed a day (unless it's the very first run)
            if(state.settings.lastLogin) state.settings.streak = 1; 
            else state.settings.streak = 1;
        }
        state.settings.lastLogin = today;
        
        // Reset daily tasks
        state.tasks.forEach(t => t.done = false);
        saveData();
    }
    document.getElementById('streak-count').innerText = `🔥 ${state.settings.streak} Days`;
}

function addTask() {
    const input = document.getElementById('new-task-input');
    const txt = input.value.trim();
    if (!txt) return;
    
    state.tasks.push({ id: Date.now(), text: txt, done: false });
    input.value = '';
    saveData();
}

function renderTasks() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';
    
    state.tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.done ? 'completed' : ''}`;
        li.innerHTML = `
            <input type="checkbox" onchange="toggleTask(${index})" ${task.done ? 'checked' : ''}>
            <span>${task.text}</span>
            <button onclick="deleteTask(${index})" style="margin-left:auto; background:none; border:none; cursor:pointer;">✕</button>
        `;
        list.appendChild(li);
    });
}

function toggleTask(index) {
    state.tasks[index].done = !state.tasks[index].done;
    saveData();
}

function deleteTask(index) {
    state.tasks.splice(index, 1);
    saveData();
}

function resetTasks() {
    if(confirm('Reset all daily tasks?')) {
        state.tasks.forEach(t => t.done = false);
        saveData();
    }
}

// === SETTINGS ===
function updateSettingsUI() {
    // handled in init
}

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "lifeos_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function resetAllData() {
    if(confirm('WARNING: This will delete ALL your data permanently. Continue?')) {
        localStorage.removeItem(APP_KEY);
        location.reload();
    }
}
