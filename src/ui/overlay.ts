/**
 * 窗口内 HTML 覆盖层:举牌文字 / 对话气泡 / 右键菜单。
 * 覆盖层打开时通过 onOverlayChange 通知 main,把整个窗口设为可交互
 * (否则点击穿透轮询会把菜单区域放行给桌面)。
 */

let overlayCount = 0;
let onOverlayChange: (active: boolean) => void = () => {};

export function setOverlayListener(fn: (active: boolean) => void): void {
  onOverlayChange = fn;
}

function pushOverlay(): void {
  overlayCount++;
  if (overlayCount === 1) onOverlayChange(true);
}

function popOverlay(): void {
  overlayCount = Math.max(0, overlayCount - 1);
  if (overlayCount === 0) onOverlayChange(false);
}

// ---------------------------------------------------------------- 举牌

const signEl = document.getElementById('sign') as HTMLDivElement;
let signTimer: ReturnType<typeof setTimeout> | null = null;

export function showSign(text: string, ms = 4500): void {
  signEl.textContent = text;
  signEl.classList.remove('hidden');
  if (signTimer) clearTimeout(signTimer);
  signTimer = setTimeout(() => {
    signEl.classList.add('hidden');
    signTimer = null;
  }, ms);
}

export function hideSign(): void {
  if (signTimer) clearTimeout(signTimer);
  signTimer = null;
  signEl.classList.add('hidden');
  signEl.classList.remove('action');
}

/**
 * 可点击的举牌(健康任务):显示期间整窗可交互;
 * 点击触发 onClick,超时未点自动收起。
 */
export function showActionSign(text: string, ms: number, onClick: () => void): void {
  hideSign();
  signEl.textContent = text;
  signEl.classList.remove('hidden');
  signEl.classList.add('action');
  pushOverlay();
  let done = false;
  const finish = (clicked: boolean): void => {
    if (done) return;
    done = true;
    signEl.removeEventListener('click', onSignClick);
    signEl.classList.add('hidden');
    signEl.classList.remove('action');
    popOverlay();
    if (clicked) onClick();
  };
  const onSignClick = (): void => finish(true);
  signEl.addEventListener('click', onSignClick);
  if (signTimer) clearTimeout(signTimer);
  signTimer = setTimeout(() => {
    signTimer = null;
    finish(false);
  }, ms);
}

// ---------------------------------------------------------------- 对话气泡

const bubbleEl = document.getElementById('bubble') as HTMLDivElement;
const bubbleInput = bubbleEl.querySelector('input') as HTMLInputElement;
const bubbleReply = bubbleEl.querySelector('.reply') as HTMLDivElement;
let bubbleOpen = false;

export function openBubble(onSend: (text: string) => Promise<string>): void {
  if (bubbleOpen) return;
  bubbleOpen = true;
  pushOverlay();
  bubbleReply.textContent = '(它歪着头看你…)';
  bubbleInput.value = '';
  bubbleEl.classList.remove('hidden');
  setTimeout(() => bubbleInput.focus(), 50);

  const close = (): void => {
    if (!bubbleOpen) return;
    bubbleOpen = false;
    bubbleEl.classList.add('hidden');
    bubbleInput.removeEventListener('keydown', onKey);
    popOverlay();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter') {
      const text = bubbleInput.value.trim();
      if (!text) return;
      bubbleInput.value = '';
      bubbleReply.textContent = '…';
      void onSend(text).then((reply) => {
        if (bubbleOpen) bubbleReply.textContent = reply;
      });
    }
  };
  bubbleInput.addEventListener('keydown', onKey);
}

export function isBubbleOpen(): boolean {
  return bubbleOpen;
}

// ---------------------------------------------------------------- 右键菜单

const menuEl = document.getElementById('menu') as HTMLDivElement;
const submenuEl = document.getElementById('submenu') as HTMLDivElement;
let menuOpen = false;

export interface MenuItem {
  label: string;
  tag?: string;
  disabled?: boolean;
  action?: () => void;
  submenu?: Array<{ label: string; action: () => void }>;
}

export function closeMenu(): void {
  if (!menuOpen) return;
  menuOpen = false;
  menuEl.classList.add('hidden');
  submenuEl.classList.add('hidden');
  popOverlay();
}

export function openMenu(x: number, y: number, items: Array<MenuItem | 'sep'>): void {
  closeMenu();
  menuOpen = true;
  pushOverlay();

  menuEl.innerHTML = '';
  submenuEl.classList.add('hidden');

  for (const item of items) {
    if (item === 'sep') {
      const sep = document.createElement('div');
      sep.className = 'sep';
      menuEl.appendChild(sep);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'item' + (item.disabled ? ' disabled' : '');
    const label = document.createElement('span');
    label.textContent = item.label;
    el.appendChild(label);
    if (item.tag) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = item.tag;
      el.appendChild(tag);
    }
    if (!item.disabled) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.submenu) {
          openSubmenu(el, item.submenu);
        } else {
          closeMenu();
          item.action?.();
        }
      });
    }
    menuEl.appendChild(el);
  }

  menuEl.classList.remove('hidden');
  // 先显示才能量尺寸,再夹取到窗口内
  const rect = menuEl.getBoundingClientRect();
  const px = Math.min(Math.max(4, x), 260 - rect.width - 4);
  const py = Math.min(Math.max(4, y), 300 - rect.height - 4);
  menuEl.style.left = `${px}px`;
  menuEl.style.top = `${py}px`;
}

function openSubmenu(anchor: HTMLElement, items: Array<{ label: string; action: () => void }>): void {
  submenuEl.innerHTML = '';
  for (const it of items) {
    const el = document.createElement('div');
    el.className = 'item';
    el.textContent = it.label;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      it.action();
    });
    submenuEl.appendChild(el);
  }
  submenuEl.classList.remove('hidden');
  const a = anchor.getBoundingClientRect();
  const m = menuEl.getBoundingClientRect();
  let left = m.left - 114;
  if (left < 2) left = m.right + 4;
  if (left + 110 > 258) left = 2;
  let top = a.top;
  const sh = Math.min(items.length * 23 + 8, 190);
  if (top + sh > 296) top = 296 - sh;
  submenuEl.style.left = `${left}px`;
  submenuEl.style.top = `${top}px`;
}

// 点击窗口空白处关闭菜单
document.addEventListener('pointerdown', (e) => {
  if (!menuOpen) return;
  const t = e.target as Node;
  if (!menuEl.contains(t) && !submenuEl.contains(t)) closeMenu();
});

export function isMenuOpen(): boolean {
  return menuOpen;
}
