import React, { useState, useEffect, useCallback } from 'react';

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
  source?: string;
  usageCount: number;
  isFavorite: boolean;
  updatedAt: string;
}

interface PromptForm {
  title: string;
  content: string;
  categoryId: string;
  tags: string;
  source: string;
}

const emptyForm: PromptForm = { title: '', content: '', categoryId: '', tags: '', source: '' };

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8" height="8" rx="1.5" />
      <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5l1.85 3.75L14 5.9l-3 2.92.71 4.13L8 10.94l-3.71 2.01.71-4.13-3-2.92 4.15-.65L8 1.5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M13 4v9.33a1.33 1.33 0 01-1.33 1.34H4.33A1.33 1.33 0 013 13.33V4" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
      <rect x="10" y="6" width="20" height="28" rx="3" />
      <path d="M15 14h10M15 19h10M15 24h6" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M13.5 8a5.5 5.5 0 00-.14-1.23l1.44-1.13-1-1.73-1.72.56A5.5 5.5 0 0010.73 3.3l.56-1.72-1.73-1-1.13 1.44A5.5 5.5 0 008 2.5a5.5 5.5 0 00-1.23.14L5.64 1.2l-1.73 1 .56 1.72A5.5 5.5 0 003.3 5.27l-1.72-.56-1 1.73 1.44 1.13A5.5 5.5 0 002.5 8a5.5 5.5 0 00.14 1.23L1.2 10.36l1 1.73 1.72-.56a5.5 5.5 0 001.35 1.17l-.56 1.72 1.73 1 1.13-1.44A5.5 5.5 0 008 13.5a5.5 5.5 0 001.23-.14l1.13 1.44 1.73-1-.56-1.72a5.5 5.5 0 001.17-1.35l1.72.56 1-1.73-1.44-1.13A5.5 5.5 0 0013.5 8z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  );
}

function OrganizeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M4 8h8M6 12h4" />
    </svg>
  );
}

