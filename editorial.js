'use strict';

const voices = {
  dream: { name: '梦真记得', quote: '“只有5分钟的全力奔跑和用力撕扯，跟日常办公室状态完全相反，让我感到自己也能有‘攻击性’和‘狠人属性’。”' },
  zhang: { name: '张旭记得', quote: '“同一场竞争中，不同策略同样可以有效：有人选择低调避战，有人稳守，有人与队友联动，都成功留到了最后。”' },
  stone: { name: '石头记得', quote: '“大家在赛场上全力以赴、想赢敢拼的劲头，充分展现了同事们蓬勃的活力和拼搏向上的气质。”' }
};
const voiceTabs = [...document.querySelectorAll('.voice-tab')];
const voicePanel = document.querySelector('.voice-content');
function selectVoice(tab) {
  voiceTabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
  });
  voicePanel.setAttribute('aria-labelledby', tab.id);
  voicePanel.querySelector('.voice-kicker').textContent = voices[tab.dataset.voice].name;
  voicePanel.querySelector('blockquote').textContent = voices[tab.dataset.voice].quote;
}
voiceTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectVoice(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % voiceTabs.length;
    if (event.key === 'ArrowLeft') next = (index + voiceTabs.length - 1) % voiceTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = voiceTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectVoice(voiceTabs[next]);
    voiceTabs[next].focus();
  });
});

const photos = [
  { id: 'scene-01', title: '01 · 草地全景', time: '17:35:30' },
  { id: 'scene-02', title: '02 · 队伍移动', time: '17:36:23' },
  { id: 'scene-03', title: '03 · 场上追逐', time: '17:37:42' },
  { id: 'scene-04', title: '04 · 笑着跑过镜头', time: '17:37:55' },
  { id: 'scene-05', title: '05 · 场上片刻', time: '17:38:18' }
];
const targets = { album: '这一组 · 户外挑战', ...Object.fromEntries(photos.map((p) => [p.id, p.title])) };
const hasTarget = (id) => Object.hasOwn(targets, id);
const imagePath = (id, thumbnail = false) => `public/images/${id}${thumbnail ? '-thumb' : ''}.jpg`;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// LOCAL-ONLY PROTOTYPE. No upload, API call, authenticated identity or shared database.
const STORAGE_KEY = 'jinqiu.jeju.memories.v1';
const MAX_ENTRIES = 200;
const form = document.getElementById('memory-form');
const nameInput = document.getElementById('memory-name');
const textInput = document.getElementById('memory-text');
const status = document.getElementById('memory-status');
const list = document.getElementById('memory-list');
let currentTarget = 'album';
let storageUsable = true;
let entries = [];
function announce(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}
function validEntry(entry) {
  return entry && typeof entry.id === 'string' && entry.id.length <= 100 &&
    typeof entry.target === 'string' && hasTarget(entry.target) &&
    typeof entry.name === 'string' && entry.name.trim().length > 0 && entry.name.length <= 24 &&
    typeof entry.text === 'string' && entry.text.trim().length > 0 && entry.text.length <= 500 &&
    Number.isSafeInteger(entry.createdAt) && entry.createdAt > 0 && entry.createdAt <= 8640000000000000;
}
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !Array.isArray(saved.entries) || saved.entries.length > MAX_ENTRIES ||
        !saved.entries.every(validEntry) || new Set(saved.entries.map((e) => e.id)).size !== saved.entries.length) {
      throw new Error('Invalid local memory data');
    }
    entries = saved.entries;
  }
} catch {
  storageUsable = false;
  announce('无法读取本机存储。可以临时体验；新留言只在本次页面有效，刷新后不保留。原存储不会被覆盖。', true);
}
function persist() {
  if (!storageUsable) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
    return true;
  } catch {
    storageUsable = false;
    return false;
  }
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // Never render user input as HTML.
  return node;
}
function renderMemories() {
  list.replaceChildren();
  const visible = entries.filter((entry) => currentTarget === 'album' || entry.target === currentTarget)
    .sort((a, b) => b.createdAt - a.createdAt);
  document.getElementById('memory-total').textContent = visible.length;
  document.getElementById('conversation-scope').textContent = currentTarget === 'album'
    ? '这一组下的全部想法（含单张照片）' : `关于 ${targets[currentTarget]} 的想法`;
  if (!visible.length) {
    const empty = element('div', 'memory-empty');
    empty.append(element('strong', '', '这里还空着，留给你的视角。'),
      element('p', '', '没有预置评论，也没有参与门槛。写一句你看到的、想到的，就很好。'));
    list.append(empty);
    return;
  }
  visible.forEach((entry) => {
    const card = element('article', 'memory-card');
    const head = element('div', 'memory-card-header');
    head.append(element('span', 'memory-avatar', Array.from(entry.name)[0]), element('strong', '', entry.name));
    const time = element('time', '', new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(entry.createdAt)));
    time.dateTime = new Date(entry.createdAt).toISOString();
    head.append(time);
    const target = element('button', 'memory-target');
    target.type = 'button';
    if (entry.target !== 'album') {
      const thumb = element('img');
      thumb.src = imagePath(entry.target, true);
      thumb.alt = '';
      thumb.loading = 'lazy';
      target.append(thumb);
    }
    target.append(element('span', '', targets[entry.target]));
    target.setAttribute('aria-label', `查看${targets[entry.target]}`);
    target.addEventListener('click', () => {
      if (entry.target === 'album') setTarget('album');
      else openPhoto(photos.findIndex((p) => p.id === entry.target));
    });
    const remove = element('button', 'memory-delete', '删除这条本机留言');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      if (!window.confirm('删除这条本机留言？此操作不能撤销。')) return;
      entries = entries.filter((item) => item.id !== entry.id);
      const saved = persist();
      renderMemories();
      announce(saved ? '已删除这条本机留言。' : '已从本次页面移除；无法更新本机存储，旧留言可能在刷新后重新出现。', !saved);
      textInput.focus({ preventScroll: true });
    });
    card.append(head, target, element('p', 'memory-body', entry.text), remove);
    list.append(card);
  });
}
function setTarget(id) {
  if (!hasTarget(id)) return;
  currentTarget = id;
  document.querySelectorAll('[data-target]').forEach((button) => {
    const active = button.dataset.target === id;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('composer-scope').textContent = `正在写给：${targets[id]}`;
  renderMemories();
}
document.querySelectorAll('[data-target]').forEach((button) => {
  button.addEventListener('click', () => setTarget(button.dataset.target));
});
function updateCount() {
  textInput.setCustomValidity('');
  document.getElementById('memory-count').textContent = `${textInput.value.length} / 500`;
}
textInput.addEventListener('input', updateCount);
nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    const separator = textInput.value.trim() ? '\n' : '';
    textInput.value = `${textInput.value}${separator}${button.dataset.prompt}`.slice(0, 500);
    updateCount();
    textInput.focus({ preventScroll: true });
    textInput.setSelectionRange(textInput.value.length, textInput.value.length);
  });
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const text = textInput.value.trim();
  nameInput.setCustomValidity(name ? '' : '请填写称呼，不能只输入空格。');
  textInput.setCustomValidity(text ? '' : '请写一点想法，不能只输入空格。');
  if (!form.reportValidity()) return;
  if (entries.length >= MAX_ENTRIES) {
    announce('已达到 200 条本机预览留言上限。请先删除不需要的留言。', true);
    return;
  }
  entries.push({
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    target: currentTarget, name, text, createdAt: Date.now()
  });
  const saved = persist();
  textInput.value = '';
  updateCount();
  renderMemories();
  announce(saved ? '已保存在当前浏览器。同事暂时看不到这条想法。' : '已放入本次页面；本机存储不可用，刷新后这条想法不会保留。', !saved);
});
form.querySelector('[type="submit"]').disabled = false;
renderMemories();

