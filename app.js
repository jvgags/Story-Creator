/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   STORY FORGE â€” app.js
   Full state management & UI controller
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

'use strict';

const desktop = window.storyCreator || null;

// â”€â”€â”€ STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATE = {
  projects: [],
  currentProjectId: null,
  currentChapterId: null,
  currentSceneId: null,
  currentCodexFilter: 'All',
  currentCodexId: null,
  currentNoteId: null,
  currentPanel: 'manuscript',
  currentStructure: '3act',
  settings: {
    fontSize: 16,
    lineHeight: 1.9,
    theme: 'dark',
    chapterFontKey: 'prose',
    contextChars: 2000,
    aiIsmsEnabled: true,
    aiIsmsList: [],
    aiIsmsSeeded: false,
  },
};

function getProject() {
  return STATE.projects.find(p => p.id === STATE.currentProjectId) || null;
}

function getChapter(chapterId) {
  const proj = getProject();
  return proj ? proj.chapters.find(c => c.id === chapterId) : null;
}

function getScene(chapterId, sceneId) {
  const ch = getChapter(chapterId);
  return ch ? ch.scenes.find(s => s.id === sceneId) : null;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getShortStoryPartCount(proj) {
  const raw = parseInt(proj?.ssPartCount, 10);
  if (!Number.isFinite(raw)) return 4;
  return Math.min(20, Math.max(2, raw));
}

function shortStoryPartSpanLabel(partCount) {
  if (partCount <= 2) return 'Parts 1 and 2';
  return `Parts 1 through ${partCount}`;
}

const CHAPTER_FONT_MAP = {
  prose: "'Crimson Pro', Georgia, serif",
  modern: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Mono', monospace",
  classic: "Georgia, 'Times New Roman', serif",
  book: "'Times New Roman', Times, serif",
};

function resolveChapterFontKey() {
  const key = STATE.settings.chapterFontKey || 'prose';
  return CHAPTER_FONT_MAP[key] ? key : 'prose';
}

function applyChapterFont() {
  const key = resolveChapterFontKey();
  document.documentElement.style.setProperty('--chapter-font-family', CHAPTER_FONT_MAP[key]);
  const select = document.getElementById('settings-chapter-font');
  if (select) select.value = key;
}

const DEFAULT_AI_ISMS = Array.isArray(window.STORY_FORGE_DEFAULT_AI_ISMS)
  ? window.STORY_FORGE_DEFAULT_AI_ISMS
  : [];
const DEFAULT_AI_ISMS_TEXT = typeof window.STORY_FORGE_DEFAULT_AI_ISMS_TEXT === 'string'
  ? window.STORY_FORGE_DEFAULT_AI_ISMS_TEXT
  : '';

let _aiIsmRegexCacheKey = '';
let _aiIsmRegexCache = null;

function normalizeAiIsmTerm(term) {
  if (!term) return '';
  let out = String(term).trim();
  if (!out) return '';
  out = out.replace(/^[-*]\s+/, '').trim();
  out = out.replace(/^["']+|["']+$/g, '').trim();
  if (!out) return '';
  if (out.startsWith('#')) return '';
  if (/^\*{1,2}.+\*{1,2}$/.test(out)) return '';
  return out;
}

function parseAiIsmList(rawText) {
  const lines = String(rawText || '').split(/\r?\n/);
  const terms = [];
  lines.forEach((line) => {
    let trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#')) return;
    if (/^\*{1,2}.+\*{1,2}:?$/.test(trimmed)) return;
    if (/^[A-Za-z ]+:\s*$/.test(trimmed)) return;

    if (trimmed.startsWith('- ')) {
      trimmed = trimmed.slice(2).trim();
    }

    const parts = trimmed.includes(',') ? trimmed.split(',') : [trimmed];
    parts.forEach((part) => {
      const one = normalizeAiIsmTerm(part);
      if (one) terms.push(one);
    });
  });

  const seen = new Set();
  const deduped = [];
  terms.forEach((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(term);
  });
  return deduped;
}

function ensureAiIsmSettings() {
  if (typeof STATE.settings.aiIsmsEnabled !== 'boolean') {
    STATE.settings.aiIsmsEnabled = true;
  }

  const existingRaw = String(STATE.settings.aiIsmsRawText || '').trim();
  const existingList = Array.isArray(STATE.settings.aiIsmsList) ? STATE.settings.aiIsmsList : [];
  if (!existingRaw || !STATE.settings.aiIsmsSeeded) {
    if (DEFAULT_AI_ISMS_TEXT.trim()) {
      STATE.settings.aiIsmsRawText = DEFAULT_AI_ISMS_TEXT;
    } else if (existingList.length > 0) {
      STATE.settings.aiIsmsRawText = existingList.join('\n');
    } else {
      STATE.settings.aiIsmsRawText = DEFAULT_AI_ISMS.join('\n');
    }
  }
  STATE.settings.aiIsmsList = parseAiIsmList(STATE.settings.aiIsmsRawText);
  STATE.settings.aiIsmsSeeded = true;
}

function getAiIsmRegex() {
  const list = Array.isArray(STATE.settings.aiIsmsList) ? STATE.settings.aiIsmsList : [];
  if (!STATE.settings.aiIsmsEnabled || list.length === 0) return null;

  const key = list.join('\n').toLowerCase();
  if (_aiIsmRegexCacheKey === key && _aiIsmRegexCache) return _aiIsmRegexCache;

  const escaped = list
    .map((term) => normalizeAiIsmTerm(term))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const wordLike = /^[a-z0-9' ]+$/i.test(term);
      return wordLike ? `\\b${esc}\\b` : esc;
    });

  if (escaped.length === 0) return null;

  _aiIsmRegexCacheKey = key;
  _aiIsmRegexCache = new RegExp(escaped.join('|'), 'gi');
  return _aiIsmRegexCache;
}

function removeAiIsmHighlights(root) {
  if (!root) return;
  root.querySelectorAll('.ai-ism-hit').forEach((span) => {
    span.replaceWith(document.createTextNode(span.textContent || ''));
  });
  root.normalize();
}

function getCleanSceneHtml(el) {
  const clone = el.cloneNode(true);
  removeAiIsmHighlights(clone);
  return clone.innerHTML;
}

function getCaretOffset(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

function setCaretOffset(el, offset) {
  if (offset == null) return;
  const range = document.createRange();
  const sel = window.getSelection();
  let current = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const next = current + node.nodeValue.length;
    if (offset <= next) {
      range.setStart(node, Math.max(0, offset - current));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    current = next;
    node = walker.nextNode();
  }
}

function highlightAiIsmsInElement(root, preserveCaret = false) {
  if (!root) return;
  const caret = preserveCaret ? getCaretOffset(root) : null;
  removeAiIsmHighlights(root);

  const regex = getAiIsmRegex();
  if (!regex) return;

  const textNodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement && node.parentElement.closest('.ai-ism-hit')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    textNodes.push(current);
    current = walker.nextNode();
  }

  textNodes.forEach((node) => {
    const text = node.nodeValue;
    regex.lastIndex = 0;
    if (!regex.test(text)) return;
    regex.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let match = regex.exec(text);
    while (match) {
      const start = match.index;
      const found = match[0];
      if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));
      const span = document.createElement('span');
      span.className = 'ai-ism-hit';
      span.textContent = found;
      frag.appendChild(span);
      last = start + found.length;
      match = regex.exec(text);
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });

  if (preserveCaret) setCaretOffset(root, caret);
}

function save() {
  localStorage.setItem('storyforge_data', JSON.stringify({
    projects: STATE.projects,
    settings: STATE.settings,
    nav: {
      currentProjectId:  STATE.currentProjectId,
      currentPanel:      STATE.currentPanel,
      currentChapterId:  STATE.currentChapterId,
      currentSceneId:    STATE.currentSceneId,
      currentCodexId:    STATE.currentCodexId,
      currentCodexFilter: STATE.currentCodexFilter,
      currentNoteId:     STATE.currentNoteId,
      currentStructure:  STATE.currentStructure,
    },
  }));

  if (desktop) {
    desktop.storage.saveProjects(STATE.projects).catch(() => {});
    desktop.settings.save(STATE.settings).catch(() => {});
  }
}

function load() {
  try {
    const raw = localStorage.getItem('storyforge_data');
    if (raw) {
      const data = JSON.parse(raw);
      STATE.projects = data.projects || [];
      if (data.settings) STATE.settings = { ...STATE.settings, ...data.settings };
      if (data.nav) {
        STATE.currentProjectId  = data.nav.currentProjectId  || null;
        STATE.currentPanel      = data.nav.currentPanel      || 'manuscript';
        STATE.currentChapterId  = data.nav.currentChapterId  || null;
        STATE.currentSceneId    = data.nav.currentSceneId    || null;
        STATE.currentCodexId    = data.nav.currentCodexId    || null;
        STATE.currentCodexFilter = data.nav.currentCodexFilter || 'All';
        STATE.currentNoteId     = data.nav.currentNoteId     || null;
        STATE.currentStructure  = data.nav.currentStructure  || '3act';
      }
    }
  } catch (e) { /* ignore */ }
}

async function hydrateDesktopState() {
  if (!desktop) return;
  try {
    const [projects, settings] = await Promise.all([
      desktop.storage.loadProjects(),
      desktop.settings.load(),
    ]);
    if (Array.isArray(projects) && projects.length) {
      STATE.projects = projects;
    }
    if (settings) {
      STATE.settings = { ...STATE.settings, ...settings };
    }
  } catch (e) {
    console.error('Desktop hydrate failed', e);
  }
}

// â”€â”€â”€ WORD COUNT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function countWords(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent || '';
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function projectWordCount(proj) {
  let total = 0;
  for (const ch of proj.chapters || []) {
    for (const sc of ch.scenes || []) {
      total += countWords(sc.content || '');
    }
  }
  return total;
}

function chapterWordCount(ch) {
  let total = 0;
  for (const sc of ch.scenes || []) {
    total += countWords(sc.content || '');
  }
  return total;
}

// â”€â”€â”€ SPLASH SCREEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderProjects() {
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('no-projects');
  grid.innerHTML = '';
  if (STATE.projects.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  STATE.projects.forEach(proj => {
    const wc = projectWordCount(proj);
    const target = proj.targetWordCount || 0;
    const pct = target > 0 ? Math.min(100, Math.round(wc / target * 100)) : 0;
    const card = document.createElement('div');
    card.className = 'project-card';

    // Cover / placeholder
    const coverHtml = proj.coverImage
      ? `<img class="project-card-cover" src="${proj.coverImage}" alt="Cover" />`
      : `<div class="project-card-cover-placeholder">✦</div>`;

    card.innerHTML = `
      ${coverHtml}
      <div class="project-card-body">
        <div class="project-card-genre">${esc(proj.genre || 'Fiction')}${proj.storyType === 'short_story' ? ' <span class="ss-badge">Short Story</span>' : ''}</div>
        <h3>${esc(proj.title)}</h3>
        ${proj.synopsis ? `<div class="project-card-synopsis">${esc(proj.synopsis)}</div>` : ''}
        ${target > 0 ? `
          <div class="proj-progress-wrap">
            <div class="proj-progress-bar-bg"><div class="proj-progress-bar-fill" style="width:${pct}%"></div></div>
            <div class="proj-progress-label">${wc.toLocaleString()} / ${target.toLocaleString()} words (${pct}%)</div>
          </div>` : ''}
        <div class="project-card-footer">
        <div class="project-card-stats">${wc.toLocaleString()} words · ${proj.chapters.length} chapters</div>
        <div style="display:flex;gap:6px;">
            <button class="project-card-backup" data-id="${proj.id}" title="Export this project">💾</button>
            <button class="project-card-duplicate" data-id="${proj.id}" title="Duplicate story">⧉</button>
            <button class="project-card-edit" data-id="${proj.id}" title="Edit project">✎</button>
            <button class="project-card-delete" data-id="${proj.id}" title="Delete project">🗑</button>
          </div>
        </div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('project-card-delete') ||
          e.target.classList.contains('project-card-edit') ||
          e.target.classList.contains('project-card-duplicate') ||
          e.target.classList.contains('project-card-backup')) return;
      openProject(proj.id);
    });
    card.querySelector('.project-card-backup').addEventListener('click', (e) => {
      e.stopPropagation();
      exportProject(proj.id);
    });
    card.querySelector('.project-card-duplicate').addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateProject(proj.id);
    });
    card.querySelector('.project-card-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditProjectModal(proj.id);
    });
    card.querySelector('.project-card-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDelete(`Delete "${proj.title}"?`, 'All chapters, scenes, and notes will be permanently deleted.', () => {
        STATE.projects = STATE.projects.filter(p => p.id !== proj.id);
        save();
        renderProjects();
      });
    });
    grid.appendChild(card);
  });
}

function openProject(id, restore = false) {
  STATE.currentProjectId = id;
  if (!restore) {
    STATE.currentChapterId = null;
    STATE.currentSceneId   = null;
    STATE.currentCodexId   = null;
    STATE.currentNoteId    = null;
  }
  const proj = getProject();
  document.getElementById('topbar-project-title').textContent = proj.title;
  document.getElementById('splash-screen').classList.remove('active');
  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('active');

  const panel = restore ? (STATE.currentPanel || 'manuscript') : 'manuscript';
  switchPanel(panel);
  renderChapterSidebar();
  updateTotalWC();

  // Restore deep state for each panel
  if (restore) {
    if (panel === 'manuscript') {
      if (STATE.currentSceneId) {
        const scene = getScene(STATE.currentChapterId, STATE.currentSceneId);
        if (scene) {
          selectScene(STATE.currentChapterId, STATE.currentSceneId);
        } else if (STATE.currentChapterId) {
          selectChapter(STATE.currentChapterId);
        }
      } else if (STATE.currentChapterId) {
        selectChapter(STATE.currentChapterId);
      }
    } else if (panel === 'codex') {
      renderCodexPanel();
    } else if (panel === 'notes') {
      renderNotesPanel();
      if (STATE.currentNoteId) loadNote(STATE.currentNoteId);
    } else if (panel === 'plot') {
      renderPlotPanel();
    }
  }
  loadAISettings();
}

// â”€â”€â”€ NEW PROJECT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

document.getElementById('new-project-btn').addEventListener('click', () => {
  document.getElementById('new-project-modal').classList.remove('hidden');
  document.getElementById('proj-title-input').focus();
});

document.getElementById('cancel-project-btn').addEventListener('click', () => {
  document.getElementById('new-project-modal').classList.add('hidden');
  clearProjectForm();
});

document.querySelectorAll('#new-story-type-picker .story-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#new-story-type-picker .story-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('new-ss-range').classList.toggle('hidden', btn.dataset.type !== 'short_story');
  });
});

document.querySelectorAll('#edit-story-type-picker .story-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#edit-story-type-picker .story-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isShort = btn.dataset.type === 'short_story';
    document.getElementById('edit-ss-range').classList.toggle('hidden', !isShort);
    if (isShort) {
      setTimeout(() => document.getElementById('edit-ss-min').focus(), 50);
      updateEditSsSub();
    }
  });
});

function updateEditSsSub() {
  const min = document.getElementById('edit-ss-min')?.value || 1000;
  const max = document.getElementById('edit-ss-max')?.value || 2500;
  const parts = parseInt(document.getElementById('edit-ss-parts')?.value, 10) || 4;
  const sub = document.getElementById('edit-ss-sub');
  if (sub) sub.textContent = `${parseInt(min).toLocaleString()}–${parseInt(max).toLocaleString()} words • ${parts} parts`;
}

document.getElementById('edit-ss-min')?.addEventListener('input', updateEditSsSub);
document.getElementById('edit-ss-max')?.addEventListener('input', updateEditSsSub);
document.getElementById('edit-ss-parts')?.addEventListener('input', updateEditSsSub);

document.getElementById('create-project-btn').addEventListener('click', createProject);
document.getElementById('proj-title-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') createProject();
});

function createProject() {
  const title = document.getElementById('proj-title-input').value.trim();
  if (!title) { document.getElementById('proj-title-input').focus(); return; }
  const genre = document.getElementById('proj-genre-input').value;
  const synopsis = document.getElementById('proj-synopsis-input').value.trim();
  const storyType = document.querySelector('#new-story-type-picker .story-type-btn.active')?.dataset.type || 'novel';
  const ssMin = storyType === 'short_story' ? (parseInt(document.getElementById('new-ss-min').value) || 1000) : null;
  const ssMax = storyType === 'short_story' ? (parseInt(document.getElementById('new-ss-max').value) || 2500) : null;
  const ssPartCount = storyType === 'short_story' ? getShortStoryPartCount({ ssPartCount: document.getElementById('new-ss-parts').value }) : null;
  const proj = {
    id: genId(),
    title,
    genre,
    synopsis,
    storyType,
    ssMin,
    ssMax,
    ssPartCount,
    chapters: [],
    codex: [],
    notes: [],
    beats: [],
    createdAt: Date.now(),
  };
  STATE.projects.unshift(proj);
  save();
  document.getElementById('new-project-modal').classList.add('hidden');
  clearProjectForm();
  renderProjects();
  openProject(proj.id);
}

function duplicateProject(projectId) {
  const source = STATE.projects.find(p => p.id === projectId);
  if (!source) return;

  const copy = typeof structuredClone === 'function'
    ? structuredClone(source)
    : JSON.parse(JSON.stringify(source));

  copy.id = genId();
  copy.title = buildDuplicateTitle(source.title || 'Untitled Story');
  copy.createdAt = Date.now();

  STATE.projects.unshift(copy);
  save();
  renderProjects();
  openProject(copy.id);
}

function buildDuplicateTitle(baseTitle) {
  const existingTitles = new Set(STATE.projects.map(p => String(p.title || '').toLowerCase()));
  let candidate = `${baseTitle} (Copy)`;
  let n = 2;
  while (existingTitles.has(candidate.toLowerCase())) {
    candidate = `${baseTitle} (Copy ${n})`;
    n += 1;
  }
  return candidate;
}

function clearProjectForm() {
  document.getElementById('proj-title-input').value = '';
  document.getElementById('proj-synopsis-input').value = '';
  document.getElementById('proj-genre-input').selectedIndex = 0;
  document.querySelectorAll('#new-story-type-picker .story-type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#new-story-type-picker .story-type-btn[data-type="novel"]').classList.add('active');
  document.getElementById('new-ss-range').classList.add('hidden');
  document.getElementById('new-ss-min').value = 1000;
  document.getElementById('new-ss-max').value = 2500;
  document.getElementById('new-ss-parts').value = 4;
}

// â”€â”€â”€ EDIT PROJECT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function openEditProjectModal(projId) {
  const proj = STATE.projects.find(p => p.id === projId) || getProject();
  if (!proj) return;
  STATE._editingProjectId = projId;
  document.getElementById('edit-proj-title-input').value = proj.title || '';
  document.getElementById('edit-proj-synopsis-input').value = proj.synopsis || '';
  document.getElementById('edit-proj-target-input').value = proj.targetWordCount || '';
  // Story type picker
  const st = proj.storyType || 'novel';
  document.querySelectorAll('#edit-story-type-picker .story-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === st);
  });
  const editSsRange = document.getElementById('edit-ss-range');
  editSsRange.classList.toggle('hidden', st !== 'short_story');
  document.getElementById('edit-ss-min').value = proj.ssMin ?? 1000;
  document.getElementById('edit-ss-max').value = proj.ssMax ?? 2500;
  document.getElementById('edit-ss-parts').value = getShortStoryPartCount(proj);
  if (st === 'short_story') updateEditSsSub();
  // Set genre select
  const sel = document.getElementById('edit-proj-genre-input');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === proj.genre) { sel.selectedIndex = i; break; }
  }
  // Cover image
  const zone = document.getElementById('cover-upload-zone');
  const preview = document.getElementById('cover-preview');
  const prompt = document.getElementById('cover-upload-prompt');
  const removeBtn = document.getElementById('cover-remove-btn');
  if (proj.coverImage) {
    preview.src = proj.coverImage;
    preview.classList.remove('hidden');
    prompt.classList.add('hidden');
    removeBtn.classList.remove('hidden');
    zone.classList.add('has-cover');
  } else {
    preview.src = '';
    preview.classList.add('hidden');
    prompt.classList.remove('hidden');
    removeBtn.classList.add('hidden');
    zone.classList.remove('has-cover');
  }
  document.getElementById('cover-file-input').value = '';
  document.getElementById('edit-project-modal').classList.remove('hidden');
  document.getElementById('edit-proj-title-input').focus();
}

// Cover upload interactions
document.getElementById('cover-upload-zone').addEventListener('click', (e) => {
  if (e.target.id === 'cover-remove-btn') return;
  document.getElementById('cover-file-input').click();
});

document.getElementById('cover-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const preview = document.getElementById('cover-preview');
    const prompt = document.getElementById('cover-upload-prompt');
    const removeBtn = document.getElementById('cover-remove-btn');
    const zone = document.getElementById('cover-upload-zone');
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    prompt.classList.add('hidden');
    removeBtn.classList.remove('hidden');
    zone.classList.add('has-cover');
    // Store temporarily so saveEditProject can read it
    zone.dataset.pendingCover = dataUrl;
  };
  reader.readAsDataURL(file);
});

document.getElementById('cover-remove-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const preview = document.getElementById('cover-preview');
  const prompt = document.getElementById('cover-upload-prompt');
  const zone = document.getElementById('cover-upload-zone');
  preview.src = '';
  preview.classList.add('hidden');
  prompt.classList.remove('hidden');
  document.getElementById('cover-remove-btn').classList.add('hidden');
  zone.classList.remove('has-cover');
  zone.dataset.pendingCover = '';
  document.getElementById('cover-file-input').value = '';
});

// Drag-and-drop support on the cover zone
document.getElementById('cover-upload-zone').addEventListener('dragover', (e) => {
  e.preventDefault();
  document.getElementById('cover-upload-zone').style.borderColor = 'var(--gold)';
});
document.getElementById('cover-upload-zone').addEventListener('dragleave', () => {
  document.getElementById('cover-upload-zone').style.borderColor = '';
});
document.getElementById('cover-upload-zone').addEventListener('drop', (e) => {
  e.preventDefault();
  document.getElementById('cover-upload-zone').style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const preview = document.getElementById('cover-preview');
    const zone = document.getElementById('cover-upload-zone');
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    document.getElementById('cover-upload-prompt').classList.add('hidden');
    document.getElementById('cover-remove-btn').classList.remove('hidden');
    zone.classList.add('has-cover');
    zone.dataset.pendingCover = dataUrl;
  };
  reader.readAsDataURL(file);
});

document.getElementById('edit-project-btn').addEventListener('click', () => {
  openEditProjectModal(STATE.currentProjectId);
});

document.getElementById('close-edit-project-x').addEventListener('click', () => {
  document.getElementById('edit-project-modal').classList.add('hidden');
});

document.getElementById('cancel-edit-project-btn').addEventListener('click', () => {
  document.getElementById('edit-project-modal').classList.add('hidden');
});

document.getElementById('save-edit-project-btn').addEventListener('click', saveEditProject);
document.getElementById('edit-proj-title-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') saveEditProject();
});

function saveEditProject() {
  const title = document.getElementById('edit-proj-title-input').value.trim();
  if (!title) { document.getElementById('edit-proj-title-input').focus(); return; }
  const proj = STATE.projects.find(p => p.id === STATE._editingProjectId);
  if (!proj) return;
  proj.title = title;
  proj.genre = document.getElementById('edit-proj-genre-input').value;
  proj.synopsis = document.getElementById('edit-proj-synopsis-input').value.trim();
  proj.storyType = document.querySelector('#edit-story-type-picker .story-type-btn.active')?.dataset.type || 'novel';
  if (proj.storyType === 'short_story') {
    proj.ssMin = parseInt(document.getElementById('edit-ss-min').value) || 1000;
    proj.ssMax = parseInt(document.getElementById('edit-ss-max').value) || 2500;
    proj.ssPartCount = getShortStoryPartCount({ ssPartCount: document.getElementById('edit-ss-parts').value });
  } else {
    proj.ssMin = null;
    proj.ssMax = null;
    proj.ssPartCount = null;
  }
  const targetVal = parseInt(document.getElementById('edit-proj-target-input').value);
  proj.targetWordCount = isNaN(targetVal) || targetVal <= 0 ? 0 : targetVal;
  // Save cover image
  const zone = document.getElementById('cover-upload-zone');
  if (zone.dataset.pendingCover !== undefined) {
    proj.coverImage = zone.dataset.pendingCover || null;
    delete zone.dataset.pendingCover;
  }
  save();
  document.getElementById('edit-project-modal').classList.add('hidden');
  // Update topbar title if editing the open project
  if (STATE.currentProjectId === proj.id) {
    document.getElementById('topbar-project-title').textContent = proj.title;
  }
  renderProjects();
}

document.getElementById('back-to-projects').addEventListener('click', () => {
  saveCurrentScene();
  STATE.currentProjectId = null;
  STATE.currentChapterId = null;
  STATE.currentSceneId = null;
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('splash-screen').classList.add('active');
  document.getElementById('splash-screen').classList.remove('hidden');
  renderProjects();
});

// â”€â”€â”€ PANEL SWITCHING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    saveCurrentScene();
    switchPanel(btn.dataset.panel);
  });
});

function switchPanel(name) {
  STATE.currentPanel = name;
  document.querySelectorAll('.nav-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === name);
  });
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  const target = document.getElementById('panel-' + name);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
  if (name === 'codex') renderCodexPanel();
  if (name === 'plot') renderPlotPanel();
  if (name === 'notes') renderNotesPanel();
  save();
}

// â”€â”€â”€ MANUSCRIPT PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderChapterSidebar() {
  const proj = getProject();
  const list = document.getElementById('chapters-list');
  list.innerHTML = '';
  if (!proj) return;
  document.getElementById('chapter-count').textContent = proj.chapters.length;
  let totalScenes = 0;
  proj.chapters.forEach(ch => totalScenes += ch.scenes.length);
  document.getElementById('scene-count').textContent = totalScenes;

  proj.chapters.forEach((ch, idx) => {
    const wc = chapterWordCount(ch);
    const isOpen = ch.id === STATE.currentChapterId;
    const item = document.createElement('div');
    item.className = 'chapter-item' + (isOpen ? ' open active' : '');
    item.dataset.chapterId = ch.id;

    let scenesHtml = '';
    ch.scenes.forEach(sc => {
      const isActiveSc = sc.id === STATE.currentSceneId;
      scenesHtml += `
        <div class="scene-sub-item${isActiveSc ? ' active' : ''}" data-scene-id="${sc.id}" data-chapter-id="${ch.id}">
          <div class="scene-sub-dot"></div>
          <span class="scene-sub-name">${esc(sc.title || 'Untitled Scene')}</span>
        </div>`;
    });

    item.innerHTML = `
      <div class="chapter-item-header">
            <span class="chapter-chevron">▶</span>
        <span class="chapter-item-name">${esc(ch.title || `Chapter ${idx + 1}`)}</span>
        <span class="chapter-item-wc">${wc > 0 ? wc.toLocaleString() + 'w' : ''}</span>
      </div>
      ${ch.scenes.length > 0 ? `<div class="scenes-sub">${scenesHtml}</div>` : ''}
    `;

    item.querySelector('.chapter-item-header').addEventListener('click', () => {
      saveCurrentScene();
      if (STATE.currentChapterId === ch.id) {
        item.classList.toggle('open');
      } else {
        item.classList.add('open');
      }
      selectChapter(ch.id);
    });

    item.querySelectorAll('.scene-sub-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        saveCurrentScene();
        selectScene(el.dataset.chapterId, el.dataset.sceneId);
      });
    });

    list.appendChild(item);
    if (isOpen) item.classList.add('open');
  });

  updateEditorView();
}

function selectChapter(chapterId) {
  STATE.currentChapterId = chapterId;
  STATE.currentSceneId = null;
  renderChapterSidebar();
  updateEditorView();
  save();
}

function selectScene(chapterId, sceneId) {
  STATE.currentChapterId = chapterId;
  STATE.currentSceneId = sceneId;
  renderChapterSidebar();
  updateEditorView();
  updateTotalWC();
  save();
}

function updateEditorView() {
  const proj = getProject();
  const editorEmpty    = document.getElementById('editor-empty');
  const chapterOverview = document.getElementById('chapter-overview');
  const sceneEditor    = document.getElementById('scene-editor');
  const readView       = document.getElementById('chapter-read-view');

  // Hide all
  editorEmpty.classList.add('hidden');
  chapterOverview.classList.add('hidden');
  sceneEditor.classList.add('hidden');
  readView.classList.add('hidden');

  if (!proj || !STATE.currentChapterId) {
    applyChapterFont();
    editorEmpty.classList.remove('hidden');
    return;
  }

  if (STATE.currentSceneId) {
    // Show scene editor
    const sc = getScene(STATE.currentChapterId, STATE.currentSceneId);
    if (!sc) { editorEmpty.classList.remove('hidden'); return; }
    sceneEditor.classList.remove('hidden');
    document.getElementById('scene-name-input').value = sc.title || '';
    const contentEl = document.getElementById('scene-content');
    contentEl.innerHTML = sc.content || '';
    highlightAiIsmsInElement(contentEl, false);
    document.getElementById('scene-wc').textContent = countWords(sc.content || '') + ' words';

    // POV dropdown
    const povSelect = document.getElementById('scene-pov-select');
  povSelect.innerHTML = '<option value="">—</option>';
    (proj.codex || []).filter(e => e.category === 'Characters').forEach(char => {
      const opt = document.createElement('option');
      opt.value = char.id;
      opt.textContent = char.name;
      opt.selected = sc.povCharacterId === char.id;
      povSelect.appendChild(opt);
    });

    applyEditorSettings();
    applyChapterFont();
  } else {
    // Show chapter overview
    const ch = getChapter(STATE.currentChapterId);
    if (!ch) { editorEmpty.classList.remove('hidden'); return; }
    chapterOverview.classList.remove('hidden');
    document.getElementById('chapter-name-input').value = ch.title || '';
    applyChapterFont();
    renderScenesOverview(ch);
  }
}

function renderScenesOverview(ch) {
  const list = document.getElementById('scenes-list');
  list.innerHTML = '';
  if (ch.scenes.length === 0) {
    list.innerHTML = `<div style="color:var(--text-dim);font-style:italic;padding:20px 0;">No scenes yet. Add your first scene above.</div>`;
    return;
  }
  ch.scenes.forEach(sc => {
    const wc = countWords(sc.content || '');
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.innerHTML = `
      <div class="scene-card-icon">§</div>
      <div class="scene-card-info">
        <div class="scene-card-title">${esc(sc.title || 'Untitled Scene')}</div>
        <div class="scene-card-meta">${wc > 0 ? wc.toLocaleString() + ' words' : 'Empty'}</div>
      </div>
      <div class="scene-card-arrow">→</div>
    `;
    card.addEventListener('click', () => {
      saveCurrentScene();
      selectScene(ch.id, sc.id);
    });
    list.appendChild(card);
  });
}

// Chapter name editing
document.getElementById('chapter-name-input').addEventListener('input', () => {
  const ch = getChapter(STATE.currentChapterId);
  if (ch) {
    ch.title = document.getElementById('chapter-name-input').value;
    save();
    renderChapterSidebar();
  }
});

// Add chapter
document.getElementById('add-chapter-btn').addEventListener('click', addChapter);
document.getElementById('empty-add-chapter-btn').addEventListener('click', addChapter);

function addChapter() {
  const proj = getProject();
  if (!proj) return;
  const ch = { id: genId(), title: `Chapter ${proj.chapters.length + 1}`, scenes: [] };
  proj.chapters.push(ch);
  save();
  selectChapter(ch.id);
}

// Delete chapter
document.getElementById('delete-chapter-btn').addEventListener('click', () => {
  const ch = getChapter(STATE.currentChapterId);
  if (!ch) return;
  confirmDelete(`Delete "${ch.title || 'this chapter'}"?`, 'All scenes in this chapter will be deleted.', () => {
    const proj = getProject();
    proj.chapters = proj.chapters.filter(c => c.id !== STATE.currentChapterId);
    STATE.currentChapterId = null;
    STATE.currentSceneId = null;
    save();
    renderChapterSidebar();
    updateTotalWC();
  });
});

// Add scene
document.getElementById('add-scene-btn').addEventListener('click', () => {
  const ch = getChapter(STATE.currentChapterId);
  if (!ch) return;
  const sc = { id: genId(), title: `Scene ${ch.scenes.length + 1}`, content: '', povCharacterId: '' };
  ch.scenes.push(sc);
  save();
  selectScene(ch.id, sc.id);
});

// Read chapter
document.getElementById('read-chapter-btn').addEventListener('click', () => {
  saveCurrentScene();
  renderChapterReadView(STATE.currentChapterId);
});

document.getElementById('close-read-view-btn').addEventListener('click', () => {
  document.getElementById('chapter-read-view').classList.add('hidden');
  document.getElementById('chapter-overview').classList.remove('hidden');
});

function renderChapterReadView(chapterId) {
  const ch = getChapter(chapterId);
  if (!ch) return;

  const editorEmpty     = document.getElementById('editor-empty');
  const chapterOverview = document.getElementById('chapter-overview');
  const sceneEditor     = document.getElementById('scene-editor');
  const readView        = document.getElementById('chapter-read-view');

  editorEmpty.classList.add('hidden');
  chapterOverview.classList.add('hidden');
  sceneEditor.classList.add('hidden');
  readView.classList.remove('hidden');

  // Header
  document.getElementById('chapter-read-title').textContent = ch.title || 'Untitled Chapter';
  const totalWords = ch.scenes.reduce((sum, sc) => sum + countWords(sc.content || ''), 0);
  document.getElementById('chapter-read-wc').textContent = totalWords.toLocaleString() + ' words';

  // Build content
  const container = document.getElementById('chapter-read-content');
  container.innerHTML = '';

  const scenesWithContent = ch.scenes.filter(sc => sc.content && sc.content.trim() !== '<p><br></p>' && sc.content.trim() !== '');

  if (scenesWithContent.length === 0) {
    container.innerHTML = `<p style="color:var(--text-dim);font-style:italic;text-align:center;padding:40px 0;">This chapter has no content yet.</p>`;
    return;
  }

  scenesWithContent.forEach((sc, i) => {
    const section = document.createElement('div');
    section.className = 'chapter-read-scene';

    // Scene divider (not before first scene)
    if (i > 0) {
      const divider = document.createElement('div');
      divider.className = 'chapter-read-break';
      divider.textContent = '* * *';
      container.appendChild(divider);
    }

    // Scene label (subtle, only if scene has a real title)
    const defaultTitle = /^scene\s+\d+$/i.test(sc.title || '');
    if (sc.title && !defaultTitle) {
      const label = document.createElement('div');
      label.className = 'chapter-read-scene-title';
      label.textContent = sc.title;
      section.appendChild(label);
    }

    // Scene prose
    const body = document.createElement('div');
    body.className = 'chapter-read-scene-body';
    body.innerHTML = sc.content || '';
    highlightAiIsmsInElement(body, false);
    section.appendChild(body);

    container.appendChild(section);
  });

  // Scroll to top
  document.getElementById('chapter-read-scroll').scrollTop = 0;
}

// Scene name editing
document.getElementById('scene-name-input').addEventListener('input', () => {
  const sc = getScene(STATE.currentChapterId, STATE.currentSceneId);
  if (sc) {
    sc.title = document.getElementById('scene-name-input').value;
    save();
  }
});

// Scene POV
document.getElementById('scene-pov-select').addEventListener('change', () => {
  const sc = getScene(STATE.currentChapterId, STATE.currentSceneId);
  if (sc) {
    sc.povCharacterId = document.getElementById('scene-pov-select').value;
    save();
  }
});

// Scene content editing
const sceneContentEl = document.getElementById('scene-content');
let saveTimeout = null;
let highlightTimeout = null;

sceneContentEl.addEventListener('input', () => {
  const wc = countWords(getCleanSceneHtml(sceneContentEl));
  document.getElementById('scene-wc').textContent = wc + ' words';
  updateTotalWC();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveCurrentScene, 500);
  clearTimeout(highlightTimeout);
  highlightTimeout = setTimeout(() => highlightAiIsmsInElement(sceneContentEl, true), 300);
});

function saveCurrentScene() {
  if (!STATE.currentSceneId) return;
  const sc = getScene(STATE.currentChapterId, STATE.currentSceneId);
  if (sc) {
    sc.content = getCleanSceneHtml(sceneContentEl);
    save();
    renderChapterSidebar();
  }
}

// Back to chapter from scene
document.getElementById('back-to-chapter-btn').addEventListener('click', () => {
  saveCurrentScene();
  STATE.currentSceneId = null;
  renderChapterSidebar();
  updateEditorView();
});

// Delete scene
document.getElementById('delete-scene-btn').addEventListener('click', () => {
  const sc = getScene(STATE.currentChapterId, STATE.currentSceneId);
  if (!sc) return;
  confirmDelete(`Delete "${sc.title || 'this scene'}"?`, 'The scene content will be permanently deleted.', () => {
    const ch = getChapter(STATE.currentChapterId);
    ch.scenes = ch.scenes.filter(s => s.id !== STATE.currentSceneId);
    STATE.currentSceneId = null;
    save();
    renderChapterSidebar();
    updateEditorView();
    updateTotalWC();
  });
});

// Toolbar formatting
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.execCommand(btn.dataset.cmd, false, null);
    sceneContentEl.focus();
  });
});

document.getElementById('font-size-select').addEventListener('change', (e) => {
  STATE.settings.fontSize = parseInt(e.target.value);
  applyEditorSettings();
  applyFocusFontSize();
  // sync settings modal slider
  const slider = document.getElementById('settings-font-size');
  if (slider) { slider.value = STATE.settings.fontSize; document.getElementById('settings-font-label').textContent = STATE.settings.fontSize + 'px'; }
  save();
});

function updateTotalWC() {
  const proj = getProject();
  const wc = proj ? projectWordCount(proj) : 0;
  const isShortStory = proj?.storyType === 'short_story';

  const badge = document.getElementById('total-wc-badge');
  const ssProgress = document.getElementById('ss-progress');

  if (isShortStory) {
    const ssMin = proj.ssMin ?? 1000;
    const ssMax = proj.ssMax ?? 2500;
    const warnAt = ssMin + Math.round((ssMax - ssMin) * 0.88);
    badge.classList.add('hidden');
    ssProgress.classList.remove('hidden');
    const pct = Math.min(100, Math.round(wc / ssMax * 100));
    const fill = document.getElementById('ss-progress-fill');
    fill.style.width = pct + '%';
    fill.className = 'ss-progress-fill';
    if (wc > ssMax) fill.classList.add('ss-over');
    else if (wc >= ssMin) fill.classList.add(wc > warnAt ? 'ss-warn' : 'ss-good');
    document.getElementById('ss-progress-label').textContent =
      `${wc.toLocaleString()} / ${ssMax.toLocaleString()}${wc > ssMax ? ' ⚠ Over' : wc >= ssMin ? ' ✓' : ''}`;
  } else {
    badge.classList.remove('hidden');
    ssProgress.classList.add('hidden');
    badge.textContent = wc.toLocaleString() + ' words';
  }
}

// â”€â”€â”€ CODEX PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ Rich editor toolbar â”€â”€
document.querySelectorAll('.codex-rich-toolbar').forEach(toolbar => {
  toolbar.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.codex-tool-btn');
    if (!btn) return;
    e.preventDefault(); // keep focus in editor
    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val || null;
    document.execCommand(cmd, false, val);
    updateCodexToolbarState();
  });
});

// Track formatting state when selection changes inside editors
document.querySelectorAll('.codex-rich-content').forEach(el => {
  el.addEventListener('keyup', updateCodexToolbarState);
  el.addEventListener('mouseup', updateCodexToolbarState);
  el.addEventListener('focus', updateCodexToolbarState);

  // Clean paste â€” strip external styles but keep structure
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      // Parse and clean: keep b/i/u/ul/ol/li/h1-h6/p, strip everything else
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      // Remove all style/class attributes
      tmp.querySelectorAll('*').forEach(node => {
        node.removeAttribute('style');
        node.removeAttribute('class');
        node.removeAttribute('id');
      });
      // Collapse divs to p
      tmp.querySelectorAll('div').forEach(div => {
        const p = document.createElement('p');
        p.innerHTML = div.innerHTML;
        div.replaceWith(p);
      });
      // Downgrade h1/h2 to h3
      tmp.querySelectorAll('h1, h2').forEach(h => {
        const h3 = document.createElement('h3');
        h3.innerHTML = h.innerHTML;
        h.replaceWith(h3);
      });
      // Remove h4-h6 tags keeping text
      tmp.querySelectorAll('h4, h5, h6').forEach(h => {
        const p = document.createElement('p');
        p.innerHTML = h.innerHTML;
        h.replaceWith(p);
      });
      document.execCommand('insertHTML', false, tmp.innerHTML);
    } else {
      // Plain text: preserve line breaks as paragraphs
      const paragraphs = text.split(/\n\n+/).map(p =>
        `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      document.execCommand('insertHTML', false, paragraphs || text);
    }
  });
});

