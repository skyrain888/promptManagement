import { api } from './api-client.js';

// Context menu: "Save to PromptStash"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-promptstash',
    title: 'Save to PromptStash',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-promptstash' && info.selectionText) {
    const text = info.selectionText;
    const source = tab?.url ? new URL(tab.url).hostname : undefined;

    try {
      const classification = await api.classify(text);
      const categories = await api.getCategories();

      // Send data to popup for user confirmation
      chrome.storage.local.set({
        pendingSave: {
          content: text,
          suggestedTitle: classification.title,
          categoryId: classification.categoryId,
          categoryName: classification.category,
          tags: classification.tags || [],
          source,
          categories,
        },
      });

      // Notify user to open popup
      chrome.action.setBadgeText({ text: '1' });
      chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });

      // Try opening popup automatically (may fail depending on context)
      try {
        await chrome.action.openPopup();
      } catch {
        // openPopup not available in this context — badge will guide the user
      }
    } catch (err) {
      console.error('PromptStash save error:', err);
    }
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'search') {
    api.searchPrompts(message.query).then(sendResponse).catch(() => sendResponse([]));
    return true; // async response
  }
  if (message.type === 'recordUsage') {
    api.recordUsage(message.id).then(() => sendResponse({ ok: true }));
    return true;
  }
});
