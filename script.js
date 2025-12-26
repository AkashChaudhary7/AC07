// === GLOBAL STATE ===
const APP_KEY = 'lifeos_pro_v1';
let state = {
    user: { pin: null, theme: 'light', lastLogin: Date.now() },
    finance: { transactions: [], budget: 2000, assets: [] },
    productivity: { goals: [], focusTime: 0, timerActive: false, weeklyPlan: {} },
    health: { water: 0, waterGoal: 8 },
    notes: [],
    secureNotes: ""
};

let db; // IndexedDB instance
let timerInterval;
let timeLeft = 1500; // 25 mins

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async () => {
    loadLocalData();
    applyTheme();
    await initDB();
    
    document.getElementById('date-display').innerText = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    checkLock(); // App Lock Logic
    renderAll();
});

// === DATA MANAGMENT ===
function loadLocalData() {
    const saved = localStorage.getItem(APP_KEY);
    if (saved) state = { ...state, ...JSON.parse(saved) };
    
    // Reset daily counters if new day
    const lastDate = new Date(state.user.lastLogin).toDateString();
    const today = new Date().toDateString();
    if (lastDate !== today) {
        state.health.water = 0;
        state.productivity.focusTime = 0;
    }
    state.user.lastLogin = Date.now();
    saveData();
}

function saveData() {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
}

// === APP LOCK ===
function checkLock() {
    if (state.user.pin) {
        document.getElementById('app-lock-screen').classList.remove('hidden');
    }
}

function unlockApp() {
    const input = document.getElementById('unlock-pin').value;
    if (input === state.user.pin) {
        document.getElementById('app-lock-screen').classList.add('hidden');
    } else {
        document.getElementById('lock-msg').innerText = "Incorrect PIN";
    }
}

function savePin() {
    const pin = document.getElementById('set-pin').value;
    if (pin.length === 4) {
        state.user.pin = pin;
        saveData();
        alert('PIN Set Successfully');
    }
}

// === THEME ===
function toggleTheme() {
    state.user.theme = state.user.theme === 'light' ? 'dark' : 'light';
    saveData();
    applyTheme();
}

function applyTheme() {
    document.body.setAttribute('data-theme', state.user.theme);
}

// === NAVIGATION ===
function navTo(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active-view'));
    document.getElementById(viewId).classList.add('active-view');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    const titles = {dashboard: 'Dashboard', finance: 'Money Manager', productivity: 'Focus & Plan', vault: 'Vault', settings: 'Settings'};
    document.getElementById('page-title').innerText = titles[viewId];
}

// === DASHBOARD & HEALTH SCORE ===
function calcHealthScore() {
    const income = calcTotal('income');
    const expenses = calcTotal('expense');
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    
    // Simple algo: 50% based on savings rate, 50% based on remaining budget
    let score = Math.round(savingsRate + (state.finance.budget > expenses ? 20 : 0));
    if (score > 100) score = 100;
    if (score < 0) score = 0;
    return score;
}

function renderDashboard() {
    const income = calcTotal('income');
    const expense = calcTotal('expense');
    
    document.getElementById('dash-balance').innerText = `$${income - expense}`;
    document.getElementById('dash-health-score').innerText = `${calcHealthScore()}/100`;
    document.getElementById('water-count').innerText = state.health.water;
    document.getElementById('water-goal-disp').innerText = state.health.waterGoal;
    document.getElementById('dash-focus-time').innerText = `${state.productivity.focusTime} mins`;
}

// === FINANCE MODULE ===
function calcTotal(type) {
    return state.finance.transactions
        .filter(t => t.type === type)
        .reduce((acc, t) => acc + parseFloat(t.amount), 0);
}

function addTransaction() {
    const type = document.getElementById('trans-type').value;
    const amount = document.getElementById('trans-amt').value;
    const cat = document.getElementById('trans-cat').value;
    
    if(!amount) return;

    state.finance.transactions.push({ id: Date.now(), type, amount, cat });
    saveData();
    renderFinance();
    renderDashboard();
    
    document.getElementById('trans-amt').value = "";
}

function renderFinance() {
    const inc = calcTotal('income');
    const exp = calcTotal('expense');
    
    document.getElementById('fin-income').innerText = `+$${inc}`;
    document.getElementById('fin-expense').innerText = `-$${exp}`;
    
    const pct = Math.min((exp / state.finance.budget) * 100, 100);
    document.getElementById('budget-bar').style.width = `${pct}%`;
    document.getElementById('budget-pct').innerText = `${Math.round(pct)}%`;
    
    // Assets
    const list = document.getElementById('asset-list');
    list.innerHTML = "";
    state.finance.assets.forEach(a => {
        const pnl = a.curr - a.buy;
        list.innerHTML += `<li>
            <span>${a.name}</span>
            <span class="${pnl >= 0 ? 'success' : 'danger'}">${pnl >= 0 ? '+' : ''}${pnl}</span>
        </li>`;
    });
}

function addAsset() {
    const name = document.getElementById('asset-name').value;
    const buy = document.getElementById('asset-buy').value;
    const curr = document.getElementById('asset-curr').value;
    
    if(name && buy) {
        state.finance.assets.push({name, buy, curr});
        saveData();
        renderFinance();
    }
}

