'use strict';

const scenes = roadData;
const activitiesById = new Map(activityData.map((activity) => [activity.id, activity]));
const stage = document.querySelector('#route-stage');
const roadPanel = document.querySelector('#activity-panel');
const photoDialog = document.querySelector('#photo-dialog');
const photoDialogClose = document.querySelector('#photo-dialog-close');
const photoDialogTitle = document.querySelector('#photo-dialog-title');
const photoDialogGrid = document.querySelector('#photo-dialog-grid');
const photoLightbox = document.querySelector('#photo-lightbox');
const photoLightboxClose = document.querySelector('#photo-lightbox-close');
const photoLightboxExit = document.querySelector('#photo-lightbox-exit');
const photoLightboxTitle = document.querySelector('#photo-lightbox-title');
const photoLightboxImage = document.querySelector('#photo-lightbox-image');
const photoLightboxCount = document.querySelector('#photo-lightbox-count');
const photoLightboxPrev = document.querySelector('#photo-lightbox-prev');
const photoLightboxNext = document.querySelector('#photo-lightbox-next');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const imageRoot = '锦秋团建照片/';
let lastScene = -1;
let lastPhotoTrigger = null;
let lastCommentTrigger = null;
let commentSceneIndex = 0;
let photoDialogScene = null;
let photoLightboxImages = [];
let photoLightboxIndex = 0;
let photoLightboxReturnToArchive = false;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const ease = (value) => value * value * (3 - 2 * value);
const imageUrl = (file) => encodeURI(`${imageRoot}${file}`);
// 网格 / 照片墙里的图都用 720px 缩略图；只有单张放大查看才加载原图。
// 缩略图文件名和原图一致，只换目录和扩展名（统一存为 JPEG）。
const thumbRoot = 'public/thumbs/';
const thumbUrl = (file) => encodeURI(`${thumbRoot}${file.replace(/\.[^.]+$/, '')}.jpg`);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/* 反馈头像来自用户提供的截图；没有对应头像的反馈继续使用姓名首字。 */
const feedbackPeople = {
  '仲昭阳': { displayName: '仲昭阳', avatar: 'public/avatars/zhong-zhaoyang.png' },
  '昭阳': { displayName: '仲昭阳', avatar: 'public/avatars/zhong-zhaoyang.png' },
  '郑晓超': { displayName: '郑晓超', avatar: 'public/avatars/zheng-xiaochao.png' },
  '晓超': { displayName: '郑晓超', avatar: 'public/avatars/zheng-xiaochao.png' },
  '石头': { displayName: '石头', avatar: 'public/avatars/shitou.png' },
  '马梦真': { displayName: '马梦真', avatar: 'public/avatars/ma-mengzhen.png' },
  '梦真': { displayName: '马梦真', avatar: 'public/avatars/ma-mengzhen.png' },
  '张旭': { displayName: '张旭', avatar: 'public/avatars/zhang-xu.png' },
  '张虚': { displayName: '张旭', avatar: 'public/avatars/zhang-xu.png' },
  'Sherry': { displayName: '张旭', avatar: 'public/avatars/zhang-xu.png' },
  '周琪': { displayName: '周琪', avatar: 'public/avatars/zhou-qi.png' },
  'Ben': { displayName: '周琪', avatar: 'public/avatars/zhou-qi.png' },
  '乔众龙': { displayName: '乔众龙', avatar: 'public/avatars/qiao-zhenglong.png' },
  '乔正龙': { displayName: '乔正龙', avatar: 'public/avatars/qiao-zhenglong.png' },
  '诺诺': { displayName: '诺诺', avatar: 'public/avatars/nuonuo.png' },
  '肖杨': { displayName: '肖杨', avatar: 'public/avatars/xiao-yang.png' }
};

function getFeedbackPerson(name = '') {
  const baseName = name.split(' · ')[0].trim();
  return feedbackPeople[baseName] || { displayName: baseName || name, avatar: '' };
}

