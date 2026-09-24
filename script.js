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
const commentDialog = document.querySelector('#comment-dialog');
const commentDialogClose = document.querySelector('#comment-dialog-close');
const commentDialogTitle = document.querySelector('#comment-dialog-title');
const commentSourceText = document.querySelector('#comment-source-text');
const commentSourceName = document.querySelector('#comment-source-name');
const commentForm = document.querySelector('#comment-form');
const commentName = document.querySelector('#comment-name');
const commentText = document.querySelector('#comment-text');
const commentCount = document.querySelector('#comment-count');
const commentStatus = document.querySelector('#comment-status');
const commentTotal = document.querySelector('#comment-total');
const commentList = document.querySelector('#comment-list');
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
let commentStorageUsable = true;
let comments = [];
const COMMENT_STORAGE_KEY = 'jinqiu.jeju.activity-comments.v1';
const MAX_COMMENTS = 200;

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

function validComment(comment) {
  return comment && typeof comment.id === 'string' && comment.id.length <= 100 &&
    activityData.some((activity) => activity.id === comment.activityId) &&
    typeof comment.name === 'string' && comment.name.trim().length > 0 && comment.name.length <= 24 &&
    typeof comment.text === 'string' && comment.text.trim().length > 0 && comment.text.length <= 500 &&
    Number.isSafeInteger(comment.createdAt) && comment.createdAt > 0 && comment.createdAt <= 8640000000000000;
}

try {
  const saved = localStorage.getItem(COMMENT_STORAGE_KEY);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (parsed.version !== 1 || !Array.isArray(parsed.comments) || parsed.comments.length > MAX_COMMENTS ||
        !parsed.comments.every(validComment) || new Set(parsed.comments.map((comment) => comment.id)).size !== parsed.comments.length) {
      throw new Error('Invalid comment data');
    }
    comments = parsed.comments;
  }
} catch {
  commentStorageUsable = false;
}

function persistComments() {
  if (!commentStorageUsable) return false;
  try {
    localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify({ version: 1, comments }));
    return true;
  } catch {
    commentStorageUsable = false;
    return false;
  }
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

function renderReactionComments(key, panel) {
  panel.replaceChildren();
  const entry = getReaction(key);
  entry.comments.slice().sort((a, b) => b.createdAt - a.createdAt).forEach((comment) => {
    const row = make('div', 'reaction-comment-row');
    const head = make('div', 'reaction-comment-row-head');
    head.append(make('strong', '', comment.name), make('time', '', new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(comment.createdAt))));
    const text = make('p', 'reaction-comment-row-text', comment.text);
    const remove = make('button', 'reaction-comment-row-delete', '删除');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      entry.comments = entry.comments.filter((item) => item.id !== comment.id);
      persistReactions();
      renderReactionComments(key, panel);
      const commentButton = panel.parentElement.querySelector('.reaction-comment');
      if (commentButton) commentButton.textContent = `评论 ${getReactionCommentCount(key)}`;
    });
    row.append(head, text, remove);
    panel.append(row);
  });

  const form = make('form', 'reaction-comment-form');
  form.setAttribute('aria-label', '写一条评论');
  const nameInput = make('input');
  nameInput.type = 'text';
  nameInput.maxLength = 24;
  nameInput.placeholder = '你的称呼';
  nameInput.required = true;
  nameInput.autocomplete = 'off';
  const textInput = make('textarea');
  textInput.rows = 2;
  textInput.maxLength = 200;
  textInput.placeholder = '一句评论……';
  textInput.required = true;
  const submit = make('button', 'reaction-comment-form-submit', '留下评论');
  submit.type = 'submit';
  form.append(nameInput, textInput, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    nameInput.setCustomValidity(name ? '' : '请填写称呼。');
    textInput.setCustomValidity(text ? '' : '请写一点评论。');
    if (!form.reportValidity()) return;
    if (entry.comments.length >= MAX_REACTION_COMMENTS) {
      textInput.setCustomValidity('已达到评论上限，请先删除一些。');
      form.reportValidity();
      textInput.setCustomValidity('');
      return;
    }
    entry.comments.push({
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      text,
      createdAt: Date.now()
    });
    persistReactions();
    textInput.value = '';
    renderReactionComments(key, panel);
    const commentButton = panel.parentElement.querySelector('.reaction-comment');
    if (commentButton) commentButton.textContent = `评论 ${getReactionCommentCount(key)}`;
  });
  panel.append(form);
}


