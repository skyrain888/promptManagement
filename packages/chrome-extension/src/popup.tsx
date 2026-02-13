import { api } from './api-client.js';

interface PendingSave {
  content: string;
  suggestedTitle: string;
  categoryId: string;
  categoryName: string;
  tags: string[];
  source?: string;
  categories: { id: string; name: string }[];
}

async function init() {
  const root = document.getElementById('root')!;

  const data = await chrome.storage.local.get('pendingSave');
  const pending = data.pendingSave as PendingSave | undefined;

  if (!pending) {
    root.innerHTML = `
      <div style="padding:20px;text-align:center;">
        <h3 style="margin:0 0 8px;">PromptStash</h3>
        <p style="color:#666;font-size:13px;">Select text on any AI page, right-click, and choose "Save to PromptStash"</p>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div style="padding:16px;">
      <h3 style="margin:0 0 12px;">Save Prompt</h3>
      <label style="display:block;margin-bottom:8px;font-size:13px;color:#555;">Title</label>
      <input id="title" type="text" value="${escapeAttr(pending.suggestedTitle)}"
        style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;margin-bottom:12px;" />

      <label style="display:block;margin-bottom:8px;font-size:13px;color:#555;">Category</label>
      <select id="category" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:12px;">
        ${pending.categories.map((c) =>
          `<option value="${c.id}" ${c.id === pending.categoryId ? 'selected' : ''}>${c.name}</option>`
        ).join('')}
      </select>

      <label style="display:block;margin-bottom:8px;font-size:13px;color:#555;">Tags</label>
      <input id="tags" type="text" value="${pending.tags.join(', ')}"
        style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;margin-bottom:12px;"
        placeholder="comma separated" />

      <div style="color:#999;font-size:12px;margin-bottom:12px;max-height:60px;overflow-y:auto;">
        ${escapeHtml(pending.content.slice(0, 200))}${pending.content.length > 200 ? '...' : ''}
      </div>

      <button id="save-btn"
        style="width:100%;padding:10px;background:#4F46E5;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
        Save
      </button>
      <div id="status" style="margin-top:8px;text-align:center;font-size:13px;"></div>
    </div>`;

  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const title = (document.getElementById('title') as HTMLInputElement).value.trim();
    const categoryId = (document.getElementById('category') as HTMLSelectElement).value;
    const tagsStr = (document.getElementById('tags') as HTMLInputElement).value;
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    const statusEl = document.getElementById('status')!;

    try {
      await api.createPrompt({
        title: title || pending.suggestedTitle,
        content: pending.content,
        categoryId,
        tags,
        source: pending.source,
      });
      statusEl.style.color = '#16a34a';
      statusEl.textContent = 'Saved!';
      await chrome.storage.local.remove('pendingSave');
      setTimeout(() => window.close(), 800);
    } catch (err) {
      statusEl.style.color = '#dc2626';
      statusEl.textContent = 'Error: Is PromptStash desktop app running?';
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}

init();