function updateCodexToolbarState() {
  document.querySelectorAll('.codex-tool-btn[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    if (['bold','italic','underline','insertUnorderedList','insertOrderedList'].includes(cmd)) {
      btn.classList.toggle('active', document.queryCommandState(cmd));
    }
  });
}

const CODEX_ICONS = {
  Characters:  '👤',
  Locations:   '📍',
  Items:       '📦',
  Factions:    '⚑',
  Lore:        '📜',
  Subplots:    '🔀',
  Other:       '📄',
  'Style Guide':  '🎨',
  'World Rules':  '🌐',
  'Instructions': '📋',
  'Synopsis':     '📝',
};

// Singular labels for badge display
const CODEX_SINGULAR = {
  Characters: 'Character', Locations: 'Location', Items: 'Item',
  Factions: 'Faction', Lore: 'Lore', Subplots: 'Subplot',
  Other: 'Other', 'Style Guide': 'Style Guide', 'World Rules': 'World Rules',
  'Instructions': 'Instructions', 'Synopsis': 'Synopsis',
};

// â”€â”€ New Entry dropdown â”€â”€

const newEntryBtn  = document.getElementById('codex-new-entry-btn');
const newEntryDrop = document.getElementById('new-entry-dropdown');

newEntryBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = !newEntryDrop.classList.contains('hidden');
  newEntryDrop.classList.toggle('hidden', open);
  newEntryBtn.classList.toggle('open', !open);
});