function makeFeedbackAvatar(name, className = 'feedback-avatar') {
  const person = getFeedbackPerson(name);
  const avatar = make('span', className);
  if (person.avatar) {
    const image = make('img');
    image.src = person.avatar;
    image.alt = `${person.displayName}头像`;
    image.loading = 'lazy';
    image.decoding = 'async';
    // 头像加载不出来时退回姓名首字，不要留一个空圆。
    image.addEventListener('error', () => {
      image.remove();
      avatar.textContent = Array.from(person.displayName)[0] || '·';
    }, { once: true });
    avatar.append(image);
  } else {
    avatar.textContent = Array.from(person.displayName)[0] || '·';
  }
  return avatar;
}

function displayFeedbackName(name = '') {
  return getFeedbackPerson(name).displayName;
}

function getActivity(activityId) {
  return activitiesById.get(activityId) || activityData[0];
}

/* 两段话说的是不是同一件事。
   只用 includes 不够：同一句话在不同回答里会被缩写、换词，
   所以按二字组算重叠比例，达到七成就算重复。 */
function sameWording(a, b) {
  const clean = (text) => (text || '').replace(/[\s，。、；：！？,.!?;:“”"'（）()·…—-]/g, '');
  const x = clean(a);
  const y = clean(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const grams = (text) => {
    const set = new Set();
    for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
    return set;
  };
  const gx = grams(x);
  const gy = grams(y);
  let hit = 0;
  gx.forEach((gram) => { if (gy.has(gram)) hit += 1; });
  return hit / Math.min(gx.size, gy.size) >= 0.7;
}

/* ---- 亮点卡片：点赞 + 评论（本机） ---- */
const REACTION_STORAGE_KEY = 'jinqiu.jeju.reactions.v1';
const MAX_REACTION_COMMENTS = 100;
let reactionStorageUsable = true;
let reactions = {};
let reactionDataMigrated = false;

function validReactionComment(comment) {
  return comment && typeof comment.id === 'string' && comment.id.length <= 100 &&
    typeof comment.name === 'string' && comment.name.trim().length > 0 && comment.name.length <= 24 &&
    typeof comment.text === 'string' && comment.text.trim().length > 0 && comment.text.length <= 200 &&
    Number.isSafeInteger(comment.createdAt) && comment.createdAt > 0;
}

function validReactions(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).every((entry) => {
      return entry && typeof entry === 'object' &&
        typeof entry.likedByMe === 'boolean' &&
        Number.isSafeInteger(entry.likes) && entry.likes >= 0 &&
        Array.isArray(entry.comments) && entry.comments.length <= MAX_REACTION_COMMENTS && entry.comments.every(validReactionComment);
    });
}

try {
  const savedReactions = localStorage.getItem(REACTION_STORAGE_KEY);
  if (savedReactions !== null) {
    const parsed = JSON.parse(savedReactions);
    if (parsed.version !== 1 || !parsed.reactions || typeof parsed.reactions !== 'object') throw new Error('Invalid reactions');
    const migratedReactions = {};
    Object.entries(parsed.reactions).forEach(([key, entry]) => {
      const comments = Array.isArray(entry.comments) ? entry.comments : entry.notes;
      if (!Array.isArray(entry.comments) && Array.isArray(entry.notes)) reactionDataMigrated = true;
      migratedReactions[key] = { ...entry, comments: Array.isArray(comments) ? comments : [] };
      delete migratedReactions[key].notes;
    });
    if (!validReactions(migratedReactions)) throw new Error('Invalid reactions');
    reactions = migratedReactions;
  }
} catch {
  reactionStorageUsable = false;
}

function persistReactions() {
  if (!reactionStorageUsable) return false;
  try {
    localStorage.setItem(REACTION_STORAGE_KEY, JSON.stringify({ version: 1, reactions }));
    return true;
  } catch {
    reactionStorageUsable = false;
    return false;
  }
}

if (reactionDataMigrated) persistReactions();

function getReaction(key) {
  if (!reactions[key]) reactions[key] = { likes: 0, likedByMe: false, comments: [] };
  return reactions[key];
}

function getReactionLikeCount(key) {
  return getReaction(key).likes;
}

function isReactionLiked(key) {
  return getReaction(key).likedByMe;
}

function toggleReactionLike(key) {
  const entry = getReaction(key);
  entry.likedByMe = !entry.likedByMe;
  entry.likes = Math.max(0, entry.likes + (entry.likedByMe ? 1 : -1));
  persistReactions();
}

function syncLikeButton(button, key) {
  const liked = isReactionLiked(key);
  button.textContent = `赞 ${getReactionLikeCount(key)}`;
  button.classList.toggle('is-liked', liked);
  button.setAttribute('aria-pressed', String(liked));
}

function getReactionCommentCount(key) {
  return getReaction(key).comments.length;
}

const clockFormatter = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const formatClock = (timestamp) => clockFormatter.format(new Date(timestamp));
let reactionPanelSeq = 0;
let reactionFieldSeq = 0;

function syncCommentCountLabel(scope, key) {
  const button = scope.closest('.reaction-bar')?.querySelector('.reaction-comment');
  if (button) button.textContent = `评论 ${getReactionCommentCount(key)}`;
}

function setFieldError(field, message) {
  field.error.textContent = message;
  field.error.hidden = false;
  field.control.setAttribute('aria-invalid', 'true');
}

function clearFieldError(field) {
  field.error.textContent = '';
  field.error.hidden = true;
  field.control.removeAttribute('aria-invalid');
}

function setFormStatus(scope, message, warn = false) {
  const status = scope.querySelector('.reaction-comment-status');
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle('is-warn', warn);
}

function renderReactionComments(key, panel) {
  panel.replaceChildren();
  const entry = getReaction(key);
  const rows = entry.comments.slice().sort((a, b) => b.createdAt - a.createdAt);

  if (!rows.length) {
    panel.append(make('p', 'reaction-comment-empty', '还没有人评论，欢迎写第一条。'));
  }

  rows.forEach((comment) => {
    const row = make('div', 'reaction-comment-row');
    const head = make('div', 'reaction-comment-row-head');
    head.append(make('strong', '', comment.name), make('time', '', formatClock(comment.createdAt)));
    const text = make('p', 'reaction-comment-row-text', comment.text);
    const remove = make('button', 'reaction-comment-row-delete', '删除');
    remove.type = 'button';
    remove.setAttribute('aria-label', `删除 ${comment.name} 的这条评论`);
    remove.addEventListener('click', () => {
      entry.comments = entry.comments.filter((item) => item.id !== comment.id);
      const saved = persistReactions();
      renderReactionComments(key, panel);
      syncCommentCountLabel(panel, key);
      if (!saved) setFormStatus(panel, '存储不可用：这条评论刷新后会重新出现。', true);
    });
    row.append(head, text, remove);
    panel.append(row);
  });

  const form = make('form', 'reaction-comment-form');
  form.setAttribute('aria-label', '写一条评论');
  form.noValidate = true;

  const buildField = (labelText, control) => {
    const field = make('div', 'reaction-field');
    const id = `reaction-field-${reactionFieldSeq++}`;
    control.id = id;
    const label = make('label', 'reaction-field-label', labelText);
    label.htmlFor = id;
    const error = make('p', 'reaction-field-error');
    error.id = `${id}-error`;
    error.hidden = true;
    control.setAttribute('aria-describedby', error.id);
    field.append(label, control, error);
    return { field, control, error };
  };

  const nameInput = make('input');
  nameInput.type = 'text';
  nameInput.maxLength = 24;
  nameInput.placeholder = '你的称呼';
  nameInput.autocomplete = 'off';
  const nameField = buildField('你的称呼', nameInput);

  const textInput = make('textarea');
  textInput.rows = 2;
  textInput.maxLength = 200;
  textInput.placeholder = '一句评论……';
  const textField = buildField('评论内容', textInput);

  const submit = make('button', 'reaction-comment-form-submit', '留下评论');
  submit.type = 'submit';

  const status = make('p', 'reaction-comment-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  // 不因为「还没填完」而禁用提交：那样用户只能对着一个点不动的按钮猜原因。
  // 允许提交、就地报错、把焦点送到第一个没填的框，更清楚。
  const syncSubmit = () => {
    submit.disabled = entry.comments.length >= MAX_REACTION_COMMENTS;
  };

  form.append(nameField.field, textField.field, submit, status);

  if (entry.comments.length >= MAX_REACTION_COMMENTS) {
    setFormStatus(form, `这条评论已达 ${MAX_REACTION_COMMENTS} 条上限，删掉一些才能继续写。`, true);
  }
  syncSubmit();
  nameInput.addEventListener('input', () => clearFieldError(nameField));
  textInput.addEventListener('input', () => clearFieldError(textField));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const name = nameInput.value.trim();
    const commentText = textInput.value.trim();
    let firstInvalid = null;
    if (!name) { setFieldError(nameField, '请填写称呼。'); firstInvalid = nameInput; }
    else clearFieldError(nameField);
    if (!commentText) { setFieldError(textField, '请写一句评论。'); firstInvalid = firstInvalid || textInput; }
    else clearFieldError(textField);
    if (firstInvalid) { firstInvalid.focus(); return; }

    submit.disabled = true;
    entry.comments.push({
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      text: commentText,
      createdAt: Date.now()
    });
    const saved = persistReactions();
    renderReactionComments(key, panel);
    syncCommentCountLabel(panel, key);
    // 本机存储写不进去时也留在页面上，但要告诉用户刷新会丢。
    setFormStatus(panel, saved ? '已评论，保存在这台电脑上。' : '存储不可用：这条评论刷新后会丢失。', !saved);
  });

  panel.append(form);
}


function renderPhotoGrid(title, images, selectedIndex = 0) {
  photoDialogScene = null;
  photoDialogTitle.textContent = title;
  photoDialogGrid.replaceChildren();
  images.forEach((file, index) => {
    const button = make('button', 'archive-photo');
    button.type = 'button';
    button.setAttribute('aria-label', `${title}照片`);
    const image = make('img');
    image.src = thumbUrl(file);
    image.alt = `${title}照片`;
    image.loading = index < 4 ? 'eager' : 'lazy';
    image.decoding = 'async';
    markLoading(button);
    button.append(image);
    button.addEventListener('click', () => {
      photoDialogGrid.querySelectorAll('.archive-photo.is-focus').forEach((item) => item.classList.remove('is-focus'));
      button.classList.add('is-focus');
      openPhotoLightbox(images, index, title);
    });
    photoDialogGrid.append(button);
  });
  const selected = photoDialogGrid.children[selectedIndex];
  if (selected) selected.classList.add('is-focus');
  if (!photoDialog.open) photoDialog.showModal();
}

function updatePhotoLightbox() {
  const file = photoLightboxImages[photoLightboxIndex];
  if (!file || !photoLightboxImage) return;
  photoLightboxImage.src = imageUrl(file);
  photoLightboxImage.alt = `${photoLightboxTitle.textContent}第 ${photoLightboxIndex + 1} 张照片`;
  photoLightboxCount.textContent = `${photoLightboxIndex + 1} / ${photoLightboxImages.length}`;
  photoLightboxPrev.disabled = photoLightboxIndex === 0;
  photoLightboxNext.disabled = photoLightboxIndex === photoLightboxImages.length - 1;
}

function openPhotoLightbox(images, selectedIndex, title) {
  if (!photoLightbox || !images.length) return;
  photoLightboxImages = images;
  photoLightboxIndex = clamp(selectedIndex, 0, images.length - 1);
  photoLightboxReturnToArchive = photoDialog.open;
  if (photoDialog.open) photoDialog.close();
  photoLightboxTitle.textContent = title;
  updatePhotoLightbox();
  if (!photoLightbox.open) photoLightbox.showModal();
}

function closePhotoLightbox() {
  if (photoLightbox?.open) photoLightbox.close();
}

function movePhotoLightbox(step) {
  photoLightboxIndex = clamp(photoLightboxIndex + step, 0, photoLightboxImages.length - 1);
  updatePhotoLightbox();
}

function openSceneArchive(sceneIndex, selectedIndex = 0, trigger) {
  const scene = scenes[sceneIndex];
  if (!scene) return;
  lastPhotoTrigger = trigger || null;
  photoDialogScene = scene;
  renderPhotoGrid(scene.title, scene.allImages, selectedIndex);
  window.requestAnimationFrame(() => {
    const selected = photoDialogGrid.querySelector('.archive-photo.is-focus');
    selected?.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });
}

photoDialogClose.addEventListener('click', () => photoDialog.close());
photoDialog.addEventListener('click', (event) => {
  if (event.target === photoDialog) photoDialog.close();
});
photoDialog.addEventListener('close', () => {
  if (lastPhotoTrigger?.isConnected) lastPhotoTrigger.focus({ preventScroll: true });
});
photoLightboxClose.addEventListener('click', closePhotoLightbox);
photoLightboxExit.addEventListener('click', closePhotoLightbox);
photoLightboxPrev.addEventListener('click', () => movePhotoLightbox(-1));
photoLightboxNext.addEventListener('click', () => movePhotoLightbox(1));
photoLightbox.addEventListener('click', (event) => {
  if (event.target === photoLightbox) closePhotoLightbox();
});
photoLightbox.addEventListener('close', () => {
  if (photoLightboxReturnToArchive && !photoDialog.open) {
    photoDialog.showModal();
    window.requestAnimationFrame(() => {
      photoDialogGrid.querySelectorAll('.archive-photo.is-focus').forEach((item) => item.classList.remove('is-focus'));
      const selected = photoDialogGrid.children[photoLightboxIndex];
      selected?.classList.add('is-focus');
      selected?.focus({ preventScroll: true });
    });
  }
  photoLightboxReturnToArchive = false;
});
document.addEventListener('keydown', (event) => {
  if (!photoLightbox.open) return;
  if (event.key === 'ArrowLeft') movePhotoLightbox(-1);
  if (event.key === 'ArrowRight') movePhotoLightbox(1);
});
function buildReactionBar(key) {
  const bar = make('div', 'reaction-bar');
  const likeButton = make('button', 'reaction-like', `赞 ${getReactionLikeCount(key)}`);
  likeButton.type = 'button';
  likeButton.setAttribute('aria-pressed', String(isReactionLiked(key)));
  if (isReactionLiked(key)) likeButton.classList.add('is-liked');
  likeButton.addEventListener('click', () => { toggleReactionLike(key); syncLikeButton(likeButton, key); });
  const commentButton = make('button', 'reaction-comment', `评论 ${getReactionCommentCount(key)}`);
  commentButton.type = 'button';
  commentButton.setAttribute('aria-expanded', 'false');
  // 面板常驻 DOM，靠 is-open 过渡展开；内容首次展开时才渲染。
  const panel = make('div', 'reaction-comment-panel');
  panel.id = `reaction-panel-${reactionPanelSeq++}`;
  commentButton.setAttribute('aria-controls', panel.id);
  // 三层：外层负责折叠动画，中层负责裁切，最内层承担留白与边框。
  const inner = make('div', 'reaction-comment-panel-inner');
  const box = make('div', 'reaction-comment-panel-box');
  inner.append(box);
  panel.append(inner);
  let rendered = false;
  commentButton.addEventListener('click', () => {
    const willOpen = !panel.classList.contains('is-open');
    if (willOpen && !rendered) { renderReactionComments(key, box); rendered = true; }
    panel.classList.toggle('is-open', willOpen);
    commentButton.setAttribute('aria-expanded', String(willOpen));
  });
  bar.append(likeButton, commentButton, panel);
  return bar;
}

function renderHighlightCard(item, sceneTitle, listIndex) {
  const card = make('article', 'highlight-card');
  const key = `${sceneTitle}-${listIndex}`;
  card.dataset.reactionKey = key;
  const head = make('div', 'highlight-head');
  const who = make('div', 'highlight-who');
  who.append(makeFeedbackAvatar(item.name, 'highlight-avatar'), make('strong', '', displayFeedbackName(item.name)));
  head.append(who);
  const body = make('p', 'highlight-text', item.text);
  card.append(head, body, buildReactionBar(key));
  return card;
}

function renderVarietyCard(scene, data, cardIndex) {
  const card = make('article', 'variety-card');
  const key = data.reactionKey || `${scene.reactionTitle || scene.title}-${cardIndex}`;
  card.dataset.reactionKey = key;
  const sceneIndex = scenes.indexOf(scene);
  const photoButton = make('button', 'variety-photo');
  photoButton.type = 'button';
  photoButton.setAttribute('aria-label', `打开${scene.title}完整相册`);
  const photoImage = make('img');
  photoImage.src = thumbUrl(data.image);
  photoImage.alt = `${scene.title}现场照片`;
  photoImage.loading = 'lazy';
  photoImage.decoding = 'async';
  markLoading(photoButton);
  photoButton.append(photoImage);
  const imageIndex = scene.allImages.findIndex((file) => file === data.image);
  photoButton.addEventListener('click', () => openSceneArchive(sceneIndex, imageIndex === -1 ? 0 : imageIndex, photoButton));
  const caption = make('figcaption', 'variety-caption');
  const quoteWrap = make('div', 'variety-quote-wrap');
  const varietyWho = make('span', 'variety-who');
  varietyWho.append(makeFeedbackAvatar(data.who, 'variety-avatar'), make('span', 'variety-who-name', displayFeedbackName(data.who)));
  quoteWrap.append(make('p', 'variety-quote', `“${data.quote}”`), varietyWho);
  caption.append(quoteWrap);
  card.append(photoButton, caption, buildReactionBar(key));
  return card;
}

function renderVoiceFeedbackList(items, sceneTitle) {
  const list = make('div', 'highlight-list');
  items.forEach((item, index) => list.append(renderHighlightCard(item, sceneTitle, index)));
  return list;
}

function renderStation(index) {
  const scene = scenes[index];
  const details = sceneDetails[scene.id] || {};
  const station = make('article', 'activity-station');
  station.id = `station-${scene.id}`;
  station.dataset.scene = scene.id;

  const heading = make('div', 'road-heading');
  const headingMain = make('div');
  const sceneHeading = make('h1', `scene-title ${details.titleClass || ''}`, scene.title);
  sceneHeading.id = `heading-${scene.id}`;
  headingMain.append(sceneHeading);
  const aside = make('div', 'road-aside road-thumbs');
  // 11 张缩略图 + 1 个「+N」= 12 格，4 列正好 3 行，不会剩一个孤格子。
  const thumbLimit = 11;
  scene.allImages.slice(0, thumbLimit).forEach((file, i) => {
    const thumb = make('button', 'road-thumb');
    thumb.type = 'button';
    thumb.setAttribute('aria-label', `预览${scene.title}第 ${i + 1} 张`);
    const thumbImg = make('img');
    thumbImg.src = thumbUrl(file);
    thumbImg.alt = '';
    thumbImg.loading = 'lazy';
    thumbImg.decoding = 'async';
    markLoading(thumb);
    thumb.append(thumbImg);
    thumb.addEventListener('click', () => openSceneArchive(index, i, thumb));
    aside.append(thumb);
  });
  if (scene.allImages.length > thumbLimit) {
    const more = make('button', 'road-thumb-more', `+${scene.allImages.length - thumbLimit}`);
    more.type = 'button';
    more.setAttribute('aria-label', `打开${scene.title}完整相册`);
    more.addEventListener('click', () => openSceneArchive(index, 0, more));
    aside.append(more);
  }
  heading.append(headingMain);

  const world = make('div', 'road-world');
  // 烤肉烧酒那一站整块路面都不要，连它占的高度也一起省掉。
  if (!details.hideRoad) {
    world.append(make('div', 'road-surface'), make('div', 'road-center-line'), make('div', 'road-wordmark', 'WIN BIG'));
  }

  const echo = make('section', 'station-echo');
  const grid = make('div', 'variety-grid');
  let cards = details.variety?.cards;
  if (!cards) {
    const source = getActivity(scene.commentId);
    const highlights = details.highlights || [];
    // 这一站的引言如果本来就和三张里的某条同源，就不再单独占一张卡片。
    const quote = source.feedback.quote;
    const repeatsHighlight = highlights.some((item) => sameWording(item.text, quote));
    cards = [
      ...(repeatsHighlight ? [] : [{ quote, who: source.feedback.source, reactionKey: `${scene.reactionTitle}-source` }]),
      ...highlights.map((item, i) => ({
        quote: item.text, who: item.name,
        reactionKey: `${scene.reactionTitle}-${i}`
      }))
    ].map((item, i) => ({ ...item, image: scene.allImages[i % scene.allImages.length] }));
  }
  cards.forEach((cardData, cardIndex) => grid.append(renderVarietyCard(scene, cardData, cardIndex)));
  echo.append(grid);
  const archiveLabel = make('h3', 'archive-label', '照片合集');
  echo.append(archiveLabel, aside);

  station.append(heading);
  if (!details.hideRoad) station.append(world);
  station.append(echo);
  return station;
}

function renderSuggestionsSection() {
  const section = make('section', 'activity-station suggestions-station');
  section.id = 'station-suggestions';
  const heading = make('div', 'road-heading');
  heading.append(make('h1', 'scene-title', '下一站，去哪？'));
  const echo = make('div', 'station-echo');
  echo.append(renderVoiceFeedbackList(feedbackSuggestions, '建议'));
  section.append(heading, echo);
  return section;
}

function renderAllScenes() {
  roadPanel.replaceChildren();
  roadPanel.removeAttribute('aria-hidden');
  roadPanel.inert = false;
  scenes.forEach((scene, index) => {
    roadPanel.append(renderStation(index));
  });
  roadPanel.append(renderSuggestionsSection());
}

renderAllScenes();

/* ---- 内容揭示（scroll reveal）---- */
document.documentElement.classList.add('js-reveal');
function observeReveal(selector, stagger = 0) {
  const nodes = document.querySelectorAll(selector);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      if (stagger && element.dataset.revealed) return;
      element.classList.add('is-visible');
      element.dataset.revealed = '1';
      observer.unobserve(element);
    });
    // 采集入场时元素已经超过一屏高，用比例阈值会永远触发不了，
    // 所以只要求「顶部进入视口」即可。
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
  nodes.forEach((node, index) => {
    if (stagger) node.style.transitionDelay = `${Math.min(index * stagger, 600)}ms`;
    observer.observe(node);
  });
  return observer;
}
if (reducedMotion.matches) {
  document.querySelectorAll('.activity-station > .road-heading, .activity-station > .road-world, .activity-station > .station-echo, .highlight-card').forEach((node) => node.classList.add('is-visible'));
} else {
  if ('IntersectionObserver' in window) {
    observeReveal('.activity-station > .road-heading');
    observeReveal('.activity-station > .road-world');
    observeReveal('.activity-station > .station-echo');
    observeReveal('.highlight-card', 55);
  } else {
    document.querySelectorAll('.activity-station > .road-heading, .activity-station > .road-world, .activity-station > .station-echo, .highlight-card').forEach((node) => node.classList.add('is-visible'));
  }
}