const lightbox = document.querySelector('.lightbox');
const lightboxImage = lightbox.querySelector('img');
const previousButton = lightbox.querySelector('.lightbox-prev');
const nextButton = lightbox.querySelector('.lightbox-next');
let currentPhoto = 0;
let lastFocus;
let previousOverflow = '';
function displayPhoto() {
  const photo = photos[currentPhoto];
  lightboxImage.src = imagePath(photo.id);
  lightboxImage.alt = photo.title;
  lightbox.querySelector('figcaption').textContent = `${photo.title} · 2026.09.16 ${photo.time}`;
  lightbox.querySelector('.lightbox-counter').textContent = `${String(currentPhoto + 1).padStart(2, '0')} / 05`;
  previousButton.disabled = currentPhoto === 0;
  nextButton.disabled = currentPhoto === photos.length - 1;
}
function openPhoto(index) {
  if (!Number.isInteger(index) || index < 0 || index >= photos.length) return;
  currentPhoto = index;
  displayPhoto();
  if (!lightbox.open) {
    lastFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    lightbox.showModal(); // Native dialog makes the background inert and contains keyboard focus.
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('.lightbox-close').focus();
  }
}
function closePhoto() { lightbox.close(); }
lightbox.addEventListener('close', () => {
  document.body.style.overflow = previousOverflow;
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
});
document.querySelectorAll('.image-button').forEach((button) => {
  const index = photos.findIndex((photo) => button.dataset.image === imagePath(photo.id));
  button.addEventListener('click', () => openPhoto(index));
});
previousButton.addEventListener('click', () => { if (currentPhoto > 0) { currentPhoto--; displayPhoto(); } });
nextButton.addEventListener('click', () => { if (currentPhoto < photos.length - 1) { currentPhoto++; displayPhoto(); } });
lightbox.querySelector('.lightbox-close').addEventListener('click', closePhoto);
lightbox.addEventListener('click', (event) => {
  if (event.target !== lightbox) return;
  const rect = lightbox.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePhoto();
});
lightbox.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    if (event.key === 'ArrowLeft') previousButton.click();
    else nextButton.click();
  }
});
lightbox.querySelector('.lightbox-comment').addEventListener('click', () => {
  const id = photos[currentPhoto].id;
  lightbox.addEventListener('close', () => {
    setTarget(id);
    document.getElementById('memories').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    textInput.focus({ preventScroll: true });
  }, { once: true });
  closePhoto();
});

const header = document.querySelector('.site-header');
const hero = document.querySelector('.hero');
const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > hero.offsetHeight - 100);
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('resize', updateHeader);
updateHeader();