document.addEventListener('click', () => {
  newEntryDrop.classList.add('hidden');
  newEntryBtn.classList.remove('open');
});

newEntryDrop.addEventListener('click', (e) => e.stopPropagation());

document.querySelectorAll('.new-entry-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.cat;
    newEntryDrop.classList.add('hidden');
    newEntryBtn.classList.remove('open');
    createCodexEntry(cat);
  });
});

function createCodexEntry(cat) {
  const proj = getProject();
  if (!proj) return;
  const singular = CODEX_SINGULAR[cat] || cat;
  const entry = {
    id: genId(),
    category: cat,
    name: `New ${singular}`,
    description: '',
    role: '',
    notes: '',
  };
  proj.codex.push(entry);
  save();
  STATE.currentCodexId = entry.id;
  STATE.currentCodexFilter = 'All';
  // Sync filter button
  document.querySelectorAll('.codex-filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === 'All'));
  renderCodexList();
  loadCodexEntry(entry.id);
}

// â”€â”€ Filter bar â”€â”€

document.querySelectorAll('.codex-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.codex-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    STATE.currentCodexFilter = btn.dataset.cat;
    renderCodexList();
  });
});

// â”€â”€ Search â”€â”€

document.getElementById('codex-search-input').addEventListener('input', () => {
  renderCodexList();
});

function renderCodexPanel() {
  renderCodexList();
  if (STATE.currentCodexId) loadCodexEntry(STATE.currentCodexId);
  else showCodexEmpty();
}

function renderCodexList() {
  const proj = getProject();
  const list = document.getElementById('codex-list');
  list.innerHTML = '';
  if (!proj) return;

  const filter = STATE.currentCodexFilter || 'All';
  const query  = (document.getElementById('codex-search-input')?.value || '').toLowerCase().trim();

  let entries = proj.codex;
  if (filter !== 'All') entries = entries.filter(e => e.category === filter);
  if (query) entries = entries.filter(e =>
    (e.name || '').toLowerCase().includes(query) ||
    htmlToText(e.description || '').toLowerCase().includes(query)
  );

  if (entries.length === 0) {
    list.innerHTML = `<div class="codex-list-empty">${
      query ? `No entries match "${query}"` : filter === 'All' ? 'No entries yet.\nClick + New Entry to begin.' : `No ${filter} entries yet.`
    }</div>`;
    return;
  }

  // Drag-and-drop only makes sense when viewing the full unfiltered list
  const canDrag = filter === 'All' && !query;
  let dragSrcId = null;

  entries.forEach(entry => {
    const icon = CODEX_ICONS[entry.category] || '📄';
    const isAll = filter === 'All';
    const isAlways = entry.aiContext === 'always';
    const el = document.createElement('div');
    el.className = 'codex-list-item' + (entry.id === STATE.currentCodexId ? ' active' : '');
    el.dataset.id = entry.id;

    el.innerHTML = `
        ${canDrag ? `<span class="codex-drag-handle" title="Drag to reorder">⠿</span>` : ''}
      <span class="codex-item-icon">${icon}</span>
      <span class="codex-item-name">${esc(entry.name)}</span>
        ${isAlways ? `<span class="codex-item-always-badge" title="Always included in AI context">✦</span>` : ''}
      ${isAll && !isAlways ? `<span class="codex-item-cat-tag">${esc(CODEX_SINGULAR[entry.category] || entry.category)}</span>` : ''}
    `;

    el.addEventListener('click', () => {
      STATE.currentCodexId = entry.id;
      renderCodexList();
      loadCodexEntry(entry.id);
      save();
    });

    if (canDrag) {
      el.draggable = true;

      el.addEventListener('dragstart', (e) => {
        dragSrcId = entry.id;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', entry.id);
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        list.querySelectorAll('.codex-list-item').forEach(n => n.classList.remove('drag-over'));
      });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrcId !== entry.id) {
          list.querySelectorAll('.codex-list-item').forEach(n => n.classList.remove('drag-over'));
          el.classList.add('drag-over');
        }
      });

      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over');
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (!dragSrcId || dragSrcId === entry.id) return;

        // Reorder proj.codex array
        const codex = proj.codex;
        const fromIdx = codex.findIndex(c => c.id === dragSrcId);
        const toIdx   = codex.findIndex(c => c.id === entry.id);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = codex.splice(fromIdx, 1);
        codex.splice(toIdx, 0, moved);
        save();
        renderCodexList();
      });
    }

    list.appendChild(el);
  });
}

function loadCodexEntry(id) {
  const proj = getProject();
  const entry = proj.codex.find(e => e.id === id);
  if (!entry) { showCodexEmpty(); return; }
  document.getElementById('codex-empty').classList.add('hidden');
  const form = document.getElementById('codex-entry-form');
  form.classList.remove('hidden');
  const nameInput = document.getElementById('codex-entry-name');
  nameInput.value = entry.name;
  const badge = document.getElementById('codex-entry-cat-badge');
  badge.textContent = (CODEX_ICONS[entry.category] || '') + ' ' + (CODEX_SINGULAR[entry.category] || entry.category);
  document.getElementById('codex-entry-desc').innerHTML = entry.description || '';
  document.getElementById('codex-entry-role').value = entry.role || '';
  document.getElementById('codex-entry-notes').innerHTML = entry.notes || '';
  const charFields = document.getElementById('codex-char-fields');
  charFields.style.display = entry.category === 'Characters' ? 'block' : 'none';
  // AI context radio
  const ctxVal = entry.aiContext || 'auto';
  document.querySelectorAll('input[name="codex-ai-ctx"]').forEach(r => {
    r.checked = r.value === ctxVal;
  });
  // Auto-select name if it's still the default so user can type immediately
  const singular = CODEX_SINGULAR[entry.category] || entry.category;
  if (entry.name === `New ${singular}` || entry.name === 'Unnamed') {
    requestAnimationFrame(() => { nameInput.focus(); nameInput.select(); });
  }
}

function showCodexEmpty() {
  document.getElementById('codex-empty').classList.remove('hidden');
  document.getElementById('codex-entry-form').classList.add('hidden');
}

// Live-save name on blur so the sidebar updates immediately
document.getElementById('codex-entry-name').addEventListener('blur', () => {
  const proj = getProject();
  const entry = proj?.codex.find(e => e.id === STATE.currentCodexId);
  if (!entry) return;
  const newName = document.getElementById('codex-entry-name').value.trim();
  if (newName && newName !== entry.name) {
    entry.name = newName;
    save();
    renderCodexList();
  }
});