/* ---- 进入活动区时，视频停播、音乐接棒 ---- */
const finalVideo = document.querySelector('#final-video');
const videoPlayButton = document.querySelector('#video-play');
const bgm = document.querySelector('#bgm');
const bgmToggle = document.querySelector('#bgm-toggle');
const bgmTip = document.querySelector('#bgm-tip');
const bgmTipClose = document.querySelector('#bgm-tip-close');
const routeTop = document.querySelector('#route-top');
let bgmAvailable = true;
let bgmManuallyPaused = false;
let albumActive = false;
let bgmBlocked = false;
// 滚动不算“用户操作”，浏览器会拦截滚动触发的自动播放，
// 所以在活动区里等用户第一次点击或按键时再接着播。
const bgmGestureEvents = ['pointerdown', 'keydown', 'touchstart'];

let bgmTipTimer = 0;

// 提示框挡在内容前面，所以给个关闭按钮，并且十秒后自己收起。
function showBgmTip() {
  if (!bgmTip) return;
  bgmTip.hidden = false;
  window.clearTimeout(bgmTipTimer);
  bgmTipTimer = window.setTimeout(() => { bgmTip.hidden = true; }, 10000);
}

function hideBgmTip() {
  if (!bgmTip) return;
  window.clearTimeout(bgmTipTimer);
  bgmTip.hidden = true;
}

