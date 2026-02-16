export {};

const BASE_URL = 'http://127.0.0.1:9877';

interface AlfredItem {
  title: string;
  subtitle: string;
  arg: string;
  uid: string;
}

async function main() {
  const query = process.argv[2] ?? '';

  try {
    const res = await fetch(
      `${BASE_URL}/api/prompts/search?q=${encodeURIComponent(query)}&limit=20`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const prompts = await res.json();

    const items: AlfredItem[] = prompts.map((p: any) => ({
      uid: p.id,
      title: p.title,
      subtitle: p.content.slice(0, 80),
      arg: p.content,
    }));

    console.log(JSON.stringify({ items }));
  } catch {
    console.log(
      JSON.stringify({
        items: [
          {
            title: 'PromptStash not running',
            subtitle: 'Please start the PromptStash desktop app',
            arg: '',
            valid: false,
          },
        ],
      })
    );
  }
}

main();