// Also update on Enter key
document.getElementById('codex-entry-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});

document.getElementById('save-codex-btn').addEventListener('click', () => {
  const proj = getProject();
  const entry = proj.codex.find(e => e.id === STATE.currentCodexId);
  if (!entry) return;
  entry.name        = document.getElementById('codex-entry-name').value || 'Unnamed';
  entry.description = document.getElementById('codex-entry-desc').innerHTML;
  entry.role        = document.getElementById('codex-entry-role').value;
  entry.notes       = document.getElementById('codex-entry-notes').innerHTML;
  const checkedCtx = document.querySelector('input[name="codex-ai-ctx"]:checked');
  entry.aiContext = checkedCtx ? checkedCtx.value : 'auto';
  save();
  renderCodexList();
  flashSave(document.getElementById('save-codex-btn'));
});

document.getElementById('delete-codex-btn').addEventListener('click', () => {
  const proj = getProject();
  const entry = proj.codex.find(e => e.id === STATE.currentCodexId);
  if (!entry) return;
  confirmDelete(`Delete "${entry.name}"?`, 'This codex entry will be permanently deleted.', () => {
    proj.codex = proj.codex.filter(e => e.id !== STATE.currentCodexId);
    STATE.currentCodexId = null;
    save();
    renderCodexList();
    showCodexEmpty();
  });
});

// â”€â”€â”€ PLOT PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STRUCTURES = {
  '3act': {
    acts: [
    { title: 'Act I — Setup', desc: 'Introduce the world, characters, and the inciting incident that launches your story.' },
    { title: 'Act II — Confrontation', desc: 'Rising action, obstacles, and escalating conflict that drives toward the darkest moment.' },
    { title: 'Act III — Resolution', desc: 'Climax, falling action, and the resolution of all major story threads.' },
    ]
  },
  'heros': {
    acts: [
      { title: 'Ordinary World', desc: 'The hero\'s normal life before the adventure begins.' },
      { title: 'Call to Adventure', desc: 'A challenge or problem presents itself. The hero must leave the known world.' },
      { title: 'Road of Trials', desc: 'Tests, allies, enemies, and transformation. The hero faces the ordeal.' },
      { title: 'Return with Elixir', desc: 'The hero returns transformed, bringing new wisdom or power back to the world.' },
    ]
  },
  'save': {
    acts: [
      { title: 'Opening Image / Theme', desc: 'A snapshot of the world before change begins. The theme stated.' },
      { title: 'Catalyst & Debate', desc: 'Life-changing event. The hero debates whether to accept the call.' },
      { title: 'Break into Two', desc: 'The hero enters a new world, leaving the old one behind.' },
      { title: 'Finale & Final Image', desc: 'The hero proves they have changed. A mirror of the opening image.' },
    ]
  }
};

document.querySelectorAll('.struct-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.struct-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    STATE.currentStructure = btn.dataset.struct;
    renderPlotBoard();
  });
});

function renderPlotPanel() {
  const proj = getProject();
  renderPlotBoard();
  renderBeatsList(proj);
}

function renderPlotBoard() {
  const board = document.getElementById('plot-board');
  const struct = STRUCTURES[STATE.currentStructure];
  board.innerHTML = '';
  struct.acts.forEach(act => {
    const el = document.createElement('div');
    el.className = 'plot-act';
    el.innerHTML = `<div class="plot-act-title">${esc(act.title)}</div><div class="plot-act-desc">${esc(act.desc)}</div>`;
    board.appendChild(el);
  });
}

function renderBeatsList(proj) {
  const list = document.getElementById('beats-list');
  list.innerHTML = '';
  (proj.beats || []).forEach((beat, i) => {
    const el = document.createElement('div');
    el.className = 'beat-item';
    el.innerHTML = `
      <span class="beat-num">${i + 1}</span>
      <input class="beat-input" type="text" value="${esc(beat.text)}" placeholder="Describe this beat…" data-idx="${i}" />
      <button class="beat-delete" data-idx="${i}">✕</button>
    `;
    el.querySelector('.beat-input').addEventListener('input', (e) => {
      proj.beats[e.target.dataset.idx].text = e.target.value;
      save();
    });
    el.querySelector('.beat-delete').addEventListener('click', (e) => {
      proj.beats.splice(parseInt(e.target.dataset.idx), 1);
      save();
      renderBeatsList(proj);
    });
    list.appendChild(el);
  });
}

document.getElementById('add-beat-btn').addEventListener('click', () => {
  const proj = getProject();
  if (!proj) return;
  if (!proj.beats) proj.beats = [];
  proj.beats.push({ id: genId(), text: '' });
  save();
  renderBeatsList(proj);
  // focus last input
  const inputs = document.querySelectorAll('.beat-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

// â”€â”€â”€ NOTES PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

document.getElementById('add-note-btn').addEventListener('click', () => {
  const proj = getProject();
  if (!proj) return;
  const note = { id: genId(), title: 'Untitled Note', content: '', updatedAt: Date.now() };
  proj.notes.push(note);
  save();
  STATE.currentNoteId = note.id;
  renderNotesList();
  loadNote(note.id);
});

function renderNotesPanel() {
  renderNotesList();
  if (STATE.currentNoteId) loadNote(STATE.currentNoteId);
  else showNotesEmpty();
}

function renderNotesList() {
  const proj = getProject();
  const list = document.getElementById('notes-list');
  list.innerHTML = '';
  if (!proj) return;
  (proj.notes || []).slice().reverse().forEach(note => {
    const el = document.createElement('div');
    el.className = 'note-list-item' + (note.id === STATE.currentNoteId ? ' active' : '');
    el.innerHTML = `
      <div class="note-list-title">${esc(note.title || 'Untitled')}</div>
      <div class="note-list-preview">${esc(note.content.slice(0, 50))}</div>
    `;
    el.addEventListener('click', () => {
      saveCurrentNote();
      STATE.currentNoteId = note.id;
      renderNotesList();
      loadNote(note.id);
      save();
    });
    list.appendChild(el);
  });
}

function loadNote(id) {
  const proj = getProject();
  const note = proj.notes.find(n => n.id === id);
  if (!note) { showNotesEmpty(); return; }
  document.getElementById('notes-empty').classList.add('hidden');
  document.getElementById('note-editor').classList.remove('hidden');
  document.getElementById('note-title-input').value = note.title || '';
  document.getElementById('note-content-input').value = note.content || '';
  const d = new Date(note.updatedAt);
  document.getElementById('note-date').textContent = 'Last edited ' + d.toLocaleDateString();
}

function showNotesEmpty() {
  document.getElementById('notes-empty').classList.remove('hidden');
  document.getElementById('note-editor').classList.add('hidden');
}

function saveCurrentNote() {
  if (!STATE.currentNoteId) return;
  const proj = getProject();
  const note = proj.notes.find(n => n.id === STATE.currentNoteId);
  if (!note) return;
  note.title = document.getElementById('note-title-input').value || 'Untitled';
  note.content = document.getElementById('note-content-input').value;
  note.updatedAt = Date.now();
  save();
}

let noteTimer = null;
document.getElementById('note-title-input').addEventListener('input', () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { saveCurrentNote(); renderNotesList(); }, 600);
});
document.getElementById('note-content-input').addEventListener('input', () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { saveCurrentNote(); renderNotesList(); }, 600);
});

document.getElementById('delete-note-btn').addEventListener('click', () => {
  const proj = getProject();
  const note = proj.notes.find(n => n.id === STATE.currentNoteId);
  if (!note) return;
  confirmDelete(`Delete "${note.title}"?`, 'This note will be permanently deleted.', () => {
    proj.notes = proj.notes.filter(n => n.id !== STATE.currentNoteId);
    STATE.currentNoteId = null;
    save();
    renderNotesList();
    showNotesEmpty();
  });
});

// â”€â”€â”€ FOCUS MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const focusOverlay = document.getElementById('focus-overlay');
const focusEditor = document.getElementById('focus-editor');

function applyFocusFontSize() {
  const size = STATE.settings.fontSize || 16;
  document.getElementById('focus-font-label').textContent = size + 'px';
}

document.getElementById('focus-font-down').addEventListener('click', () => {
  STATE.settings.fontSize = Math.max(12, (STATE.settings.fontSize || 16) - 2);
  applyEditorSettings();
  applyFocusFontSize();
  // Keep settings modal slider in sync if open
  const slider = document.getElementById('settings-font-size');
  if (slider) { slider.value = STATE.settings.fontSize; document.getElementById('settings-font-label').textContent = STATE.settings.fontSize + 'px'; }
  save();
});

document.getElementById('focus-font-up').addEventListener('click', () => {
  STATE.settings.fontSize = Math.min(48, (STATE.settings.fontSize || 16) + 2);
  applyEditorSettings();
  applyFocusFontSize();
  const slider = document.getElementById('settings-font-size');
  if (slider) { slider.value = STATE.settings.fontSize; document.getElementById('settings-font-label').textContent = STATE.settings.fontSize + 'px'; }
  save();
});

document.getElementById('focus-mode-btn').addEventListener('click', () => {
  if (!STATE.currentSceneId) return;
  const sc = getScene(STATE.currentChapterId, STATE.currentSceneId);
  if (!sc) return;
  focusEditor.innerHTML = sceneContentEl.innerHTML;
  focusOverlay.classList.remove('hidden');
  applyFocusFontSize();
  focusEditor.focus();
  updateFocusWC();
});

document.getElementById('exit-focus-btn').addEventListener('click', exitFocus);

function exitFocus() {
  // Sync back to main editor
  sceneContentEl.innerHTML = focusEditor.innerHTML;
  saveCurrentScene();
  updateTotalWC();
  focusOverlay.classList.add('hidden');
}

focusEditor.addEventListener('input', updateFocusWC);

function updateFocusWC() {
  document.getElementById('focus-wc').textContent = countWords(focusEditor.innerHTML) + ' words';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !focusOverlay.classList.contains('hidden')) exitFocus();
});

// â”€â”€â”€ SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function applyAiIsmSettingsFromUi() {
  const enabledEl = document.getElementById('settings-ai-isms-enabled');
  const listEl = document.getElementById('settings-ai-isms-list');
  STATE.settings.aiIsmsEnabled = !!enabledEl.checked;
  STATE.settings.aiIsmsRawText = listEl.value || '';
  STATE.settings.aiIsmsList = parseAiIsmList(STATE.settings.aiIsmsRawText);
  _aiIsmRegexCache = null;
  _aiIsmRegexCacheKey = '';
  highlightAiIsmsInElement(sceneContentEl, false);
  saveCurrentScene();
}

document.getElementById('close-settings-x').addEventListener('click', () => {
  applyAiIsmSettingsFromUi();
  document.getElementById('settings-modal').classList.add('hidden');
  save();
});

document.getElementById('close-settings-btn').addEventListener('click', () => {
  applyAiIsmSettingsFromUi();
  document.getElementById('settings-modal').classList.add('hidden');
  save();
});

document.getElementById('settings-font-size').addEventListener('input', (e) => {
  STATE.settings.fontSize = parseInt(e.target.value);
  document.getElementById('settings-font-label').textContent = e.target.value + 'px';
  applyEditorSettings();
  applyFocusFontSize();
  save();
});

document.getElementById('settings-line-spacing').addEventListener('change', (e) => {
  STATE.settings.lineHeight = parseFloat(e.target.value);
  applyEditorSettings();
  save();
});

document.getElementById('settings-chapter-font').addEventListener('change', (e) => {
  const key = e.target.value;
  STATE.settings.chapterFontKey = CHAPTER_FONT_MAP[key] ? key : 'prose';
  applyChapterFont();
  save();
});

document.getElementById('settings-context-chars').addEventListener('input', (e) => {
  STATE.settings.contextChars = parseInt(e.target.value);
  document.getElementById('settings-context-label').textContent = parseInt(e.target.value).toLocaleString() + ' chars';
  save();
});

document.getElementById('settings-ai-isms-enabled').addEventListener('change', (e) => {
  STATE.settings.aiIsmsEnabled = !!e.target.checked;
  _aiIsmRegexCache = null;
  _aiIsmRegexCacheKey = '';
  highlightAiIsmsInElement(sceneContentEl, false);
  saveCurrentScene();
  save();
});

document.getElementById('settings-ai-isms-apply').addEventListener('click', () => {
  applyAiIsmSettingsFromUi();
  save();
});

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    STATE.settings.theme = btn.dataset.theme;
    applyTheme();
  });
});

function applyEditorSettings() {
  const s = STATE.settings;
  document.documentElement.style.setProperty('--editor-font-size', s.fontSize + 'px');
  document.documentElement.style.setProperty('--editor-line-height', s.lineHeight);
  // Keep toolbar dropdown in sync
  const sel = document.getElementById('font-size-select');
  if (sel) {
    // Try to select exact match; if none exists add a temporary option
    let matched = false;
    for (let i = 0; i < sel.options.length; i++) {
      if (parseInt(sel.options[i].value) === s.fontSize) {
        sel.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Insert a one-off option for this value so the dropdown shows correctly
      const opt = document.createElement('option');
      opt.value = s.fontSize;
      opt.textContent = s.fontSize + 'px';
      // Insert in sorted order
      let inserted = false;
      for (let i = 0; i < sel.options.length; i++) {
        if (parseInt(sel.options[i].value) > s.fontSize) {
          sel.insertBefore(opt, sel.options[i]);
          inserted = true;
          break;
        }
      }
      if (!inserted) sel.appendChild(opt);
      sel.value = s.fontSize;
    }
  }
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', STATE.settings.theme);
}

// â”€â”€â”€ CONFIRM DELETE MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _confirmCallback = null;

function confirmDelete(title, message, cb) {
  _confirmCallback = cb;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

document.getElementById('confirm-cancel').addEventListener('click', () => {
  document.getElementById('confirm-modal').classList.add('hidden');
  _confirmCallback = null;
});

document.getElementById('confirm-ok').addEventListener('click', () => {
  document.getElementById('confirm-modal').classList.add('hidden');
  if (_confirmCallback) _confirmCallback();
  _confirmCallback = null;
});

// â”€â”€â”€ EXPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Dropdown toggle
document.getElementById('export-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const drop = document.getElementById('export-dropdown');
  drop.classList.toggle('hidden');
});
document.addEventListener('click', () => {
  document.getElementById('export-dropdown').classList.add('hidden');
});
document.getElementById('export-dropdown').addEventListener('click', e => e.stopPropagation());

document.getElementById('export-docx-btn').addEventListener('click', () => {
  document.getElementById('export-dropdown').classList.add('hidden');
  exportDocx();
});
document.getElementById('export-md-btn').addEventListener('click', () => {
  document.getElementById('export-dropdown').classList.add('hidden');
  exportMarkdown();
});

// â”€â”€ Pure-JS DOCX builder (no CDN required) â”€â”€

function xmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Parse HTML content into an array of paragraph descriptor objects
function parseHtmlToParagraphs(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  const paras = [];

  function extractRuns(node, bold = false, italic = false, underline = false) {
    const runs = [];
    node.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        if (n.textContent) runs.push({ text: n.textContent, bold, italic, underline });
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const t = n.tagName.toLowerCase();
        if (t === 'br') { runs.push({ text: '', br: true }); return; }
        const b = bold || t === 'b' || t === 'strong';
        const i = italic || t === 'i' || t === 'em';
        const u = underline || t === 'u';
        runs.push(...extractRuns(n, b, i, u));
      }
    });
    return runs;
  }

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.trim();
      if (t) paras.push({ type: 'normal', runs: [{ text: node.textContent }] });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'h1' || tag === 'h2') {
      paras.push({ type: 'h2', runs: [{ text: node.textContent, bold: true }] });
    } else if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
      paras.push({ type: 'h3', runs: [{ text: node.textContent, bold: true }] });
    } else if (tag === 'ul') {
      node.querySelectorAll('li').forEach(li => {
        paras.push({ type: 'bullet', runs: [{ text: li.textContent }] });
      });
    } else if (tag === 'ol') {
      node.querySelectorAll('li').forEach((li, i) => {
        paras.push({ type: 'number', num: i + 1, runs: [{ text: li.textContent }] });
      });
    } else {
      const runs = extractRuns(node);
      const text = runs.map(r => r.text).join('').trim();
      if (text) paras.push({ type: 'normal', runs });
    }
  }

  tmp.childNodes.forEach(processNode);
  return paras;
}