function syncBgmButton(playing) {
  bgmToggle.setAttribute('aria-pressed', String(playing));
}

function stopWaitingForBgmGesture() {
  bgmBlocked = false;
  bgmGestureEvents.forEach((eventName) => window.removeEventListener(eventName, waitForBgmGesture));
}

function playBgm() {
  if (!albumActive || !bgmAvailable) {
    if (albumActive) showBgmTip();
    return;
  }
  bgm.play().then(() => {
    // 离开活动区或手动暂停发生在异步播放完成前，也不能让音乐继续响。
    if (!albumActive || bgmManuallyPaused) {
      bgm.pause();
      return;
    }
    stopWaitingForBgmGesture();
    hideBgmTip();
    syncBgmButton(true);
  }).catch(() => {
    if (!albumActive || bgmManuallyPaused) return;
    bgmBlocked = true;
    showBgmTip();
    bgmGestureEvents.forEach((eventName) => window.addEventListener(eventName, waitForBgmGesture, { passive: true }));
  });
}

function waitForBgmGesture() {
  if (!bgmBlocked) return;
  playBgm();
}

function syncAlbumAudio() {
  // 第二屏露出近一半时切换声音；只在跨过边界时切换，避免滚动重复播放。
  const enteringAlbum = routeTop.getBoundingClientRect().top <= window.innerHeight * 0.6;
  if (enteringAlbum === albumActive) return;
  albumActive = enteringAlbum;
  bgmToggle.hidden = !albumActive;
  if (albumActive) {
    finalVideo.pause();
    if (!bgmManuallyPaused) playBgm();
  } else {
    bgm.pause();
    hideBgmTip();
    stopWaitingForBgmGesture();
  }
}