function setCommentStatus(message, error = false) {
  commentStatus.textContent = message;
  commentStatus.classList.toggle('is-error', error);
}

function renderComments() {
  const scene = scenes[commentSceneIndex];
  const visible = comments
    .filter((comment) => scene.activityIds.includes(comment.activityId))
    .sort((a, b) => b.createdAt - a.createdAt);
  commentTotal.textContent = String(visible.length);
  commentList.replaceChildren();
  if (!visible.length) {
    const empty = make('div', 'comment-empty');
    empty.append(make('strong', '', '这里还空着，留给你的视角。'), make('p', '', '不必写完整总结，一句你记住的细节就很好。'));
    commentList.append(empty);
    return;
  }
  visible.forEach((comment) => {
    const card = make('article', 'comment-card');
    const head = make('div', 'comment-card-head');
    head.append(make('span', 'comment-avatar', Array.from(comment.name)[0] || '·'), make('strong', '', comment.name));
    const time = make('time', '', new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(comment.createdAt)));
    time.dateTime = new Date(comment.createdAt).toISOString();
    head.append(time);
    const body = make('p', 'comment-body', comment.text);
    const remove = make('button', 'comment-delete', '删除这条本机留言');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      if (!window.confirm('删除这条本机留言？此操作不能撤销。')) return;
      comments = comments.filter((item) => item.id !== comment.id);
      const saved = persistComments();
      renderComments();
      setCommentStatus(saved ? '已删除这条本机留言。' : '已从本次页面移除；存储不可用，刷新后旧留言可能重新出现。', !saved);
    });
    card.append(head, body, remove);
    commentList.append(card);
  });
}

function updateCommentCount() {
  commentText.setCustomValidity('');
  commentCount.textContent = `${commentText.value.length} / 500`;
}

