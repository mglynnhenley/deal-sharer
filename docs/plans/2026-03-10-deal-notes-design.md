# Deal Notes Feature — Design Doc

Date: 2026-03-10

## Goals

Add a notes section to each deal where users can add voice or text notes. Each note gets a GPT-generated mini-summary. An overall rolling summary is stored on the deal and regenerated after each new note.

## Database

### New table: `deal_notes`
- `id` uuid primary key default gen_random_uuid()
- `deal_id` uuid references deals(id) on delete cascade
- `content` text not null — raw transcription or typed text
- `summary` text — GPT mini-summary of this note
- `created_at` timestamptz default now()

### New column on `deals`
- `notes_summary` text nullable — rolling overall summary of all notes

## Deal Detail Page (`/deals/[id]`)

- Deal info at top (company name, one-liner, sector, priority — inline-editable)
- Overall summary card below deal info (stored `notes_summary`)
- Note input: textarea + voice recorder + "Add Note" button
- Notes list: each note shows mini-summary heading, full content, timestamp. Newest first.
- Delete button per note

## Flow: Adding a Note

1. User types or records voice (transcribed via Whisper)
2. Click "Add Note"
3. POST to `/api/summarize-note` with content + deal_id
4. API generates one-line summary via GPT
5. Note saved to `deal_notes` with content + summary
6. API fetches all note summaries for deal, regenerates overall summary via GPT
7. Overall summary saved to `deals.notes_summary`
8. Page revalidates

## Navigation

- Deal company name in home list links to `/deals/[id]`
- Back link on detail page returns home
