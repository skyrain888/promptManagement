import { useState, useEffect } from 'react';

const API = 'http://127.0.0.1:9877';

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Prompt {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
  usageCount: number;
  isFavorite: boolean;
  updatedAt: string;
}

export function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategoryId) params.set('categoryId', selectedCategoryId);
    fetch(`${API}/api/prompts/search?${params}`).then((r) => r.json()).then(setPrompts);
  }, [searchQuery, selectedCategoryId]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar: categories */}
      <aside className="w-56 bg-white border-r p-4 flex flex-col gap-1">
        <h2 className="text-lg font-bold mb-3">PromptStash</h2>
        <button
          className={`text-left px-3 py-2 rounded text-sm ${!selectedCategoryId ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'}`}
          onClick={() => setSelectedCategoryId(null)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`text-left px-3 py-2 rounded text-sm ${selectedCategoryId === c.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'}`}
            onClick={() => setSelectedCategoryId(c.id)}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </aside>

      {/* Main: prompt list */}
      <main className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {prompts.map((p) => (
            <div
              key={p.id}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedPrompt?.id === p.id ? 'bg-indigo-50' : ''}`}
              onClick={() => setSelectedPrompt(p)}
            >
              <div className="font-medium text-sm">{p.title}</div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{p.content}</div>
              <div className="flex gap-1 mt-2">
                {p.tags.map((t) => (
                  <span key={t} className="text-xs bg-gray-200 px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </div>
          ))}
          {prompts.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No prompts yet</div>
          )}
        </div>
      </main>

      {/* Detail panel */}
      {selectedPrompt && (
        <aside className="w-80 bg-white border-l p-4 flex flex-col">
          <h3 className="font-bold text-sm mb-2">{selectedPrompt.title}</h3>
          <pre className="flex-1 text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded overflow-y-auto">
            {selectedPrompt.content}
          </pre>
          <div className="mt-3 flex gap-2">
            <button
              className="flex-1 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
              onClick={() => navigator.clipboard.writeText(selectedPrompt.content)}
            >
              Copy
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
