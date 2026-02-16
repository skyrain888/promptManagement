const TRIGGER = '/p ';
const TRIGGER_ALT = ';p ';
const DEBUG = false; // Set to true to debug in console

interface PromptResult {
  id: string;
  title: string;
  content: string;
}

let dropdown: HTMLElement | null = null;
let activeInput: HTMLElement | null = null;
let selectedIndex = -1;
let currentResults: PromptResult[] = [];

function log(...args: unknown[]): void {
  if (DEBUG) console.log('[PromptStash]', ...args);
}

/** Walk up from el to find the element with an explicit contenteditable="true" attribute */
function getContentEditableRoot(el: HTMLElement | null): HTMLElement | null {
  while (el && el !== document.body) {
    if (el.getAttribute?.('contenteditable') === 'true') return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * Get the active editable element — tries event target first, then document.activeElement.
 * Returns { element, text } or null.
 */
function getEditableInfo(target?: HTMLElement): { element: HTMLElement; text: string } | null {
  const candidates = target
    ? [target, document.activeElement as HTMLElement]
    : [document.activeElement as HTMLElement];

  for (const el of candidates) {
    if (!el) continue;

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return { element: el, text: el.value };
    }

    const root = getContentEditableRoot(el);
    if (root) {
      return { element: root, text: root.textContent ?? '' };
    }
  }

  return null;
}

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

  let anchorRect: DOMRect | null = null;

  // For contentEditable, try caret position first
  if (target.isContentEditable) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const caretRect = range.getBoundingClientRect();
      if (caretRect.height > 0) {
        anchorRect = caretRect;
      }
    }
  }

  // Fallback: position relative to element
  if (!anchorRect) {
    anchorRect = target.getBoundingClientRect();
  }

  dropdown.style.maxHeight = '300px'; // Reset before measuring
  const dropdownHeight = Math.min(dropdown.scrollHeight || 300, 300);
  const spaceBelow = window.innerHeight - anchorRect.bottom - 4;
  const spaceAbove = anchorRect.top - 4;

  dropdown.style.left = `${anchorRect.left}px`;

  if (spaceBelow >= dropdownHeight) {
    // Enough space below — show below
    dropdown.style.top = `${anchorRect.bottom + 4}px`;
    dropdown.style.bottom = 'auto';
  } else if (spaceAbove >= dropdownHeight) {
    // Show above
    dropdown.style.top = `${anchorRect.top - dropdownHeight - 4}px`;
    dropdown.style.bottom = 'auto';
  } else {
    // Not enough space either way — show above and constrain height
    const constrainedHeight = Math.min(dropdownHeight, spaceAbove);
    dropdown.style.top = `${anchorRect.top - constrainedHeight - 4}px`;
    dropdown.style.bottom = 'auto';
    dropdown.style.maxHeight = `${constrainedHeight}px`;
  }
}

function showResults(results: PromptResult[]): void {
  if (!dropdown) dropdown = createDropdown();
  dropdown.innerHTML = '';
  currentResults = results;
  selectedIndex = -1;

  if (results.length === 0) {
    dropdown.innerHTML = '<div style="padding:12px;color:#999;">未找到提示词</div>';
  } else {
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const item = document.createElement('div');
      item.className = 'promptstash-item';
      item.dataset.index = String(i);
      item.style.cssText = 'padding:10px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;';
      item.innerHTML = `<div style="font-weight:600;">${escapeHtml(r.title)}</div>
        <div style="color:#666;font-size:12px;margin-top:2px;">${escapeHtml(r.content.slice(0, 60))}...</div>`;
      item.addEventListener('mouseenter', () => {
        selectedIndex = i;
        updateSelectedHighlight();
      });
      item.addEventListener('mouseleave', () => {
        selectedIndex = -1;
        updateSelectedHighlight();
      });
      item.addEventListener('click', () => {
        insertPrompt(r);
        hideDropdown();
      });
      dropdown.appendChild(item);
    }
  }
  dropdown.style.display = 'block';
}

function updateSelectedHighlight(): void {
  if (!dropdown) return;
  const items = dropdown.querySelectorAll('.promptstash-item') as NodeListOf<HTMLElement>;
  for (let i = 0; i < items.length; i++) {
    items[i].style.background = i === selectedIndex ? '#e8f0fe' : 'white';
  }
}

function hideDropdown(): void {
  if (dropdown) dropdown.style.display = 'none';
  selectedIndex = -1;
  currentResults = [];
}

function isDropdownVisible(): boolean {
  return dropdown !== null && dropdown.style.display === 'block';
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
    insertIntoContentEditable(activeInput, prompt.content);
  }

  // Record usage
  chrome.runtime.sendMessage({ type: 'recordUsage', id: prompt.id });
}