function openSceneComments(sceneIndex, trigger) {
  const scene = scenes[sceneIndex];
  if (!scene || !commentDialog) return;
  const source = getActivity(scene.commentId);
  commentSceneIndex = sceneIndex;
  lastCommentTrigger = trigger || null;
  commentDialogTitle.textContent = '欢迎JQer留下你的评论';
  commentSourceText.textContent = source.feedback.quote;
  commentSourceName.textContent = `— ${displayFeedbackName(source.feedback.source)}`;
  commentForm.reset();
  updateCommentCount();
  setCommentStatus(commentStorageUsable ? '' : '本机存储不可用；这次留言只会暂时留在当前页面。', !commentStorageUsable);
  renderComments();
  if (!commentDialog.open) commentDialog.showModal();
  window.requestAnimationFrame(() => commentName.focus({ preventScroll: true }));
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

commentText.addEventListener('input', updateCommentCount);
commentName.addEventListener('input', () => commentName.setCustomValidity(''));
commentForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = commentName.value.trim();
  const text = commentText.value.trim();
  commentName.setCustomValidity(name ? '' : '请填写称呼，不能只输入空格。');
  commentText.setCustomValidity(text ? '' : '请写一点想法，不能只输入空格。');
  if (!commentForm.reportValidity()) return;
  if (comments.length >= MAX_COMMENTS) {
    setCommentStatus('已达到 200 条本机预览留言上限。请先删除不需要的留言。', true);
    return;
  }
  comments.push({
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    activityId: scenes[commentSceneIndex].commentId,
    name,
    text,
    createdAt: Date.now()
  });
  const saved = persistComments();
  commentText.value = '';
  updateCommentCount();
  renderComments();
  setCommentStatus(saved ? '留言已保存在这台电脑上。' : '已放入本次页面；本机存储不可用，刷新后这条留言不会保留。', !saved);
  commentText.focus({ preventScroll: true });
});

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
commentDialogClose.addEventListener('click', () => commentDialog.close());
commentDialog.addEventListener('click', (event) => {
  if (event.target === commentDialog) commentDialog.close();
});
commentDialog.addEventListener('close', () => {
  if (lastCommentTrigger?.isConnected) lastCommentTrigger.focus({ preventScroll: true });
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
  const commentPanel = make('div', 'reaction-comment-panel');
  commentPanel.hidden = true;
  commentButton.addEventListener('click', () => {
    const willOpen = commentPanel.hidden;
    commentPanel.hidden = !willOpen;
    commentButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) renderReactionComments(key, commentPanel);
  });
  bar.append(likeButton, commentButton, commentPanel);
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
  photoButton.append(photoImage);
  const imageIndex = scene.allImages.findIndex((file) => file === data.image);
  photoButton.addEventListener('click', () => openSceneArchive(sceneIndex, imageIndex === -1 ? 0 : imageIndex, photoButton));
  const caption = make('figcaption', 'variety-caption');
  if (data.tag) caption.append(make('span', 'variety-tag', data.tag));
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
  const surface = make('div', 'road-surface');
  const centerLine = make('div', 'road-center-line');
  const wordmark = make('div', 'road-wordmark', 'WIN BIG');
  world.append(surface, centerLine, wordmark);

  const echo = make('section', 'station-echo');
  const grid = make('div', 'variety-grid');
  let cards = details.variety?.cards;
  if (!cards) {
    const source = getActivity(scene.commentId);
    cards = [
      { tag: source.feedback.prompt, quote: source.feedback.quote, who: source.feedback.source,
        reactionKey: `${scene.reactionTitle}-source` },
      ...(details.highlights || []).map((item, i) => ({
        tag: item.source, quote: item.text, who: item.name,
        reactionKey: `${scene.reactionTitle}-${i}`
      }))
    ].map((item, i) => ({ ...item, image: scene.allImages[i % scene.allImages.length] }));
  }
  cards.forEach((cardData, cardIndex) => grid.append(renderVarietyCard(scene, cardData, cardIndex)));
  echo.append(grid);
  const archiveLabel = make('h3', 'archive-label', '照片合集');
  echo.append(archiveLabel, aside);

  station.append(heading, world);
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
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
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
const routeTop = document.querySelector('#route-top');
let bgmAvailable = true;
let bgmManuallyPaused = false;
let albumActive = false;
let bgmBlocked = false;
// 滚动不算“用户操作”，浏览器会拦截滚动触发的自动播放，
// 所以在活动区里等用户第一次点击或按键时再接着播。
const bgmGestureEvents = ['pointerdown', 'keydown', 'touchstart'];

function syncBgmButton(playing) {
  bgmToggle.setAttribute('aria-pressed', String(playing));
}

function stopWaitingForBgmGesture() {
  bgmBlocked = false;
  bgmGestureEvents.forEach((eventName) => window.removeEventListener(eventName, waitForBgmGesture));
}

function playBgm() {
  if (!albumActive || !bgmAvailable) {
    if (albumActive) bgmTip.hidden = false;
    return;
  }
  bgm.play().then(() => {
    // 离开活动区或手动暂停发生在异步播放完成前，也不能让音乐继续响。
    if (!albumActive || bgmManuallyPaused) {
      bgm.pause();
      return;
    }
    stopWaitingForBgmGesture();
    bgmTip.hidden = true;
    syncBgmButton(true);
  }).catch(() => {
    if (!albumActive || bgmManuallyPaused) return;
    bgmBlocked = true;
    bgmTip.hidden = false;
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
    bgmTip.hidden = true;
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
bgmTip.addEventListener('click', () => { bgmTip.hidden = true; });