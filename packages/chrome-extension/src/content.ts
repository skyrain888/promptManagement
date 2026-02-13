const TRIGGER = '/p ';
const TRIGGER_ALT = ';p ';

interface PromptResult {
  id: string;
  title: string;
  content: string;
}

let dropdown: HTMLElement | null = null;
let activeInput: HTMLElement | null = null;

function createDropdown(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'promptstash-dropdown';
  el.style.cssText = `
    position: fixed;
    z-index: 99999;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-height: 300px;
    width: 360px;
    overflow-y: auto;
    display: none;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
  `;
  document.body.appendChild(el);
  return el;
}

function positionDropdown(target: HTMLElement): void {
  if (!dropdown) return;
  const rect = target.getBoundingClientRect();
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;
}

function showResults(results: PromptResult[]): void {
  if (!dropdown) dropdown = createDropdown();
  dropdown.innerHTML = '';
  if (results.length === 0) {
    dropdown.innerHTML = '<div style="padding:12px;color:#999;">No prompts found</div>';
  } else {
    for (const r of results) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;';
      item.innerHTML = `<div style="font-weight:600;">${escapeHtml(r.title)}</div>
        <div style="color:#666;font-size:12px;margin-top:2px;">${escapeHtml(r.content.slice(0, 60))}...</div>`;
      item.addEventListener('mouseenter', () => { item.style.background = '#f5f5f5'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'white'; });
      item.addEventListener('click', () => {
        insertPrompt(r);
        hideDropdown();
      });
      dropdown.appendChild(item);
    }
  }
  dropdown.style.display = 'block';
}

function hideDropdown(): void {
  if (dropdown) dropdown.style.display = 'none';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function insertPrompt(prompt: PromptResult): void {
  if (!activeInput) return;

  if (activeInput instanceof HTMLTextAreaElement || activeInput instanceof HTMLInputElement) {
    const val = activeInput.value;
    const triggerIdx = Math.max(val.lastIndexOf(TRIGGER), val.lastIndexOf(TRIGGER_ALT));
    if (triggerIdx >= 0) {
      activeInput.value = val.slice(0, triggerIdx) + prompt.content;
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (activeInput.isContentEditable) {
    const text = activeInput.textContent ?? '';
    const triggerIdx = Math.max(text.lastIndexOf(TRIGGER), text.lastIndexOf(TRIGGER_ALT));
    if (triggerIdx >= 0) {
      activeInput.textContent = text.slice(0, triggerIdx) + prompt.content;
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Record usage
  chrome.runtime.sendMessage({ type: 'recordUsage', id: prompt.id });
}

function handleInput(e: Event): void {
  const target = e.target as HTMLElement;
  let text = '';

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    text = target.value;
  } else if (target.isContentEditable) {
    text = target.textContent ?? '';
  } else {
    return;
  }

  const hasTrigger = text.includes(TRIGGER) || text.includes(TRIGGER_ALT);
  if (!hasTrigger) {
    hideDropdown();
    return;
  }

  activeInput = target;
  const triggerIdx = Math.max(text.lastIndexOf(TRIGGER), text.lastIndexOf(TRIGGER_ALT));
  const triggerLen = text.includes(TRIGGER) ? TRIGGER.length : TRIGGER_ALT.length;
  const query = text.slice(triggerIdx + triggerLen).trim();

  if (query.length === 0) {
    // Show recent/popular
    chrome.runtime.sendMessage({ type: 'search', query: '' }, (results) => {
      positionDropdown(target);
      showResults(results ?? []);
    });
  } else {
    chrome.runtime.sendMessage({ type: 'search', query }, (results) => {
      positionDropdown(target);
      showResults(results ?? []);
    });
  }
}

// Listen on the whole document (captures dynamic inputs)
document.addEventListener('input', handleInput, true);

// Close dropdown on click outside
document.addEventListener('click', (e) => {
  if (dropdown && !dropdown.contains(e.target as Node)) {
    hideDropdown();
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideDropdown();
});