/**
 * Insert text into a contentEditable element using Selection/Range + execCommand.
 * This preserves ProseMirror/rich-editor internal state.
 */
function insertIntoContentEditable(root: HTMLElement, content: string): void {
  const fullText = root.textContent ?? '';
  const triggerIdx = Math.max(fullText.lastIndexOf(TRIGGER), fullText.lastIndexOf(TRIGGER_ALT));
  if (triggerIdx < 0) return;

  // Use TreeWalker to find the text node and offset where the trigger starts
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let charCount = 0;
  let startNode: Text | null = null;
  let startOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nodeLen = node.length;
    if (charCount + nodeLen > triggerIdx) {
      startNode = node;
      startOffset = triggerIdx - charCount;
      break;
    }
    charCount += nodeLen;
  }

  if (!startNode) return;

  // Select from trigger start to the end of all content
  const sel = window.getSelection();
  if (!sel) return;

  // Find the last text node for end of selection
  const endWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastNode: Text | null = null;
  while (endWalker.nextNode()) {
    lastNode = endWalker.currentNode as Text;
  }
  if (!lastNode) lastNode = startNode;

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(lastNode, lastNode.length);
  sel.removeAllRanges();
  sel.addRange(range);

  // Use execCommand to insert text — this preserves editor state
  document.execCommand('insertText', false, content);

  // Dispatch input event for frameworks that listen to it
  root.dispatchEvent(new Event('input', { bubbles: true }));
}

function processTarget(target?: HTMLElement): void {
  const info = getEditableInfo(target);
  if (!info) {
    log('No editable element found');
    return;
  }

  const { element, text } = info;
  log('Text:', JSON.stringify(text));

  const hasTrigger = text.includes(TRIGGER) || text.includes(TRIGGER_ALT);
  if (!hasTrigger) {
    hideDropdown();
    return;
  }

  activeInput = element;
  const triggerIdx = Math.max(text.lastIndexOf(TRIGGER), text.lastIndexOf(TRIGGER_ALT));
  const matchedTrigger = text.lastIndexOf(TRIGGER) >= text.lastIndexOf(TRIGGER_ALT) ? TRIGGER : TRIGGER_ALT;
  const query = text.slice(triggerIdx + matchedTrigger.length).trim();

  log('Trigger found, query:', query);

  chrome.runtime.sendMessage({ type: 'search', query }, (results) => {
    log('Search results:', results?.length);
    positionDropdown(element);
    showResults(results ?? []);
  });
}

/**
 * Handle input events — deferred by one microtask to let ProseMirror
 * finish its DOM updates before we read textContent.
 */
function handleInput(e: Event): void {
  const target = e.target as HTMLElement;
  // Defer: ProseMirror updates DOM asynchronously after input events
  setTimeout(() => processTarget(target), 0);
}

/**
 * Handle keyup as fallback for editors that don't fire input events reliably.
 */
function handleKeyup(e: KeyboardEvent): void {
  // Skip navigation keys that we handle in keydown
  if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) return;
  // Skip modifier-only keypresses
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

  const target = e.target as HTMLElement;
  // Defer same as input handler
  setTimeout(() => processTarget(target), 10);
}

// Listen on the whole document in capture phase (catches events before site handlers)
document.addEventListener('input', handleInput, true);

// Keyup fallback for editors that don't fire `input` reliably
document.addEventListener('keyup', handleKeyup, true);

// Keyboard navigation for dropdown — use window (not document) so our capture-phase
// handler fires before any document-level handlers registered by the host page.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isDropdownVisible()) {
      hideDropdown();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    return;
  }

  if (!isDropdownVisible() || currentResults.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopImmediatePropagation();
    selectedIndex = selectedIndex < currentResults.length - 1 ? selectedIndex + 1 : 0;
    updateSelectedHighlight();
    const items = dropdown?.querySelectorAll('.promptstash-item');
    items?.[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopImmediatePropagation();
    selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : currentResults.length - 1;
    updateSelectedHighlight();
    const items = dropdown?.querySelectorAll('.promptstash-item');
    items?.[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  } else if ((e.key === 'Enter' || e.key === 'Tab') && selectedIndex >= 0) {
    e.preventDefault();
    e.stopImmediatePropagation();
    insertPrompt(currentResults[selectedIndex]);
    hideDropdown();
  }
}, true);

// Close dropdown on click outside
document.addEventListener('click', (e) => {
  if (dropdown && !dropdown.contains(e.target as Node)) {
    hideDropdown();
  }
});

log('Content script loaded on', window.location.hostname);
