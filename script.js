'use strict';

const scenes = roadData;
const activitiesById = new Map(activityData.map((activity) => [activity.id, activity]));
const stage = document.querySelector('#route-stage');
const launch = document.querySelector('#route-launch');
const roadPanel = document.querySelector('#activity-panel');
const transitionPanel = document.querySelector('#activity-transition');
const progressBar = document.querySelector('#stage-progress-bar');
const transitionKicker = document.querySelector('#transition-kicker');
const transitionTitle = document.querySelector('#transition-title');
const transitionCopy = document.querySelector('#transition-copy');
const photoDialog = document.querySelector('#photo-dialog');
const photoDialogClose = document.querySelector('#photo-dialog-close');
const photoDialogKicker = document.querySelector('#photo-dialog-kicker');
const photoDialogTitle = document.querySelector('#photo-dialog-title');
const photoDialogDescription = document.querySelector('#photo-dialog-description');
const photoDialogGrid = document.querySelector('#photo-dialog-grid');
const photoLightbox = document.querySelector('#photo-lightbox');
const photoLightboxClose = document.querySelector('#photo-lightbox-close');
const photoLightboxExit = document.querySelector('#photo-lightbox-exit');
const photoLightboxTitle = document.querySelector('#photo-lightbox-title');
const photoLightboxImage = document.querySelector('#photo-lightbox-image');
const photoLightboxCaption = document.querySelector('#photo-lightbox-caption');
const photoLightboxCount = document.querySelector('#photo-lightbox-count');
const photoLightboxPrev = document.querySelector('#photo-lightbox-prev');
const photoLightboxNext = document.querySelector('#photo-lightbox-next');
const openArchiveButton = document.querySelector('#open-archive');
const commentDialog = document.querySelector('#comment-dialog');
const commentDialogClose = document.querySelector('#comment-dialog-close');
const commentDialogKicker = document.querySelector('#comment-dialog-kicker');
const commentDialogTitle = document.querySelector('#comment-dialog-title');
const commentSourceText = document.querySelector('#comment-source-text');
const commentSourceName = document.querySelector('#comment-source-name');
const commentForm = document.querySelector('#comment-form');
const commentScope = document.querySelector('#comment-scope');
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
  commentDialogKicker.textContent = '真心话时刻';
  commentDialogTitle.textContent = `给${scene.title}的一句真心话`;
  commentSourceText.textContent = source.feedback.quote;
  commentSourceName.textContent = `— ${displayFeedbackName(source.feedback.source)} · 活动反馈文档`;
  commentScope.textContent = `正在写给：${scene.title}`;
  commentForm.reset();
  updateCommentCount();
  setCommentStatus(commentStorageUsable ? '' : '本机存储不可用；这次留言只会暂时留在当前页面。', !commentStorageUsable);
  renderComments();
  if (!commentDialog.open) commentDialog.showModal();
  window.requestAnimationFrame(() => commentName.focus({ preventScroll: true }));
}

function renderPhotoGrid(title, description, images, selectedIndex = 0, kicker = 'SCENE ARCHIVE') {
  photoDialogScene = null;
  photoDialogKicker.textContent = kicker;
  photoDialogTitle.textContent = title;
  photoDialogDescription.textContent = description;
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
  photoLightboxCaption.textContent = `${photoLightboxTitle.textContent} · 第 ${photoLightboxIndex + 1} / ${photoLightboxImages.length} 张`;
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
  renderPhotoGrid(scene.title, `${scene.subtitle}。${scene.description}`, scene.allImages, selectedIndex, 'SCENE ARCHIVE');
  window.requestAnimationFrame(() => {
    const selected = photoDialogGrid.querySelector('.archive-photo.is-focus');
    selected?.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });
}

