// Mission Control Static Dashboard
const AGENTS = {
    larry: { id: 'larry', name: 'Larry', role: 'Lead Generation', emoji: '🤖', color: '#3B82F6', dept: 'sales', expertise: ['Research', 'List Building'] },
    lexi: { id: 'lexi', name: 'Lexi', role: 'Outreach & SDR', emoji: '📧', color: '#8B5CF6', dept: 'sales', expertise: ['Cold Email', 'LinkedIn'] },
    maya: { id: 'maya', name: 'Maya', role: 'Content & Marketing', emoji: '📊', color: '#EC4899', dept: 'sales', expertise: ['Content', 'Social'] },
    oliver: { id: 'oliver', name: 'Oliver', role: 'Operations Manager', emoji: '📋', color: '#10B981', dept: 'ops', expertise: ['Project Mgmt', 'Timelines'] },
    sam: { id: 'sam', name: 'Sam', role: 'Scheduling', emoji: '📅', color: '#F59E0B', dept: 'ops', expertise: ['Calendar', 'Notes'] },
    fiona: { id: 'fiona', name: 'Fiona', role: 'Finance', emoji: '💵', color: '#059669', dept: 'finance', expertise: ['Invoicing', 'Revenue'] },
    carl: { id: 'carl', name: 'Carl', role: 'Contracts', emoji: '🤝', color: '#6366F1', dept: 'finance', expertise: ['SOWs', 'MSAs'] },
    taylor: { id: 'taylor', name: 'Taylor', role: 'Tech Lead', emoji: '⚡', color: '#EF4444', dept: 'delivery', expertise: ['Architecture', 'Estimation'] },
    dana: { id: 'dana', name: 'Dana', role: 'Design Lead', emoji: '🎨', color: '#EC4899', dept: 'delivery', expertise: ['UI/UX', 'Brand'] }
};

let tasks = [
    { id: '1', title: 'Find 10 YC W24 fintech startups', agentId: 'larry', status: 'in_progress', priority: 'high', tags: ['yc', 'fintech'], dueDate: '2026-02-20' },
    { id: '2', title: 'Draft outreach sequence for Acme Corp', agentId: 'lexi', status: 'todo', priority: 'medium', tags: ['outreach'], handoffFrom: 'larry' },
    { id: '3', title: 'Create StartupX MVP timeline', agentId: 'oliver', status: 'in_progress', priority: 'urgent', tags: ['project'], dueDate: '2026-02-18' },
    { id: '4', title: 'Generate ClientY milestone invoice', agentId: 'fiona', status: 'todo', priority: 'high', tags: ['invoice'] },
    { id: '5', title: 'Review SOW for NewClient', agentId: 'carl', status: 'review', priority: 'high', tags: ['legal'] },
    { id: '6', title: 'Write LinkedIn post about 3-week MVPs', agentId: 'maya', status: 'backlog', priority: 'low', tags: ['content'] },
    { id: '7', title: 'Schedule kickoff with StartupX', agentId: 'sam', status: 'todo', priority: 'medium', tags: ['scheduling'] },
    { id: '8', title: 'Architecture review for marketplace', agentId: 'taylor', status: 'in_progress', priority: 'high', tags: ['tech'] },
    { id: '9', title: 'Review StartupX design mockups', agentId: 'dana', status: 'review', priority: 'medium', tags: ['design'] },
    { id: '10', title: 'Close Q1 fintech outreach campaign', agentId: 'larry', status: 'done', priority: 'high', tags: ['campaign'] }
];

const projects = [
    { id: '1', name: 'StartupX MVP', client: 'StartupX Inc', status: 'in_progress', progress: 15, agents: ['oliver', 'taylor', 'dana'], targetDate: '2026-03-10' },
    { id: '2', name: 'ClientY Phase 2', client: 'ClientY Corp', status: 'planning', progress: 0, agents: ['oliver', 'taylor'], targetDate: '2026-03-24' }
];

let selectedAgent = 'larry';
let draggedTask = null;