bgmToggle.hidden = true;
window.addEventListener('scroll', syncAlbumAudio, { passive: true });
window.addEventListener('resize', syncAlbumAudio);
syncAlbumAudio();

bgm.addEventListener('error', () => { bgmAvailable = false; });
bgm.addEventListener('playing', () => { bgmAvailable = true; });
bgm.addEventListener('pause', () => syncBgmButton(false));
bgm.addEventListener('ended', () => syncBgmButton(false));

finalVideo.addEventListener('play', () => {
  videoPlayButton.hidden = true;
  if (!bgm.paused) bgm.pause();
  if (albumActive) finalVideo.pause();
});
finalVideo.addEventListener('pause', () => {
  if (!finalVideo.ended) videoPlayButton.hidden = false;
});
finalVideo.addEventListener('ended', () => { videoPlayButton.hidden = false; });
videoPlayButton.addEventListener('click', () => { finalVideo.play(); });

bgmToggle.addEventListener('click', () => {
  if (bgm.paused) {
    bgmManuallyPaused = false;
    playBgm();
  } else {
    bgmManuallyPaused = true;
    stopWaitingForBgmGesture();
    bgm.pause();
  }
});
bgmTipClose.addEventListener('click', hideBgmTip);
bgmTip.addEventListener('click', (event) => { if (!event.target.closest('a')) hideBgmTip(); });

