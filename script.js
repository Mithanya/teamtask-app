// ============ INITIALIZE DATABASE WITH DEMO USERS ============
let users = localStorage.getItem('team_users');
if (!users) {
    let defaultUsers = {
        'admin@team.com': { name: 'Admin User', password: 'admin123', role: 'Manager' },
        'john@team.com': { name: 'John Smith', password: 'john123', role: 'Member' },
        'sarah@team.com': { name: 'Sarah Lee', password: 'sarah123', role: 'Member' }
    };
    localStorage.setItem('team_users', JSON.stringify(defaultUsers));
}

// ============ GLOBAL VARIABLES ============
let currentUser = null;
let tasks = [];
let currentAssignee = 'all';
let currentStat = 'all';
let searchQuery = '';
let pendingDeleteId = null;
let pendingEditId = null;
let deptChart = null;
let weeklyChart = null;
let assigneeChart = null;
let sortable = null;

// ============ HELPER FUNCTIONS ============
function showToast(msg, isError) {
    let toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.innerHTML = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============ DARK MODE ============
let savedTheme = localStorage.getItem('team_theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('themeToggle').innerHTML = '☀️';
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    let isDark = document.body.classList.contains('dark');
    document.getElementById('themeToggle').innerHTML = isDark ? '☀️' : '🌙';
    localStorage.setItem('team_theme', isDark ? 'dark' : 'light');
}

// ============ NOTIFICATION & REMINDERS ============
function checkReminders() {
    let today = new Date().toISOString().split('T')[0];
    let overdueTasks = tasks.filter(t => !t.completed && t.dueDate < today);
    let dueTodayTasks = tasks.filter(t => !t.completed && t.dueDate === today);
    
    let banner = document.getElementById('notificationBanner');
    let msgDiv = document.getElementById('notificationMsg');
    
    if (overdueTasks.length > 0) {
        msgDiv.innerHTML = '<i class="fas fa-bell"></i> ⚠️ You have ' + overdueTasks.length + ' overdue task(s)!';
        banner.classList.add('show');
    } else if (dueTodayTasks.length > 0) {
        msgDiv.innerHTML = '<i class="fas fa-bell"></i> 📅 ' + dueTodayTasks.length + ' task(s) due today!';
        banner.classList.add('show');
    } else {
        banner.classList.remove('show');
    }
}

document.getElementById('closeNotification').onclick = function() {
    document.getElementById('notificationBanner').classList.remove('show');
};

// ============ AUTHENTICATION FUNCTIONS ============
function handleLogin() {
    let email = document.getElementById('loginEmail').value.trim();
    let password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showToast('Please enter email and password', true);
        return;
    }
    
    let users = JSON.parse(localStorage.getItem('team_users'));
    let user = users[email];
    
    if (user && user.password === password) {
        currentUser = { email: email, name: user.name, role: user.role };
        localStorage.setItem('team_current', JSON.stringify(currentUser));
        showToast('Welcome ' + user.name);
        showApp();
    } else {
        showToast('Invalid email or password', true);
    }
}

function handleSignup() {
    let name = document.getElementById('signupName').value.trim();
    let email = document.getElementById('signupEmail').value.trim();
    let password = document.getElementById('signupPassword').value;
    let role = document.getElementById('signupRole').value;
    
    if (!name || !email || !password) {
        showToast('Please fill all fields', true);
        return;
    }
    if (password.length < 4) {
        showToast('Password must be at least 4 characters', true);
        return;
    }
    
    let users = JSON.parse(localStorage.getItem('team_users'));
    if (users[email]) {
        showToast('Email already exists', true);
        return;
    }
    
    users[email] = { name: name, password: password, role: role };
    localStorage.setItem('team_users', JSON.stringify(users));
    showToast('Account created! Please login.');
    
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('team_current');
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('authContainer').style.display = 'flex';
    showToast('Logged out successfully');
}

function checkSession() {
    let saved = localStorage.getItem('team_current');
    if (saved) {
        currentUser = JSON.parse(saved);
        return true;
    }
    return false;
}

