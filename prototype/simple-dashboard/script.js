const fallbackData = {
  metrics: [
    { label: 'Vault Health Score', value: '86', suffix: '/100', detail: '+4 this week', tone: 'cyan', icon: '⌁' },
    { label: 'Inbox Backlog', value: '17', suffix: 'notes', detail: '9d oldest, 4 need routing', tone: 'amber', icon: '↓' },
    { label: 'Task Flow', value: '67', suffix: '%', detail: '12 today, 3 overdue', tone: 'violet', icon: '↗' }
  ],
  actions: ['New Diary', 'Deep Research', 'Pull RSS Feeds', 'GitHub Feeds', 'Inbox Ingest', 'Vault Lint'],
  tasks: [
    { title: 'Review research brief: Local-first AI', state: 'doing', meta: 'Deep work · 10:30' },
    { title: 'Route three capture notes from Inbox', state: 'todo', meta: 'Vault hygiene · 15 min' },
    { title: 'Publish weekly learning note', state: 'todo', meta: 'Writing · 16:00' },
    { title: 'Link meeting notes to project pages', state: 'done', meta: 'Knowledge graph' },
    { title: 'Triage agent output: web clipper', state: 'overdue', meta: 'Needs decision · yesterday' }
  ],
  github: [
    { repo: 'obsidianmd/obsidian-api', description: 'Updated type definitions for properties API.', meta: '2h ago · 4.1k ★' },
    { repo: 'langchain-ai/langchainjs', description: 'New streaming callbacks landed in main.', meta: '5h ago · 15.6k ★' },
    { repo: 'microsoft/markitdown', description: 'Issue: Frontmatter preservation proposal.', meta: 'Yesterday · 66.2k ★' },
    { repo: 'anthropics/skills', description: 'Added a new skill authoring example.', meta: 'Yesterday · 7.8k ★' },
    { repo: 'huggingface/transformers', description: 'Release v4.53 notes are available.', meta: '2d ago · 149k ★' }
  ]
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function renderDashboard(data) {
  document.querySelector('#action-strip').innerHTML = data.actions.map((action) => `<button class="action-button" type="button">${escapeHtml(action)}</button>`).join('');
  document.querySelector('#metrics-grid').innerHTML = data.metrics.map((metric) => `
    <article class="metric-card" style="--metric-color: var(--${escapeHtml(metric.tone)})">
      <span class="metric-card__icon" aria-hidden="true">${escapeHtml(metric.icon)}</span>
      <p class="metric-card__label">${escapeHtml(metric.label)}</p>
      <p class="metric-card__value">${escapeHtml(metric.value)} <span class="metric-card__suffix">${escapeHtml(metric.suffix)}</span></p>
      <p class="metric-card__detail">${escapeHtml(metric.detail)}</p>
    </article>`).join('');
  document.querySelector('#task-count').textContent = `${data.tasks.length} items`;
  document.querySelector('#task-list').innerHTML = data.tasks.map((task) => `
    <li class="task-item"><div><p class="task-title">${escapeHtml(task.title)}</p><p class="task-meta">${escapeHtml(task.meta)}</p></div><span class="task-state state-${escapeHtml(task.state)}">${escapeHtml(task.state)}</span></li>`).join('');
  document.querySelector('#github-list').innerHTML = data.github.map((item) => `
    <li class="github-item"><div><p class="github-repo">${escapeHtml(item.repo)}</p><p class="github-description">${escapeHtml(item.description)}</p></div><p class="github-meta">${escapeHtml(item.meta)}</p></li>`).join('');
  renderHeatmap();
  bindInteractions();
}

function renderHeatmap() {
  const heatmap = document.querySelector('#heatmap');
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const labels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  const cells = [];
  labels.forEach((label, index) => cells.push(`<span class="day-label" style="grid-row:${index + 2}">${label}</span>`));
  for (let week = 0; week < 53; week += 1) {
    if (week % 4 === 0 && months[week / 4]) cells.push(`<span class="month-label" style="grid-column:${week + 2}">${months[week / 4]}</span>`);
    for (let day = 0; day < 7; day += 1) {
      const signal = (week * 11 + day * 7 + (week > 31 ? 3 : 0)) % 13;
      const level = signal < 4 ? 0 : signal < 7 ? 1 : signal < 10 ? 2 : signal < 12 ? 3 : 4;
      const date = new Date(2025, 6, 1 + week * 7 + day);
      cells.push(`<span class="heat-cell level-${level}" style="grid-column:${week + 2};grid-row:${day + 2}" title="${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${level} note${level === 1 ? '' : 's'}"></span>`);
    }
  }
  heatmap.innerHTML = cells.join('');
}

function bindInteractions() {
  const toast = document.querySelector('#toast');
  let toastTimer;
  const notify = (message) => { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200); };
  document.querySelectorAll('.action-button').forEach((button) => button.addEventListener('click', () => {
    button.classList.add('is-running');
    notify(`${button.textContent} queued — prototype mode`);
    setTimeout(() => button.classList.remove('is-running'), 900);
  }));
  document.querySelector('#refresh-button').addEventListener('click', (event) => {
    const button = event.currentTarget;
    button.classList.add('is-refreshing'); button.textContent = 'Syncing';
    setTimeout(() => { button.classList.remove('is-refreshing'); button.textContent = 'Refresh'; document.querySelector('.sync-time').innerHTML = 'Last sync <time datetime="09:42">just now</time>'; notify('Vault signal refreshed — mock data unchanged'); }, 700);
  });
}

async function initialise() {
  let data = fallbackData;
  if (location.protocol !== 'file:') {
    try {
      const response = await fetch('mock-data.json');
      if (response.ok) data = await response.json();
    } catch {
      // A direct file preview intentionally uses the bundled fallback data.
    }
  }
  renderDashboard(data);
}

initialise();