// Build a <w:p> XML string from a paragraph descriptor
function buildWPara(para) {
  const pStyleMap = { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', normal: 'Normal', bullet: 'Normal', number: 'Normal', center: 'Normal', title: 'Title' };
  const style = pStyleMap[para.type] || 'Normal';

  let pPr = `<w:pStyle w:val="${style}"/>`;
  if (para.type === 'center') pPr += `<w:jc w:val="center"/>`;
  if (para.spacingBefore || para.spacingAfter) {
    pPr += `<w:spacing${para.spacingBefore ? ` w:before="${para.spacingBefore}"` : ''}${para.spacingAfter ? ` w:after="${para.spacingAfter}"` : ''}/>`;
  }
  if (para.type === 'bullet') {
    pPr += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>`;
  }

  let runsXml = '';
  if (para.pageBreakBefore) {
    runsXml += `<w:r><w:rPr><w:b/></w:rPr><w:lastRenderedPageBreak/><w:br w:type="page"/></w:r>`;
  }

  (para.runs || []).forEach(run => {
    if (!run.text && !run.br) return;
    if (run.br) { runsXml += `<w:r><w:br/></w:r>`; return; }
    let rPr = '';
    if (run.bold || para.type === 'h1' || para.type === 'h2' || para.type === 'h3' || para.type === 'title') rPr += '<w:b/>';
    if (run.italic) rPr += '<w:i/>';
    if (run.underline) rPr += '<w:u w:val="single"/>';
    if (para.color) rPr += `<w:color w:val="${para.color}"/>`;
    if (para.fontSize) rPr += `<w:sz w:val="${para.fontSize}"/><w:szCs w:val="${para.fontSize}"/>`;
    const rPrXml = rPr ? `<w:rPr>${rPr}</w:rPr>` : '';
    // preserve leading/trailing spaces
    const text = run.text.replace(/\n/g, '');
    if (!text) return;
    const spaceAttr = (text !== text.trim()) ? ' xml:space="preserve"' : '';
    runsXml += `<w:r>${rPrXml}<w:t${spaceAttr}>${xmlEsc(text)}</w:t></w:r>`;
  });

  return `<w:p><w:pPr>${pPr}</w:pPr>${runsXml}</w:p>`;
}

// Build document.xml body from project
function buildDocumentXml(proj) {
  const paras = [];

  // Title page
  paras.push({ type: 'title', spacingBefore: 2880, spacingAfter: 480, runs: [{ text: proj.title, bold: true }] });
  if (proj.genre) paras.push({ type: 'center', color: '888888', fontSize: 20, spacingAfter: 240, runs: [{ text: proj.genre.toUpperCase() }] });
  if (proj.synopsis) paras.push({ type: 'center', color: '555555', spacingAfter: 480, runs: [{ text: proj.synopsis, italic: true }] });

  (proj.chapters || []).forEach((ch, chIdx) => {
    // Page break + H1 chapter title
    paras.push({ type: 'h1', pageBreakBefore: true, spacingBefore: 480, spacingAfter: 360, runs: [{ text: ch.title || `Chapter ${chIdx + 1}`, bold: true }] });

    (ch.scenes || []).forEach((sc, scIdx) => {
      // Scene title as H2 if it has a real name
      const isDefaultTitle = /^scene\s+\d+$/i.test(sc.title || '');
      if (sc.title && !isDefaultTitle) {
        paras.push({ type: 'h2', spacingBefore: 360, spacingAfter: 180, runs: [{ text: sc.title, bold: true }] });
      }

      // Scene content
      const sceneParas = parseHtmlToParagraphs(sc.content || '');
      paras.push(...sceneParas);

      // Scene break
      if (scIdx < (ch.scenes || []).length - 1) {
        paras.push({ type: 'center', color: 'AAAAAA', spacingBefore: 360, spacingAfter: 360, runs: [{ text: '* * *' }] });
      }
    });
  });

  const body = paras.map(buildWPara).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
  xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"
  xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"
  xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"
  xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash"
  xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh wp14">
  <w:body>
${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:after="160" w:line="360" w:lineRule="auto"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="2880" w:after="480"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="480" w:after="240"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/><w:color w:val="1a1a1a"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="360" w:after="180"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="333333"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="2"/><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="555555"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="720"/></w:pPr>
  </w:style>
</w:styles>`;
}

function buildNumberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="â€¢"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;
}

// Tiny ZIP builder â€” no external deps
// Produces a valid ZIP/docx binary using Uint8Array + CRC32
function buildDocxZip(files) {
  // files: [{name, data (string or Uint8Array)}]
  function strToBytes(str) {
    return new TextEncoder().encode(str);
  }
  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function u16le(n) { return [(n & 0xFF), ((n >> 8) & 0xFF)]; }
  function u32le(n) { return [(n & 0xFF), ((n >> 8) & 0xFF), ((n >> 16) & 0xFF), ((n >> 24) & 0xFF)]; }

  const entries = files.map(f => {
    const data = typeof f.data === 'string' ? strToBytes(f.data) : f.data;
    const name = strToBytes(f.name);
    const crc  = crc32(data);
    return { name, data, crc, size: data.length };
  });

  const parts = [];
  const centralDir = [];
  let offset = 0;

  entries.forEach(e => {
    const localHeader = new Uint8Array([
      0x50,0x4B,0x03,0x04,       // sig
      20,0,                       // version needed
      0,0,                        // flags
      0,0,                        // compression = stored
      0,0,0,0,                    // mod time/date
      ...u32le(e.crc),
      ...u32le(e.size),
      ...u32le(e.size),
      ...u16le(e.name.length),
      0,0,                        // extra len
    ]);
    parts.push(localHeader, e.name, e.data);

    centralDir.push({ offset, e });
    offset += localHeader.length + e.name.length + e.size;
  });

  const cdParts = [];
  let cdSize = 0;
  centralDir.forEach(({ offset: off, e }) => {
    const cd = new Uint8Array([
      0x50,0x4B,0x01,0x02,        // sig
      20,0,                        // version made
      20,0,                        // version needed
      0,0,                         // flags
      0,0,                         // compression
      0,0,0,0,                     // mod time/date
      ...u32le(e.crc),
      ...u32le(e.size),
      ...u32le(e.size),
      ...u16le(e.name.length),
      0,0,                         // extra len
      0,0,                         // comment len
      0,0,                         // disk start
      0,0,                         // internal attr
      0,0,0,0,                     // external attr
      ...u32le(off),
    ]);
    cdParts.push(cd, e.name);
    cdSize += cd.length + e.name.length;
  });

  const eocd = new Uint8Array([
    0x50,0x4B,0x05,0x06,           // sig
    0,0,0,0,                        // disk numbers
    ...u16le(entries.length),
    ...u16le(entries.length),
    ...u32le(cdSize),
    ...u32le(offset),
    0,0,                            // comment length
  ]);

  const allParts = [...parts, ...cdParts, eocd];
  const total = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  allParts.forEach(p => { out.set(p, pos); pos += p.length; });
  return out;
}

// â”€â”€ DOCX Export â”€â”€

function exportDocx() {
  const proj = getProject();
  if (!proj) return;

  const documentXml = buildDocumentXml(proj);
  const stylesXml   = buildStylesXml();
  const numberingXml = buildNumberingXml();

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

  const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const relsWord = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;

  const files = [
    { name: '[Content_Types].xml',       data: contentTypes },
    { name: '_rels/.rels',               data: relsRoot },
    { name: 'word/_rels/document.xml.rels', data: relsWord },
    { name: 'word/document.xml',         data: documentXml },
    { name: 'word/styles.xml',           data: stylesXml },
    { name: 'word/numbering.xml',        data: numberingXml },
    { name: 'word/settings.xml',         data: settingsXml },
  ];

  const zipBytes = buildDocxZip(files);
  const blob = new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const slug = proj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// â”€â”€ Markdown Export â”€â”€

function htmlToMarkdown(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  let md = '';

  const walkNode = (node, context = {}) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(n => walkNode(n, context)).join('');
    switch (tag) {
      case 'b': case 'strong': return `**${inner}**`;
      case 'i': case 'em':    return `*${inner}*`;
      case 'u':               return `__${inner}__`;
      case 'h1': case 'h2':  return `\n## ${inner}\n`;
      case 'h3': case 'h4':  return `\n### ${inner}\n`;
      case 'br':              return '\n';
      case 'p':               return `\n${inner}\n`;
      case 'ul':              return '\n' + Array.from(node.querySelectorAll('li')).map(li => `- ${li.textContent}`).join('\n') + '\n';
      case 'ol':              return '\n' + Array.from(node.querySelectorAll('li')).map((li, i) => `${i+1}. ${li.textContent}`).join('\n') + '\n';
      case 'li':              return '';  // handled by ul/ol
      default:                return inner;
    }
  };

  tmp.childNodes.forEach(node => { md += walkNode(node); });
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

function exportMarkdown() {
  const proj = getProject();
  if (!proj) return;

  let md = '';

  // Title block
  md += `# ${proj.title}\n\n`;
  if (proj.genre) md += `*${proj.genre}*\n\n`;
  if (proj.synopsis) md += `> ${proj.synopsis}\n\n`;
  md += `---\n\n`;

  (proj.chapters || []).forEach((ch, chIdx) => {
    // Chapter as H1
    md += `# ${ch.title || `Chapter ${chIdx + 1}`}\n\n`;

    (ch.scenes || []).forEach((sc, scIdx) => {
      const isDefaultTitle = /^scene\s+\d+$/i.test(sc.title || '');
      if (sc.title && !isDefaultTitle) {
        md += `## ${sc.title}\n\n`;
      }

      const content = htmlToMarkdown(sc.content || '');
      if (content) md += content + '\n\n';

      // Scene break between scenes
      if (scIdx < ch.scenes.length - 1) {
        md += `---\n\n`;
      }
    });

    md += '\n';
  });

  const slug = proj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// â”€â”€â”€ BACKUP & RESTORE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BACKUP_VERSION = 1;

function buildBackupPayload(projectIds) {
  const projects = projectIds
    ? STATE.projects.filter(p => projectIds.includes(p.id))
    : STATE.projects;
  return {
    version: BACKUP_VERSION,
    app: 'Story Forge',
    exportedAt: new Date().toISOString(),
    projectCount: projects.length,
    projects,
  };
}

function triggerDownload(filename, json) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportAllProjects() {
  const payload = buildBackupPayload(null);
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(`storyforge-backup-${date}.storyforge`, JSON.stringify(payload, null, 2));
  showBackupStatus(`âœ“ Exported ${payload.projectCount} project${payload.projectCount !== 1 ? 's' : ''} successfully.`, 'success');
}

function exportProject(projId) {
  const proj = STATE.projects.find(p => p.id === projId);
  if (!proj) return;
  const payload = buildBackupPayload([projId]);
  const slug = proj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(`storyforge-${slug}-${date}.storyforge`, JSON.stringify(payload, null, 2));
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Accept both full backup format and raw project array
      let incoming = [];
      if (data.app === 'Story Forge' && Array.isArray(data.projects)) {
        incoming = data.projects;
      } else if (Array.isArray(data)) {
        incoming = data;
      } else if (data.id && data.chapters) {
        // Single bare project object
        incoming = [data];
      } else {
        throw new Error('Unrecognised file format. Expected a Story Forge backup file.');
      }

      if (incoming.length === 0) {
        showBackupStatus('âš  No projects found in file.', 'error');
        return;
      }

      let added = 0, updated = 0;
      incoming.forEach(proj => {
        if (!proj.id || !proj.title) return;
        const existing = STATE.projects.findIndex(p => p.id === proj.id);
        if (existing >= 0) {
          STATE.projects[existing] = proj;
          updated++;
        } else {
          STATE.projects.unshift(proj);
          added++;
        }
      });

      save();
      renderProjects();

      const parts = [];
      if (added)   parts.push(`${added} project${added !== 1 ? 's' : ''} imported`);
      if (updated) parts.push(`${updated} project${updated !== 1 ? 's' : ''} updated`);
      showBackupStatus(`âœ“ ${parts.join(', ')}.`, 'success');
    } catch (err) {
      showBackupStatus(`âœ— Import failed: ${err.message}`, 'error');
    }
  };
  reader.onerror = () => showBackupStatus('âœ— Could not read file.', 'error');
  reader.readAsText(file);
}

function showBackupStatus(msg, type) {
  const el = document.getElementById('backup-status');
  el.textContent = msg;
  el.className = `backup-status ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 5000);
}

// Wire up settings buttons
document.getElementById('export-all-btn').addEventListener('click', exportAllProjects);

document.getElementById('import-trigger-btn').addEventListener('click', () => {
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importBackup(file);
});

document.getElementById('close-settings-btn-2').addEventListener('click', () => {
  applyAiIsmSettingsFromUi();
  document.getElementById('settings-modal').classList.add('hidden');
  save();
});

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function flashSave(btn) {
  const orig = btn.textContent;
  btn.textContent = '✓ Saved';
  btn.style.background = 'linear-gradient(135deg, #3a7a3a, #5a9a5a)';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = '';
  }, 1500);
}

// â”€â”€â”€ DEMO DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function seedDemoProject() {
  const proj = {
    id: genId(),
    title: 'The Ember Chronicles',
    genre: 'Fantasy',
    synopsis: 'A young archivist discovers the last ember of a dying magic, hunted by those who would extinguish it forever.',
    chapters: [
      {
        id: genId(),
        title: 'Chapter 1 â€” The Archive',
        scenes: [
          {
            id: genId(),
            title: 'The Dusty Vaults',
            content: '<p>The archive breathed with the slow patience of old things. Mira moved between shelves taller than memory, her lantern casting amber pools across spines that had not been touched in generations.</p><p>She paused at the forbidden wing â€” the iron door ajar, just barely, as though inviting only those who would dare.</p>',
            povCharacterId: '',
          },
          {
            id: genId(),
            title: 'The Discovery',
            content: '<p>The ember sat in a cracked reliquary, no larger than a sparrow\'s egg. It pulsed with a warmth that had no business existing in a place this cold.</p>',
            povCharacterId: '',
          }
        ]
      },
      {
        id: genId(),
        title: 'Chapter 2 â€” The Hunters',
        scenes: [
          {
            id: genId(),
            title: 'Midnight Visitors',
            content: '<p>They came at the hour when even the archive\'s shadows seemed to hold their breath.</p>',
            povCharacterId: '',
          }
        ]
      }
    ],
    codex: [
      { id: genId(), category: 'Characters', name: 'Mira Ashvale', description: 'A young archivist with an eidetic memory and a talent for finding things that do not wish to be found.', role: 'Protagonist', notes: 'Has a fear of fire, ironic given her quest.' },
      { id: genId(), category: 'Characters', name: 'The Warden', description: 'An ageless figure of indeterminate allegiance who guards the archive\'s deepest secrets.', role: 'Mysterious Ally', notes: 'May not be entirely human.' },
      { id: genId(), category: 'Locations', name: 'The Athenaeum', description: 'A vast underground archive carved into the bones of a mountain. Houses forbidden knowledge from seven collapsed civilizations.', role: '', notes: 'The shelves rearrange themselves at night.' },
    ],
    notes: [
      { id: genId(), title: 'Magic System Notes', content: 'Ember magic is thermodynamic â€” it borrows heat from living things. Extended use leaves the user cold, eventually permanently.', updatedAt: Date.now() - 86400000 },
    ],
    beats: [
      { id: genId(), text: 'Mira discovers the ember while cataloguing forbidden texts' },
      { id: genId(), text: 'The Hunters arrive â€” someone knows she found it' },
      { id: genId(), text: 'Mira must flee the archive she has called home her whole life' },
    ],
    createdAt: Date.now(),
  };
  STATE.projects.push(proj);
}

// â”€â”€â”€ OPENROUTER & AI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const AI = {
  models: [],           // full list from OpenRouter
  filteredModels: [],   // after search filter
  conversation: [],     // [{role, content}]
  currentMode: 'continue',
  isStreaming: false,
  wordTarget: 400,      // target word count for generation
  temperature: 1.0,     // generation temperature
};

const AI_MODE_META = {
  novel: {
    continue: 'Continue',
    brainstorm: 'Brainstorm',
    rewrite: 'Rewrite',
    compliance: 'Check',
    chat: 'Chat',
  },
  short_story: {
    continue: 'Draft Part',
    brainstorm: 'Plan Arc',
    rewrite: 'Revise Part',
    compliance: 'Check Rules',
    chat: 'Coach',
  },
};

function buildShortStoryModePrompt(partCount) {
  const span = shortStoryPartSpanLabel(partCount);
  return [
    'SHORT STORY MODE:',
    `Write exactly one part at a time for a ${partCount}-part short story.`,
    `Label the parts ${span}.`,
    'After completing a drafted part, print exactly: "Shall I continue with the next part?" and stop.',
    'Use scene breaks only when time, location, or point-of-view changes, formatted as: -****-',
    'Do not open Part 1 by naming or directly referencing a town, village, city, hamlet, or geographic location.',
    `Print "The End" only after the final line of Part ${partCount}.`,
    'Blend psychological and supernatural horror with controlled, precise lyricism.',
    'Show emotion through sensory detail and action rather than direct emotional labeling.',
    'Vary sentence lengths, avoid cliches, keep metaphors lean, and do not use em dashes.',
    `Build tension progressively across all ${partCount} parts, with Part ${partCount} containing the peak.`,
  ].join('\n');
}

// â”€â”€ API Key management â”€â”€

function getApiKey() { return STATE.settings.openrouterKey || ''; }

document.getElementById('settings-key-toggle').addEventListener('click', () => {
  const inp = document.getElementById('settings-api-key');
  const btn = document.getElementById('settings-key-toggle');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'Hide'; }
  else { inp.type = 'password'; btn.textContent = 'Show'; }
});

document.getElementById('settings-api-key').addEventListener('input', (e) => {
  STATE.settings.openrouterKey = e.target.value.trim();
  save();
  if (STATE.settings.openrouterKey.length > 20) fetchModels();
});

// â”€â”€ Fetch models from OpenRouter â”€â”€

async function fetchModels() {
  const loadingEl = document.getElementById('model-list-loading');
  const listEl = document.getElementById('model-list');
  loadingEl.textContent = 'Loading models…';
  loadingEl.style.display = 'block';
  listEl.innerHTML = '';

  try {
    let models;
    if (desktop) {
      models = await desktop.ai.models({
        apiKey: getApiKey(),
        referer: window.location.href,
        appTitle: 'Story Forge'
      });
    } else {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${getApiKey()}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      models = data.data || [];
    }

    // Sort: free first, then by name
    AI.models = models.sort((a, b) => {
      const aFree = isFree(a);
      const bFree = isFree(b);
      if (aFree && !bFree) return -1;
      if (!aFree && bFree) return 1;
      return (a.name || a.id).localeCompare(b.name || b.id);
    });

    loadingEl.style.display = 'none';
    filterAndRenderModels('');
  } catch (err) {
    loadingEl.textContent = 'Failed to load models: ' + err.message;
  }
}

function isFree(model) {
  const p = model.pricing;
  if (!p) return false;
  return (parseFloat(p.prompt) === 0 && parseFloat(p.completion) === 0);
}

function fmtCtx(n) {
  if (!n) return '';
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n;
}

function filterAndRenderModels(query) {
  const q = query.toLowerCase();
  AI.filteredModels = q
    ? AI.models.filter(m => (m.name || '').toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
    : AI.models;
  renderModelList();
}

function renderModelList() {
  const listEl = document.getElementById('model-list');
  listEl.innerHTML = '';
  AI.filteredModels.forEach(model => {
    const free = isFree(model);
    const selected = model.id === (STATE.settings.selectedModel || '');
    const div = document.createElement('div');
    div.className = 'model-item' + (selected ? ' selected' : '');
    div.innerHTML = `
      <div class="model-item-info">
        <div class="model-item-name">${esc(model.name || model.id)}</div>
        <div class="model-item-id">${esc(model.id)}</div>
      </div>
      <div class="model-item-badges">
        ${free ? '<span class="badge badge-free">FREE</span>' : ''}
        ${model.context_length ? `<span class="badge badge-ctx">${fmtCtx(model.context_length)}</span>` : ''}
      </div>`;
    div.addEventListener('click', () => {
      STATE.settings.selectedModel = model.id;
      save();
      renderModelList();
      updateSelectedModelDisplay();
      updateAIModelLabel();
    });
    listEl.appendChild(div);
  });
  if (AI.filteredModels.length === 0) {
    listEl.innerHTML = '<div class="model-list-loading">No models match your search.</div>';
  }
}

function updateSelectedModelDisplay() {
  const el = document.getElementById('selected-model-display');
  const modelId = STATE.settings.selectedModel;
  if (!modelId) { el.textContent = 'No model selected'; return; }
  const model = AI.models.find(m => m.id === modelId);
  el.textContent = '✓ ' + (model ? (model.name || modelId) : modelId);
}

document.getElementById('model-search-input').addEventListener('input', (e) => {
  filterAndRenderModels(e.target.value);
});

// â”€â”€ AI Panel open/close â”€â”€

document.getElementById('ai-assistant-btn').addEventListener('click', toggleAIPanel);
document.getElementById('ai-panel-close').addEventListener('click', closeAIPanel);
document.getElementById('ai-change-model-btn').addEventListener('click', () => {
  closeAIPanel();
  document.getElementById('settings-modal').classList.remove('hidden');
  populateSettingsModal();
});

function toggleAIPanel() {
  const panel = document.getElementById('ai-panel');
  if (panel.classList.contains('hidden')) openAIPanel();
  else closeAIPanel();
}

function openAIPanel() {
  document.getElementById('ai-panel').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('ai-open');
  updateAIContextBar();
  updateAIModelLabel();
}

function closeAIPanel() {
  document.getElementById('ai-panel').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('ai-open');
}

function updateAIModelLabel() {
  const modelId = STATE.settings.selectedModel || '';
  const model = AI.models.find(m => m.id === modelId);
  const label = model ? (model.name || modelId) : (modelId || 'No model selected');
  document.getElementById('ai-current-model-label').textContent = label;
}

function updateAIContextBar() {
  const label = document.getElementById('ai-context-label');
  const proj = getProject();
  if (proj?.storyType === 'short_story' && !STATE.currentSceneId && !STATE.currentChapterId) {
    label.textContent = 'Short story mode active, ready for part-by-part drafting';
  } else if (STATE.currentSceneId) {
    const sc = getScene(STATE.currentChapterId, STATE.currentSceneId);
    const ch = getChapter(STATE.currentChapterId);
    label.textContent = (ch ? ch.title : 'Chapter') + ' › ' + (sc ? sc.title : 'Scene');
  } else if (STATE.currentChapterId) {
    const ch = getChapter(STATE.currentChapterId);
    label.textContent = ch ? ch.title : 'Chapter selected';
  } else {
    label.textContent = 'No scene selected — open a scene for context';
  }
}

// â”€â”€ AI Mode switching â”€â”€

document.querySelectorAll('.ai-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ai-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    AI.currentMode = btn.dataset.mode;
    updateQuickBtns();
    updateAIModeUI();
  });
});

// â”€â”€ Word Target Buttons â”€â”€
document.querySelectorAll('.ai-wt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const customInput = document.getElementById('ai-wt-custom-input');
    if (btn.dataset.words === 'custom') {
      // Toggle custom input
      const isOpen = !customInput.classList.contains('hidden');
      if (isOpen) {
        customInput.classList.add('hidden');
        // Restore whichever preset was last active (or default 100)
        const prev = [...document.querySelectorAll('.ai-wt-btn[data-words]')]
          .find(b => b.dataset.words !== 'custom' && parseInt(b.dataset.words) === AI.wordTarget);
        document.querySelectorAll('.ai-wt-btn').forEach(b => b.classList.remove('active'));
        if (prev) prev.classList.add('active'); else btn.classList.add('active');
      } else {
        document.querySelectorAll('.ai-wt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        customInput.classList.remove('hidden');
        customInput.value = AI.wordTarget;
        customInput.focus();
        customInput.select();
      }
      return;
    }
    // Preset button
    document.querySelectorAll('.ai-wt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    customInput.classList.add('hidden');
    AI.wordTarget = parseInt(btn.dataset.words);
    saveAISettings();
  });
});

document.getElementById('ai-wt-custom-input').addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  if (val >= 50 && val <= 4000) { AI.wordTarget = val; saveAISettings(); }
});
document.getElementById('ai-wt-custom-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.target.blur();
    const val = parseInt(e.target.value);
    if (val >= 50 && val <= 4000) {
      AI.wordTarget = val;
      e.target.classList.add('hidden');
      // Deactivate all preset btns, keep custom btn active
      document.querySelectorAll('.ai-wt-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.words === 'custom');
      });
      saveAISettings();
    }
  }
});

// â”€â”€ Temperature slider â”€â”€
function tempHint(t) {
  if (t <= 0.3) return 'Precise';
  if (t <= 0.7) return 'Focused';
  if (t <= 1.1) return 'Balanced';
  if (t <= 1.5) return 'Creative';
  return 'Wild';
}

document.getElementById('ai-temp-slider').addEventListener('input', (e) => {
  AI.temperature = parseFloat(e.target.value);
  document.getElementById('ai-temp-label').textContent = AI.temperature.toFixed(1);
  document.getElementById('ai-temp-hint').textContent = tempHint(AI.temperature);
  saveAISettings();
});

// Persist AI word target + temperature on the current project
function saveAISettings() {
  const proj = getProject();
  if (!proj) return;
  proj.aiWordTarget  = AI.wordTarget;
  proj.aiTemperature = AI.temperature;
  save();
}

// Load AI settings from project when switching projects
function loadAISettings() {
  const proj = getProject();
  const isShortStory = proj?.storyType === 'short_story';

  // Default word target differs by type
  const defaultTarget = isShortStory ? 150 : 400;
  const wordTarget  = proj?.aiWordTarget  ?? defaultTarget;
  const temperature = proj?.aiTemperature ?? 1.0;

  AI.wordTarget  = wordTarget;
  AI.temperature = temperature;

  // Swap preset buttons for short story mode
  const btnsWrap = document.querySelector('.ai-word-target-btns');
  btnsWrap.innerHTML = isShortStory
    ? `<button class="ai-wt-btn" data-words="50">50</button>
       <button class="ai-wt-btn" data-words="100">100</button>
       <button class="ai-wt-btn active" data-words="150">150</button>
       <button class="ai-wt-btn" data-words="200">200</button>
       <button class="ai-wt-btn" data-words="custom">✎</button>`
    : `<button class="ai-wt-btn" data-words="100">100</button>
       <button class="ai-wt-btn" data-words="200">200</button>
       <button class="ai-wt-btn active" data-words="400">400</button>
       <button class="ai-wt-btn" data-words="600">600</button>
       <button class="ai-wt-btn" data-words="custom">✎</button>`;

  // Re-attach click handlers to new buttons
  btnsWrap.querySelectorAll('.ai-wt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const customInput = document.getElementById('ai-wt-custom-input');
      if (btn.dataset.words === 'custom') {
        const isOpen = !customInput.classList.contains('hidden');
        if (isOpen) {
          customInput.classList.add('hidden');
          const prev = [...btnsWrap.querySelectorAll('.ai-wt-btn[data-words]')]
            .find(b => b.dataset.words !== 'custom' && parseInt(b.dataset.words) === AI.wordTarget);
          btnsWrap.querySelectorAll('.ai-wt-btn').forEach(b => b.classList.remove('active'));
          if (prev) prev.classList.add('active'); else btn.classList.add('active');
        } else {
          btnsWrap.querySelectorAll('.ai-wt-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          customInput.classList.remove('hidden');
          customInput.value = AI.wordTarget;
          customInput.focus();
          customInput.select();
        }
        return;
      }
      btnsWrap.querySelectorAll('.ai-wt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('ai-wt-custom-input').classList.add('hidden');
      AI.wordTarget = parseInt(btn.dataset.words);
      saveAISettings();
    });
  });

  // Sync active button to saved word target
  const customInput = document.getElementById('ai-wt-custom-input');
  const preset = [...btnsWrap.querySelectorAll('.ai-wt-btn')]
    .find(b => b.dataset.words !== 'custom' && parseInt(b.dataset.words) === wordTarget);
  btnsWrap.querySelectorAll('.ai-wt-btn').forEach(b => b.classList.remove('active'));
  customInput.classList.add('hidden');
  if (preset) {
    preset.classList.add('active');
  } else {
    btnsWrap.querySelector('.ai-wt-btn[data-words="custom"]').classList.add('active');
    customInput.classList.remove('hidden');
    customInput.value = wordTarget;
  }

  // Sync temperature slider
  const slider = document.getElementById('ai-temp-slider');
  slider.value = temperature;
  document.getElementById('ai-temp-label').textContent = temperature.toFixed(1);
  document.getElementById('ai-temp-hint').textContent = tempHint(temperature);
  updateAIModeUI();
  updateQuickBtns();
  updateAIContextBar();
}

const QUICK_BTNS = {
  continue: [
    { label: '▶ Auto-continue', prompt: 'Continue this scene naturally, matching the established tone, voice, and style.' },
    { label: '🔀 Suggest paths', prompt: 'Suggest 3 different directions this scene could go next, each with a brief description.' },
    { label: '🌅 Expand setting', prompt: 'Expand the current setting with more vivid sensory detail — sight, sound, smell, touch.' },
  ],
  brainstorm: [
    { label: '💡 Scene ideas', prompt: 'Give me 5 creative scene ideas that could follow what I\'ve written, with varying tones.' },
    { label: '⚡ Add conflict', prompt: 'Suggest 3 ways to add tension or conflict to this scene without it feeling forced.' },
    { label: '🎭 Character momentŸŽ­ Character moment', prompt: 'Suggest a character-revealing moment or piece of dialogue that would fit naturally here.' },
  ],
  rewrite: [
    { label: 'âœ¨ More vivid', prompt: 'Rewrite the last paragraph of my scene with more vivid, sensory language.' },
    { label: 'âš¡ More tension', prompt: 'Rewrite the scene opening with more tension and urgency.' },
    { label: 'ðŸŽ¯ Tighten prose', prompt: 'Identify any weak, redundant, or overly wordy sentences in my scene and suggest tighter rewrites.' },
  ],
  chat: [
    { label: 'ðŸ“– Analyze scene', prompt: 'Analyze this scene\'s strengths and weaknesses as a writing coach would.' },
    { label: 'ðŸ§  Story advice', prompt: 'What narrative techniques would most improve this scene?' },
    { label: 'âœï¸ Write in style', prompt: 'What is the distinctive style of this writing, and how can I deepen it?' },
  ],
};

function updateQuickBtns() {
  const container = document.querySelector('.ai-quick-btns');
  container.innerHTML = '';
  (QUICK_BTNS[AI.currentMode] || []).forEach(({ label, prompt }) => {
    const btn = document.createElement('button');
    btn.className = 'ai-quick-btn';
    btn.textContent = label;
    btn.dataset.prompt = prompt;
    btn.addEventListener('click', () => {
      document.getElementById('ai-prompt-input').value = prompt;
      sendAIMessage();
    });
    container.appendChild(btn);
  });
}

function buildShortStoryQuickBtns(partCount) {
  return {
    continue: [
      { label: 'Draft Part 1', prompt: 'Draft Part 1 of this short story. Follow the short story instructions exactly, reveal one concrete backstory detail through action or dialogue, and stop after Part 1 with "Shall I continue with the next part?"' },
      { label: 'Draft next part', prompt: 'Draft the next numbered part of this short story only. Raise the tension from where the last part ended, follow the style rules exactly, and stop with "Shall I continue with the next part?"' },
      { label: 'Sharpen ending', prompt: `Draft or revise the ending portion of the current part so the tension rises cleanly toward Part ${partCount} without feeling rushed or overwritten.` },
    ],
    brainstorm: [
      { label: `Plan ${partCount}-part arc`, prompt: `Plan this short story as a ${partCount}-part arc. For each part, give the main dramatic move, the key transformation, and how tension rises.` },
      { label: 'Map tension rise', prompt: `Map how tension should escalate across ${shortStoryPartSpanLabel(partCount)}, with a concrete turning point for each part.` },
      { label: 'Suggest 3 directions', prompt: 'Suggest 3 different directions the next part could take while preserving the current tone, constraints, and transformation theme.' },
    ],
    rewrite: [
      { label: 'Revise to match rules', prompt: 'Revise this part so it better matches the short story instructions: lean prose, no cliches, no em dashes, stronger sensory detail, and sharper tension.' },
      { label: 'Make prose leaner', prompt: 'Tighten this part into more restrained, vivid prose. Cut filler, adverbs, and generic phrasing without losing atmosphere.' },
      { label: 'Add sensory detail', prompt: 'Revise this part to deepen atmosphere through specific sensory details and action, without purple prose.' },
    ],
    compliance: [
      { label: 'Check rule compliance', prompt: 'Audit the current part against the short story instructions. List any violations or weak spots under Structure, Style, Tension, and Process. Be specific.' },
      { label: 'Check no em dashes', prompt: 'Check this part for em dashes, cliches, direct emotional labeling, and overlong metaphors. Quote only the offending phrases and suggest replacements.' },
      { label: 'Check part structure', prompt: `Check whether this part is correctly labeled, uses scene breaks only when needed, escalates tension, and lands correctly in a ${partCount}-part story.` },
    ],
    chat: [
      { label: 'Story coach', prompt: 'Coach me on this short story part. Focus on pacing, dread, transformation, and whether the prose feels controlled instead of overwritten.' },
      { label: 'Author restraint', prompt: 'Explain where this part leans too ornate or too flat, and how to move it toward precise, restrained lyricism.' },
      { label: 'Strengthen tension', prompt: 'Explain how to strengthen suspense and unease in this part without relying on cliches or direct emotional labeling.' },
    ],
  };
}

function updateAIModeUI() {
  const proj = getProject();
  const variant = proj?.storyType === 'short_story' ? 'short_story' : 'novel';
  const labels = AI_MODE_META[variant];
  document.querySelectorAll('.ai-mode-btn').forEach(btn => {
    btn.textContent = labels[btn.dataset.mode] || btn.dataset.mode;
  });

  const banner = document.getElementById('ai-mode-banner');
  const bannerCopy = document.getElementById('ai-mode-banner-copy');
  if (variant === 'short_story') {
    banner.classList.remove('hidden');
    bannerCopy.textContent = 'A number of labeled parts, one part at a time, with revision and rule-check tools built in.';
  } else {
    banner.classList.add('hidden');
  }
}

function updateQuickBtns() {
  const container = document.querySelector('.ai-quick-btns');
  const proj = getProject();
  const isShortStory = proj?.storyType === 'short_story';
  const ssPartCount = getShortStoryPartCount(proj);
  const buttonSet = isShortStory ? buildShortStoryQuickBtns(ssPartCount) : {
    continue: [
      { label: 'Auto-continue', prompt: 'Continue this scene naturally, matching the established tone, voice, and style.' },
      { label: 'Suggest paths', prompt: 'Suggest 3 different directions this scene could go next, each with a brief description.' },
      { label: 'Expand setting', prompt: 'Expand the current setting with more vivid sensory detail using sight, sound, smell, and touch.' },
    ],
    brainstorm: [
      { label: 'Scene ideas', prompt: 'Give me 5 creative scene ideas that could follow what I\'ve written, with varying tones.' },
      { label: 'Add conflict', prompt: 'Suggest 3 ways to add tension or conflict to this scene without it feeling forced.' },
      { label: 'Character moment', prompt: 'Suggest a character-revealing moment or piece of dialogue that would fit naturally here.' },
    ],
    rewrite: [
      { label: 'More vivid', prompt: 'Rewrite the last paragraph of my scene with more vivid, sensory language.' },
      { label: 'More tension', prompt: 'Rewrite the scene opening with more tension and urgency.' },
      { label: 'Tighten prose', prompt: 'Identify any weak, redundant, or overly wordy sentences in my scene and suggest tighter rewrites.' },
    ],
    compliance: [
      { label: 'Check compliance', prompt: 'Check the current writing against its structural and style constraints. Flag violations and suggest targeted fixes.' },
      { label: 'Find weak spots', prompt: 'Identify the 3 biggest craft or structure issues in the current writing and explain how to fix them.' },
      { label: 'Check formatting', prompt: 'Check formatting, labeling, and structural consistency only. Do not rewrite unless needed to demonstrate a fix.' },
    ],
    chat: [
      { label: 'Analyze scene', prompt: 'Analyze this scene\'s strengths and weaknesses as a writing coach would.' },
      { label: 'Story advice', prompt: 'What narrative techniques would most improve this scene?' },
      { label: 'Write in style', prompt: 'What is the distinctive style of this writing, and how can I deepen it?' },
    ],
  };
  container.innerHTML = '';
  (buttonSet[AI.currentMode] || []).forEach(({ label, prompt }) => {
    const btn = document.createElement('button');
    btn.className = 'ai-quick-btn';
    btn.textContent = label;
    btn.dataset.prompt = prompt;
    btn.addEventListener('click', () => {
      document.getElementById('ai-prompt-input').value = prompt;
      sendAIMessage();
    });
    container.appendChild(btn);
  });
}

// Bind quick btns from HTML (initial)
document.querySelectorAll('.ai-quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('ai-prompt-input').value = btn.dataset.prompt;
    sendAIMessage();
  });
});

// â”€â”€ Send message â”€â”€

document.getElementById('ai-send-btn').addEventListener('click', sendAIMessage);
document.getElementById('ai-prompt-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendAIMessage(); }
});

async function sendAIMessage() {
  const inp = document.getElementById('ai-prompt-input');
  const userText = inp.value.trim();
  if (!userText || AI.isStreaming) return;

  // Short story hard cap â€” block generation if at or over limit
  const proj = getProject();
  if (proj?.storyType === 'short_story') {
    const ssMax = proj.ssMax ?? 2500;
    const wc = projectWordCount(proj);
    if (wc >= ssMax) {
      showAIError(`This short story has reached the ${ssMax.toLocaleString()}-word limit (${wc.toLocaleString()} words). Edit or trim existing content to continue.`);
      return;
    }
    // Clamp word target to remaining budget
    const remaining = ssMax - wc;
    if (AI.wordTarget > remaining) {
      AI.wordTarget = Math.max(50, remaining);
    }
  }

  const apiKey = getApiKey();
  if (!apiKey) {
      showAIError('No API key set. Open ⚙ Settings and add your OpenRouter API key.');
    return;
  }
  const modelId = STATE.settings.selectedModel;
  if (!modelId) {
    showAIError('No model selected. Open ⚙ Settings → AI to choose a model.');
    return;
  }

  inp.value = '';
  document.getElementById('ai-welcome').style.display = 'none';

  // Add user message
  appendAIMessage('user', userText);
  AI.conversation.push({ role: 'user', content: userText });

  // Build system prompt based on mode + context
  const systemPrompt = buildSystemPrompt();

  // Start streaming
  setAIStreaming(true);
  const assistantEl = appendAIMessage('assistant', '', true);
  let fullResponse = '';

  try {
    const historyForAPI = AI.conversation.slice(-12);
    const bubble = assistantEl.querySelector('.ai-msg-bubble');
    bubble.classList.add('ai-streaming');
    fullResponse = await requestAIResponse({
      apiKey,
      modelId,
      systemPrompt,
      historyForAPI,
      maxTokens: Math.min(8000, Math.max(400, Math.round(AI.wordTarget * 1.8 * 1.3))),
      temperature: AI.temperature,
    });
    bubble.textContent = fullResponse;
    scrollAIToBottom();

    bubble.classList.remove('ai-streaming');
    // Render final response as formatted HTML
    bubble.innerHTML = markdownToHtml(fullResponse);
    if (['continue', 'rewrite'].includes(AI.currentMode)) {
      const actionsEl = assistantEl.querySelector('.ai-msg-actions');
      actionsEl.innerHTML = `
        <button class="ai-msg-action" title="Insert at cursor in scene">✦ Insert into scene</button>
        <button class="ai-msg-action" title="Copy to clipboard">📋 Copy</button>`;
      actionsEl.querySelector('[title="Insert at cursor in scene"]').addEventListener('click', () => insertTextIntoScene(fullResponse));
      actionsEl.querySelector('[title="Copy to clipboard"]').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        copyToClipboard(fullResponse, btn);
      });
    }

  } catch (err) {
    assistantEl.remove();
    showAIError('Error: ' + err.message);
    AI.conversation.pop(); // remove the user message we added
  } finally {
    if (fullResponse) AI.conversation.push({ role: 'assistant', content: fullResponse });
    setAIStreaming(false);
  }
}

async function requestAIResponse({ apiKey, modelId, systemPrompt, historyForAPI, maxTokens, temperature }) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyForAPI,
  ];

  try {
    return desktop
      ? await desktop.ai.chat({
          model: modelId,
          messages,
          temperature,
          settings: {
            apiKey,
            referer: window.location.href,
            appTitle: 'Story Forge'
          }
        })
      : await requestAIResponseBrowser({ apiKey, modelId, messages, maxTokens, temperature });
  } catch (error) {
    if (!shouldRetryWithoutSystem(error)) throw error;
    const compatibleMessages = adaptMessagesForSystemLimitedModel(messages);
    return desktop
      ? await desktop.ai.chat({
          model: modelId,
          messages: compatibleMessages,
          temperature,
          settings: {
            apiKey,
            referer: window.location.href,
            appTitle: 'Story Forge'
          }
        })
      : await requestAIResponseBrowser({ apiKey, modelId, messages: compatibleMessages, maxTokens, temperature });
  }
}

async function requestAIResponseBrowser({ apiKey, modelId, messages, maxTokens, temperature }) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.href,
      'X-Title': 'Story Forge',
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: false,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function shouldRetryWithoutSystem(error) {
  const message = String(error?.message || '');
  return message.includes('Developer instruction is not enabled') ||
    message.includes('system message') ||
    message.includes('system instruction');
}

function adaptMessagesForSystemLimitedModel(messages) {
  const systemMessages = messages.filter(message => message.role === 'system').map(message => message.content.trim());
  const nonSystemMessages = messages.filter(message => message.role !== 'system').map(message => ({ ...message }));
  if (!systemMessages.length) return nonSystemMessages;

  const merged = `Follow these instructions for the whole conversation:\n${systemMessages.join('\n')}`.trim();
  const firstUserIndex = nonSystemMessages.findIndex(message => message.role === 'user');
  if (firstUserIndex === -1) {
    return [{ role: 'user', content: merged }, ...nonSystemMessages];
  }

  nonSystemMessages[firstUserIndex] = {
    ...nonSystemMessages[firstUserIndex],
    content: `${merged}\n\n${nonSystemMessages[firstUserIndex].content}`.trim(),
  };
  return nonSystemMessages;
}

// â”€â”€ Preceding text helpers â”€â”€

function htmlToText(html) {
  if (!html) return '';
  // Insert a space before block-level tags so words don't run together
  const spaced = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|br)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ');
  const d = document.createElement('div');
  d.innerHTML = spaced;
  // Collapse multiple spaces/newlines to single space
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Gather all text from the manuscript in order, up to and including the
 * current scene. Returns { precedingText, currentSceneText } where:
 *   precedingText  = text from all scenes BEFORE the current one, trimmed to
 *                    STATE.settings.contextChars characters (from the tail)
 *   currentSceneText = full text of the current scene
 */
function gatherManuscriptContext() {
  const proj = getProject();
  if (!proj) return { precedingText: '', currentSceneText: '' };

  const limitChars = STATE.settings.contextChars || 2000;
  const segments = []; // { text, isCurrent }

  for (const ch of proj.chapters) {
    for (const sc of ch.scenes) {
      const text = htmlToText(sc.content || '').trim();
      if (!text) continue;
      const isCurrent = sc.id === STATE.currentSceneId;
      segments.push({ text, isCurrent });
      if (isCurrent) break; // stop after current scene
    }
    if (segments.length && segments[segments.length - 1].isCurrent) break;
  }

  const currentSeg = segments.find(s => s.isCurrent);
  const currentSceneText = currentSeg ? currentSeg.text : '';

  // Preceding = everything before the current scene, concatenated
  const priorSegments = segments.filter(s => !s.isCurrent);
  const allPrior = priorSegments.map(s => s.text).join('\n\n');

  // Take only the tail (most recent prose)
  const precedingText = allPrior.length > limitChars
    ? allPrior.slice(-limitChars)
    : allPrior;

  return { precedingText, currentSceneText };
}

function buildContextParts() {
  const proj = getProject();
  const sc = STATE.currentSceneId ? getScene(STATE.currentChapterId, STATE.currentSceneId) : null;
  const ch = STATE.currentChapterId ? getChapter(STATE.currentChapterId) : null;
  const { precedingText, currentSceneText } = gatherManuscriptContext();
  const userPrompt = document.getElementById('ai-prompt-input')?.value || '';
  const isShortStory = proj?.storyType === 'short_story';
  const ssPartCount = getShortStoryPartCount(proj);

  // Smart codex selection using aiContext field:
  // "always"  â†’ always included regardless of scene content
  // "auto"    â†’ included only when entry name is detected in scene or message
  // "never"   â†’ never included
  const allCodex = proj?.codex || [];
  const combinedText = (currentSceneText + ' ' + userPrompt).toLowerCase();

  const alwaysEntries = allCodex
    .filter(e => e.aiContext === 'always');

  const autoEntries = allCodex
    .filter(e => (e.aiContext === 'auto' || !e.aiContext) && e.name &&
      combinedText.includes(e.name.toLowerCase()));

  // Combine, deduplicate, cap at 14 total
  const seen = new Set();
  const chars = [...alwaysEntries, ...autoEntries].filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  }).slice(0, 14);

  const modeInstructions = {
    continue:   "CONTINUE the story seamlessly. Match the author's voice, style, and tone exactly. Write in the same narrative perspective. Do not add scene-ending flourishes unless the scene is clearly ending.",
    brainstorm: "BRAINSTORM ideas, suggestions, and possibilities. Be creative, varied, and offer multiple options. Label each idea clearly.",
    rewrite:    "REWRITE or IMPROVE specific passages. When given text to rewrite, preserve the core meaning while improving the craft.",
    compliance: "CHECK COMPLIANCE against the requested structure, prose rules, and process. Be specific, organized, and practical. Quote short offending phrases only when needed.",
    chat:       "Act as a WRITING COACH. Analyze, advise, and answer questions about the story and craft. Be specific and constructive.",
  };

  const shortStoryModeInstructions = {
    continue: 'DRAFT exactly one short-story part at a time. Respect the process rules, structure rules, and style constraints. End by asking "Shall I continue with the next part?"',
    brainstorm: `PLAN the short story as a ${ssPartCount}-part arc. Focus on transformation, tension escalation, and clean structure without drafting multiple full parts unless asked.`,
    rewrite: 'REVISE the current short-story part to better fit the rules: lean prose, no cliches, no em dashes, stronger sensory detail, and progressive tension.',
    compliance: 'AUDIT the current short-story part for rule compliance. Organize findings under clear headings and prioritize concrete, fixable issues.',
    chat: 'Act as a SHORT STORY COACH. Give craft feedback focused on structure, dread, pacing, transformation, and precise prose.',
  };

  return {
    role:           `You are an expert creative writing assistant embedded in Story Forge, a novel-writing app.`,
    project:        proj ? `Title: "${proj.title}"  |  Genre: ${proj.genre}${proj.synopsis ? '\nSynopsis: ' + proj.synopsis : ''}` : null,
    chapter:        ch ? ch.title : null,
    scene:          sc ? sc.title : null,
    precedingText:  precedingText || null,
    currentSceneText: currentSceneText || null,
    characters:     chars.length > 0
      ? chars.map(c => {
          const tag = c.aiContext === 'always' ? ' [always]' : ' [detected]';
          const lines = [`• [${CODEX_SINGULAR[c.category] || c.category}${tag}] ${c.name}`];
          if (c.role) lines.push(`  Role: ${c.role}`);
          if (c.description) lines.push(`  ${htmlToText(c.description)}`);
          if (c.notes) lines.push(`  Notes: ${htmlToText(c.notes)}`);
          return lines.join('\n');
        }).join('\n\n')
      : null,
    mode:           isShortStory
      ? (shortStoryModeInstructions[AI.currentMode] || shortStoryModeInstructions.chat)
      : (modeInstructions[AI.currentMode] || modeInstructions.chat),
    footer:         `Respond naturally and helpfully. Do not add meta-commentary about what you're doing unless asked.`,
    contextChars:   STATE.settings.contextChars || 2000,
    alwaysCount:    alwaysEntries.length,
    autoCount:      autoEntries.length,
  };
}