/* ---- 图片的加载中 / 加载失败状态 ----
   load 和 error 不冒泡，但能在捕获阶段拿到，所以效劳一次全局监听即可。 */
function markLoading(container) {
  container?.classList.add('is-loading');
  container?.closest('button,figure')?.classList.remove('has-broken-image');
}

document.addEventListener('load', (event) => {
  const image = event.target;
  if (!image || image.tagName !== 'IMG') return;
  image.classList.remove('is-loading');
  image.parentElement?.classList.remove('is-loading');
  image.closest('button,figure')?.classList.remove('has-broken-image');
}, true);

document.addEventListener('error', (event) => {
  const image = event.target;
  if (!image || image.tagName !== 'IMG') return;
  image.classList.remove('is-loading');
  image.parentElement?.classList.remove('is-loading');
  image.closest('button,figure')?.classList.add('has-broken-image');
}, true);

/* ---- 手机端板块跳转：标出当前所在的板块 ---- */
const stationNav = document.querySelector('#station-nav');
if (stationNav) {
  const links = [...stationNav.querySelectorAll('a')];
  const stops = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  const navCompact = window.matchMedia('(max-width: 800px)');
  let navTick = false;

  const paintNav = () => {
    navTick = false;
    if (!navCompact.matches) return;
    const line = window.innerHeight * 0.35;
    let currentId = stops[0]?.id;
    stops.forEach((stop) => { if (stop.getBoundingClientRect().top <= line) currentId = stop.id; });
    let activeLink = null;
    links.forEach((link) => {
      const on = link.getAttribute('href') === `#${currentId}`;
      link.classList.toggle('is-current', on);
      if (on) activeLink = link;
    });
    // 只滑动导航自身，不要连带页面上下跳。
    if (activeLink) {
      const bar = stationNav.getBoundingClientRect();
      const chip = activeLink.getBoundingClientRect();
      if (chip.left < bar.left || chip.right > bar.right) {
        stationNav.scrollLeft += chip.left - bar.left - 16;
      }
    }
  };

  window.addEventListener('scroll', () => {
    if (navTick) return;
    navTick = true;
    window.requestAnimationFrame(paintNav);
  }, { passive: true });
  window.addEventListener('resize', paintNav);
  paintNav();
}