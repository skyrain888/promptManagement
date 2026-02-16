export {};

const BASE_URL = 'http://127.0.0.1:9877';

async function main() {
  const { execSync } = await import('node:child_process');

  // Check if PromptStash API is running
  let running = false;
  try {
    const res = await fetch(`${BASE_URL}/api/categories`, { signal: AbortSignal.timeout(2000) });
    running = res.ok;
  } catch {
    // not running
  }

  if (running) {
    // Activate the existing Electron window via AppleScript
    // Try packaged app name first, then fall back to Electron (dev mode)
    try {
      execSync(
        `osascript -e 'tell application "PromptStash" to activate' 2>/dev/null || osascript -e 'tell application "Electron" to activate'`,
        { timeout: 3000 }
      );
      console.log('PromptStash activated');
    } catch {
      console.log('PromptStash is running but could not activate window');
    }
  } else {
    // Try to launch the app
    try {
      // Try packaged app first
      execSync('open -a PromptStash 2>/dev/null || true', { timeout: 3000 });
      console.log('Launching PromptStash...');
    } catch {
      console.log('PromptStash not found. Please start the desktop app manually.');
    }
  }
}

main();