// ============ TASK FUNCTIONS ============
function loadTasks() {
    let stored = localStorage.getItem('team_tasks_' + currentUser.email);
    if (stored) {
        tasks = JSON.parse(stored);
    } else {
        let today = new Date().toISOString().split('T')[0];
        let tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        tasks = [
            { id: 1, title: "Complete Q4 Financial Report", completed: false, priority: "high", assignee: "John", dept: "Finance", desc: "Prepare quarterly financial summary", dueDate: tomorrow, createdBy: "Admin" },
            { id: 2, title: "Frontend Architecture Review", completed: false, priority: "high", assignee: "Sarah", dept: "IT", desc: "Review new component structure", dueDate: tomorrow, createdBy: "Admin" },
            { id: 3, title: "Client Presentation", completed: true, priority: "medium", assignee: "Me", dept: "Marketing", desc: "Present new product roadmap", dueDate: today, createdBy: "Admin" },
            { id: 4, title: "Employee Onboarding Session", completed: false, priority: "low", assignee: "Mike", dept: "HR", desc: "New hire orientation", dueDate: tomorrow, createdBy: "Admin" }
        ];
        saveTasks();
    }
    renderAll();
    initDragDrop();
}

function saveTasks() {
    localStorage.setItem('team_tasks_' + currentUser.email, JSON.stringify(tasks));
}

function addTask() {
    let title = document.getElementById('taskTitle').value;
    let assignee = document.getElementById('taskAssignee').value;
    let priority = document.getElementById('taskPriority').value;
    let dueDate = document.getElementById('taskDueDate').value;
    let dept = document.getElementById('taskDept').value;
    let desc = document.getElementById('taskDesc').value;
    
    if (!title.trim()) {
        showToast('Please enter a task title', true);
        return;
    }
    
    let newTask = {
        id: Date.now(),
        title: title.trim(),
        completed: false,
        priority: priority,
        assignee: assignee === 'Me' ? currentUser.name.split(' ')[0] : assignee,
        dept: dept,
        desc: desc || '',
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        createdBy: currentUser.name.split(' ')[0]
    };
    
    tasks.unshift(newTask);
    saveTasks();
    renderAll();
    showToast('Task created successfully!');
    
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    initDragDrop();
}

function toggleTask(id) {
    let task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderAll();
        checkReminders();
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderAll();
    showToast('Task deleted');
}

function updateTask(id, newTitle) {
    let task = tasks.find(t => t.id === id);
    if (task && newTitle && newTitle.trim()) {
        task.title = newTitle.trim();
        saveTasks();
        renderAll();
        showToast('Task updated');
    }
}

