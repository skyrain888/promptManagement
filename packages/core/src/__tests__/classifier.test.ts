import { describe, it, expect } from 'vitest';
import { Classifier } from '../classifier.js';

describe('Classifier', () => {
  const classifier = new Classifier();

  it('should classify programming-related content', () => {
    const result = classifier.classify('Help me debug this Python function that raises an error');
    expect(result.category).toBe('编程');
    expect(result.tags).toContain('python');
    expect(result.tags).toContain('debug');
  });

  it('should classify writing-related content', () => {
    const result = classifier.classify('Write a professional email to my manager about project updates');
    expect(result.category).toBe('写作');
    expect(result.tags).toContain('email');
  });

  it('should classify translation-related content', () => {
    const result = classifier.classify('Translate the following text from English to Chinese');
    expect(result.category).toBe('翻译');
  });

  it('should return 其他 for unrecognized content', () => {
    const result = classifier.classify('random words with no clear pattern xyzzy');
    expect(result.category).toBe('其他');
  });

  it('should auto-generate title from content', () => {
    const title = classifier.suggestTitle('Help me debug this Python function that raises an error when called with null arguments');
    expect(title.length).toBeLessThanOrEqual(25);
    expect(title.length).toBeGreaterThan(0);
  });
});
