# Pesmi.json Database Structure Analysis

## Overview
The `pesmi.json` file contains a database export of a Slovenian song/hymn collection system. The database is named "pesmi" (songs/hymns).

## Database Statistics
- **Total Albums**: 17
- **Total Songs (pesmi)**: 1,253
- **Total Diasi records**: 5,719
- **Total Kitice (stanzas)**: 3,575
- **Average diasi per song**: 4.56
- **Average kitice per song**: 2.85
- **Songs with author**: 485 (38.7%)
- **Songs with description**: 42 (3.4%)

## Core Tables

### 1. **Album** (17 records)
Represents song collections/albums.

**Fields:**
- `pid` (integer): Primary key - Album ID
- `ime` (string): Album name/code (e.g., "LJ1", "MAR", "PRA")
- `opis` (string): Album description (e.g., "JKA Ljudske1", "Marijine")
- `datoteka` (string): Associated filename (e.g., "ljudske1", "molitve")

**Purpose**: Organizes songs into collections (e.g., "Ljudske" (Folk), "Marijine" (Marian), "Prazniške" (Holiday songs))

---

### 2. **pesmi** (1,253 records)
Main table containing song metadata.

**Fields:**
- `phId` (integer): Primary key - Song ID
- `naslov` (string): Song title (required)
- `naslov1` (string, nullable): Secondary title/description (optional)
- `avtor` (string, nullable): Author name (optional, 38.7% have authors)
- `CSS` (string, nullable): CSS styling information (currently unused)

**Purpose**: Stores song titles, authors, and metadata.

**Example:**
```json
{
  "phId": 1,
  "naslov": "Bog, pred tvojim veličastvom",
  "naslov1": null,
  "avtor": "Gregor Rihar",
  "CSS": null
}
```

---

### 3. **diasi** (5,719 records)
Junction/linking table connecting songs to stanzas and albums.

**Fields:**
- `pid` (integer): Album ID (foreign key to Album.pid)
- `dias` (integer): Display/slide number within the album
- `phId` (integer): Song ID (foreign key to pesmi.phId)
- `cid` (integer): Stanza ID (foreign key to kitice.cid)
- `foreground_css` (string, nullable): Text color styling
- `background_css` (string, nullable): Background color styling

**Purpose**: 
- Links songs to albums (via `pid`)
- Links songs to stanzas (via `phId` → `cid`)
- Defines display order within albums (via `dias`)
- Allows same song to appear in multiple albums with different stanza selections

**Key Relationships:**
- One song (`phId`) can have multiple `diasi` records (appears in multiple albums or has multiple stanzas)
- One album (`pid`) contains multiple songs via `diasi` records
- One stanza (`cid`) can be used by multiple songs

**Example:**
```json
{
  "pid": 1,
  "dias": 201,
  "phId": 1,
  "cid": 1,
  "foreground_css": null,
  "background_css": null
}
```

---

### 4. **kitice** (3,575 records)
Contains the actual stanza/verse text content.

**Fields:**
- `cid` (integer): Primary key - Stanza ID
- `kitica` (integer): Page/stanza number within a song
- `besedilo` (string): The actual text content of the stanza (with escaped newlines `\\n`)

**Purpose**: Stores the textual content of song stanzas/verses.

**Text Format:**
- Contains escaped newlines: `\\n` represents line breaks
- May contain formatting markers like `[` and `]` for italic text

**Example:**
```json
{
  "cid": 1,
  "kitica": 1,
  "besedilo": "Bog, pred tvojim veličastvom\\\nmolimo ponižno te.\\\n..."
}
```

---

## Relationship Diagram

```
Album (pid)
  │
  ├─── diasi (pid, phId, cid, dias)
  │     │
  │     ├─── pesmi (phId) ──── Song metadata
  │     │
  │     └─── kitice (cid) ──── Stanza text
  │
  └─── Multiple songs can appear in same album
       Same song can appear in multiple albums
```

## Key Relationships

### 1. **Album → Songs (via diasi)**
- One album (`pid`) contains many songs (`phId`)
- Relationship: `Album.pid` = `diasi.pid` → `diasi.phId` = `pesmi.phId`
- Example: Album pid=1 contains 129 different songs