// === PRODUCTIVITY ===
// Timer
function startTimer() {
    if(state.productivity.timerActive) return;
    state.productivity.timerActive = true;
    timerInterval = setInterval(() => {
        timeLeft--;
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        document.getElementById('timer-display').innerText = `${m}:${s}`;
        
        if(timeLeft <= 0) {
            pauseTimer();
            state.productivity.focusTime += 25;
            saveData();
            renderDashboard();
            alert("Focus Session Complete!");
            resetTimer();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    state.productivity.timerActive = false;
}

function resetTimer() {
    pauseTimer();
    timeLeft = 1500;
    document.getElementById('timer-display').innerText = "25:00";
}

// Planner
function renderPlanner() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const container = document.getElementById('planner-container');
    container.innerHTML = "";
    
    days.forEach(day => {
        const task = state.productivity.weeklyPlan[day] || "";
        container.innerHTML += `
            <div class="flex-row-center mb-10">
                <span style="width:40px; font-weight:bold">${day}</span>
                <input type="text" value="${task}" onchange="updatePlan('${day}', this.value)" style="margin:0">
            </div>
        `;
    });
}

function updatePlan(day, val) {
    state.productivity.weeklyPlan[day] = val;
    saveData();
}

// Goals
function addGoal() {
    const txt = document.getElementById('goal-input').value;
    if(txt) {
        state.productivity.goals.push({text: txt, done: false});
        saveData();
        renderGoals();
        document.getElementById('goal-input').value = "";
    }
}

function renderGoals() {
    const list = document.getElementById('goal-list');
    list.innerHTML = "";
    state.productivity.goals.forEach((g, i) => {
        list.innerHTML += `<li>
            <span style="text-decoration: ${g.done ? 'line-through' : 'none'}">${g.text}</span>
            <input type="checkbox" ${g.done ? 'checked' : ''} onchange="toggleGoal(${i})">
        </li>`;
    });
}

function toggleGoal(idx) {
    state.productivity.goals[idx].done = !state.productivity.goals[idx].done;
    saveData();
    renderGoals();
}

// Water
function addWater() {
    state.health.water++;
    saveData();
    renderDashboard();
}

// === VAULT (INDEXEDDB & NOTES) ===
// Notes
function newNote() {
    document.getElementById('modal-note-title').value = "";
    document.getElementById('modal-note-body').value = "";
    document.getElementById('note-modal').classList.remove('hidden');
}

function saveModalNote() {
    const title = document.getElementById('modal-note-title').value;
    const body = document.getElementById('modal-note-body').value;
    state.notes.push({title, body, date: new Date().toLocaleDateString()});
    saveData();
    closeModal();
    renderNotes();
}

function closeModal() {
    document.getElementById('note-modal').classList.add('hidden');
}

function renderNotes() {
    const div = document.getElementById('notes-list');
    div.innerHTML = "";
    state.notes.forEach((n, i) => {
        div.innerHTML += `
            <div class="card glass">
                <h4>${n.title}</h4>
                <small>${n.body.substring(0, 50)}...</small>
                <button class="btn-danger btn-small mt-10" onclick="deleteNote(${i})">Del</button>
            </div>
        `;
    });
}

function deleteNote(i) {
    state.notes.splice(i, 1);
    saveData();
    renderNotes();
}

// Secure Notes
function switchVaultTab(tab) {
    document.querySelectorAll('.vault-tab').forEach(e => e.classList.add('hidden'));
    document.getElementById(`vault-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-pill').forEach(e => e.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function accessSecureNotes() {
    const pin = document.getElementById('secure-access-pin').value;
    if(pin === state.user.pin) {
        document.getElementById('secure-lock-ui').classList.add('hidden');
        document.getElementById('secure-content').classList.remove('hidden');
        document.getElementById('secure-notepad').value = state.secureNotes;
        
        // Auto save on type
        document.getElementById('secure-notepad').addEventListener('input', (e) => {
            state.secureNotes = e.target.value;
            saveData();
        });
    } else {
        alert('Wrong PIN');
    }
}

// IndexedDB for Files
function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('LifeOS_Files', 1);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = (e) => {
            db = e.target.result;
            resolve();
            renderFiles();
        };
    });
}

function handleFileUpload(input) {
    const file = input.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
        const tx = db.transaction(['files'], 'readwrite');
        tx.objectStore('files').add({ name: file.name, type: file.type, data: reader.result });
        tx.oncomplete = () => {
            renderFiles();
            alert('File saved to Secure Vault');
        };
    };
    reader.readAsDataURL(file);
}

function renderFiles() {
    if(!db) return;
    const list = document.getElementById('file-list');
    list.innerHTML = "";
    
    const tx = db.transaction(['files'], 'readonly');
    const store = tx.objectStore('files');
    
    store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if(cursor) {
            list.innerHTML += `<li>
                <span>${cursor.value.name}</span>
                <button class="btn-small" onclick="deleteFile(${cursor.key})">Delete</button>
            </li>`;
            cursor.continue();
        }
    };
}

function deleteFile(key) {
    const tx = db.transaction(['files'], 'readwrite');
    tx.objectStore('files').delete(key);
    tx.oncomplete = renderFiles;
}

// === SETTINGS ===
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const dlNode = document.createElement('a');
    dlNode.setAttribute("href", dataStr);
    dlNode.setAttribute("download", "lifeos_backup.json");
    document.body.appendChild(dlNode);
    dlNode.click();
    dlNode.remove();
}

function importData(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        state = JSON.parse(e.target.result);
        saveData();
        location.reload();
    };
    reader.readAsText(file);
}

function resetApp() {
    if(confirm('Delete all data?')) {
        localStorage.removeItem(APP_KEY);
        location.reload();
    }
}

function renderAll() {
    renderDashboard();
    renderFinance();
    renderPlanner();
    renderGoals();
    renderNotes();
}
