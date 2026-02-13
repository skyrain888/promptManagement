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
      const matchedCat = categories.find((c: any) => c.name === classification.category);

      if (!matchedCat) {
        console.error('No matching category found');
        return;
      }

      // Send data to popup for user confirmation
      chrome.storage.local.set({
        pendingSave: {
          content: text,
          suggestedTitle: classification.suggestedTitle,
          categoryId: matchedCat.id,
          categoryName: matchedCat.name,
          tags: classification.tags,
          source,
          categories,
        },
      });

      // Open popup for confirmation
      if (tab?.id) {
        chrome.action.openPopup();
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