### 2. **Song → Stanzas (via diasi)**
- One song (`phId`) has multiple stanzas (`cid`)
- Relationship: `pesmi.phId` = `diasi.phId` → `diasi.cid` = `kitice.cid`
- Example: Song phId=1 has 10 unique stanzas (kitica 1-10)

### 3. **Song → Albums (many-to-many)**
- One song can appear in multiple albums
- Same song may have different stanza selections per album
- Example: Song phId=1 appears in albums with pid: 1, 2, 3, 4, 7, 9, 10, 11

### 4. **Stanza Reusability**
- One stanza (`cid`) can be used by multiple songs
- Stanzas are shared/reusable components

## Additional Tables (Metadata)

### 5. **pesem_kitica** (4,184 records)
Links songs to stanzas with ordering.

**Fields:**
- `cid`: Stanza ID
- `phid`: Song ID
- `ordun`: Order/sequence number

### 6. **pesem_pesmarica** (3,558 records)
Links songs to songbooks/publications.

**Fields:**
- `phId`: Song ID
- `pesmarica`: Songbook code (e.g., "clp61")
- `stevilka`: Page/song number in songbook
- `varianta`: Variant number
- `stran`: Page number
- `tonaliteta`: Key/tonality ID
- `avtor`: Author (nullable)
- `besedilo`: Text indicator
- `Opombe`: Notes (nullable)

### 7. **pesmarice** (21 records)
Songbook/publication metadata.

**Fields:**
- `oznaka`: Songbook code
- `naslov`: Songbook title
- `leto izida`: Publication year
- `Založba`: Publisher
- `vir`: Source

### 8. **zvrsti** (31 records)
Song genres/types.

**Fields:**
- `zid`: Genre ID
- `Oznaka`: Genre code (e.g., "mis")
- `zvrst`: Genre name (e.g., "Mašne")

### 9. **pesem_zvrst** (1,459 records)
Links songs to genres.

### 10. **tonalitete** (26 records)
Musical keys/tonalities.

### 11. **Organizacija** (4 records)
Organizational metadata.

### 12. **Zbirke_pesmarice** (26 records)
Songbook collections.

### 13. **Zbirke_proj** (26 records)
Project collections.

### 14. **lepljenja** (0 records)
Empty table (possibly for pasting/merging operations).

### 15. **Napake** (0 records)
Empty table (possibly for error tracking).

## Data Flow Example

**To get a complete song with all stanzas:**

1. Start with `pesmi` record (phId = 1)
   - Title: "Bog, pred tvojim veličastvom"
   - Author: "Gregor Rihar"

2. Find all `diasi` records where `phId = 1`
   - Returns 80 records (song appears in 8 different albums)
   - Each record links to a `cid` (stanza ID)

3. Get unique `cid` values from those `diasi` records
   - Example: 10 unique cid values

4. Find `kitice` records matching those `cid` values
   - Returns 10 stanzas with `kitica` numbers 1-10
   - Each contains the actual text (`besedilo`)

5. Sort by `kitica` number to get stanzas in order

## Transformation Logic (as implemented)

The transformation script converts this structure to library items:

1. **For each `pesmi` record:**
   - `phId` → `guid`
   - `naslov` → `name`
   - `naslov1` → `description`
   - `avtor` → `author`

2. **For each song, find stanzas:**
   - Get all `diasi` where `phId` matches
   - Get unique `cid` values (deduplicate)
   - Find `kitice` records for those `cid` values
   - Create content array with:
     - `page` = `kitica` (stanza number)
     - `content` = `besedilo` (stanza text, with newlines converted)

3. **Result:** Library item with multiple pages, each page containing one stanza

## Notes

- **Diasi table is complex**: It serves multiple purposes:
  - Links songs to albums
  - Links songs to stanzas
  - Defines display order
  - Allows same song to appear multiple times in same album with different stanzas

- **Stanza reuse**: The same `kitice` record can be used by multiple songs, making it a shared content library.

- **Album organization**: Songs are organized into albums, but the same song can appear in multiple albums with potentially different stanza selections.

- **Display numbers**: The `dias` field in `diasi` represents the display/slide number within an album, which may differ from the stanza number (`kitica`).