function buildSystemPrompt() {
  const p = buildContextParts();
  const proj = getProject();
  const isShortStory = proj?.storyType === 'short_story';

  let ctx = p.role + '\n\n';
  if (p.project)    ctx += `PROJECT:\n${p.project}\n\n`;
  if (p.chapter)    ctx += `CURRENT CHAPTER: "${p.chapter}"\n`;
  if (p.scene)      ctx += `CURRENT SCENE: "${p.scene}"\n\n`;

  // Short story budget awareness
  if (isShortStory) {
    const ssMin = proj.ssMin ?? 1000;
    const ssMax = proj.ssMax ?? 2500;
    const ssPartCount = getShortStoryPartCount(proj);
    const wc = projectWordCount(proj);
    const remaining = Math.max(0, ssMax - wc);
    ctx += `SHORT STORY CONSTRAINTS:\n`;
    ctx += `• Target range: ${ssMin.toLocaleString()}–${ssMax.toLocaleString()} words total\n`;
    ctx += `• Part count: ${ssPartCount} parts (Part 1 through Part ${ssPartCount})\n`;
    ctx += `• Words written so far: ${wc.toLocaleString()}\n`;
    ctx += `• Remaining budget: ${remaining.toLocaleString()} words\n`;
    if (remaining < 300) {
      ctx += `• ⚠ BUDGET ALMOST EXHAUSTED — write a satisfying conclusion within the remaining budget. Do NOT exceed it.\n`;
    } else {
      ctx += `• Write content that fits naturally within this budget. Pace accordingly.\n`;
    }
    ctx += '\n';
    ctx += `${buildShortStoryModePrompt(ssPartCount)}\n\n`;
  }

  if (p.characters) ctx += `CODEX ENTRIES:\n${p.characters}\n\n`;
  ctx += `YOUR ROLE: ${p.mode}\n\n`;
  if (AI.currentMode === 'compliance') {
    ctx += `OUTPUT MODE: Return an audit, not story prose. Use concise headings and actionable notes.\n\n`;
  } else if (isShortStory && AI.currentMode === 'continue') {
    ctx += `TARGET LENGTH: Aim for approximately ${AI.wordTarget} words for this single part or excerpt while staying within the short-story budget. Stop after one part only.\n\n`;
  } else {
    ctx += `TARGET LENGTH: You MUST write exactly ${AI.wordTarget} words, count carefully. Do not stop early. Do not summarize or truncate. Keep writing until you reach ${AI.wordTarget} words.\n\n`;
  }
  ctx += `${p.footer}\n\n`;
  ctx += `--- STORY TEXT ---\n`;
  if (p.precedingText) {
    ctx += `[PRECEDING TEXT — last ${p.contextChars.toLocaleString()} chars from prior scenes]\n${p.precedingText}\n\n`;
  }
  if (p.currentSceneText) {
    ctx += `[CURRENT SCENE — continue from the end of this]\n${p.currentSceneText}`;
  } else if (!p.precedingText) {
    ctx += `[No scene content yet — start fresh, matching the project's genre and tone]`;
  }
  return ctx;
}

