# Deal Sharer - Design Document

## Overview

A web app for curating and sharing investment deals with investors. Unstructured text or voice input about deals and investors is processed by an LLM into structured data. Deals are manually prioritised (1-3), and investors specify a priority threshold. The app generates personalised deal lists per investor and tracks sharing history.

Single user in v1. No multi-team features.

## Stack

- **Frontend**: Next.js (App Router)
- **Database + Auth**: Supabase (Postgres, single-user auth via email/password or magic link)
- **LLM**: Claude API for text extraction (deals + investors)
- **Speech-to-text**: Whisper API or browser Web Speech API for voice input
- **Web enrichment**: Optional per-investor, triggered manually

## Data Model

### Deal

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `created_at` | timestamp | When the deal was added |
| `company_name` | text | Company name |
| `website_url` | text | Company website |
| `one_liner` | text | Short description |
| `raise_amount` | numeric | Amount being raised |
| `currency` | text | Currency (EUR, USD, GBP, etc.) |
| `priority` | int (1-3) | 1 = top, 2 = good, 3 = interesting |
| `status` | text | active, passed, or closed |
| `raw_source_text` | text | Original unstructured input |

### Investor

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `created_at` | timestamp | When the investor was added |
| `contact_name` | text | Contact person |
| `fund_name` | text | Fund/firm name |
| `email` | text | Contact email |
| `priority_threshold` | int (1-3) | Receive deals rated this or better |
| `sharing_frequency` | text | weekly, bi-weekly, or monthly |
| `thesis_description` | text | Free text for reference |
| `raw_source_text` | text | Original unstructured input |

### Share Record

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `created_at` | timestamp | When the share happened |
| `investor_id` | uuid | FK to investor |
| `deal_id` | uuid | FK to deal |
| `batch_id` | uuid | Groups deals shared in the same list |

## User Workflows

### A: Add Deals (Text)

1. Paste unstructured text (transcripts, emails, notes - one or many deals) into a text box
2. LLM parses and proposes structured deal cards
3. Review each card - edit fields, assign priority (1-3), confirm or discard
4. Confirmed deals saved to Supabase

### B: Add Deals (Voice)

1. Click record button, talk about a deal
2. Speech-to-text transcribes audio
3. Same LLM extraction pipeline as text input
4. Review, assign priority, confirm

### C: Add Investors

1. Type or paste natural language about an investor (e.g., "Sarah at Northzone, they do seed/Series A in Europe, focus on developer tools")
2. LLM extracts structured profile
3. Review and confirm, set priority threshold and sharing frequency
4. Optional: click "Enrich" to pull additional data from web sources

### D: Generate Share Lists

1. Select a date range for deals to include
2. Click through investors one by one (sidebar navigation)
3. For each investor: see deals from that date range filtered by their priority threshold, sorted 1 > 2 > 3
4. Deals already shared with that investor are visually flagged
5. Toggle deals on/off
6. "Finalise" generates shareable text output in this format:

```
Some stuff I've been looking at this week!

https://jaipurrobotics.com/ - AI detection of hazardous materials in mixed waste
https://polybot.eu/ - Greenhouse crop harvesting robotics
...
```

7. Share records saved automatically

### E: Share History

- View per-investor: what deals they've been sent, when
- View per-deal: which investors have seen it
- Filter by date range

## Key Pages

1. **Deals** - input (text/voice) + deal list with date filters
2. **Investors** - input (natural language) + investor list
3. **Share Lists** - date range selector + investor sidebar + deal curation + text output
4. **History** - share history with date filtering

## Matching Logic

No AI matching. Priority-based only:

- Each deal has a priority: 1 (top), 2 (good), 3 (interesting)
- Each investor has a threshold: 1, 2, or 3
- Investor with threshold 2 sees deals rated 1 and 2
- Investor with threshold 3 sees all deals
- Within the list, deals are sorted by priority (1 first)

## LLM Usage

The LLM (Claude API) is used only for extraction, not matching:

- **Deal extraction**: Unstructured text -> structured deal fields (company name, URL, one-liner, raise amount, currency). User confirms/edits each.
- **Investor extraction**: Natural language -> structured investor fields (contact name, fund, email, thesis). User confirms/edits each.
- **Voice transcription**: Audio -> text (via Whisper), then same extraction pipeline.

## Non-Goals (v1)

- Multi-user / team features
- Automated email sending
- CRM integrations
- Sector/stage/geo tagging or filtering
- AI-powered deal-investor matching
