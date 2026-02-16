# Organize Feature Design

## Overview

Add an "organize/tidy" feature to PromptStash that uses AI to scan all prompts and suggest optimizations for titles, categories, tags, and detect duplicates. Users review suggestions and selectively apply changes.

## Approach

**Smart recommendation + manual confirmation**: System scans all prompts via LLM, presents optimization suggestions, user selects which to apply.

**Full scan mode**: All prompts are sent to LLM in batches with global context (all categories, all tags) so suggestions are consistent across the entire library.

## Backend

### Core Service: `PromptOrganizer` (`packages/core/src/prompt-organizer.ts`)

Reuses existing `LLMService` patterns (same config, structured JSON responses).

**Processing flow:**
1. Load all prompts (id, title, content truncated to 500 chars, categoryId, tags)
2. Load all categories and tags as context
3. Send to LLM in batches (~10-15 prompts per batch)
4. Each batch's system prompt includes: full category list, all existing tags, batch prompt data
5. LLM returns structured JSON with suggestions per prompt
6. Aggregate results, group duplicates

**LLM response format per batch:**
```json
{
  "suggestions": [
    {
      "promptId": "xxx",
      "newTitle": "optimized title or null",
      "newCategoryId": "existing-cat-id or null",
      "newCategoryName": "new category name if suggesting new",
      "newTags": ["tag1", "tag2"],
      "similarTo": ["other-prompt-id"],
      "reason": "explanation of why this change is suggested"
    }
  ]
}
```

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/organize/scan` | Trigger full scan, return all suggestions |
| POST | `/api/organize/apply` | Apply user-selected suggestions |

**`POST /api/organize/scan`**
- No request body
- Response: `{ suggestions: Suggestion[], duplicates: DuplicateGroup[] }`
- Internally batches LLM calls

**`POST /api/organize/apply`**
- Request: `{ changes: [{ promptId, newTitle?, newCategoryId?, newTags? }] }`
- Batch updates database
- Response: update results summary

## Frontend

### Entry Point

Add "Organize" button in left sidebar (similar to existing "AI Generate" entry).

### OrganizePanel (right panel)

**State 1 - Initial:**
- Description text explaining the feature
- "Start Scan" button

**State 2 - Scanning:**
- Progress bar + batch progress text ("Analyzing batch 2/5...")
- Cancel button

**State 3 - Results:**
- Top summary: N suggestions found, M duplicate groups
- Four tabs: Title Optimization / Category Adjustment / Tag Optimization / Duplicates
- Each suggestion shows: original → suggested value + reason + checkbox
- All selected by default, user can deselect
- "Apply Selected Changes" button at bottom

**State 4 - Applying/Complete:**
- Apply progress → completion summary with stats

### UI Style

Matches existing GeneratePanel conventions (same button styles, colors, spacing, Tailwind classes).

## Optimization Scope

1. **Titles**: Improve vague or overly long titles to be concise and descriptive
2. **Categories**: Reassign prompts to more appropriate categories, suggest new categories if needed
3. **Tags**: Standardize tag names, add missing tags, remove irrelevant ones
4. **Duplicates**: Flag content-similar prompts for user awareness (no auto-merge)

## Technical Notes

- LLM temperature: 0.3 (deterministic, consistent suggestions)
- Content truncation: 500 chars per prompt for batch analysis
- Batch size: 10-15 prompts per LLM call
- Fallback: If LLM fails for a batch, skip that batch and report partial results
- New categories suggested by LLM are created on apply (same pattern as classify)
