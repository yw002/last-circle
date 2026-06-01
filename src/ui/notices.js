// Notification and kill feed system - with deduplication

import { state } from '../state.js';

// Track recent notices to prevent spam
const recentNotices = new Map();
const NOTICE_COOLDOWN = 3000; // 3 seconds cooldown for same message

export function showNotice(msg, color = "#fff") {
  // Check if this exact message was shown recently
  const now = Date.now();
  const lastShown = recentNotices.get(msg);
  if (lastShown && now - lastShown < NOTICE_COOLDOWN) {
    return; // Skip duplicate message
  }
  recentNotices.set(msg, now);

  // Clean up old entries periodically
  if (recentNotices.size > 50) {
    for (const [key, time] of recentNotices) {
      if (now - time > NOTICE_COOLDOWN * 2) {
        recentNotices.delete(key);
      }
    }
  }

  // Limit max visible notices
  const existingNotices = document.querySelectorAll('.game-notice');
  if (existingNotices.length >= 3) {
    // Remove oldest notice
    existingNotices[0].remove();
  }

  let el = document.createElement('div');
  el.className = 'game-notice';
  el.innerText = msg;
  el.style.position = 'absolute';
  el.style.top = '70%';
  el.style.left = '50%';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.color = color;
  el.style.fontSize = '24px';
  el.style.fontWeight = 'bold';
  el.style.textShadow = '2px 2px 4px black';
  el.style.zIndex = '100';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);

  let op = 1;
  let opIntv = setInterval(() => {
    op -= 0.025;
    el.style.opacity = op;
    el.style.top = (70 - (1 - op) * 5) + '%';
    if (op <= 0) {
      clearInterval(opIntv);
      if (document.body.contains(el)) document.body.removeChild(el);
    }
  }, 30);
}

export function addKillFeed(msg) {
  state.killFeed.push(msg);
  if (state.killFeed.length > 4) state.killFeed.shift();
  document.getElementById('kill-feed').innerHTML = state.killFeed.join('<br>');
  setTimeout(() => {
    state.killFeed.shift();
    document.getElementById('kill-feed').innerHTML = state.killFeed.join('<br>');
  }, 6000);
}