function getFilteredTasks() {
    let filtered = [...tasks];
    
    if (currentStat === 'active') {
        filtered = filtered.filter(t => !t.completed);
    }
    if (currentStat === 'completed') {
        filtered = filtered.filter(t => t.completed);
    }
    if (currentAssignee !== 'all') {
        filtered = filtered.filter(t => t.assignee === currentAssignee);
    }
    if (searchQuery) {
        filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
}

// ============ DRAG & DROP ============
function initDragDrop() {
    let container = document.getElementById('tasksList');
    if (sortable) sortable.destroy();
    if (container) {
        sortable = new Sortable(container, {
            animation: 300,
            ghostClass: 'drag-over',
            onEnd: function() {
                let newOrder = [];
                let items = document.querySelectorAll('.task-card');
                for (let i = 0; i < items.length; i++) {
                    let id = parseInt(items[i].getAttribute('data-id'));
                    if (id) newOrder.push(id);
                }
                let reorderedTasks = [];
                for (let i = 0; i < newOrder.length; i++) {
                    let task = tasks.find(t => t.id === newOrder[i]);
                    if (task) reorderedTasks.push(task);
                }
                tasks = reorderedTasks;
                saveTasks();
            }
        });
    }
}

// ============ UI RENDERING ============
function renderTasks() {
    let container = document.getElementById('tasksList');
    let filtered = getFilteredTasks();
    let today = new Date().toISOString().split('T')[0];
    
    if (!container) return;
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-tasks"></i><p>No tasks found</p></div>';
        return;
    }
    
    container.innerHTML = '';
    let deptColors = { IT: '#06b6d4', HR: '#10b981', Finance: '#3b82f6', Marketing: '#f59e0b' };
    
    for (let task of filtered) {
        let isOverdue = (!task.completed && task.dueDate < today);
        let dueText = isOverdue ? 'Overdue' : (task.dueDate === today ? 'Today' : task.dueDate);
        
        let card = document.createElement('div');
        card.className = 'task-card';
        card.setAttribute('data-id', task.id);
        card.style.borderLeftColor = deptColors[task.dept] || '#3b82f6';
        card.innerHTML = 
            '<div class="task-header">' +
                '<span class="task-id">#' + task.id + '</span>' +
                '<span class="assignee-badge"><i class="fas fa-user"></i> ' + escapeHtml(task.assignee) + '</span>' +
                '<span class="status-badge ' + (task.completed ? 'status-completed' : 'status-pending') + '">' + (task.completed ? 'Completed' : 'Pending') + '</span>' +
            '</div>' +
            '<div class="task-row">' +
                '<input type="checkbox" class="task-check" data-id="' + task.id + '"' + (task.completed ? ' checked' : '') + '>' +
                '<div class="task-title ' + (task.completed ? 'completed' : '') + '">' + escapeHtml(task.title) + '</div>' +
            '</div>' +
            (task.desc ? '<div style="font-size:12px;color:var(--text-secondary);margin:8px 0 8px 32px;"><i class="fas fa-align-left"></i> ' + escapeHtml(task.desc) + '</div>' : '') +
            '<div class="task-meta">' +
                '<span class="meta-tag"><i class="fas fa-building"></i> ' + escapeHtml(task.dept) + '</span>' +
                '<span class="meta-tag priority-' + task.priority + '">' + task.priority + '</span>' +
                '<span class="meta-tag ' + (isOverdue ? 'due-overdue' : '') + '"><i class="fas fa-calendar"></i> ' + dueText + (isOverdue ? ' ⚠️' : '') + '</span>' +
                '<span class="meta-tag"><i class="fas fa-user-plus"></i> By: ' + (task.createdBy || 'Admin') + '</span>' +
            '</div>' +
            '<div class="task-buttons">' +
                '<button class="task-btn edit" data-id="' + task.id + '"><i class="fas fa-edit"></i> Edit</button>' +
                '<button class="task-btn delete" data-id="' + task.id + '"><i class="fas fa-trash-alt"></i> Delete</button>' +
            '</div>';
        container.appendChild(card);
    }
    
    // Attach events
    document.querySelectorAll('.task-check').forEach(cb => {
        cb.onclick = (e) => { e.stopPropagation(); toggleTask(parseInt(cb.dataset.id)); };
    });
    document.querySelectorAll('.task-btn.delete').forEach(btn => {
        btn.onclick = () => { pendingDeleteId = parseInt(btn.dataset.id); document.getElementById('confirmModal').classList.add('active'); };
    });
    document.querySelectorAll('.task-btn.edit').forEach(btn => {
        btn.onclick = () => {
            pendingEditId = parseInt(btn.dataset.id);
            let task = tasks.find(t => t.id === pendingEditId);
            document.getElementById('editInput').value = task ? task.title : '';
            document.getElementById('editModal').classList.add('active');
        };
    });
}

function updateStats() {
    let total = tasks.length;
    let completed = tasks.filter(t => t.completed).length;
    let pending = total - completed;
    let prod = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    document.getElementById('totalTasks').innerText = total;
    document.getElementById('completedTasks').innerText = completed;
    document.getElementById('pendingTasks').innerText = pending;
    document.getElementById('productivityRate').innerText = prod + '%';
    
    let highPriority = tasks.filter(t => !t.completed && t.priority === 'high').length;
    let weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    let weeklyCompleted = tasks.filter(t => t.completed && t.dueDate >= weekAgo).length;
    let today = new Date().toISOString().split('T')[0];
    let overdue = tasks.filter(t => !t.completed && t.dueDate < today).length;
    
    document.getElementById('highPriorityPending').innerText = highPriority;
    document.getElementById('weeklyCompleted').innerText = weeklyCompleted;
    document.getElementById('overdueTasks').innerText = overdue;
    document.getElementById('teamProductivity').innerText = prod + '%';
}