// â”€â”€ Context Preview â”€â”€

let _previewView = 'structured'; // 'structured' | 'json' | 'xml'

document.getElementById('ai-preview-btn').addEventListener('click', () => {
  const preview = document.getElementById('ai-context-preview');
  if (!preview.classList.contains('hidden')) {
    preview.classList.add('hidden');
    return;
  }
  renderContextPreview();
  preview.classList.remove('hidden');
});

document.getElementById('ai-preview-close').addEventListener('click', () => {
  document.getElementById('ai-context-preview').classList.add('hidden');
});

document.querySelectorAll('.ai-preview-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ai-preview-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _previewView = btn.dataset.view;
    renderContextPreview();
  });
});

function buildApiPayload() {
  const modelId = STATE.settings.selectedModel || 'no-model-selected';
  const systemPrompt = buildSystemPrompt();
  const userPrompt = document.getElementById('ai-prompt-input').value.trim() || '(your message here)';
  const history = AI.conversation.slice(-10);
  // ~1.8 tokens per word for prose, 30% headroom, min 400, max 8000
  const maxTokens = Math.min(8000, Math.max(400, Math.round(AI.wordTarget * 1.8 * 1.3)));
  return {
    model: modelId,
    stream: true,
    max_tokens: maxTokens,
    temperature: AI.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userPrompt },
    ],
  };
}

