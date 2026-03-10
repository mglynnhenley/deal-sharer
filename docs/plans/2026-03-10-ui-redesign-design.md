# UI Redesign — Design Doc

Date: 2026-03-10

## Goals

1. Anthropic-inspired visual design with high contrast and readability
2. Tabbed home page showing deals and investors
3. Batch extraction for both deals and investors — no confirmation step, straight to DB
4. Inline editing on all list items (click to edit, save on blur)
5. Deals grouped by week, sorted by priority within the current week
6. Investors sorted by priority_threshold ascending

## 1. Visual Design

### Color Palette
- **Page background:** warm off-white `#FAF9F7`
- **Cards:** white `#FFFFFF`, border `border-gray-200`
- **Primary text:** `#1A1A1A` (near-black)
- **Secondary text:** `#555555` — never lighter for readable content
- **Primary buttons:** black `#000`, hover `#333`
- **Secondary buttons:** `border-gray-300`, `text-gray-700`, hover `bg-gray-50`
- **Priority badges:** `bg-amber-50 text-amber-800` (P1), `bg-gray-100 text-gray-700` (P2/P3)
- **Sector tags:** `bg-blue-50 text-blue-800`
- **Focus rings:** visible, using default ring or `ring-2 ring-black/20`

### Typography
- No `text-xs` for user-facing content — minimum `text-sm` (14px)
- Company/contact names: `text-base font-semibold`
- Body/descriptions: `text-sm` with good line height
- Labels: `text-sm font-medium text-gray-700`
- Section headings: `text-lg font-semibold`
- Tab headings: `text-base font-medium`

### Spacing
- Card padding: `p-4` minimum
- Section gaps: `space-y-6`
- Card list gaps: `space-y-3`
- Generous margins between input area and list

## 2. Home Page — Tabbed Layout

### Route Change
- `/` renders the home page directly (remove redirect to `/deals`)
- `/deals` and `/investors` routes remain as aliases (redirect to `/?tab=deals` / `/?tab=investors`)

### Tab Structure
- Two tabs at the top: "Deals" | "Investors"
- Active tab: bold text with bottom border indicator
- Tab state stored in URL search param `?tab=deals` (default) or `?tab=investors`
- Server component reads tab param, fetches appropriate data

### Deals Tab Content
1. Text input area + voice recorder button at top
2. "Extract Deals" button
3. Deal list grouped by week (see section 5)

### Investors Tab Content
1. Text input area at top
2. "Extract Investors" button
3. Investor list sorted by priority_threshold (see section 6)

## 3. Batch Extraction — No Confirmation

### Deals (already batch, remove review step)
- User pastes text, clicks "Extract Deals"
- API extracts array of deals
- Each deal is saved to DB immediately with default priority 3
- List refreshes showing new deals at the top of "This Week"
- Brief flash message: "3 deals added"

### Investors (new: batch extraction)
- Update `INVESTOR_EXTRACTION_PROMPT` to instruct LLM to return a JSON array
- Update `parseInvestorFromLLMResponse` → `parseInvestorsFromLLMResponse` (return array)
- Update `/api/extract-investor` to return `{ investors: ExtractedInvestor[] }`
- User pastes text describing multiple investors, clicks "Extract Investors"
- All extracted investors saved to DB immediately with defaults (threshold 3, weekly)
- Brief flash message: "4 investors added"

### Default Values on Auto-Save
- Deals: `priority: 3`, `status: 'active'`, `currency: 'EUR'`
- Investors: `priority_threshold: 3`, `sharing_frequency: 'weekly'`

## 4. Inline Editing

### EditableField Component
- Renders as plain styled text by default
- On click: transforms into an input (text, select, or textarea based on field type)
- On blur: saves via server action, reverts to text display
- While saving: subtle opacity change or brief highlight
- On error: shows red border briefly, reverts to previous value

### Field Types
- **Text fields:** company_name, fund_name, email, linkedin_url, website_url, one_liner, thesis_description
- **Select fields:** priority (1/2/3), status, currency, priority_threshold, sharing_frequency
- **Tag fields:** sectors (click to edit comma-separated, split on save)

### Server Actions Needed
- `updateDeal(id: string, field: string, value: any)` — updates single field
- `updateInvestor(id: string, field: string, value: any)` — updates single field
- `deleteDeal(id: string)` — removes deal
- `deleteInvestor(id: string)` — removes investor

## 5. Deal Ordering & Grouping

### Week Grouping
- Group deals by the week they were created (Monday–Sunday)
- Week headers: "This Week", "Last Week", then "Feb 24 – Mar 1" format for older

### Sort Order
- Within each week: sort by priority ascending (P1 first), then by created_at descending
- Weeks ordered most recent first

### Display
- Each week is a collapsible section (open by default for current + last week)
- Week header shows deal count

## 6. Investor Ordering

- Primary sort: `priority_threshold` ascending (1 = pickiest investors first)
- Secondary sort: `created_at` descending (newest first within same threshold)
- No grouping — flat list with threshold badge visible

## 7. Components Changed

| Component | Change |
|-----------|--------|
| `src/app/page.tsx` | Tabbed home page instead of redirect |
| `src/app/deals/page.tsx` | Redirect to `/?tab=deals` |
| `src/app/investors/page.tsx` | Redirect to `/?tab=investors` |
| `src/components/deals/DealInput.tsx` | Remove review cards, save directly, show flash |
| `src/components/deals/DealReviewCard.tsx` | Delete — no longer needed |
| `src/components/investors/InvestorInput.tsx` | Batch extraction, remove review card, save directly |
| `src/components/investors/InvestorReviewCard.tsx` | Delete — no longer needed |
| `src/components/EditableField.tsx` | New — inline edit component |
| `src/components/deals/DealList.tsx` | New — grouped/sorted deal list with inline editing |
| `src/components/investors/InvestorList.tsx` | New — sorted investor list with inline editing |
| `src/app/deals/actions.ts` | Add updateDeal, deleteDeal |
| `src/app/investors/actions.ts` | Add updateInvestor, deleteInvestor |
| `src/lib/extraction/investors.ts` | Batch extraction (array response) |
| `src/app/api/extract-investor/route.ts` | Return array |
| `src/app/globals.css` | Updated color variables |
| `src/components/Nav.tsx` | Updated styling |
