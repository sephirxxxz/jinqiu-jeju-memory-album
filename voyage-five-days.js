'use strict';

const track = document.querySelector('.voyage-track');
const stage = document.querySelector('#voyage-stage');
const launchScene = document.querySelector('#launch-scene');
const travelCopy = document.querySelector('.travel-copy');
const travelKicker = document.querySelector('#travel-kicker');
const travelMessage = document.querySelector('#travel-message');
const journeyState = document.querySelector('#journey-state');
const journeyCount = document.querySelector('#journey-count');
const stageCaption = document.querySelector('#stage-caption');
const progressBar = document.querySelector('#stage-progress-bar');
const cards = [...document.querySelectorAll('.day-card')];
const dayButtons = [...document.querySelectorAll('[data-day-jump]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// The five supplied photos are intentionally distributed across five fictional days
// for this interaction test only. The real itinerary should replace these labels.
const DAY_START = 1.1;
const DAY_GAP = 1.3;
const MAX_UNITS = 7.2;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
let rafId = 0;
let lastUnits = -1;

function getUnits() {
  const rect = track.getBoundingClientRect();
  const scrollDistance = Math.max(track.offsetHeight - stage.clientHeight, 1);
  const travelled = clamp(-rect.top, 0, scrollDistance);
  // One unit is approximately one viewport of travel.
  return clamp(travelled / stage.clientHeight, 0, MAX_UNITS);
}

function setCard(card, relative, isNearest) {
  const distance = Math.abs(relative);
  const visibleDistance = .78;
  const opacity = distance >= visibleDistance ? 0 : distance < .22 ? 1 : 1 - ((distance - .22) / (.56)) * .76;
  const scale = 1 - Math.min(distance, 1.15) * .32;
  const x = relative * 31;
  const z = -Math.min(distance, 1.15) * 570;
  const rotate = relative * -7;
  card.style.transform = `translate3d(calc(-50% + ${x}vw), -50%, ${z}px) rotateY(${rotate}deg) scale(${scale})`;
  card.style.opacity = String(clamp(opacity, 0, 1));
  card.style.zIndex = String(100 - Math.round(distance * 20));
  card.style.pointerEvents = isNearest && distance < .18 ? 'auto' : 'none';
  card.setAttribute('aria-hidden', String(!isNearest));
}

function updateCards(dayFloat) {
  const nearest = Math.round(dayFloat);
  const reveal = clamp((dayFloat + .55) / .45, 0, 1);
  cards.forEach((card, index) => {
    setCard(card, index - dayFloat, index === nearest);
    card.style.opacity = String(Number(card.style.opacity) * reveal);
  });
  dayButtons.forEach((button, index) => {
    const current = index === nearest && dayFloat > -.45 && dayFloat < cards.length - .35;
    button.classList.toggle('is-current', current);
    if (current) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

function updateCopy(units, dayFloat, energy) {
  const nearest = clamp(Math.round(dayFloat), 0, cards.length - 1);
  const transitioning = units >= DAY_START - .42 && energy > .18;
  const inLaunch = units < DAY_START - .42;
  const count = inLaunch ? '00 / 05' : `${String(nearest + 1).padStart(2, '0')} / 05`;
  journeyCount.textContent = count;

  if (inLaunch) {
    journeyState.textContent = '准备出发';
    stageCaption.textContent = '向下滚动 · 进入第一天';
    travelKicker.textContent = '航线准备中';
    travelMessage.innerHTML = '向下滑<br /><em>出发。</em>';
  } else if (transitioning) {
    const target = clamp(Math.ceil(dayFloat) + 1, 1, 5);
    journeyState.textContent = '航行中';
    stageCaption.textContent = `前往 DAY ${String(target).padStart(2, '0')}`;
    travelKicker.textContent = `IN TRANSIT / DAY ${String(target).padStart(2, '0')}`;
    travelMessage.innerHTML = `穿过这一段<br /><em>抵达下一天。</em>`;
  } else {
    journeyState.textContent = `DAY ${String(nearest + 1).padStart(2, '0')} · 已到达`;
    stageCaption.textContent = `DAY ${String(nearest + 1).padStart(2, '0')} · 停留看照片`;
    travelKicker.textContent = `ARRIVED / DAY ${String(nearest + 1).padStart(2, '0')}`;
    travelMessage.innerHTML = `停在这里<br /><em>看一会儿。</em>`;
  }
}

function update() {
  rafId = 0;
  const units = getUnits();
  if (Math.abs(units - lastUnits) < .001 && !reducedMotion.matches) return;
  lastUnits = units;

  const dayFloat = (units - DAY_START) / DAY_GAP;
  const nearestCenter = Math.round(dayFloat);
  const centerDistance = Math.abs(dayFloat - nearestCenter);
  const energy = units < DAY_START - .42
    ? clamp((units - .15) / 1.0, 0, 1) * .55
    : clamp(centerDistance * 2.1, 0, 1);
  const launchProgress = clamp((units - .05) / (DAY_START - .1), 0, 1);
  const launchOpacity = units < DAY_START - .42 ? 1 - launchProgress * .86 : 0;
  const launchScale = 1 + launchProgress * .68;
  const launchY = -50 - launchProgress * 9;

  stage.style.setProperty('--flight-energy', energy.toFixed(3));
  launchScene.style.opacity = String(clamp(launchOpacity, 0, 1));
  launchScene.style.transform = `translate(-50%, ${launchY}%) scale(${launchScale})`;
  travelCopy.style.opacity = String(clamp((units - .65) * 2.4, 0, 1));
  progressBar.style.height = `${clamp((units / MAX_UNITS) * 100, 0, 100)}%`;
  updateCards(dayFloat);
  updateCopy(units, dayFloat, energy);
}

function requestUpdate() {
  if (rafId) return;
  rafId = window.requestAnimationFrame(update);
}
window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('resize', requestUpdate);
update();

function jumpToDay(index) {
  if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;
  const trackTop = window.scrollY + track.getBoundingClientRect().top;
  const targetTop = trackTop + (DAY_START + index * DAY_GAP) * stage.clientHeight;
  window.scrollTo({ top: targetTop, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}
dayButtons.forEach((button) => {
  button.addEventListener('click', () => jumpToDay(Number(button.dataset.dayJump)));
});

document.querySelector('.scroll-prompt')?.addEventListener('click', () => jumpToDay(0));