function syntaxHighlightJSON(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="tok-key">${match}</span>`;
        return `<span class="tok-str">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="tok-bool">${match}</span>`;
      if (/null/.test(match)) return `<span class="tok-num">${match}</span>`;
      return `<span class="tok-num">${match}</span>`;
    });
}

function buildXMLPayload() {
  const payload = buildApiPayload();
  const escXml = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<request>\n`;
  xml += `  <model>${escXml(payload.model)}</model>\n`;
  xml += `  <max_tokens>${payload.max_tokens}</max_tokens>\n`;
  xml += `  <temperature>${payload.temperature}</temperature>\n`;
  xml += `  <stream>${payload.stream}</stream>\n`;
  xml += `  <messages>\n`;
  payload.messages.forEach(msg => {
    xml += `    <message role="${escXml(msg.role)}">\n`;
    xml += `      <content>${escXml(msg.content)}</content>\n`;
    xml += `    </message>\n`;
  });
  xml += `  </messages>\n</request>`;
  return xml;
}

function syntaxHighlightXML(xml) {
  return xml
    .replace(/&amp;/g, '&amp;amp;').replace(/&lt;/g, '&amp;lt;')
    .replace(/&gt;/g, '&amp;gt;').replace(/&quot;/g, '&amp;quot;')
    .replace(/(<\/?)([\w:]+)/g, (_, slash, tag) => `${slash}<span class="tok-tag">${tag}</span>`)
    .replace(/([\w:]+)(=)(".*?")/g, (_, attr, eq, val) =>
      `<span class="tok-attr">${attr}</span>${eq}<span class="tok-str">${val}</span>`)
    .replace(/(&amp;\w+;)/g, `<span class="tok-num">$1</span>`);
}

function renderContextPreview() {
  const container = document.getElementById('ai-preview-sections');
  container.innerHTML = '';

  if (_previewView === 'structured') {
    renderStructuredPreview(container);
  } else if (_previewView === 'json') {
    renderRawPreview(container, 'json');
  } else if (_previewView === 'xml') {
    renderRawPreview(container, 'xml');
  }
}

function renderStructuredPreview(container) {
  const parts = buildContextParts();
  const userPrompt = document.getElementById('ai-prompt-input').value.trim();

  const blocks = [
    { label: 'System Role',        content: parts.role,                   always: true },
    { label: 'Project',            content: parts.project,                always: false },
    { label: 'Chapter / Scene',    content: [parts.chapter ? `Chapter: ${parts.chapter}` : null, parts.scene ? `Scene: ${parts.scene}` : null].filter(Boolean).join('\n') || null, always: false },
      { label: `Codex Entries${parts.characters ? ` (${parts.alwaysCount || 0} always · ${parts.autoCount || 0} detected)` : ''}`, content: parts.characters, always: false },
    { label: 'AI Mode / Role',     content: parts.mode,                   always: true },
    { label: `Preceding Text (last ${(parts.contextChars||2000).toLocaleString()} chars)`, content: parts.precedingText, always: false },
    { label: 'Current Scene',      content: parts.currentSceneText,       always: false },
    { label: 'Your Message',       content: userPrompt || '(nothing typed yet)', always: true, highlight: true },
  ];

  let totalChars = 0;
  const wrap = document.createElement('div');
  wrap.className = 'ai-preview-sections';

  blocks.forEach(block => {
    if (!block.always && !block.content) return;
    const isEmpty = !block.content;
    const charCount = block.content ? block.content.length : 0;
    totalChars += charCount;

    const div = document.createElement('div');
    div.className = 'ai-preview-block';
    div.innerHTML = `
      <div class="ai-preview-block-label">
        <span>${block.label}</span>
        <span style="display:flex;align-items:center;gap:8px;">
          ${isEmpty ? '<span style="color:var(--text-dim);font-style:italic;">empty</span>' : `<span>${charCount.toLocaleString()} chars</span>`}
        <span class="preview-chevron">▾</span>
        </span>
      </div>
      <div class="ai-preview-block-content">${isEmpty ? '<span style="color:var(--text-dim);font-style:italic;">Not included</span>' : esc(block.content)}</div>
      ${charCount > 0 ? `<div class="ai-preview-token-count">~${Math.ceil(charCount / 4).toLocaleString()} tokens</div>` : ''}
    `;
    // Collapse large text blocks by default
    if ((block.label.startsWith('Preceding') || block.label === 'Current Scene') && charCount > 300) {
      div.classList.add('collapsed');
    }
    div.querySelector('.ai-preview-block-label').addEventListener('click', () => div.classList.toggle('collapsed'));
    wrap.appendChild(div);
  });

  const summary = document.createElement('div');
  summary.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:var(--text-dim);text-align:right;padding:4px 8px 8px;';
  summary.textContent = `Total: ~${totalChars.toLocaleString()} chars · ~${Math.ceil(totalChars / 4).toLocaleString()} tokens`;
  wrap.appendChild(summary);
  container.appendChild(wrap);
}

function renderRawPreview(container, fmt) {
  const payload = buildApiPayload();
  let rawText, highlighted;
  let charCount, tokenCount;

  if (fmt === 'json') {
    rawText = JSON.stringify(payload, null, 2);
    highlighted = syntaxHighlightJSON(rawText);
  } else {
    rawText = buildXMLPayload();
    highlighted = syntaxHighlightXML(rawText);
  }

  charCount = rawText.length;
  tokenCount = Math.ceil(charCount / 4);

  const wrap = document.createElement('div');
  wrap.className = 'ai-preview-raw';
  wrap.innerHTML = `
    <div class="ai-preview-raw-toolbar">
        <span class="ai-preview-raw-meta">${charCount.toLocaleString()} chars · ~${tokenCount.toLocaleString()} tokens · ${payload.messages.length} messages</span>
        <button class="ai-preview-copy-btn" id="copy-raw-btn">📋 Copy</button>
    </div>
    <div class="ai-preview-raw-code" id="ai-raw-code">${highlighted}</div>
  `;
  wrap.querySelector('#copy-raw-btn').addEventListener('click', (e) => {
    copyToClipboard(rawText, e.currentTarget);
  });
  container.appendChild(wrap);
}

// Refresh preview when prompt changes (if preview is open)
document.getElementById('ai-prompt-input').addEventListener('input', () => {
  if (!document.getElementById('ai-context-preview').classList.contains('hidden')) {
    renderContextPreview();
  }
});

function markdownToHtml(md) {
  // Process block by block
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (/^### (.+)/.test(line))      { blocks.push(`<h3>${inlineMarkdown(line.replace(/^### /, ''))}</h3>`); i++; continue; }
    if (/^## (.+)/.test(line))       { blocks.push(`<h3>${inlineMarkdown(line.replace(/^## /, ''))}</h3>`); i++; continue; }
    if (/^# (.+)/.test(line))        { blocks.push(`<h3>${inlineMarkdown(line.replace(/^# /, ''))}</h3>`); i++; continue; }

    // Horizontal rule
    if (/^(\*\*\*|---|___)\s*$/.test(line)) { blocks.push('<hr>'); i++; continue; }

    // Unordered list â€” collect consecutive items
    if (/^[-*+] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*+] /, ''))}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Blank line â€” skip (paragraph breaks handled by grouping)
    if (line.trim() === '') { i++; continue; }

    // Regular paragraph â€” collect consecutive non-blank, non-special lines
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' &&
           !/^#{1,3} /.test(lines[i]) && !/^[-*+] /.test(lines[i]) &&
           !/^\d+\. /.test(lines[i]) && !/^(\*\*\*|---|___)\s*$/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) blocks.push(`<p>${inlineMarkdown(paraLines.join(' '))}</p>`);
  }

  return blocks.join('');
}

function inlineMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Bold+italic (must come before bold and italic)
    .replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold â€” require non-space at edges, no newlines inside
    .replace(/\*\*([^\s*][^*\n]*?[^\s*])\*\*/g, '<strong>$1</strong>')
    .replace(/\*\*([^\s*])\*\*/g, '<strong>$1</strong>')
    .replace(/__([^\s_][^_\n]*?[^\s_])__/g, '<strong>$1</strong>')
    // Italic â€” require non-space at edges, no newlines inside
    .replace(/\*([^\s*][^*\n]*?[^\s*])\*/g, '<em>$1</em>')
    .replace(/\*([^\s*])\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`\n]+?)`/g, '<code>$1</code>')
    // Em dash
    .replace(/--/g, '—');
}

function insertTextIntoScene(text) {
  if (!STATE.currentSceneId) { showAIError('Open a scene first to insert text.'); return; }
  const el = document.getElementById('scene-content');
  el.focus();

  // Place cursor at end if not already inside the editor
  const sel = window.getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Convert markdown â†’ HTML then insert
  const html = markdownToHtml(text.trim());
  document.execCommand('insertHTML', false, html);

  saveCurrentScene();
  document.getElementById('scene-wc').textContent = countWords(el.innerHTML) + ' words';
  updateTotalWC();
}

function appendAIMessage(role, text, streaming = false) {
  const chat = document.getElementById('ai-chat-area');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.innerHTML = `
      <div class="ai-msg-role">${role === 'user' ? 'You' : '✦ AI'}</div>
    <div class="ai-msg-bubble">${esc(text)}</div>
    <div class="ai-msg-actions"></div>`;
  chat.appendChild(div);
  scrollAIToBottom();
  return div;
}

function copyToClipboard(text, btn) {
  const done = () => {
    if (btn) {
      const orig = btn.textContent;
  btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); done?.(); } catch {}
  document.body.removeChild(ta);
}

function showAIError(msg) {
  const chat = document.getElementById('ai-chat-area');
  const div = document.createElement('div');
  div.className = 'ai-error-msg';
  div.textContent = msg;
  chat.appendChild(div);
  scrollAIToBottom();
}

function scrollAIToBottom() {
  const chat = document.getElementById('ai-chat-area');
  chat.scrollTop = chat.scrollHeight;
}

function setAIStreaming(val) {
  AI.isStreaming = val;
  const btn = document.getElementById('ai-send-btn');
  const label = document.getElementById('ai-send-label');
  const spinner = document.getElementById('ai-send-spinner');
  btn.disabled = val;
  label.classList.toggle('hidden', val);
  spinner.classList.toggle('hidden', !val);
}

// â”€â”€ Settings modal open: populate AI fields â”€â”€

function populateSettingsModal() {
  ensureAiIsmSettings();
  document.getElementById('settings-api-key').value = STATE.settings.openrouterKey || '';
  document.getElementById('settings-font-size').value = STATE.settings.fontSize;
  document.getElementById('settings-font-label').textContent = STATE.settings.fontSize + 'px';
  document.getElementById('settings-line-spacing').value = STATE.settings.lineHeight;
  document.getElementById('settings-chapter-font').value = resolveChapterFontKey();
  const ctxChars = STATE.settings.contextChars || 2000;
  document.getElementById('settings-context-chars').value = ctxChars;
  document.getElementById('settings-context-label').textContent = ctxChars.toLocaleString() + ' chars';
  document.getElementById('settings-ai-isms-enabled').checked = !!STATE.settings.aiIsmsEnabled;
  document.getElementById('settings-ai-isms-list').value = STATE.settings.aiIsmsRawText || '';
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === STATE.settings.theme));
  updateSelectedModelDisplay();
  updateAIModelLabel();
  if (STATE.settings.openrouterKey && AI.models.length === 0) fetchModels();
  else if (AI.models.length > 0) { filterAndRenderModels(''); document.getElementById('model-list-loading').style.display = 'none'; }
}

// Settings button opens modal with AI fields populated
document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('hidden');
  populateSettingsModal();
});

// â”€â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function init() {
  load();
  await hydrateDesktopState();
  ensureAiIsmSettings();
  if (STATE.projects.length === 0) {
    seedDemoProject();
    save();
  }
  applyTheme();
  applyEditorSettings();
  applyChapterFont();
  renderProjects();
  updateQuickBtns();

  // Restore last position â€” if a project was open, go straight back in
  if (STATE.currentProjectId && STATE.projects.find(p => p.id === STATE.currentProjectId)) {
    openProject(STATE.currentProjectId, true /* restore */);
  }

  // Pre-load models if key exists
  if (STATE.settings.openrouterKey) {
    fetchModels().then(() => updateAIModelLabel());
  }
}

init();
