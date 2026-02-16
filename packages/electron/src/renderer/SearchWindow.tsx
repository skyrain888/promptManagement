import { useState, useEffect, useRef } from 'react';

const API = 'http://127.0.0.1:9877';

interface Prompt {
  id: string;
  title: string;
  content: string;
  tags: string[];
  usageCount: number;
}

export function SearchWindow() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Prompt[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', '10');
    fetch(`${API}/api/prompts/search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setSelectedIdx(0);
      })
      .catch(() => setResults([]));
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      navigator.clipboard.writeText(results[selectedIdx].content);
      // Record usage
      fetch(`${API}/api/prompts/${results[selectedIdx].id}/use`, { method: 'POST' });
      window.close();
    } else if (e.key === 'Escape') {
      window.close();
    }
  };

  return (
    <div className="rounded-xl overflow-hidden bg-white/95 backdrop-blur-xl shadow-2xl border border-gray-200">
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search prompts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 text-lg bg-transparent outline-none"
        />
      </div>
      {results.length > 0 && (
        <div className="border-t max-h-72 overflow-y-auto">
          {results.map((p, i) => (
            <div
              key={p.id}
              className={`px-4 py-3 cursor-pointer ${i === selectedIdx ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              onClick={() => {
                navigator.clipboard.writeText(p.content);
                fetch(`${API}/api/prompts/${p.id}/use`, { method: 'POST' });
                window.close();
              }}
            >
              <div className="font-medium text-sm">{p.title}</div>
              <div className="text-xs text-gray-500 mt-1 truncate">{p.content.slice(0, 80)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