function openFullArchive() {
  lastPhotoTrigger = openArchiveButton;
  const images = activityData.flatMap((activity) => activity.images);
  renderPhotoGrid('完整相册', '按活动分区保留的全部现场图片。', images, 0, 'FULL ARCHIVE');
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
  setCommentStatus(saved ? '真心话小纸条已启程，正漂向页尾的锦秋漂流瓶。' : '已放入本次页面；本机存储不可用，刷新后这封信不会保留。', !saved);
  sendMailToBox(comments[comments.length - 1].id);
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
openArchiveButton.addEventListener('click', openFullArchive);

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
  const key = `${scene.title}-${cardIndex}`;
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
  caption.append(make('span', 'variety-tag', data.tag));
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
  if (details.krTitle) {
    const krTitle = make('span', 'kr-title', details.krTitle);
    krTitle.setAttribute('aria-hidden', 'true');
    headingMain.append(krTitle);
  }
  const aside = make('div', 'road-aside road-thumbs');
  const thumbLimit = 12;
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
  heading.append(headingMain, aside);

  const world = make('div', 'road-world');
  const surface = make('div', 'road-surface');
  const centerLine = make('div', 'road-center-line');
  const wordmark = make('div', 'road-wordmark', 'WIN BIG');
  const interactionSign = make('div', `road-interaction-sign ${details.signClass || ''}`);
  const stopFace = make('div', 'road-stop-face', details.signFace || '정지');
  stopFace.setAttribute('aria-hidden', 'true');
  const commentButton = make('button', 'road-action road-comment-action', '真心话时刻');
  commentButton.type = 'button';
  commentButton.setAttribute('aria-label', `给${scene.title}写一句真心话`);
  commentButton.addEventListener('click', () => openSceneComments(index, commentButton));
  interactionSign.append(stopFace, commentButton);
  const leftStack = make('div', 'road-photo-stack road-photo-stack-left');
  const rightStack = make('div', 'road-photo-stack road-photo-stack-right');

  const appendProp = (className) => {
    const prop = make('span', `road-prop ${className}`);
    prop.setAttribute('aria-hidden', 'true');
    world.append(prop);
  };
  (details.props || ['prop-tangerine', 'prop-stone']).forEach(appendProp);
  (details.krTags || []).forEach((tag, tagIndex) => {
    const krTag = make('span', `kr-tag kr-tag-${tagIndex + 1}`, tag);
    krTag.setAttribute('aria-hidden', 'true');
    world.append(krTag);
  });

  const isMountainGallery = !!details.fullWidthGallery;
  const isVariety = !!details.variety;
  world.append(surface, centerLine, wordmark, interactionSign);
  if (isMountainGallery) {
    world.classList.add('road-world-spread');
    const decor = make('div', 'climb-decor');
    world.querySelectorAll('.road-prop, .kr-tag').forEach((node) => decor.append(node));
    const stage = make('div', 'climb-stage');
    const leftSide = make('div', 'climb-side climb-side-left');
    const rightSide = make('div', 'climb-side climb-side-right');
    leftSide.setAttribute('aria-live', 'polite');
    rightSide.setAttribute('aria-live', 'polite');
    const core = make('div', 'climb-core');
    const climbHint = make('p', 'climb-hint', '点击任意处，让照片从卡片左右两边铺开');
    const revealButton = make('button', 'climb-reveal-button', '点击铺开汉拿山照片');
    revealButton.type = 'button';

    // 汉拿山站的全部照片都铺在一屏里，散落摆放。
    const spreadImages = scene.allImages.length ? scene.allImages : scene.images;
    const lightboxImages = scene.allImages.length ? scene.allImages : scene.images;
    const revealBatchSize = 6;
    const climbCount = make('p', 'climb-count', `已铺开 0 / ${spreadImages.length} 张`);
    const progressTrack = make('div', 'climb-progress-track');
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-label', '汉拿山照片展开进度');
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', String(spreadImages.length));
    progressTrack.setAttribute('aria-valuenow', '0');
    const progressFill = make('span', 'climb-progress-fill');
    progressTrack.append(progressFill);
    core.append(climbHint, revealButton, climbCount, progressTrack, commentButton);
    stage.append(leftSide, core, rightSide, decor);
    world.append(stage);

    // 散落布局：位置用固定种子生成，所以刷新后每张照片还是落在原处。
    // 先按 3 列 × 4 行的格子站好，再加一点抖动和旋转，就不会看起来像表格。
    const SLOT_COLS = 3;
    const SLOT_ROWS = 4;
    const SLOT_WIDTH = 32;
    const slotRand = (() => {
      let seed = 0x5f3a91c7;
      return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();
    const makeScatter = (count) => {
      const cells = [];
      for (let row = 0; row < SLOT_ROWS; row++) {
        for (let col = 0; col < SLOT_COLS; col++) cells.push([col, row]);
      }
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(slotRand() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      return cells.slice(0, count).map(([col, row]) => ({
        x: col * (100 / SLOT_COLS) + (slotRand() - .5) * 5,
        y: row * (100 / SLOT_ROWS) + (slotRand() - .5) * 4,
        rot: (slotRand() - .5) * 13
      }));
    };
    const perSide = Math.ceil(spreadImages.length / 2);
    const scatter = [makeScatter(perSide), makeScatter(perSide)];

    // 先把所有格子摆好并占住位置，点击时只往格子里填内容。
    // 布局从加载到结束都不变，所以中间卡片不会移动，也不会因为重排而卡顿。
    const slots = spreadImages.map((file, imageIndex) => {
      const slot = make('button', 'climb-gallery-photo is-empty');
      slot.type = 'button';
      const sideIndex = imageIndex % 2;
      const place = scatter[sideIndex][Math.floor(imageIndex / 2)];
      const rot = place.rot.toFixed(2);
      slot.dataset.rot = rot;
      slot.style.setProperty('--slot-w', `${SLOT_WIDTH}%`);
      slot.style.setProperty('--slot-rot', `${rot}deg`);
      slot.style.left = `${place.x.toFixed(2)}%`;
      slot.style.top = `${place.y.toFixed(2)}%`;
      // order 只影响窄屏：那时两栏会压到卡片下方，靠 order 保持照片顺序。
      slot.style.order = String(imageIndex);
      (sideIndex === 0 ? leftSide : rightSide).append(slot);
      return slot;
    });

    let revealedCount = 0;
    let spreadBusy = false;
    const spreadFromCard = (entries) => {
      if (reducedMotion.matches) return;
      const card = core.getBoundingClientRect();
      const originX = card.left + card.width / 2;
      const originY = card.top + card.height / 2;
      requestAnimationFrame(() => {
        entries.forEach(({ el, side }, index) => {
          const rect = el.getBoundingClientRect();
          const dx = originX - (rect.left + rect.width / 2);
          const dy = originY - (rect.top + rect.height / 2);
          const rot = Number(el.dataset.rot || 0);
          const tilt = rot + (side === 'left' ? -5 : 5);
          if (typeof el.animate !== 'function') {
            el.classList.add('is-entering');
            return;
          }
          // 只动 opacity / transform：起点在卡片中心（被卡片挡住），
          // 于是照片看起来是从卡片左右两侧被推出来的。
          // 关键帧里带上这张照片自己的旋转角，收尾时才能和静态位置无缝接上。
          const animation = el.animate([
            { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.86) rotate(${tilt}deg)` },
            { opacity: 1, transform: `translate(0, 0) scale(1.03) rotate(${rot}deg)`, offset: .7 },
            { opacity: 1, transform: `translate(0, 0) scale(1) rotate(${rot}deg)` }
          ], { duration: 420, delay: index * 55, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
          animation.onfinish = () => animation.cancel();
        });
      });
    };
    const revealNextBatch = async () => {
      if (spreadBusy || revealedCount >= spreadImages.length) return;
      spreadBusy = true;
      decor.classList.add('is-active');
      const startIndex = revealedCount;
      const batch = spreadImages.slice(startIndex, startIndex + revealBatchSize);
      const prepared = batch.map((file, offset) => {
        const imageIndex = startIndex + offset;
        const slot = slots[imageIndex];
        const img = make('img');
        img.src = thumbUrl(file);
        img.alt = `汉拿山现场照片 ${imageIndex + 1}`;
        img.decoding = 'async';
        slot.append(img);
        return { slot, img, imageIndex };
      });
      revealedCount = startIndex + prepared.length;
      // 等图片解码完再入场，避免先看到一个空框再闪出图片。
      await Promise.all(prepared.map(({ img }) => (typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve())));
      const entries = prepared.map(({ slot, imageIndex }) => {
        slot.classList.remove('is-empty');
        slot.setAttribute('aria-label', `放大查看汉拿山第 ${imageIndex + 1} 张照片`);
        slot.addEventListener('click', () => openPhotoLightbox(lightboxImages, imageIndex, scene.title));
        return { el: slot, side: imageIndex % 2 === 0 ? 'left' : 'right' };
      });
      spreadFromCard(entries);
      climbCount.textContent = `已铺开 ${revealedCount} / ${spreadImages.length} 张`;
      progressTrack.setAttribute('aria-valuenow', String(revealedCount));
      progressFill.style.transform = `scaleX(${(revealedCount / spreadImages.length).toFixed(3)})`;
      if (revealedCount >= spreadImages.length) {
        revealButton.textContent = '汉拿山照片已全部铺开';
        revealButton.disabled = true;
        const rest = Math.max(lightboxImages.length - spreadImages.length, 0);
        climbHint.textContent = rest
          ? `这 ${spreadImages.length} 张精选都在这里了；其余 ${rest} 张在页尾的完整相册里。`
          : '全部照片都在这里了。';
      } else {
        const nextCount = Math.min(revealBatchSize, spreadImages.length - revealedCount);
        revealButton.textContent = `继续铺开 · 再看 ${nextCount} 张`;
      }
      spreadBusy = false;
    };
    revealButton.addEventListener('click', revealNextBatch);
    world.addEventListener('click', (event) => {
      if (event.target.closest('button, a, input, textarea')) return;
      revealNextBatch();
    });
  } else if (!isVariety) {
    const appendPhoto = (stack, imageIndex) => {
      const file = scene.images[imageIndex];
      if (!file) return;
      const button = make('button', 'road-photo');
      button.type = 'button';
      button.setAttribute('aria-label', `打开${scene.title}完整相册`);
      const image = make('img');
      image.src = thumbUrl(file);
      image.alt = `${scene.title}现场照片`;
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.decoding = 'async';
      button.append(image);
      button.addEventListener('click', () => openSceneArchive(index, imageIndex, button));
      stack.append(button);
    };
    world.append(leftStack, rightStack);
    appendPhoto(leftStack, 0);
    appendPhoto(leftStack, 2);
    appendPhoto(rightStack, 1);
    appendPhoto(rightStack, 3);
  }

  const echo = make('section', 'station-echo');
  echo.setAttribute('aria-labelledby', `echo-${scene.id}`);
  if (isVariety) {
    echo.append(make('p', 'station-echo-kicker', `${details.variety.badge} ${details.variety.round} · 照片里的真心话`));
    echo.append(make('h2', '', '每一张，都有一句现场点评'));
    echo.append(make('p', 'station-echo-intro', `${details.featureText || ''} 照片和反馈合在一起看，不再分开。`));
    const grid = make('div', 'variety-grid');
    details.variety.cards.forEach((cardData, cardIndex) => grid.append(renderVarietyCard(scene, cardData, cardIndex)));
    echo.append(grid);
  } else {
    echo.append(make('p', 'station-echo-kicker', '真心话时刻 · 这一站的回答'));
    echo.append(make('h2', '', '这一站，大家说了什么？'));
    echo.append(make('p', 'station-echo-intro', `${details.featureText || ''} 按对应环节归到这一站的回答。`));
    const source = getActivity(scene.commentId);
    const quote = make('blockquote', 'station-source-quote');
    const quoteCite = make('cite', 'station-source-cite');
    quoteCite.append(makeFeedbackAvatar(source.feedback.source, 'source-avatar'), make('span', 'source-cite-copy', `— ${displayFeedbackName(source.feedback.source)} · ${source.feedback.prompt}`));
    quote.append(make('p', '', `“${source.feedback.quote}”`), quoteCite);
    echo.append(quote);
    if (details.highlights && details.highlights.length) {
      echo.append(renderVoiceFeedbackList(details.highlights, scene.title));
    }
  }

  station.append(heading, world);
  station.append(echo);
  return station;
}

function renderSuggestionsSection() {
  const section = make('section', 'station-echo station-echo-final');
  section.id = 'station-suggestions';
  section.append(make('p', 'station-echo-kicker', '活动回声 · 给下一次的建议'));
  section.append(make('h2', '', '大家想对下一次团建说什么？'));
  section.append(make('p', 'station-echo-intro', '关于形式建议、改进与对同事的新发现。'));
  section.append(renderVoiceFeedbackList(feedbackSuggestions, '建议'));
  return section;
}

function renderAllScenes() {
  roadPanel.replaceChildren();
  roadPanel.removeAttribute('aria-hidden');
  roadPanel.inert = false;
  scenes.forEach((scene, index) => {
    roadPanel.append(renderStation(index));
    if (index < scenes.length - 1) {
      const next = scenes[index + 1];
      const separator = make('div', 'station-transition');
      separator.append(
        make('p', 'route-kicker', '继续沿路'),
        make('h2', '', `走向${next.title}`),
        make('p', '', '下一段记忆正在靠近。')
      );
      roadPanel.append(separator);
    }
  });
  roadPanel.append(renderSuggestionsSection());
}

renderAllScenes();

/* ---- 首页岛屿 → 道路过渡 ---- */
const launchSection = document.querySelector('#route-launch');
function updateIslandScroll() {
  if (reducedMotion.matches || !launchSection) return;
  const rect = launchSection.getBoundingClientRect();
  const out = -rect.top / launchSection.offsetHeight;
  launchSection.classList.toggle('road-fade', out > 0.22);
}
window.addEventListener('scroll', updateIslandScroll, { passive: true });

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

/* ---- 真心话时刻：小纸条投递 + 漂流瓶展开 ---- */
const mailboxArea = document.querySelector('#mailbox-area');
const mailboxList = document.querySelector('#mailbox-list');

function formatMailTime(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp));
}

function getAllComments() {
  return comments.slice().sort((a, b) => b.createdAt - a.createdAt);
}

function renderMailboxList() {
  if (!mailboxList) return;
  mailboxList.replaceChildren();
  const all = getAllComments();
  if (!all.length) {
    mailboxList.append(make('p', 'mailbox-empty', '漂流瓶还空着——等第一句真心话。'));
    return;
  }
  const byActivity = new Map();
  all.forEach((commentItem) => {
    const groupFor = byActivity.get(commentItem.activityId) || [];
    groupFor.push(commentItem);
    byActivity.set(commentItem.activityId, groupFor);
  });
  [...byActivity.entries()].forEach(([activityId, items]) => {
    const activity = getActivity(activityId);
    const group = make('div', 'mailbox-group');
    group.append(make('h3', '', activity.title));
    const rows = make('div', 'mailbox-rows');
    items.forEach((commentItem) => {
      const row = make('article', 'mailbox-card');
      row.dataset.id = commentItem.id;
      const head = make('div', 'mailbox-card-head');
      head.append(make('strong', '', commentItem.name), make('time', '', formatMailTime(commentItem.createdAt)));
      row.append(head, make('p', 'mailbox-card-text', commentItem.text));
      rows.append(row);
    });
    group.append(rows);
    mailboxList.append(group);
  });
  // 评论也统一收进漂流瓶
  const reactionComments = Object.entries(reactions).flatMap(([key, entry]) =>
    entry.comments.map((comment) => ({ key, ...comment }))).sort((a, b) => b.createdAt - a.createdAt);
  if (reactionComments.length) {
    const group = make('div', 'mailbox-group');
    group.append(make('h3', '', '现场评论'));
    const rows = make('div', 'mailbox-rows');
    reactionComments.forEach((comment) => {
      const row = make('article', 'mailbox-card is-reaction-comment');
      const head = make('div', 'mailbox-card-head');
      head.append(make('strong', '', comment.name), make('time', '', formatMailTime(comment.createdAt)));
      row.append(head, make('p', 'mailbox-card-text', `[${comment.key}] ${comment.text}`));
      rows.append(row);
    });
    group.append(rows);
    mailboxList.append(group);
  }
}

function animateBottleArrival() {
  if (reducedMotion.matches) return;
  mailboxArea.classList.remove('has-arrival');
  void mailboxArea.offsetWidth;
  mailboxArea.classList.add('has-arrival');
  window.setTimeout(() => mailboxArea.classList.remove('has-arrival'), 850);
}

function sendMailToBox(newCommentId) {
  if (!mailboxArea) return;
  if (commentDialog.open) commentDialog.close();
  if (!reducedMotion.matches && !document.hidden) {
    const letter = make('div', 'bottle-letter');
    letter.setAttribute('aria-hidden', 'true');
    document.body.append(letter);
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight * 0.42;
    const applyStart = () => {
      letter.style.left = `${startX - 19}px`;
      letter.style.top = `${startY - 11}px`;
      letter.style.transform = 'rotate(-4deg) scale(1)';
      letter.style.opacity = '1';
    };
    applyStart();
    mailboxArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.querySelector('#message-bottle').getBoundingClientRect();
        const dx = (target.left + target.width / 2) - (startX + 19);
        const dy = (target.top + target.height / 2) - (startY + 11);
        letter.style.transform = `translate(${dx}px, ${dy}px) rotate(16deg) scale(.18)`;
        setTimeout(() => {
          letter.remove();
          mailboxArea.classList.add('is-open');
          animateBottleArrival();
          renderMailboxList();
          const fresh = mailboxArea.querySelector(`.mailbox-card[data-id="${CSS.escape(newCommentId)}"]`);
          if (fresh) {
            fresh.classList.add('is-new');
            setTimeout(() => fresh.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
          }
        }, 950);
      });
    });
  } else {
    mailboxArea.scrollIntoView({ behavior: 'auto', block: 'center' });
    mailboxArea.classList.add('is-open');
    renderMailboxList();
  }
}

renderMailboxList();

/* ---- 主题曲：视频结束后自动播放 ---- */
const finalVideo = document.querySelector('#final-video');
const videoPlayButton = document.querySelector('#video-play');
const videoHint = document.querySelector('#video-hint');
const bgm = document.querySelector('#bgm');
const bgmToggle = document.querySelector('#bgm-toggle');
const bgmTip = document.querySelector('#bgm-tip');
let bgmAvailable = true;
let bgmManuallyPaused = false;
let bgmWaitingForGesture = false;
const bgmGestureEvents = ['pointerdown', 'keydown', 'touchstart'];

const syncBgmButton = (playing) => {
  if (!bgmToggle) return;
  bgmToggle.setAttribute('aria-pressed', String(playing));
  bgmToggle.querySelector('.bgm-label').textContent = 'WIN BIG';
};

function playBgm() {
  if (!bgm || !bgmAvailable) {
    if (bgmTip) bgmTip.hidden = false;
    return;
  }
  bgm.play().then(() => {
    bgmWaitingForGesture = false;
    syncBgmButton(true);
  }).catch(() => {
    bgmWaitingForGesture = true;
    if (bgmTip) bgmTip.hidden = false;
  });
}

function waitForBgmGesture() {
  if (!bgmWaitingForGesture) return;
  playBgm();
  if (!bgmWaitingForGesture) {
    bgmGestureEvents.forEach((eventName) => window.removeEventListener(eventName, waitForBgmGesture));
  }
}

function startBgmAfterVideo() {
  if (bgmManuallyPaused) return;
  playBgm();
  if (bgmWaitingForGesture) {
    bgmGestureEvents.forEach((eventName) => window.addEventListener(eventName, waitForBgmGesture, { passive: true }));
  }
}

if (bgm) {
  bgm.addEventListener('error', () => { bgmAvailable = false; });
  bgm.addEventListener('playing', () => { bgmAvailable = true; });
  bgm.addEventListener('pause', () => syncBgmButton(false));
  bgm.addEventListener('ended', () => syncBgmButton(false));
}

if (finalVideo && videoPlayButton) {
  finalVideo.addEventListener('play', () => {
    videoPlayButton.hidden = true;
    if (videoHint) videoHint.hidden = true;
  });
  finalVideo.addEventListener('pause', () => {
    if (!finalVideo.ended) {
      videoPlayButton.hidden = false;
      if (videoHint) videoHint.hidden = false;
    }
  });
  finalVideo.addEventListener('ended', () => {
    videoPlayButton.hidden = false;
    if (videoHint) videoHint.hidden = false;
    startBgmAfterVideo();
  });
  finalVideo.addEventListener('error', startBgmAfterVideo);
  videoPlayButton.addEventListener('click', () => { finalVideo.play(); });
}

if (bgm && bgmToggle) {
  bgmToggle.addEventListener('click', () => {
    if (bgm.paused) {
      bgmManuallyPaused = false;
      playBgm();
    } else {
      bgmManuallyPaused = true;
      bgm.pause();
      syncBgmButton(false);
    }
  });
  bgmTip.addEventListener('click', (event) => {
    if (event.target === bgmTip || event.target.closest('a')) return;
    bgmTip.hidden = true;
  });
}