const PRESET_ICONS = [
  '💻', '✍️', '🌐', '📊', '💡', '📁',
  '🎨', '🔧', '📚', '🎯', '🧪', '🤖',
  '📝', '🔬', '📈', '🎵', '📷', '🏠',
  '🛒', '💬', '⚙️', '🔒', '📮', '🧩',
  '🚀', '🎓', '💼', '❤️', '🌍', '⭐',
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.emoji-picker-container')) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  return (
    <div className="relative emoji-picker-container">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-8 h-8 text-center text-sm border border-gray-200 rounded hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex items-center justify-center"
      >
        {value || '📁'}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 w-[168px] overflow-hidden">
          <div className="grid grid-cols-6 gap-px">
            {PRESET_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`w-[26px] h-[26px] rounded flex items-center justify-center text-[13px] hover:bg-indigo-50 transition-colors ${value === icon ? 'bg-indigo-100 ring-1 ring-indigo-300' : ''}`}
                onClick={(e) => { e.stopPropagation(); onChange(icon); setOpen(false); }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LLMSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<LLMSettings>({
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'qwen-plus-latest',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [realApiKey, setRealApiKey] = useState('');

  useEffect(() => {
    fetch(`${API}/api/settings/llm`)
      .then((r) => r.json())
      .then((data) => {
        setSettings({ baseUrl: data.baseUrl, apiKey: data.apiKey, model: data.model });
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = { baseUrl: settings.baseUrl, model: settings.model };
      // Only send apiKey if user typed a real one (not the masked version)
      if (realApiKey) body.apiKey = realApiKey;
      const r = await fetch(`${API}/api/settings/llm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      setSettings({ baseUrl: data.baseUrl, apiKey: data.apiKey, model: data.model });
      setRealApiKey('');
      setMessage({ type: 'success', text: '设置已保存' });
    } catch {
      setMessage({ type: 'error', text: '保存设置失败' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      // Save first if there's a real key, then test
      if (realApiKey) await handleSave();
      const r = await fetch(`${API}/api/prompts/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Write a Python function that calculates the Fibonacci sequence' }),
      });
      const data = await r.json();
      if (data.fallback) {
        setMessage({ type: 'error', text: 'LLM 调用失败，已使用备用分类器' });
      } else {
        setMessage({ type: 'success', text: `测试通过 - 标题: "${data.title}", 分类: "${data.category}"` });
      }
    } catch {
      setMessage({ type: 'error', text: '连接测试失败' });
    }
    setTesting(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">LLM 设置</h2>
        <button onClick={onClose} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          关闭
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
          <input
            type="text"
            value={settings.baseUrl}
            onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={realApiKey || settings.apiKey}
              onChange={(e) => setRealApiKey(e.target.value)}
              onFocus={() => { if (!realApiKey) setRealApiKey(''); }}
              className="w-full px-3 py-2 pr-16 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-mono"
              placeholder="sk-..."
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">模型</label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-mono"
          />
        </div>
        {message && (
          <div className={`text-xs px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex-1 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-40 transition-colors"
        >
          {testing ? '测试中...' : '测试连接'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN');
}

function PromptFormPanel({
  form,
  setForm,
  categories,
  onSubmit,
  onCancel,
  onAutoClassify,
  classifying,
  submitLabel,
  suggestedCategory,
}: {
  form: PromptForm;
  setForm: (f: PromptForm) => void;
  categories: Category[];
  onSubmit: () => void;
  onCancel: () => void;
  onAutoClassify?: () => void;
  classifying?: boolean;
  submitLabel: string;
  suggestedCategory?: string | null;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{submitLabel}</h2>
        {onAutoClassify && (
          <button
            onClick={onAutoClassify}
            disabled={!form.content.trim() || classifying}
            className="text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {classifying ? '分类中...' : '自动分类'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">标题</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            placeholder="提示词标题"
          />
        </div>
        <div className="flex-1 flex flex-col">
          <label className="block text-xs font-medium text-gray-500 mb-1">内容</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="flex-1 min-h-[120px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-none font-mono"
            placeholder="提示词内容..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">分类</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white"
          >
            <option value="">选择分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>
            ))}
          </select>
          {suggestedCategory && (
            <p className="text-xs text-indigo-500 mt-1">
              建议分类: {suggestedCategory}（不在现有分类中）
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">标签（逗号分隔）</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            placeholder="标签1, 标签2"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">来源（可选）</label>
          <input
            type="text"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            placeholder="e.g. chatgpt.com"
          />
        </div>
      </div>
      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          取消
        </button>
        <button
          onClick={onSubmit}
          disabled={!form.title.trim() || !form.content.trim() || !form.categoryId}
          className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function GeneratePanel({ onSaveToForm, onClose }: {
  onSaveToForm: (data: { title: string; content: string; categoryId: string; tags: string[] }) => void;
  onClose: () => void;
}) {
  const [requirement, setRequirement] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleGenerate = async () => {
    if (!requirement.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/generate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: requirement.trim() }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Generation failed');
      }
      const data = await r.json();
      setSessionId(data.sessionId);
      setGeneratedPrompt(data.prompt);
      setGeneratedTitle(data.title);
      setHistory([
        { role: 'user', content: requirement.trim() },
        { role: 'assistant', content: data.prompt },
      ]);
    } catch (err: any) {
      setError(err.message || '生成失败');
    }
    setLoading(false);
  };

  const handleRefine = async () => {
    if (!feedback.trim() || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/generate/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, feedback: feedback.trim() }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Refinement failed');
      }
      const data = await r.json();
      setGeneratedPrompt(data.prompt);
      setGeneratedTitle(data.title);
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: feedback.trim() },
        { role: 'assistant', content: data.prompt },
      ]);
      setFeedback('');
    } catch (err: any) {
      setError(err.message || '优化失败');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!sessionId) return;
    setSaving(true);
    setError(null);
    try {
      // Classify the generated prompt to get categoryId and tags
      const classifyRes = await fetch(`${API}/api/prompts/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: generatedPrompt }),
      });
      const classifyData = await classifyRes.json();

      // Clean up the generation session
      await fetch(`${API}/api/generate/${sessionId}`, { method: 'DELETE' });

      // Send to create form with generated title + classified category/tags
      onSaveToForm({
        title: generatedTitle,
        content: generatedPrompt,
        categoryId: classifyData.categoryId || '',
        tags: classifyData.tags || [],
      });
    } catch (err: any) {
      setError(err.message || '保存失败');
    }
    setSaving(false);
  };

  const handleRestart = () => {
    if (sessionId) {
      fetch(`${API}/api/generate/${sessionId}`, { method: 'DELETE' });
    }
    setSessionId(null);
    setGeneratedPrompt('');
    setGeneratedTitle('');
    setFeedback('');
    setRequirement('');
    setHistory([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">AI 生成提示词</h2>
        <button onClick={onClose} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        {!sessionId ? (
          <>
            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-medium text-gray-500 mb-1">描述你的需求</label>
              <textarea
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                className="flex-1 min-h-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-none"
                placeholder="例如：帮我写一个代码审查助手的提示词，要求关注代码质量、安全性和性能..."
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleGenerate(); }}
              />
            </div>
            <p className="text-[11px] text-gray-400">Cmd+Enter 快速生成</p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {history.map((msg, i) => (
                <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="inline-block bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg max-w-[90%] text-left">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">{msg.content}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">优化建议</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRefine(); }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  placeholder="例如：更简洁、加上输出格式、增加示例..."
                  disabled={loading}
                />
                <button
                  onClick={handleRefine}
                  disabled={!feedback.trim() || loading}
                  className="shrink-0 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '优化中...' : '优化'}
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700">{error}</div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        {!sessionId ? (
          <button
            onClick={handleGenerate}
            disabled={!requirement.trim() || loading}
            className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '生成中...' : '生成提示词'}
          </button>
        ) : (
          <>
            <button
              onClick={handleRestart}
              disabled={loading || saving}
              className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              重新开始
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface OrganizeSuggestionItem {
  promptId: string;
  originalTitle: string;
  newTitle: string | null;
  originalCategory: string;
  newCategory: string | null;
  isNewCategory: boolean;
  originalTags: string[];
  newTags: string[] | null;
  similarTo: string[];
  reason: string;
}

interface OrganizeScanResponse {
  suggestions: OrganizeSuggestionItem[];
  totalScanned: number;
  batchesCompleted: number;
  batchesFailed: number;
}

function OrganizePanel({ onComplete, onClose }: {
  onComplete: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'results' | 'applying' | 'done'>('idle');
  const [scanResult, setScanResult] = useState<OrganizeScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'title' | 'category' | 'tags' | 'duplicates'>('title');
  const [applyResult, setApplyResult] = useState<{ applied: number; failed: number } | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const handleDeleteDuplicate = async (promptId: string) => {
    try {
      await fetch(`${API}/api/prompts/${promptId}`, { method: 'DELETE' });
      setDeletedIds(prev => new Set([...prev, promptId]));
    } catch {
      setError('删除失败');
    }
  };

  const handleScan = async () => {
    setPhase('scanning');
    setError(null);
    try {
      const r = await fetch(`${API}/api/organize/scan`, { method: 'POST' });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Scan failed');
      }
      const data: OrganizeScanResponse = await r.json();
      setScanResult(data);
      const ids = new Set<string>();
      for (const s of data.suggestions) {
        if (s.newTitle || s.newCategory || s.newTags) {
          ids.add(s.promptId);
        }
      }
      setSelected(ids);
      setPhase('results');
    } catch (err: any) {
      setError(err.message || '扫描失败');
      setPhase('idle');
    }
  };

  const handleApply = async () => {
    if (!scanResult) return;
    setPhase('applying');
    setError(null);
    const changes = scanResult.suggestions
      .filter(s => selected.has(s.promptId))
      .map(s => {
        const change: any = { promptId: s.promptId };
        if (s.newTitle) change.newTitle = s.newTitle;
        if (s.newCategory) {
          if (s.isNewCategory) {
            change.newCategoryName = s.newCategory;
            change.isNewCategory = true;
          } else {
            change.newCategoryName = s.newCategory;
          }
        }
        if (s.newTags) change.newTags = s.newTags;
        return change;
      });
    try {
      const r = await fetch(`${API}/api/organize/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Apply failed');
      }
      const result = await r.json();
      setApplyResult(result);
      setPhase('done');
    } catch (err: any) {
      setError(err.message || '应用失败');
      setPhase('results');
    }
  };

  const toggleSelect = (promptId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(promptId)) next.delete(promptId);
      else next.add(promptId);
      return next;
    });
  };

  const titleSuggestions = scanResult?.suggestions.filter(s => s.newTitle) || [];
  const categorySuggestions = scanResult?.suggestions.filter(s => s.newCategory) || [];
  const tagsSuggestions = scanResult?.suggestions.filter(s => s.newTags) || [];
  const duplicates = (scanResult?.suggestions.filter(s => s.similarTo.length > 0) || []).filter(s => !deletedIds.has(s.promptId));

  const tabCounts = {
    title: titleSuggestions.length,
    category: categorySuggestions.length,
    tags: tagsSuggestions.length,
    duplicates: duplicates.length,
  };

  const currentList = activeTab === 'title' ? titleSuggestions
    : activeTab === 'category' ? categorySuggestions
    : activeTab === 'tags' ? tagsSuggestions
    : duplicates;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">智能整理</h2>
        <button onClick={() => { if (deletedIds.size > 0) onComplete(); onClose(); }} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        {phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-3xl">🧹</div>
            <div>
              <p className="text-sm text-gray-700 font-medium">扫描所有提示词</p>
              <p className="text-xs text-gray-400 mt-1">智能优化标题、分类和标签，检测重复内容</p>
            </div>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <div>
              <p className="text-sm text-gray-700 font-medium">正在分析...</p>
              <p className="text-xs text-gray-400 mt-1">AI 正在审查您的提示词库</p>
            </div>
          </div>
        )}

        {phase === 'results' && scanResult && (
          <>
            <div className="text-xs text-gray-500">
              扫描了 {scanResult.totalScanned} 条提示词，发现 {selected.size} 条优化建议
              {scanResult.batchesFailed > 0 && (
                <span className="text-amber-500">（{scanResult.batchesFailed} 批次分析失败）</span>
              )}
            </div>

            <div className="flex gap-1 border-b border-gray-100 -mx-5 px-5">
              {([
                ['title', '标题', tabCounts.title],
                ['category', '分类', tabCounts.category],
                ['tags', '标签', tabCounts.tags],
                ['duplicates', '重复', tabCounts.duplicates],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`text-xs px-2.5 py-1.5 border-b-2 transition-colors ${
                    activeTab === key
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {currentList.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">此分类无优化建议</p>
              )}
              {currentList.map((s) => (
                <label
                  key={`${activeTab}-${s.promptId}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors"
                >
                  {activeTab !== 'duplicates' && (
                    <input
                      type="checkbox"
                      checked={selected.has(s.promptId)}
                      onChange={() => toggleSelect(s.promptId)}
                      className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    {activeTab === 'title' && (
                      <>
                        <p className="text-xs text-gray-400 line-through truncate">{s.originalTitle}</p>
                        <p className="text-xs text-gray-700 font-medium truncate">{s.newTitle}</p>
                      </>
                    )}
                    {activeTab === 'category' && (
                      <>
                        <p className="text-xs truncate">
                          <span className="text-gray-400">{s.originalTitle}</span>
                        </p>
                        <p className="text-xs">
                          <span className="text-gray-400">{s.originalCategory}</span>
                          <span className="text-gray-300 mx-1">→</span>
                          <span className="text-indigo-600 font-medium">{s.newCategory}</span>
                          {s.isNewCategory && <span className="text-[10px] text-amber-500 ml-1">新分类</span>}
                        </p>
                      </>
                    )}
                    {activeTab === 'tags' && (
                      <>
                        <p className="text-xs text-gray-400 truncate">{s.originalTitle}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {s.originalTags.map(t => (
                            <span key={`old-${t}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 line-through">{t}</span>
                          ))}
                          <span className="text-gray-300 text-[10px]">→</span>
                          {(s.newTags || []).map(t => (
                            <span key={`new-${t}`} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{t}</span>
                          ))}
                        </div>
                      </>
                    )}
                    {activeTab === 'duplicates' && (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 font-medium truncate">{s.originalTitle}</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            与 {s.similarTo.length} 条提示词内容相似
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteDuplicate(s.promptId); }}
                          className="shrink-0 text-[11px] px-2 py-1 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="删除此提示词"
                        >
                          删除
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.reason}</p>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {phase === 'applying' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-700">正在应用修改...</p>
          </div>
        )}

        {phase === 'done' && applyResult && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-3xl">✅</div>
            <div>
              <p className="text-sm text-gray-700 font-medium">整理完成</p>
              <p className="text-xs text-gray-500 mt-1">
                成功更新 {applyResult.applied} 条提示词
                {deletedIds.size > 0 && `，删除 ${deletedIds.size} 条重复`}
                {applyResult.failed > 0 && `，${applyResult.failed} 条失败`}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700">{error}</div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        {phase === 'idle' && (
          <button
            onClick={handleScan}
            className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            开始扫描
          </button>
        )}
        {phase === 'results' && (
          <>
            <button
              onClick={() => { setPhase('idle'); setScanResult(null); setError(null); }}
              className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              重新扫描
            </button>
            <button
              onClick={handleApply}
              disabled={selected.size === 0}
              className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              应用修改 ({selected.size})
            </button>
          </>
        )}
        {phase === 'done' && (
          <button
            onClick={() => { onComplete(); onClose(); }}
            className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            完成
          </button>
        )}
      </div>
    </div>
  );
}

export function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'settings' | 'generate' | 'organize'>('view');
  const [form, setForm] = useState<PromptForm>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('');
  const [categoryMenuId, setCategoryMenuId] = useState<string | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
  }, []);

  // Close category menu when clicking outside
  useEffect(() => {
    if (!categoryMenuId) return;
    const handler = () => setCategoryMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [categoryMenuId]);

  // Listen for clipboard create events from main process
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      setForm({
        title: detail.title || '',
        content: detail.content || '',
        categoryId: detail.categoryId || '',
        tags: (detail.tags || []).join(', '),
        source: '',
      });
      setMode('create');
      setSelectedPrompt(null);
      setSuggestedCategory(null);
      // If LLM created a new category, refresh the category list
      if (detail.isNewCategory) {
        fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
      }
    };
    window.addEventListener('promptstash:create-from-clipboard', handler);
    return () => window.removeEventListener('promptstash:create-from-clipboard', handler);
  }, []);

  const isFavoritesView = selectedCategoryId === '__favorites__';

  const refreshPrompts = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (isFavoritesView) {
      params.set('favorite', 'true');
    } else if (selectedCategoryId) {
      params.set('categoryId', selectedCategoryId);
    }
    fetch(`${API}/api/prompts/search?${params}`)
      .then((r) => r.json())
      .then((data) => setPrompts(Array.isArray(data) ? data : []))
      .catch(() => setPrompts([]));
  }, [searchQuery, selectedCategoryId, isFavoritesView]);

  useEffect(() => {
    refreshPrompts();
  }, [refreshPrompts]);

  const handleCopy = () => {
    if (!selectedPrompt) return;
    navigator.clipboard.writeText(selectedPrompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    fetch(`${API}/api/prompts/${selectedPrompt.id}/use`, { method: 'POST' })
      .then(() => {
        const updated = { ...selectedPrompt, usageCount: selectedPrompt.usageCount + 1 };
        setSelectedPrompt(updated);
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      });
  };

  const handleToggleFavorite = () => {
    if (!selectedPrompt) return;
    fetch(`${API}/api/prompts/${selectedPrompt.id}/favorite`, { method: 'POST' })
      .then((r) => r.json())
      .then(() => {
        const updated = { ...selectedPrompt, isFavorite: !selectedPrompt.isFavorite };
        setSelectedPrompt(updated);
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      });
  };

  const parseTags = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);

  const handleCreate = () => {
    fetch(`${API}/api/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        content: form.content.trim(),
        categoryId: form.categoryId,
        tags: parseTags(form.tags),
        source: form.source.trim() || undefined,
      }),
    })
      .then((r) => r.json())
      .then((created) => {
        setMode('view');
        setForm(emptyForm);
        setSelectedPrompt(created);
        refreshPrompts();
      });
  };

  const handleUpdate = () => {
    if (!selectedPrompt) return;
    fetch(`${API}/api/prompts/${selectedPrompt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        content: form.content.trim(),
        categoryId: form.categoryId,
        tags: parseTags(form.tags),
        source: form.source.trim() || undefined,
      }),
    })
      .then((r) => r.json())
      .then((updated) => {
        setMode('view');
        setForm(emptyForm);
        setSelectedPrompt(updated);
        refreshPrompts();
      });
  };

  const handleDelete = () => {
    if (!selectedPrompt) return;
    fetch(`${API}/api/prompts/${selectedPrompt.id}`, { method: 'DELETE' })
      .then(() => {
        setSelectedPrompt(null);
        setConfirmDelete(false);
        refreshPrompts();
      });
  };

  const startCreate = () => {
    const defaultCat = categories[0]?.id || '';
    setForm({ ...emptyForm, categoryId: defaultCat });
    setMode('create');
    setSelectedPrompt(null);
    setSuggestedCategory(null);
  };

  const startEdit = () => {
    if (!selectedPrompt) return;
    setForm({
      title: selectedPrompt.title,
      content: selectedPrompt.content,
      categoryId: selectedPrompt.categoryId,
      tags: selectedPrompt.tags.join(', '),
      source: selectedPrompt.source || '',
    });
    setMode('edit');
  };

  const cancelForm = () => {
    setMode('view');
    setForm(emptyForm);
    setSuggestedCategory(null);
  };

  const handleAutoClassify = () => {
    if (!form.content.trim()) return;
    setClassifying(true);
    fetch(`${API}/api/prompts/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: form.content }),
    })
      .then((r) => r.json())
      .then((data) => {
        // If LLM created a new category, refresh the category list
        if (data.isNewCategory) {
          fetch(`${API}/api/categories`).then((r) => r.json()).then((cats) => {
            setCategories(cats);
            setForm({
              ...form,
              title: data.title || form.title,
              categoryId: data.categoryId || form.categoryId,
              tags: data.tags?.length ? data.tags.join(', ') : form.tags,
            });
          });
        } else {
          setForm({
            ...form,
            title: data.title || form.title,
            categoryId: data.categoryId || form.categoryId,
            tags: data.tags?.length ? data.tags.join(', ') : form.tags,
          });
        }
        setSuggestedCategory(null);
      })
      .finally(() => setClassifying(false));
  };

  const handleExport = () => {
    fetch(`${API}/api/export`)
      .then((r) => r.json())
      .then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `promptstash-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = JSON.parse(reader.result as string);
        fetch(`${API}/api/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).then(() => {
          refreshPrompts();
          fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
        });
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const refreshCategories = () => {
    fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
  };

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    fetch(`${API}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), icon: newCatIcon.trim() || undefined }),
    })
      .then((r) => r.json())
      .then(() => {
        setAddingCategory(false);
        setNewCatName('');
        setNewCatIcon('');
        refreshCategories();
      });
  };

  const handleUpdateCategory = (id: string) => {
    if (!editCatName.trim()) return;
    fetch(`${API}/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editCatName.trim(), icon: editCatIcon.trim() || undefined }),
    })
      .then((r) => r.json())
      .then(() => {
        setEditingCategoryId(null);
        setEditCatName('');
        setEditCatIcon('');
        refreshCategories();
      });
  };

  const handleDeleteCategory = (id: string) => {
    fetch(`${API}/api/categories/${id}`, { method: 'DELETE' })
      .then(() => {
        setConfirmDeleteCategoryId(null);
        setCategoryMenuId(null);
        if (selectedCategoryId === id) setSelectedCategoryId(null);
        refreshCategories();
        refreshPrompts();
      });
  };

  return (
    <div className="flex h-screen bg-white font-sans text-gray-900 select-none">
      {/* Sidebar */}
      <aside className="w-52 bg-gray-50/80 border-r border-gray-200/60 flex flex-col">
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-sm font-semibold tracking-tight text-gray-900">PromptStash</h1>
        </div>
        <nav className="flex-1 px-3 flex flex-col gap-0.5 overflow-y-auto">
          <button
            className={`flex items-center gap-2.5 text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              !selectedCategoryId
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
            }`}
            onClick={() => setSelectedCategoryId(null)}
          >
            <span className="text-sm">全部提示词</span>
          </button>
          <button
            className={`flex items-center gap-2.5 text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              isFavoritesView
                ? 'bg-amber-50 text-amber-600'
                : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
            }`}
            onClick={() => setSelectedCategoryId('__favorites__')}
          >
            <span className="text-sm">⭐</span>
            <span className="text-sm">常用</span>
          </button>
          <div className="h-px bg-gray-200/60 mx-2 my-1" />
          {categories.map((c) => {
            if (editingCategoryId === c.id) {
              return (
                <div key={c.id} className="flex items-center gap-1 px-2 py-1">
                  <EmojiPicker value={editCatIcon} onChange={setEditCatIcon} />
                  <input
                    type="text"
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateCategory(c.id);
                      if (e.key === 'Escape') setEditingCategoryId(null);
                    }}
                    className="flex-1 min-w-0 text-[13px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    autoFocus
                  />
                  <button onClick={() => handleUpdateCategory(c.id)} className="text-[11px] text-indigo-600 hover:text-indigo-800 px-1">OK</button>
                  <button onClick={() => setEditingCategoryId(null)} className="text-[11px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                </div>
              );
            }

            return (
              <div
                key={c.id}
                className={`group relative flex items-center gap-2.5 text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                  selectedCategoryId === c.id
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                }`}
                onClick={() => { setSelectedCategoryId(c.id); setCategoryMenuId(null); }}
              >
                <span className="text-sm">{c.icon || ''}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 text-xs px-0.5 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setCategoryMenuId(categoryMenuId === c.id ? null : c.id); }}
                >
                  ···
                </button>

                {categoryMenuId === c.id && (
                  <div className="absolute right-0 top-full mt-0.5 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px]">
                    <button
                      className="w-full text-left px-3 py-1.5 text-[12px] text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategoryId(c.id);
                        setEditCatName(c.name);
                        setEditCatIcon(c.icon || '');
                        setCategoryMenuId(null);
                      }}
                    >
                      编辑
                    </button>
                    {c.name !== '其他' && (
                      confirmDeleteCategoryId === c.id ? (
                        <div className="px-3 py-1.5">
                          <p className="text-[11px] text-red-600 mb-1">确认删除？</p>
                          <div className="flex gap-1">
                            <button
                              className="text-[11px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                              onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); }}
                            >
                              删除
                            </button>
                            <button
                              className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteCategoryId(null); }}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="w-full text-left px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 hover:text-red-700"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteCategoryId(c.id); }}
                        >
                          删除
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add category inline */}
          {addingCategory ? (
            <div className="flex items-center gap-1 px-2 py-1 mt-0.5">
              <EmojiPicker value={newCatIcon} onChange={setNewCatIcon} />
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                  if (e.key === 'Escape') { setAddingCategory(false); setNewCatName(''); setNewCatIcon(''); }
                }}
                className="flex-1 min-w-0 text-[13px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                placeholder="分类名称"
                autoFocus
              />
              <button onClick={handleCreateCategory} className="text-[11px] text-indigo-600 hover:text-indigo-800 px-1">OK</button>
              <button onClick={() => { setAddingCategory(false); setNewCatName(''); setNewCatIcon(''); }} className="text-[11px] text-gray-400 hover:text-gray-600 px-1">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingCategory(true)}
              className="flex items-center gap-2 text-left px-3 py-1.5 rounded-lg text-[12px] text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 transition-colors mt-0.5"
            >
              <span className="text-sm">+</span>
              添加分类
            </button>
          )}
        </nav>
        <div className="px-3 pb-3 flex flex-col gap-1">
          <button
            onClick={handleImport}
            className="text-[12px] text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100/80 text-left transition-colors"
          >
            导入...
          </button>
          <button
            onClick={handleExport}
            className="text-[12px] text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100/80 text-left transition-colors"
          >
            导出...
          </button>
          <button
            onClick={() => { setMode('settings'); setSelectedPrompt(null); }}
            className={`flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-lg text-left transition-colors ${
              mode === 'settings' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/80'
            }`}
          >
            <GearIcon />
            设置
          </button>
          <button
            onClick={() => { setMode('organize'); setSelectedPrompt(null); }}
            className={`flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-lg text-left transition-colors ${
              mode === 'organize' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/80'
            }`}
          >
            <OrganizeIcon />
            整理
          </button>
        </div>
      </aside>

      {/* Main list */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Search bar + create button */}
        <div className="px-4 py-3 border-b border-gray-200/60 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2.5 bg-gray-100/80 rounded-lg px-3 py-2">
            <span className="text-gray-400 shrink-0"><SearchIcon /></span>
            <input
              type="text"
              placeholder="搜索提示词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>
          <button
            onClick={() => { setMode('generate'); setSelectedPrompt(null); }}
            className="shrink-0 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            title="AI 生成提示词"
          >
            <SparkleIcon />
          </button>
          <button
            onClick={startCreate}
            className="shrink-0 p-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            title="新建提示词"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Prompt list */}
        <div className="flex-1 overflow-y-auto">
          {prompts.map((p) => (
            <div
              key={p.id}
              className={`group/item px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 ${
                selectedPrompt?.id === p.id
                  ? 'bg-indigo-50/60'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => { setSelectedPrompt(p); setMode('view'); setConfirmDelete(false); }}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[13px] font-medium text-gray-900 leading-snug">{p.title}</h3>
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  {isFavoritesView && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetch(`${API}/api/prompts/${p.id}/favorite`, { method: 'POST' })
                          .then(() => refreshPrompts());
                      }}
                      className="opacity-0 group-hover/item:opacity-100 text-[11px] text-gray-400 hover:text-red-400 px-1.5 py-0.5 rounded transition-all"
                      title="移除常用"
                    >
                      ✕
                    </button>
                  )}
                  {p.isFavorite && (
                    <span className="text-amber-400">
                      <StarIcon filled />
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{p.content}</p>
              {p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.tags.map((t) => (
                    <span key={t} className="text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                <span>{p.usageCount} 次使用</span>
                <span>&middot;</span>
                <span>{formatTime(p.updatedAt)}</span>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {prompts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <DocIcon />
              <p className="text-sm">未找到提示词</p>
              <p className="text-xs text-gray-300">试试其他搜索词或分类</p>
            </div>
          )}
        </div>
      </main>

      {/* Right panel: form or detail */}
      {(mode === 'create' || mode === 'edit') && (
        <aside className="w-[340px] bg-white border-l border-gray-200/60 flex flex-col">
          <PromptFormPanel
            form={form}
            setForm={setForm}
            categories={categories}
            onSubmit={mode === 'create' ? handleCreate : handleUpdate}
            onCancel={cancelForm}
            onAutoClassify={handleAutoClassify}
            classifying={classifying}
            submitLabel={mode === 'create' ? '创建' : '保存'}
            suggestedCategory={suggestedCategory}
          />
        </aside>
      )}

      {mode === 'view' && selectedPrompt && (
        <aside className="w-[340px] bg-white border-l border-gray-200/60 flex flex-col">
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 leading-snug">{selectedPrompt.title}</h2>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <button
                  onClick={startEdit}
                  className="p-1 rounded-md text-gray-300 hover:text-gray-500 transition-colors"
                  title="编辑"
                >
                  <EditIcon />
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1 rounded-md text-gray-300 hover:text-red-400 transition-colors"
                  title="删除"
                >
                  <TrashIcon />
                </button>
                <button
                  onClick={handleToggleFavorite}
                  className={`p-1 rounded-md transition-colors ${
                    selectedPrompt.isFavorite
                      ? 'text-amber-400 hover:text-amber-500'
                      : 'text-gray-300 hover:text-gray-400'
                  }`}
                  title={selectedPrompt.isFavorite ? '取消收藏' : '添加收藏'}
                >
                  <StarIcon filled={selectedPrompt.isFavorite} />
                </button>
              </div>
            </div>
            {selectedPrompt.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedPrompt.tags.map((t) => (
                  <span key={t} className="text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {confirmDelete && (
            <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <span className="text-sm text-red-600">确认删除此提示词？</span>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">取消</button>
                <button onClick={handleDelete} className="text-xs px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">删除</button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            <div className="bg-gray-50 rounded-xl p-4">
              <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selectedPrompt.content}
              </pre>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3 text-xs text-gray-400">
              <span>{selectedPrompt.usageCount} 次使用</span>
              <span>&middot;</span>
              <span>更新于 {formatTime(selectedPrompt.updatedAt)}</span>
            </div>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 active:bg-gray-950 transition-colors"
            >
              {copied ? (
                <>已复制</>
              ) : (
                <>
                  <CopyIcon />
                  复制到剪贴板
                </>
              )}
            </button>
          </div>
        </aside>
      )}

      {mode === 'settings' && (
        <aside className="w-[340px] bg-white border-l border-gray-200/60 flex flex-col">
          <SettingsPanel onClose={() => setMode('view')} />
        </aside>
      )}

      {mode === 'generate' && (
        <aside className="w-[340px] bg-white border-l border-gray-200/60 flex flex-col">
          <GeneratePanel
            onSaveToForm={({ title, content, categoryId, tags }) => {
              setForm({
                title,
                content,
                categoryId,
                tags: tags.join(', '),
                source: '',
              });
              setMode('create');
              setSelectedPrompt(null);
              setSuggestedCategory(null);
              fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
            }}
            onClose={() => setMode('view')}
          />
        </aside>
      )}

      {mode === 'organize' && (
        <aside className="w-[340px] bg-white border-l border-gray-200/60 flex flex-col">
          <OrganizePanel
            onComplete={() => {
              refreshPrompts();
              fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
            }}
            onClose={() => setMode('view')}
          />
        </aside>
      )}
    </div>
  );
}
