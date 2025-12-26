/* --- STATE & CONFIG --- */
const APP_KEY = 'lifeos_adaptive_v1';
const DB_NAME = 'lifeos_vault';
const DB_VER = 1;

// Initial State
let state = {
    user: { name: 'User', theme: 'light', pin: null, layoutLocked: false, adaptiveEnabled: true },
    finance: { balance: 0, budget: 2000, transactions: [] },
    tasks: { items: [], goals: [] },
    health: { water: 0, focusTime: 0 },
    // Adaptive Tracking Data
    stats: {
        finance: 0, // Click count
        tasks: 0,
        focus: 0,
        vault: 0,
        lastActive: Date.now()
    }
};

let db = null;
let timerInterval = null;
let timerSeconds = 1500;

/* --- CORE APP --- */
const app = {
    init: async () => {
        app.data.load();
        app.ui.applyTheme();
        app.security.check();
        await app.vault.initDB();
        
        // Check for new day to reset daily counters
        const lastDate = new Date(state.stats.lastActive).toDateString();
        if(lastDate !== new Date().toDateString()) {
            state.health.water = 0;
            state.health.focusTime = 0;
        }
        state.stats.lastActive = Date.now();
        
        app.renderAll();
        app.adaptive.run(); // Run adaptive logic
    },

    /* --- DATA MODULE --- */
    data: {
        save: () => localStorage.setItem(APP_KEY, JSON.stringify(state)),
        load: () => {
            const saved = localStorage.getItem(APP_KEY);
            if(saved) state = {...state, ...JSON.parse(saved)}; // Merge
        },
        reset: () => {
            if(confirm('Wipe all data?')) {
                localStorage.removeItem(APP_KEY);
                location.reload();
            }
        }
    },

    /* --- ADAPTIVE ENGINE (CORE FEATURE) --- */
    adaptive: {
        track: (module) => {
            // Increment usage count for the module
            if(state.stats[module] !== undefined) {
                state.stats[module]++;
                app.data.save();
                if(!state.user.layoutLocked && state.user.adaptiveEnabled) app.adaptive.run();
            }
        },
        run: () => {
            const hour = new Date().getHours();
            let mode = "Wellness Mode";
            let modeClass = "wellness";

            // Determine Contextual Mode
            if (hour >= 9 && hour < 17) {
                mode = "Work Mode";
                modeClass = "work";
            } else if (hour >= 17 && hour < 20) {
                mode = "Finance Mode"; // Evening budget check?
            }

            // Determine Widget Order based on Usage Stats
            const modules = [
                { id: 'widget-fin', score: state.stats.finance, type: 'finance' },
                { id: 'widget-task', score: state.stats.tasks, type: 'tasks' },
                { id: 'widget-focus', score: state.stats.focus, type: 'focus' },
                { id: 'widget-water', score: state.health.water < 4 ? 100 : 0, type: 'health' } // Boost water if low
            ];

            // Sort logic: High score first
            modules.sort((a, b) => b.score - a.score);

            // Render Dashboard Grid
            const grid = document.getElementById('dashboard-grid');
            grid.innerHTML = ''; // Clear current

            modules.forEach((mod, index) => {
                const isPriority = index === 0 && state.user.adaptiveEnabled;
                const html = app.adaptive.getWidgetHTML(mod.type, isPriority);
                grid.innerHTML += html;
            });

            // Update UI Badges
            document.getElementById('mode-badge').innerText = `🚀 ${mode}`;
            document.getElementById('greeting').innerText = `Good ${hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'}`;
            document.getElementById('lock-layout-btn').innerText = state.user.layoutLocked ? '🔒' : '🔓';
        },
        getWidgetHTML: (type, priority) => {
            const pClass = priority ? 'priority widget' : 'widget';
            // Returns HTML string for widgets based on type
            if(type === 'finance') {
                const spent = state.finance.budget - state.finance.balance;
                return `<div class="card glass ${pClass}" onclick="app.router.go('view-finance')">
                    <div class="flex-between"><h3>💰 Finance</h3> ${priority?'<span class="badge">Top Used</span>':''}</div>
                    <h2>$${state.finance.balance} <small class="text-muted">Balance</small></h2>
                </div>`;
            }
            if(type === 'tasks') {
                const pending = state.tasks.items.filter(t => !t.done).length;
                return `<div class="card glass ${pClass}" onclick="app.router.go('view-tasks')">
                    <div class="flex-between"><h3>✅ Tasks</h3> ${pending > 3 ? '<span class="badge">Busy</span>':''}</div>
                    <p>${pending} tasks pending</p>
                </div>`;
            }
            if(type === 'focus') {
                return `<div class="card glass ${pClass}" onclick="app.router.go('view-focus')">
                    <h3>⏱️ Focus</h3>
                    <p>${state.health.focusTime} mins today</p>
                </div>`;
            }
            if(type === 'health') {
                return `<div class="card glass ${pClass}" onclick="app.router.go('view-focus')">
                    <h3>🚰 Hydration</h3>
                    <div class="progress-bg"><div class="progress-fill" style="width:${(state.health.water/8)*100}%"></div></div>
                    <small>${state.health.water}/8 Glasses (Tap to add)</small>
                </div>`;
            }
        },
        toggleLayoutLock: () => {
            state.user.layoutLocked = !state.user.layoutLocked;
            app.data.save();
            app.adaptive.run();
        },
        toggleConfig: (val) => {
            state.user.adaptiveEnabled = val;
            app.data.save();
            app.adaptive.run();
        },
        reset: () => {
            state.stats = { finance: 0, tasks: 0, focus: 0, vault: 0, lastActive: Date.now() };
            app.data.save();
            app.adaptive.run();
        }
    },

    /* --- ROUTER & UI --- */
    router: {
        go: (viewId) => {
            document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            
            // Track navigation for adaptive logic
            if(viewId === 'view-finance') app.adaptive.track('finance');
            if(viewId === 'view-tasks') app.adaptive.track('tasks');
            if(viewId === 'view-focus') app.adaptive.track('focus');

            // Update Nav
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            // Simple mapping for nav items active state
            const map = {'view-dashboard':0, 'view-finance':1, 'view-tasks':2, 'view-focus':3, 'view-settings':4};
            document.querySelectorAll('.nav-item')[map[viewId]].classList.add('active');
            document.getElementById('page-title').innerText = viewId.replace('view-', '').toUpperCase();
        }
    },
    ui: {
        toggleTheme: () => {
            state.user.theme = state.user.theme === 'light' ? 'dark' : 'light';
            app.ui.applyTheme();
            app.data.save();
        },
        applyTheme: () => document.body.setAttribute('data-theme', state.user.theme),
        toggleQuickMenu: () => document.getElementById('quick-menu').classList.toggle('hidden')
    },

    /* --- MODULES --- */
    finance: {
        add: () => {
            const amt = parseFloat(document.getElementById('fin-amt').value);
            const cat = document.getElementById('fin-cat').value;
            if(!amt) return;
            state.finance.transactions.unshift({id: Date.now(), amt, cat, date: new Date().toLocaleDateString()});
            state.finance.balance -= amt; // Simple logic: starts with budget, sub expenses
            document.getElementById('fin-amt').value = '';
            app.data.save();
            app.renderAll();
        },
        render: () => {
            const el = document.getElementById('fin-list');
            el.innerHTML = '';
            state.finance.transactions.slice(0, 5).forEach(t => {
                el.innerHTML += `<li><span>${t.cat}</span> <span style="color:var(--danger)">-$${t.amt}</span></li>`;
            });
            document.getElementById('fin-balance').innerText = `$${state.finance.balance.toFixed(2)}`;
            
            // Budget Alert
            const spent = state.finance.budget - state.finance.balance;
            const pct = (spent / state.finance.budget) * 100;
            document.getElementById('fin-progress').style.width = `${pct}%`;
            document.getElementById('fin-spent').innerText = `$${spent.toFixed(2)}`;
            if(pct > 80) document.getElementById('budget-alert').classList.remove('hidden');
        }
    },
    tasks: {
        add: () => {
            const txt = document.getElementById('task-input').value;
            if(!txt) return;
            state.tasks.items.push({id: Date.now(), txt, done: false});
            document.getElementById('task-input').value = '';
            app.data.save();
            app.renderAll();
        },
        addGoal: () => {
            const txt = prompt("Goal Name:");
            if(txt) { state.tasks.goals.push({txt}); app.data.save(); app.renderAll(); }
        },
        toggle: (id) => {
            const t = state.tasks.items.find(x => x.id === id);
            t.done = !t.done;
            app.data.save();
            app.renderAll();
        },
        render: () => {
            const list = document.getElementById('task-list');
            list.innerHTML = '';
            state.tasks.items.forEach(t => {
                list.innerHTML += `<li onclick="app.tasks.toggle(${t.id})">
                    <span style="${t.done?'text-decoration:line-through;opacity:0.5':''}">${t.txt}</span>
                    <span>${t.done?'✅':'⭕'}</span>
                </li>`;
            });
            const gList = document.getElementById('goal-list');
            gList.innerHTML = '';
            state.tasks.goals.forEach(g => gList.innerHTML += `<li>🎯 ${g.txt}</li>`);
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
                    const m = Math.floor(timerSeconds / 60).toString().padStart(2,0);
                    const s = (timerSeconds % 60).toString().padStart(2,0);
                    document.getElementById('timer-display').innerText = `${m}:${s}`;
                    if(timerSeconds <= 0) {
                        clearInterval(timerInterval);
                        alert("Focus Complete!");
                        state.health.focusTime += 25;
                        timerSeconds = 1500;
                        app.data.save();
                        app.adaptive.run(); // Update dashboard stats
                    }
                }, 1000);
            }
        },
        reset: () => {
            clearInterval(timerInterval);
            timerInterval = null;
            timerSeconds = 1500;
            document.getElementById('timer-display').innerText = "25:00";
        }
    },
    health: {
        addWater: () => {
            state.health.water++;
            app.data.save();
            app.adaptive.run(); // Update widget immediately
            document.getElementById('water-count').innerText = state.health.water;
        }
    },
    vault: {
        initDB: () => {
            return new Promise(resolve => {
                const req = indexedDB.open(DB_NAME, DB_VER);
                req.onupgradeneeded = e => e.target.result.createObjectStore('files', {keyPath: 'id', autoIncrement:true});
                req.onsuccess = e => { db = e.target.result; app.vault.render(); resolve(); }
            });
        },
        upload: (input) => {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const tx = db.transaction(['files'], 'readwrite');
                tx.objectStore('files').add({name: file.name, data: reader.result, date: new Date().toLocaleDateString()});
                tx.oncomplete = () => app.vault.render();
            };
            reader.readAsDataURL(file);
        },
        render: () => {
            if(!db) return;
            const list = document.getElementById('file-list');
            list.innerHTML = '';
            db.transaction('files').readonly.objectStore('files').openCursor().onsuccess = e => {
                const cursor = e.target.result;
                if(cursor) {
                    list.innerHTML += `<li>📄 ${cursor.value.name} <button class="btn-danger btn-sm" onclick="app.vault.del(${cursor.key})">x</button></li>`;
                    cursor.continue();
                }
            }
        },
        del: (key) => {
            db.transaction(['files'], 'readwrite').objectStore('files').delete(key).onsuccess = () => app.vault.render();
        }
    },
    security: {
        setPin: () => {
            const p = document.getElementById('set-pin').value;
            if(p.length === 4) { state.user.pin = p; app.data.save(); alert('PIN Set'); }
        },
        check: () => {
            if(state.user.pin) document.getElementById('lock-screen').classList.remove('hidden');
        },
        unlock: () => {
            if(document.getElementById('unlock-pin').value === state.user.pin) {
                document.getElementById('lock-screen').classList.add('hidden');
            } else alert('Wrong PIN');
        }
    },

    renderAll: () => {
        app.finance.render();
        app.tasks.render();
        app.vault.render();
        document.getElementById('water-count').innerText = state.health.water;
    }
};

// Start
document.addEventListener('DOMContentLoaded', app.init);
