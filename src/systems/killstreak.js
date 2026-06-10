// Kill streak tracking and funny announcements

import { showNotice } from '../ui/notices.js';
import { playKillStreakSound } from '../systems/audio.js';

let streakCount = 0;
let lastKillTime = 0;
const STREAK_WINDOW = 10000; // 10 seconds to chain kills

const STREAK_MESSAGES = {
  2: { msg: "🔥 双杀！还行吧", color: "#f39c12" },
  3: { msg: "⚡ 三杀！对面是不是没吃饭？", color: "#e67e22" },
  4: { msg: "💀 四杀！你是认真的吗？", color: "#e74c3c" },
  5: { msg: "🏆 五杀！无人能挡！", color: "#9b59b6" },
  6: { msg: "👑 超神了！建议去参加职业比赛", color: "#ff00ff" },
};

export function registerKill() {
  const now = Date.now();
  if (now - lastKillTime < STREAK_WINDOW) {
    streakCount++;
  } else {
    streakCount = 1;
  }
  lastKillTime = now;

  const level = Math.min(streakCount, 6);
  if (streakCount >= 2) {
    const data = STREAK_MESSAGES[level];
    showNotice(data.msg, data.color);
    playKillStreakSound(level);
  }
}

export function resetStreak() {
  streakCount = 0;
  lastKillTime = 0;
}
