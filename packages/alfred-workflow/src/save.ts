export {};

const BASE_URL = 'http://127.0.0.1:9877';

async function main() {
  const title = process.argv[2] ?? 'Untitled';
  const { execSync } = await import('node:child_process');
  const content = execSync('pbpaste').toString().trim();

  if (!content) {
    console.log('Clipboard is empty');
    return;
  }

  try {
    // Classify first
    const classifyRes = await fetch(`${BASE_URL}/api/prompts/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const classification = await classifyRes.json();

    // Get categories
    const catRes = await fetch(`${BASE_URL}/api/categories`);
    const categories = await catRes.json();
    const matchedCat = categories.find((c: any) => c.name === classification.category) ?? categories[0];

    // Save
    const saveRes = await fetch(`${BASE_URL}/api/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        categoryId: matchedCat.id,
        tags: classification.tags,
      }),
    });

    if (saveRes.ok) {
      console.log(`Saved: ${title}`);
    } else {
      console.log('Failed to save');
    }
  } catch {
    console.log('PromptStash not running');
  }
}

main();