function updateCharts() {
    let depts = { IT: 0, HR: 0, Finance: 0, Marketing: 0 };
    for (let task of tasks) {
        if (depts[task.dept] !== undefined) depts[task.dept]++;
    }
    if (deptChart) deptChart.destroy();
    deptChart = new Chart(document.getElementById('deptChart'), {
        type: 'doughnut',
        data: { labels: ['IT', 'HR', 'Finance', 'Marketing'], datasets: [{ data: [depts.IT, depts.HR, depts.Finance, depts.Marketing], backgroundColor: ['#06b6d4', '#10b981', '#3b82f6', '#f59e0b'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
    });
    
    let days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let completedByDay = [];
    for (let i = 0; i < days.length; i++) {
        let d = new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0];
        let count = tasks.filter(t => t.completed && t.dueDate === d).length;
        completedByDay.push(count);
    }
    if (weeklyChart) weeklyChart.destroy();
    weeklyChart = new Chart(document.getElementById('weeklyChart'), {
        type: 'line',
        data: { labels: days, datasets: [{ label: 'Completed', data: completedByDay, borderColor: '#3b82f6', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: true }
    });
    
    let assignees = { Me: 0, John: 0, Sarah: 0, Mike: 0 };
    for (let task of tasks) {
        if (assignees[task.assignee] !== undefined) assignees[task.assignee]++;
    }
    if (assigneeChart) assigneeChart.destroy();
    assigneeChart = new Chart(document.getElementById('assigneeChart'), {
        type: 'bar',
        data: { labels: ['Me', 'John', 'Sarah', 'Mike'], datasets: [{ label: 'Tasks', data: [assignees.Me, assignees.John, assignees.Sarah, assignees.Mike], backgroundColor: '#3b82f6', borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
    });
}

function renderAll() {
    renderTasks();
    updateStats();
    updateCharts();
    checkReminders();
}

function showApp() {
    document.getElementById('userDisplay').innerHTML = '<i class="fas fa-user-circle"></i> ' + (currentUser.name || currentUser.email.split('@')[0]);
    document.getElementById('userRole').innerText = currentUser.role || 'Member';
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    loadTasks();
}

// ============ EVENT LISTENERS ============
document.getElementById('loginBtn').onclick = handleLogin;
document.getElementById('signupBtn').onclick = handleSignup;
document.getElementById('showSignupBtn').onclick = function() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
};
document.getElementById('showLoginBtn').onclick = function() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
};
document.getElementById('logoutBtn').onclick = handleLogout;
document.getElementById('drawerLogout').onclick = handleLogout;
document.getElementById('addTaskBtn').onclick = addTask;
document.getElementById('themeToggle').onclick = toggleTheme;
document.getElementById('taskTitle').addEventListener('keypress', function(e) { if (e.key === 'Enter') addTask(); });
document.getElementById('searchInput').addEventListener('input', function(e) { searchQuery = e.target.value; renderTasks(); });
document.getElementById('taskDueDate').value = new Date(Date.now() + 86400000).toISOString().split('T')[0];

// Assignee filters
document.querySelectorAll('[data-assignee]').forEach(el => {
    el.onclick = function() {
        document.querySelectorAll('[data-assignee]').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        currentAssignee = this.getAttribute('data-assignee');
        renderTasks();
    };
});

// Status filters
document.querySelectorAll('[data-stat]').forEach(el => {
    el.onclick = function() {
        document.querySelectorAll('[data-stat]').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        currentStat = this.getAttribute('data-stat');
        renderTasks();
    };
});

// Navigation
document.querySelectorAll('[data-view]').forEach(el => {
    el.onclick = function() {
        let view = this.getAttribute('data-view');
        document.getElementById('dashboardView').style.display = view === 'dashboard' ? 'block' : 'none';
        document.getElementById('analyticsView').style.display = view === 'analytics' ? 'block' : 'none';
        if (view === 'analytics') updateCharts();
        document.querySelectorAll('[data-view]').forEach(v => v.classList.remove('active'));
        this.classList.add('active');
        document.getElementById('drawer').classList.remove('open');
        document.getElementById('drawerOverlay').classList.remove('active');
    };
});

// Drawer
document.getElementById('menuBtn').onclick = function() {
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('active');
};
document.getElementById('drawerOverlay').onclick = function() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('active');
};

// Modals
document.getElementById('cancelDeleteBtn').onclick = function() {
    document.getElementById('confirmModal').classList.remove('active');
};
document.getElementById('confirmDeleteBtn').onclick = function() {
    if (pendingDeleteId) deleteTask(pendingDeleteId);
    document.getElementById('confirmModal').classList.remove('active');
};
document.getElementById('cancelEditBtn').onclick = function() {
    document.getElementById('editModal').classList.remove('active');
};
document.getElementById('saveEditBtn').onclick = function() {
    if (pendingEditId) updateTask(pendingEditId, document.getElementById('editInput').value);
    document.getElementById('editModal').classList.remove('active');
};

// ============ START APP ============
if (checkSession()) {
    showApp();
} else {
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}