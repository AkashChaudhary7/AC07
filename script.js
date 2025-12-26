/* --- STATE MANAGEMENT --- */
const APP_KEY = 'lifeos_ult_v1';
const DB_NAME = 'LifeOS_Vault';
const DB_VER = 1;

const defaultState = {
    user: { name: 'User', pin: null, theme: 'light', lastLogin: Date.now() },
    finance: { transactions: [], budget: 2000, assets: [] },
    productivity: { goals: [], focusTime: 0, weekly: {} },
    health: { water: 0, waterGoal: 8 },
    notes: [],
    secureNote: '',
};

let state = JSON.parse(localStorage.getItem(APP_KEY)) || defaultState;
let db = null;
let timerInterval = null;
let timerSeconds = 1500; // 25 min

/* --- CORE APP OBJECT --- */
const app = {
    init: async () => {
        app.data.load();
        app.ui.applyTheme();
        app.security.checkLock();
        await app.docs.initDB();
        
        // Reset daily counters
        const lastDate = new Date(state.user.lastLogin).toDateString();
        const today = new Date().toDateString();
        if(lastDate !== today) {
            state.health.water = 0;
            state.productivity.focusTime = 0;
        }
        state.user.lastLogin = Date.now();
        app.data.save();
        
        app.renderAll();
        app.ui.initListeners();
    },

    /* --- DATA MODULE --- */
    data: {
        save: () => localStorage.setItem(APP_KEY, JSON.stringify(state)),
        load: () => {
            const saved = localStorage.getItem(APP_KEY);
            if(saved) state = { ...defaultState, ...JSON.parse(saved) }; // Merge to ensure structure
        },
        export: () => {
            const str = JSON.stringify(state);
            const blob = new Blob([str], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `lifeos_backup_${Date.now()}.json`;
            a.click();
        },
        import: (input) => {
            const file = input.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    state = JSON.parse(e.target.result);
                    app.data.save();
                    location.reload();
                } catch(err) { alert('Invalid File'); }
            };
            reader.readAsText(file);
        },
        reset: () => {
            if(confirm('Wipe all data? This cannot be undone.')) {
                localStorage.removeItem(APP_KEY);
                indexedDB.deleteDatabase(DB_NAME);
                location.reload();
            }
        }
    },

    /* --- UI & ROUTER --- */
    router: {
        go: (viewId) => {
            document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            
            // Nav Active State
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const index = ['view-dashboard','view-finance','view-productivity','view-vault','view-settings'].indexOf(viewId);
            if(index > -1) document.querySelectorAll('.nav-item')[index].classList.add('active');
            
            // Title Update
            const titles = {
                'view-dashboard': 'Dashboard', 'view-finance': 'Money', 
                'view-productivity': 'Focus', 'view-vault': 'Vault', 'view-settings': 'Settings'
            };
            document.getElementById('page-title').innerText = titles[viewId];
        }
    },
    ui: {
        toggleTheme: () => {
            state.user.theme = state.user.theme === 'light' ? 'dark' : 'light';
            app.ui.applyTheme();
            app.data.save();
        },
        applyTheme: () => {
            document.body.setAttribute('data-theme', state.user.theme);
            document.getElementById('toggle-dark').checked = state.user.theme === 'dark';
        },
        toggleFab: () => {
            document.getElementById('fab-menu').classList.toggle('hidden');
        },
        toggleSearch: () => {
            const el = document.getElementById('search-overlay');
            el.classList.toggle('hidden');
            if(!el.classList.contains('hidden')) document.getElementById('global-search').focus();
        },
        closeModal: (id) => document.getElementById(id).classList.add('hidden'),
        initListeners: () => {
            // Keyboard Shortcuts
            document.addEventListener('keydown', (e) => {
                if((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); app.ui.toggleSearch(); }
                if(e.key === 'Escape') {
                    document.getElementById('search-overlay').classList.add('hidden');
                    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
                }
            });
            // Date Display
            document.getElementById('date-display').innerText = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
            
            // Auto lock on visibility change
            document.addEventListener('visibilitychange', () => {
                if(document.hidden && state.user.pin) app.security.lock();
            });
        }
    },

    /* --- SECURITY MODULE --- */
    security: {
        setPin: (val) => {
            if(val.length === 4) { state.user.pin = val; app.data.save(); alert('PIN Set!'); }
        },
        checkLock: () => {
            if(state.user.pin) document.getElementById('lock-screen').classList.remove('hidden');
        },
        unlock: () => {
            const val = document.getElementById('unlock-pin').value;
            if(val === state.user.pin) {
                document.getElementById('lock-screen').classList.add('hidden');
                document.getElementById('unlock-pin').value = '';
            } else {
                document.getElementById('lock-msg').innerText = 'Incorrect PIN';
            }
        },
        lock: () => document.getElementById('lock-screen').classList.remove('hidden')
    },

    /* --- FINANCE MODULE --- */
    finance: {
        openModal: (type) => {
            document.getElementById('transaction-modal').classList.remove('hidden');
            document.getElementById('trans-modal-title').innerText = type === 'income' ? 'Add Income' : 'Add Expense';
            document.getElementById('transaction-modal').dataset.type = type;
        },
        saveTransaction: () => {
            const amt = parseFloat(document.getElementById('t-amount').value);
            const desc = document.getElementById('t-desc').value;
            const cat = document.getElementById('t-cat').value;
            const type = document.getElementById('transaction-modal').dataset.type;

            if(!amt || !desc) return;

            state.finance.transactions.unshift({ id: Date.now(), type, amt, desc, cat, date: new Date().toLocaleDateString() });
            app.data.save();
            app.finance.render();
            app.ui.closeModal('transaction-modal');
            
            // Clear inputs
            document.getElementById('t-amount').value = '';
            document.getElementById('t-desc').value = '';
        },
        addAsset: () => {
            const name = document.getElementById('inv-name').value;
            const invested = parseFloat(document.getElementById('inv-amt').value);
            const current = parseFloat(document.getElementById('inv-curr').value);
            if(name && invested) {
                state.finance.assets.push({name, invested, current});
                app.data.save();
                app.finance.render();
                // Clear
                document.getElementById('inv-name').value = '';
                document.getElementById('inv-amt').value = '';
                document.getElementById('inv-curr').value = '';
            }
        },
        setBudget: (val) => { state.finance.budget = parseFloat(val); app.data.save(); app.finance.render(); },
        render: () => {
            const income = state.finance.transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amt, 0);
            const expense = state.finance.transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amt, 0);
            const balance = income - expense;
            
            // Dashboard
            document.getElementById('dash-balance').innerText = `$${balance.toFixed(2)}`;
            
            // Finance View
            document.getElementById('fin-total-expense').innerText = `$${expense.toFixed(2)}`;
            const remain = state.finance.budget - expense;
            document.getElementById('fin-budget-remain').innerText = `$${remain.toFixed(2)} Remaining`;
            
            const pct = Math.min((expense / state.finance.budget) * 100, 100);
            document.getElementById('fin-budget-bar').style.width = `${pct}%`;
            document.getElementById('budget-alert').classList.toggle('hidden', pct < 80);

            // Transactions List
            const list = document.getElementById('trans-list');
            list.innerHTML = '';
            state.finance.transactions.slice(0, 10).forEach(t => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div><b>${t.desc}</b> <br><small class="text-muted">${t.cat}</small></div>
                    <span class="${t.type === 'income' ? 'text-success' : 'text-danger'}">
                        ${t.type === 'income' ? '+' : '-'}$${t.amt}
                    </span>`;
                list.appendChild(li);
            });

            // Assets List
            const aList = document.getElementById('asset-list');
            aList.innerHTML = '';
            state.finance.assets.forEach(a => {
                const profit = a.current - a.invested;
                const li = document.createElement('li');
                li.innerHTML = `<span>${a.name}</span> <span class="${profit>=0?'text-success':'text-danger'}">${profit>=0?'+':''}${profit}</span>`;
                aList.appendChild(li);
            });

            // Health Score (Simple Algo: Savings Rate + Budget Adherence)
            const savingsRate = income > 0 ? ((income - expense) / income) * 50 : 0;
            const budgetScore = pct < 100 ? 50 : 0;
            document.getElementById('score-finance').innerText = `${Math.round(savingsRate + budgetScore)}/100`;
        }
    },

    /* --- PRODUCTIVITY MODULE --- */
    productivity: {
        render: () => {
            app.goals.render();
            app.timer.render();
            app.planner.render();
            
            // Score
            const doneGoals = state.productivity.goals.filter(g => g.done).length;
            const totalGoals = state.productivity.goals.length;
            const score = totalGoals === 0 ? 0 : Math.round((doneGoals / totalGoals) * 100);
            document.getElementById('score-prod').innerText = `${score}%`;
        }
    },
    goals: {
        addPrompt: () => {
            const txt = prompt("Goal Name:");
            if(txt) {
                state.productivity.goals.push({ id: Date.now(), text: txt, done: false });
                app.data.save();
                app.productivity.render();
            }
        },
        toggle: (id) => {
            const g = state.productivity.goals.find(x => x.id === id);
            if(g) { g.done = !g.done; app.data.save(); app.productivity.render(); }
        },
        render: () => {
            const list = document.getElementById('goals-list');
            list.innerHTML = '';
            state.productivity.goals.forEach(g => {
                const li = document.createElement('li');
                li.innerHTML = `<span style="${g.done?'text-decoration:line-through;opacity:0.6':''}">${g.text}</span> <input type="checkbox" ${g.done?'checked':''} onchange="app.goals.toggle(${g.id})">`;
                list.appendChild(li);
            });
            // Dashboard Preview
            const top = state.productivity.goals.find(g => !g.done);
            document.getElementById('dash-goal-preview').innerHTML = top ? `<p>🎯 ${top.text}</p>` : `<p class="text-muted">All goals done!</p>`;
        }
    },
    timer: {
        toggle: () => {
            if(timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            } else {
                timerInterval = setInterval(() => {
                    timerSeconds--;
                    app.timer.render();
                    if(timerSeconds <= 0) {
                        clearInterval(timerInterval);
                        alert("Focus Session Complete!");
                        state.productivity.focusTime += 25;
                        app.data.save();
                        app.timer.reset();
                    }
                }, 1000);
            }
        },
        reset: () => {
            clearInterval(timerInterval);
            timerInterval = null;
            timerSeconds = 1500;
            app.timer.render();
        },
        render: () => {
            const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
            const s = (timerSeconds % 60).toString().padStart(2, '0');
            document.getElementById('timer-display').innerText = `${m}:${s}`;
            document.getElementById('dash-focus').innerText = `${state.productivity.focusTime}m`;
        }
    },
    planner: {
        render: () => {
            const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            const container = document.getElementById('planner-days');
            container.innerHTML = '';
            const todayIdx = new Date().getDay();
            
            days.forEach((d, i) => {
                const div = document.createElement('div');
                div.className = `day-pill ${i === todayIdx ? 'active' : ''}`;
                div.innerText = d;
                div.onclick = () => app.planner.selectDay(d);
                container.appendChild(div);
            });
            // Default view logic could go here
        },
        selectDay: (d) => {
            const cont = document.getElementById('day-tasks');
            const val = state.productivity.weekly[d] || '';
            cont.innerHTML = `<textarea placeholder="Plan for ${d}..." class="full-width" rows="3" onchange="app.planner.save('${d}', this.value)">${val}</textarea>`;
        },
        save: (day, val) => {
            state.productivity.weekly[day] = val;
            app.data.save();
        }
    },

    /* --- HEALTH MODULE --- */
    health: {
        addWater: () => {
            state.health.water++;
            app.data.save();
            app.health.render();
        },
        render: () => {
            document.getElementById('water-count').innerText = state.health.water;
            document.getElementById('water-goal-disp').innerText = state.health.waterGoal;
            const pct = Math.min((state.health.water / state.health.waterGoal)*100, 100);
            document.getElementById('water-bar').style.width = `${pct}%`;
        }
    },

    /* --- VAULT (IndexedDB & Notes) --- */
    vault: {
        switchTab: (tab) => {
            document.querySelectorAll('.vault-tab').forEach(e => e.classList.add('hidden'));
            document.getElementById(`tab-${tab}`).classList.remove('hidden');
            document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
            event.target.classList.add('active');
        },
        unlockSecure: () => {
            if(document.getElementById('secure-pin-input').value === state.user.pin) {
                document.getElementById('secure-lock').classList.add('hidden');
                document.getElementById('secure-content').classList.remove('hidden');
                document.getElementById('secure-pad').value = state.secureNote;
            } else alert('Wrong PIN');
        },
        saveSecure: (val) => { state.secureNote = val; app.data.save(); }
    },
    notes: {
        create: () => {
            const title = prompt("Note Title:");
            if(title) {
                state.notes.unshift({id: Date.now(), title, body: ''});
                app.data.save();
                app.notes.render();
            }
        },
        update: (id, text) => {
            const n = state.notes.find(x => x.id === id);
            if(n) { n.body = text; app.data.save(); }
        },
        render: () => {
            const grid = document.getElementById('notes-grid');
            const filter = document.getElementById('note-search').value.toLowerCase();
            grid.innerHTML = '';
            
            state.notes.filter(n => n.title.toLowerCase().includes(filter)).forEach(n => {
                const div = document.createElement('div');
                div.className = 'note-card';
                div.innerHTML = `<b>${n.title}</b><textarea style="width:100%;height:80px;background:transparent;border:none;resize:none" oninput="app.notes.update(${n.id}, this.value)">${n.body}</textarea>`;
                grid.appendChild(div);
            });
        }
    },
    docs: {
        initDB: () => {
            return new Promise((resolve) => {
                const req = indexedDB.open(DB_NAME, DB_VER);
                req.onupgradeneeded = (e) => e.target.result.createObjectStore('files', {keyPath: 'id', autoIncrement:true});
                req.onsuccess = (e) => { db = e.target.result; app.docs.render(); resolve(); };
            });
        },
        handleUpload: (input) => {
            const file = input.files[0];
            if(!file) return;
            const tx = db.transaction(['files'], 'readwrite');
            tx.objectStore('files').add({ name: file.name, type: file.type, data: file, date: new Date().toLocaleDateString() });
            tx.oncomplete = () => { alert('Saved to Vault'); app.docs.render(); };
        },
        render: () => {
            if(!db) return;
            const list = document.getElementById('docs-list');
            list.innerHTML = '';
            let size = 0;
            const tx = db.transaction(['files'], 'readonly');
            tx.objectStore('files').openCursor().onsuccess = (e) => {
                const cursor = e.target.result;
                if(cursor) {
                    size += cursor.value.data.size;
                    const li = document.createElement('li');
                    li.innerHTML = `<span>📄 ${cursor.value.name}</span> <button class="btn-sm btn-danger" onclick="app.docs.del(${cursor.key})">×</button>`;
                    list.appendChild(li);
                    cursor.continue();
                } else {
                    document.getElementById('storage-usage').innerText = `Storage: ${(size/1024/1024).toFixed(2)} MB`;
                }
            };
        },
        del: (key) => {
            const tx = db.transaction(['files'], 'readwrite');
            tx.objectStore('files').delete(key);
            tx.oncomplete = app.docs.render;
        }
    },

    /* --- GLOBAL SEARCH --- */
    search: {
        run: (q) => {
            const list = document.getElementById('search-results');
            list.innerHTML = '';
            if(q.length < 2) return;
            q = q.toLowerCase();

            // Search Notes
            state.notes.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)).forEach(n => {
                list.innerHTML += `<li onclick="app.ui.toggleSearch();app.router.go('view-vault');app.vault.switchTab('notes')">📝 Note: ${n.title}</li>`;
            });

            // Search Expenses
            state.finance.transactions.filter(t => t.desc.toLowerCase().includes(q)).forEach(t => {
                list.innerHTML += `<li>💰 ${t.desc} ($${t.amt})</li>`;
            });
        }
    },

    renderAll: () => {
        app.finance.render();
        app.productivity.render();
        app.health.render();
        app.notes.render();
        app.ui.applyTheme();
        document.getElementById('set-budget').value = state.finance.budget;
    }
};

/* --- START APP --- */
document.addEventListener('DOMContentLoaded', app.init);
