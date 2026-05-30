// Notification and kill feed system

import { state } from '../state.js';

export function showNotice(msg, color = "#fff") {
  let el = document.createElement('div');
  el.innerText = msg;
  el.style.position = 'absolute';
  el.style.top = '70%';
  el.style.left = '50%';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.color = color;
  el.style.fontSize = '26px';
  el.style.fontWeight = 'bold';
  el.style.textShadow = '2px 2px 4px black';
  el.style.zIndex = '100';
  document.body.appendChild(el);

  let op = 1;
  let opIntv = setInterval(() => {
    op -= 0.02;
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