const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done'];
const STATUS_LABELS = { backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', review: 'Review', blocked: 'Blocked', done: 'Done' };

function render() {
    document.getElementById('app').innerHTML = `
        <header class="bg-white border-b px-6 py-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">MP</div>
                <div>
                    <h1 class="font-bold text-lg">Mission Control</h1>
                    <p class="text-xs text-gray-500">Multi-Agent Command Center</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 text-sm text-gray-500">
                    <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    9 Agents Active
                </div>
            </div>
        </header>
        <div class="flex-1 flex overflow-hidden">
            ${renderSidebar()}
            ${renderMain()}
            ${renderContext()}
        </div>
    `;
}

function renderSidebar() {
    return `<aside class="w-72 border-r bg-white flex flex-col">
        <div class="p-4 border-b"><h2 class="font-semibold text-sm">👥 Agents</h2></div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
            ${Object.values(AGENTS).map(agent => {
                const stats = getAgentStats(agent.id);
                const isActive = selectedAgent === agent.id;
                return `
                    <div onclick="selectAgent('${agent.id}')" class="agent-card p-4 rounded-lg border cursor-pointer ${isActive ? 'active bg-gray-50' : 'hover:bg-gray-50'}" style="${isActive ? `border-left-color:${agent.color}` : ''}">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background-color:${agent.color}20">${agent.emoji}</div>
                                <div><h3 class="font-semibold text-sm" ${isActive ? `style="color:${agent.color}"` : ''}>${agent.name}</h3><p class="text-xs text-gray-500">${agent.role}</p></div>
                            </div>
                            ${stats.inProgress > 0 ? '<span class="w-2 h-2 rounded-full bg-green-500"></span>' : stats.blocked > 0 ? '<span class="w-2 h-2 rounded-full bg-red-500"></span>' : '<span class="w-2 h-2 rounded-full bg-gray-300"></span>'}
                        </div>
                        <div class="mt-3 flex gap-2">
                            ${stats.inProgress > 0 ? `<span class="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">${stats.inProgress} active</span>` : ''}
                            ${stats.blocked > 0 ? `<span class="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full">${stats.blocked} blocked</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    </aside>`;
}

function renderMain() {
    const agent = AGENTS[selectedAgent];
    const agentTasks = tasks.filter(t => t.agentId === selectedAgent);
    
    return `<main class="flex-1 p-6 overflow-auto">
        <div class="space-y-4">
            <div class="flex items-center gap-3">
                <span class="text-2xl">${agent.emoji}</span>
                <div><h2 class="text-xl font-bold" style="color:${agent.color}">${agent.name}</h2><p class="text-sm text-gray-500">${agent.role}</p></div>
            </div>
            <div class="grid grid-cols-6 gap-3" style="height:calc(100vh - 200px)">
                ${STATUSES.map(status => renderColumn(status, agentTasks.filter(t => t.status === status))).join('')}
            </div>
        </div>
    </main>`;
}

function renderColumn(status, columnTasks) {
    const colors = { backlog: 'bg-gray-50 border-gray-200', todo: 'bg-blue-50 border-blue-200', in_progress: 'bg-yellow-50 border-yellow-200', review: 'bg-purple-50 border-purple-200', blocked: 'bg-red-50 border-red-200', done: 'bg-green-50 border-green-200' };
    return `
        <div class="flex flex-col rounded-lg border-2 ${colors[status]}" ondragover="event.preventDefault()" ondrop="drop(event, '${status}')">
            <div class="p-3 border-b"><div class="flex items-center justify-between"><h3 class="font-semibold text-sm">${STATUS_LABELS[status]}</h3><span class="text-xs bg-gray-200 px-2 py-0.5 rounded-full">${columnTasks.length}</span></div></div>
            <div class="flex-1 overflow-y-auto p-2 space-y-2">
                ${columnTasks.map(task => `
                    <div draggable="true" ondragstart="drag(event, '${task.id}')" class="task-card bg-white p-3 rounded-lg border shadow-sm">
                        <div class="flex items-start justify-between gap-2"><h4 class="font-medium text-sm line-clamp-2">${task.title}</h4>${task.handoffFrom ? '<span class="text-blue-500">↔</span>' : ''}</div>
                        <div class="flex items-center gap-2 mt-2 flex-wrap">
                            ${task.priority === 'urgent' ? '<span class="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Urgent</span>' : task.priority === 'high' ? '<span class="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">High</span>' : ''}
                            ${task.dueDate ? `<span class="text-[10px] text-gray-500">📅 ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderContext() {
    return `<aside class="w-80 border-l bg-white p-4 overflow-y-auto">
        <h2 class="text-lg font-bold mb-4">🎯 Global Context</h2>
        <div class="space-y-4">
            <div class="p-4 rounded-lg border">
                <h3 class="text-sm font-semibold mb-3">📁 Active Projects (${projects.length})</h3>
                <div class="space-y-3">
                    ${projects.map(p => `
                        <div class="p-3 rounded border space-y-2">
                            <div class="flex items-start justify-between"><div><h4 class="font-medium text-sm">${p.name}</h4><p class="text-xs text-gray-500">${p.client}</p></div><div class="w-2 h-2 rounded-full ${p.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-500'}"></div></div>
                            <div class="w-full bg-gray-200 rounded-full h-1.5"><div class="bg-blue-500 h-1.5 rounded-full" style="width:${p.progress}%"></div></div>
                            <div class="flex items-center gap-1">${p.agents.map(a => `<span>${AGENTS[a].emoji}</span>`).join('')}<span class="text-xs text-gray-500 ml-auto">${p.progress}%</span></div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="p-4 rounded-lg border">
                <h3 class="text-sm font-semibold mb-3">🎯 Priorities</h3>
                <div class="space-y-2">
                    <div class="flex items-center gap-2 p-2 rounded hover:bg-gray-50"><span class="text-[10px] px-2 py-0.5 bg-orange-200 text-orange-700 rounded">high</span><span class="text-sm">Close 3 new MVP deals in Q1</span></div>
                    <div class="flex items-center gap-2 p-2 rounded hover:bg-gray-50"><span class="text-[10px] px-2 py-0.5 bg-red-200 text-red-700 rounded">urgent</span><span class="text-sm">Ship StartupX MVP on time</span></div>
                </div>
            </div>
        </div>
    </aside>`;
}

function getAgentStats(agentId) {
    const agentTasks = tasks.filter(t => t.agentId === agentId);
    return { total: agentTasks.length, inProgress: agentTasks.filter(t => t.status === 'in_progress').length, blocked: agentTasks.filter(t => t.status === 'blocked').length };
}

function selectAgent(id) { selectedAgent = id; render(); }
function drag(e, taskId) { draggedTask = taskId; e.dataTransfer.effectAllowed = 'move'; }
function drop(e, status) {
    e.preventDefault();
    if (draggedTask) {
        const task = tasks.find(t => t.id === draggedTask);
        if (task && task.agentId === selectedAgent) { task.status = status; render(); }
        draggedTask = null;
    }
}

render();
