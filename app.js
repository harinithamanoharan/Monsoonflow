/**
 * Main Application logic for MonsoonFlow Coordinator.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Check Authentication
    const userData = JSON.parse(localStorage.getItem('monsoonflow_user'));
    if (!userData || !userData.loggedIn) {
        window.location.href = 'login.html';
        return;
    }

    // Application State
    let isRainy = false;
    let tasks = [];
    let historicalNotes = [];
    let agent = null;
    let currentUser = userData;

    // Initialize UI with User Info
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const userInitialEl = document.getElementById('userInitial');
    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userEmailEl) userEmailEl.textContent = currentUser.email;
    if (userInitialEl) userInitialEl.textContent = (currentUser.name || 'H').charAt(0);

    // Fetch initial data from backend
    async function fetchData() {
        try {
            const [tasksRes, notesRes] = await Promise.all([
                fetch(`/api/tasks/${currentUser.id}`),
                fetch('/api/notes')
            ]);
            
            tasks = await tasksRes.json();
            historicalNotes = await notesRes.json();

            // Initialize agent with fetched data and user settings
            agent = new window.ScheduleAgent(tasks, historicalNotes, currentUser.sensitivity);
            renderDashboard();
        } catch (error) {
            console.error("Failed to fetch data:", error);
            // Default fallbacks if backend is partially down
            if (!tasks || !tasks.length) tasks = [];
            if (!historicalNotes || !historicalNotes.length) {
                historicalNotes = [
                    "Heavy rain often causes delays on MTH Road.",
                    "Outdoor activities are best planned for early morning in July."
                ];
            }
            
            if (!agent) {
                agent = new window.ScheduleAgent(tasks, historicalNotes, currentUser.sensitivity);
            }
            renderDashboard();
        }
    }

    // Initial load
    await fetchData();
    initRain();
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // --- UI Logic & Event Listeners ---

    // Weather Toggle
    const toggleBtn = document.getElementById('toggleWeather');
    toggleBtn.addEventListener('click', () => {
        isRainy = !isRainy;
        updateWeatherUI();
        renderDashboard();
    });

    // Profile Dropdown
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => userDropdown.classList.add('hidden'));

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('monsoonflow_user');
        window.location.href = 'login.html';
    });

    // Settings & Profile
    const settingsModal = document.getElementById('settingsModal');
    const openSettings = document.getElementById('openSettings');
    const openProfile = document.getElementById('openProfile');
    const closeSettings = document.getElementById('closeSettings');
    const settingsForm = document.getElementById('settingsForm');
    const sensitivitySetting = document.getElementById('sensitivitySetting');

    if (openProfile) {
        openProfile.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }

    openSettings.addEventListener('click', () => {
        sensitivitySetting.value = currentUser.sensitivity || 'medium';
        settingsModal.classList.remove('hidden');
    });
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sensitivity = sensitivitySetting.value;
        
        try {
            const res = await fetch('/api/user/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, sensitivity })
            });
            if (res.ok) {
                currentUser.sensitivity = sensitivity;
                localStorage.setItem('monsoonflow_user', JSON.stringify(currentUser));
                agent.sensitivity = sensitivity;
                settingsModal.classList.add('hidden');
                renderDashboard();
            }
        } catch (err) {
            console.error("Failed to save settings:", err);
        }
    });

    // Task Modal
    const addTaskBtn = document.getElementById('addTaskBtn');
    const seedDataBtn = document.getElementById('seedDataBtn');
    const taskModal = document.getElementById('taskModal');
    const closeModal = document.getElementById('closeModal');
    const taskForm = document.getElementById('taskForm');

    addTaskBtn.addEventListener('click', () => taskModal.classList.remove('hidden'));
    closeModal.addEventListener('click', () => taskModal.classList.add('hidden'));

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTaskData = {
            title: document.getElementById('taskTitle').value,
            location: document.getElementById('taskLocation').value,
            priority: document.getElementById('taskPriority').value,
            category: document.getElementById('taskCategory').value,
            timeSlot: document.getElementById('taskTime').value,
            note: document.getElementById('taskNote').value
        };

        try {
            const response = await fetch(`/api/tasks/${currentUser.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTaskData)
            });
            const newTask = await response.json();
            tasks.push(newTask);
            agent.tasks = tasks;
            taskForm.reset();
            taskModal.classList.add('hidden');
            renderDashboard();
        } catch (error) {
            console.error("Failed to add task:", error);
        }
    });

    // Seed Data
    if (seedDataBtn) {
        seedDataBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/tasks/seed', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id })
                });
                await fetchData();
            } catch(e) {
                console.error("Failed to seed", e);
            }
        });
    }

    // Chat logic
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const toggleChat = document.getElementById('toggleChat');
    const chatPanel = document.querySelector('.ai-chat-panel');

    if (toggleChat && chatPanel) {
        toggleChat.addEventListener('click', () => {
            chatPanel.classList.toggle('collapsed');
            const icon = chatPanel.classList.contains('collapsed') ? 'chevron-up' : 'chevron-down';
            toggleChat.innerHTML = `<i data-lucide="${icon}"></i>`;
            if (window.lucide) window.lucide.createIcons();
        });
    }

    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if(!text) return;

            addChatMessage(text, 'user-msg');
            chatInput.value = '';
            const loadingId = addChatMessage('Thinking...', 'ai-msg');

            try {
                const res = await fetch('/api/agents/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: text, userId: currentUser.id })
                });
                const data = await res.json();
                const msgEl = document.getElementById(loadingId);
                if (msgEl) msgEl.textContent = data.response;
                await fetchData();
            } catch (err) {
                const msgEl = document.getElementById(loadingId);
                if (msgEl) msgEl.textContent = "Error: Could not reach agent.";
            }
        });
    }

    function addChatMessage(text, className) {
        const id = 'msg-' + Date.now();
        const div = document.createElement('div');
        div.className = `message ${className}`;
        div.id = id;
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return id;
    }

    // --- Core Functions ---

    async function deleteTask(taskId) {
        try {
            await fetch(`/api/tasks/${currentUser.id}/${taskId}`, { method: 'DELETE' });
            tasks = tasks.filter(t => t.id != taskId);
            agent.tasks = tasks;
            renderDashboard();
        } catch (error) {
            console.error("Failed to delete task:", error);
        }
    }

    function renderDashboard() {
        if (!agent) return;

        const { tasks: processedTasks, explanation, suggestions, stats } = agent.processSchedule(isRainy);

        const columns = ['morning', 'afternoon', 'evening'];
        const counts = { morning: 0, afternoon: 0, evening: 0 };

        columns.forEach(col => {
            const el = document.getElementById(`${col}Tasks`);
            if (el) el.innerHTML = '';
        });

        processedTasks.forEach(task => {
            const taskEl = createTaskElement(task);
            const column = document.getElementById(`${task.timeSlot}Tasks`);
            if (column) {
                column.appendChild(taskEl);
                counts[task.timeSlot]++;
            }
        });

        // Update Counts
        columns.forEach(col => {
            const countEl = document.getElementById(`${col}Count`);
            if (countEl) countEl.textContent = counts[col];
        });

        const explanationEl = document.getElementById('aiExplanation');
        if (isRainy) {
            explanationEl.innerHTML = explanation.length > 0 
                ? explanation.map(exp => `<p>${exp}</p>`).join('')
                : '<p class="placeholder-text">Checking for weather disruptions...</p>';
        } else {
            explanationEl.innerHTML = `<p class="placeholder-text">Hello ${currentUser.fullName.split(' ')[0]}! It's a clear day. Ideal for outdoor tasks.</p>`;
        }

        const suggestionsEl = document.getElementById('suggestionsList');
        if (suggestions.length > 0) {
            suggestionsEl.innerHTML = suggestions.map(sug => `
                <li class="suggestion-item">
                    <i data-lucide="info" class="sug-icon" style="width:14px;height:14px;color:#4dabf7;flex-shrink:0;margin-top:2px;"></i>
                    <span>${sug}</span>
                </li>
            `).join('');
        } else {
            suggestionsEl.innerHTML = '<li class="suggestion-placeholder">Suggestions will appear based on weather patterns.</li>';
        }

        document.getElementById('timeSaved').textContent = `${stats.timeSaved} mins`;
        document.getElementById('tasksAdjusted').textContent = stats.tasksAdjusted;

        renderForecast();
        renderProductivity();

        const notesEl = document.getElementById('historicalNotes');
        if (notesEl && historicalNotes.length > 0) {
            notesEl.innerHTML = historicalNotes.map(note => `<p class="note">"${note}"</p>`).join('');
        }

        if (window.lucide) window.lucide.createIcons();
    }

    function renderForecast() {
        const forecastList = document.getElementById('forecastList');
        if (!forecastList) return;

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const todayIdx = new Date().getDay();
        
        const mockForecast = [
            { day: days[(todayIdx + 1) % 7], icon: isRainy ? 'cloud-rain' : 'sun', high: '31°', low: '24°' },
            { day: days[(todayIdx + 2) % 7], icon: isRainy ? 'cloud-lightning' : 'cloud-sun', high: '29°', low: '23°' },
            { day: days[(todayIdx + 3) % 7], icon: 'cloud', high: '28°', low: '22°' }
        ];

        forecastList.innerHTML = mockForecast.map(f => `
            <div class="forecast-day">
                <span style="width: 80px;">${f.day}</span>
                <i data-lucide="${f.icon}"></i>
                <div class="temps">
                    <span class="temp-high">${f.high}</span>
                    <span class="temp-low">${f.low}</span>
                </div>
            </div>
        `).join('');
    }

    function renderProductivity() {
        if (!tasks.length) return;
        
        // Mock completion logic: assume 40% are done for demo, 
        // or calculate based on real status if available
        const completedCount = Math.floor(tasks.length * 0.65); 
        const rate = Math.round((completedCount / tasks.length) * 100);

        const rateEl = document.getElementById('completionRate');
        const progressEl = document.getElementById('progressBar');

        if (rateEl) rateEl.textContent = `${rate}%`;
        if (progressEl) progressEl.style.width = `${rate}%`;
    }

    function createTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-card ${task.completed ? 'completed' : ''}`;
        div.innerHTML = `
            <div class="task-header">
                <div class="task-checkbox ${task.completed ? 'active' : ''}"></div>
                <span class="task-title">${task.title}</span>
                <span class="priority-tag tag-${task.priority}">${task.priority}</span>
            </div>
            <div class="task-details">
                <span class="badge badge-${task.location}">${task.location}</span>
                <span class="badge badge-category">${task.category || 'General'}</span>
            </div>
            ${task.statusNote ? `<div class="task-status-note" style="font-size:0.75rem; color:#4dabf7; margin-top:8px; display:flex; gap:6px; align-items:center;">
                <i data-lucide="refresh-cw" style="width:12px;height:12px;"></i> ${task.statusNote}
            </div>` : ''}
            <button class="delete-task-btn" data-id="${task.id}" title="Delete Task">
                <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
            </button>
        `;

        const checkbox = div.querySelector('.task-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTaskStatus(task);
        });

        const deleteBtn = div.querySelector('.delete-task-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        });

        return div;
    }

    function toggleTaskStatus(task) {
        task.completed = !task.completed;
        renderDashboard();
        // Typically sync with backend here
    }

    // Quick Add Listeners
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const slot = btn.getAttribute('data-slot');
            const timeSelect = document.getElementById('taskTime');
            if (timeSelect) timeSelect.value = slot;
            taskModal.classList.remove('hidden');
        });
    });

    function updateWeatherUI() {
        const icon = document.getElementById('weatherIcon');
        const label = document.getElementById('weatherLabel');
        const banner = document.getElementById('alertBanner');

        if (isRainy) {
            toggleBtn.className = 'toggle-btn rainy';
            icon.setAttribute('data-lucide', 'cloud-rain');
            label.textContent = 'Rainy Day';
            banner.classList.remove('hidden');
        } else {
            toggleBtn.className = 'toggle-btn normal';
            icon.setAttribute('data-lucide', 'sun');
            label.textContent = 'Normal Day';
            banner.classList.add('hidden');
        }
        if (window.lucide) window.lucide.createIcons();
    }

    function initRain() {
        const canvas = document.getElementById('rainCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let w, h;
        const rainDrops = [];

        function resize() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        class Drop {
            constructor() { this.init(); }
            init() {
                this.x = Math.random() * w;
                this.y = Math.random() * -h;
                this.l = Math.random() * 20 + 10;
                this.v = Math.random() * 5 + 5;
                this.a = Math.random() * 0.1 + 0.1;
            }
            draw() {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(174, 194, 224, ${this.a})`;
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x, this.y + this.l);
                ctx.stroke();
            }
            update() {
                this.y += this.v;
                if (this.y > h) this.init();
            }
        }
        for (let i = 0; i < 150; i++) rainDrops.push(new Drop());

        function animate() {
            ctx.clearRect(0, 0, w, h);
            const count = isRainy ? rainDrops.length : 30; 
            for (let i = 0; i < count; i++) {
                rainDrops[i].update();
                rainDrops[i].draw();
            }
            requestAnimationFrame(animate);
        }
        animate();
    }

    function updateDateTime() {
        const now = new Date();
        const dateEl = document.getElementById('currentDate');
        const timeEl = document.getElementById('currentTime');
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
});

