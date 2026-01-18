# Analiza Povezav v Pesmi.json

## Pregled Struktur

Datoteka `pesmi.json` vsebuje podatkovno strukturo za sistem pesmi/himnov z naslednjimi glavnimi tabelami:

### 1. **Album** (17 zapisov)
Osnovna tabela, ki predstavlja zbirke/albume pesmi.

**Polja:**
- `pid` (integer): Primarni ključ - ID albuma
- `ime` (string): Ime/koda albuma (npr. "LJ1", "MAR", "PRA")
- `opis` (string): Opis albuma (npr. "JKA Ljudske1", "Marijine")
- `datoteka` (string): Povezana datoteka (npr. "ljudske1", "molitve")

**Primeri:**
```json
{
  "pid": 1,
  "ime": "LJ1",
  "opis": "JKA Ljudske1",
  "datoteka": "ljudske1"
}
{
  "pid": 5,
  "ime": "MAR",
  "opis": "Marijine",
  "datoteka": "ljudske5"
}
```

---

### 2. **Zbirke_proj** (26 zapisov)
Povezuje albume s projekti/zbirkami projektov. Omogoča, da isti album pripada različnim projektom ali organizacijam.

**Polja:**
- `ID` (integer): Primarni ključ
- `pid` (integer): **Foreign key → Album.pid** (ID albuma)
- `oe` (integer): Organizacija/izdaja (1, 2, 3, 4)
- `ord` (integer): Vrstni red v zbirki
- `datoteka` (string): Ime datoteke (lahko null)
- `opis` (string): Opis projekta

**Povezava:** `Zbirke_proj.pid` → `Album.pid`

**Primeri:**
```json
{
  "ID": 1,
  "pid": 1,
  "oe": 1,
  "ord": 1,
  "datoteka": "ljudske1",
  "opis": "Ljudske - adventni čas"
}
{
  "ID": 14,
  "pid": 1,
  "oe": 3,
  "ord": 1,
  "datoteka": "ljudske1",
  "opis": "Ljudske - adventni čas"
}
```

**Opomba:** Isti album (pid=1) se pojavi v več projektih z različnimi `oe` vrednostmi!

---

### 3. **Zbirke_pesmarice** (26 zapisov)
Povezuje pesmarice (oznake pesmaric) z zbirkami. Organizira pesmarice po organizacijah/izdajah.

**Polja:**
- `ID` (integer): Primarni ključ
- `oznaka` (string): Oznaka pesmarice (npr. "gd", "spe", "clp61", "hg79", "sg88")
- `oe` (integer): Organizacija/izdaja (1, 2, 3, 4) - **skupna z Zbirke_proj**
- `ord` (integer): Vrstni red v zbirki

**Primeri:**
```json
{
  "ID": 1,
  "oznaka": "gd",
  "oe": 1,
  "ord": 6
}
{
  "ID": 3,
  "oznaka": "clp61",
  "oe": 1,
  "ord": 3
}
{
  "ID": 5,
  "oznaka": "sg88",
  "oe": 1,
  "ord": 1
}
```

---

### 4. **diasi** (5,719 zapisov)
**Ključna povezovalna tabela** - povezuje albume s pesmimi in kiticami.

**Polja:**
- `pid` (integer): **Foreign key → Album.pid** (ID albuma)
- `dias` (integer): Prikazna številka/slide v albumu
- `phId` (integer): **Foreign key → pesmi.phId** (ID pesmi)
- `cid` (integer): **Foreign key → kitice.cid** (ID kitice/strofe)
- `foreground_css` (string, nullable): Barva besedila
- `background_css` (string, nullable): Barva ozadja

**Povezave:**
- `diasi.pid` → `Album.pid` (album vsebuje pesmi)
- `diasi.phId` → `pesmi.phId` (pesem)
- `diasi.cid` → `kitice.cid` (kitica/strofa)

**Primeri:**
```json
{
  "pid": 1,
  "dias": 2,
  "phId": 192,
  "cid": 570,
  "foreground_css": null,
  "background_css": null
}
{
  "pid": 1,
  "dias": 5,
  "phId": 22,
  "cid": 64,
  "foreground_css": null,
  "background_css": null
}
```

---

## Diagram Povezav

```
┌─────────────┐
│   Album     │
│  (pid)      │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Zbirke_proj  │  │    diasi     │
│  (pid→Album) │  │ (pid→Album)  │
│  (oe, ord)   │  │ (phId→pesmi) │
└──────────────┘  │ (cid→kitice) │
                  └──────────────┘
                         │
                         ├──────────────┐
                         │              │
                         ▼              ▼
                  ┌──────────┐    ┌──────────┐
                  │  pesmi   │    │ kitice  │
                  │  (phId)  │    │  (cid)  │
                  └──────────┘    └──────────┘

┌─────────────────┐
│Zbirke_pesmarice │
│  (oznaka)       │
│  (oe, ord)      │
└─────────────────┘
   (oe povezuje z Zbirke_proj)
```

---

## Ključne Povezave

### 1. **Album ↔ Zbirke_proj**
- **Relacija:** Many-to-Many (preko Zbirke_proj)
- **Povezava:** `Zbirke_proj.pid` = `Album.pid`
- **Pomen:** Isti album lahko pripada različnim projektom/organizacijam (različne `oe` vrednosti)
- **Statistika:** 
  - 14 različnih albumov je v Zbirke_proj
  - Album pid=1 se pojavi v 2 projektih (oe=1 in oe=3)

**Primer:**
```
Album pid=1 (LJ1 - JKA Ljudske1)
  ├─ Zbirke_proj ID=1:  oe=1, ord=1, opis="Ljudske - adventni čas"
  └─ Zbirke_proj ID=14: oe=3, ord=1, opis="Ljudske - adventni čas"
```

### 2. **Album ↔ diasi**
- **Relacija:** One-to-Many
- **Povezava:** `diasi.pid` = `Album.pid`
- **Pomen:** Album vsebuje več diasi zapisov, ki povezujejo pesmi in kitice
- **Statistika:**
  - Vsi 17 albumov so v diasi
  - Album pid=1 ima 491 diasi zapisov
  - Album pid=1 vsebuje 129 različnih pesmi

**Primer:**
```
Album pid=1 (LJ1)
  ├─ diasi: dias=2, phId=192, cid=570
  ├─ diasi: dias=3, phId=192, cid=571
  ├─ diasi: dias=5, phId=22, cid=64
  └─ ... (skupaj 491 zapisov)
```

### 3. **diasi ↔ pesmi ↔ kitice**
- **Relacija:** Many-to-Many (preko diasi)
- **Povezave:** 
  - `diasi.phId` = `pesmi.phId`
  - `diasi.cid` = `kitice.cid`
- **Pomen:** 
  - Ista pesem lahko pripada več albumom
  - Ista pesem lahko ima različne izbrane kitice v različnih albumih
  - `dias` določa vrstni red prikaza v albumu

**Primer:**
```
Pesem phId=192
  ├─ Album pid=1: dias=2, cid=570
  ├─ Album pid=1: dias=3, cid=571
  └─ Album pid=1: dias=4, cid=572
```

### 4. **OE (Organizacija/Izdaja) - Skupna Povezava**
- **Povezava:** `Zbirke_proj.oe` in `Zbirke_pesmarice.oe` imata iste vrednosti
- **Vrednosti:** 1, 2, 3, 4
- **Pomen:** OE verjetno predstavlja različne organizacije, izdaje ali verzije zbirk
  - **oe=1:** Prva organizacija/izdaja
  - **oe=2:** Druga organizacija/izdaja
  - **oe=3:** Tretja organizacija/izdaja
  - **oe=4:** Četrta organizacija/izdaja

**Primer:**
```
oe=1:
  ├─ Zbirke_proj: Album pid=1, ord=1
  └─ Zbirke_pesmarice: oznaka="sg88", ord=1

oe=3:
  ├─ Zbirke_proj: Album pid=1, ord=1
  └─ Zbirke_pesmarice: oznaka="sg88", ord=1
```

---

## Konkretni Primeri

### Primer 1: Album "LJ1 - JKA Ljudske1" (pid=1)

**V Album:**
```json
{
  "pid": 1,
  "ime": "LJ1",
  "opis": "JKA Ljudske1",
  "datoteka": "ljudske1"
}
```

**V Zbirke_proj:**
```json
[
  {
    "ID": 1,
    "pid": 1,
    "oe": 1,
    "ord": 1,
    "datoteka": "ljudske1",
    "opis": "Ljudske - adventni čas"
  },
  {
    "ID": 14,
    "pid": 1,
    "oe": 3,
    "ord": 1,
    "datoteka": "ljudske1",
    "opis": "Ljudske - adventni čas"
  }
]
```
**Razlaga:** Album pid=1 pripada dvema projektoma (oe=1 in oe=3).

**V diasi:**
- Skupaj **491 zapisov** za album pid=1
- Vsebuje **129 različnih pesmi** (phId)
- Prvih nekaj zapisov:
  ```json
  {"pid": 1, "dias": 2, "phId": 192, "cid": 570}
  {"pid": 1, "dias": 3, "phId": 192, "cid": 571}
  {"pid": 1, "dias": 4, "phId": 192, "cid": 572}
  {"pid": 1, "dias": 5, "phId": 22, "cid": 64}
  ```

---

### Primer 2: Pesem phId=192 v albumu pid=1

**V diasi:**
```json
[
  {"pid": 1, "dias": 2, "phId": 192, "cid": 570},
  {"pid": 1, "dias": 3, "phId": 192, "cid": 571},
  {"pid": 1, "dias": 4, "phId": 192, "cid": 572}
]
```
**Razlaga:** Pesem 192 se v albumu 1 prikaže na dias=2, 3, 4 z različnimi kiticami (570, 571, 572).

---

### Primer 3: Zbirke z oe=1

**Zbirke_proj z oe=1:**
```json
[
  {"ID": 1, "pid": 1, "oe": 1, "ord": 1, "opis": "Ljudske - adventni čas"},
  {"ID": 2, "pid": 2, "oe": 1, "ord": 2, "opis": "Ljudske - božični čas"},
  {"ID": 3, "pid": 3, "oe": 1, "ord": 3, "opis": "Ljudske - postni čas"},
  {"ID": 4, "pid": 4, "oe": 1, "ord": 4, "opis": "Ljudske - velikonočni čas"},
  {"ID": 5, "pid": 5, "oe": 1, "ord": 5, "opis": "Marijine"},
  {"ID": 11, "pid": 8, "oe": 1, "ord": 6, "opis": "Mladinske"},
  {"ID": 12, "pid": 12, "oe": 1, "ord": 7, "opis": "Molitve"}
]
```

**Zbirke_pesmarice z oe=1:**
```json
[
  {"ID": 5, "oznaka": "sg88", "oe": 1, "ord": 1},
  {"ID": 4, "oznaka": "hg79", "oe": 1, "ord": 2},
  {"ID": 3, "oznaka": "clp61", "oe": 1, "ord": 3},
  {"ID": 29, "oznaka": "clp78", "oe": 1, "ord": 4},
  {"ID": 2, "oznaka": "spe", "oe": 1, "ord": 5},
  {"ID": 1, "oznaka": "gd", "oe": 1, "ord": 6},
  {"ID": 23, "oznaka": "op", "oe": 1, "ord": 7}
]
```

**Razlaga:** OE=1 predstavlja prvo organizacijo/izdajo, ki vključuje tako projekte (albume) kot pesmarice.

---

## Povzetek Povezav

1. **Album** je osrednja tabela, ki predstavlja zbirke pesmi
2. **Zbirke_proj** povezuje albume s projekti/organizacijami (oe)
3. **Zbirke_pesmarice** organizira pesmarice po organizacijah (oe)
4. **diasi** je ključna povezovalna tabela, ki:
   - Povezuje albume s pesmimi
   - Določa vrstni red prikaza (dias)
   - Povezuje pesmi s kiticami
   - Omogoča, da ista pesem pripada več albumom z različnimi kiticami

5. **OE** je skupna povezava med Zbirke_proj in Zbirke_pesmarice, ki predstavlja različne organizacije/izdaje zbirk.

---

## Praktična Uporaba

**Za pridobitev vseh pesmi v albumu:**
1. Poišči vse `diasi` zapise kjer `pid = album_id`
2. Pridobi unikatne `phId` vrednosti
3. Pridobi podatke iz `pesmi` za te `phId`

**Za pridobitev vseh albumov v projektu:**
1. Poišči vse `Zbirke_proj` zapise kjer `oe = organizacija_id`
2. Pridobi unikatne `pid` vrednosti
3. Pridobi podatke iz `Album` za te `pid`

**Za pridobitev vseh kitic pesmi v albumu:**
1. Poišči vse `diasi` zapise kjer `pid = album_id` in `phId = pesem_id`
2. Pridobi `cid` vrednosti
3. Pridobi podatke iz `kitice` za te `cid`
4. Razvrsti po `dias` za pravilen vrstni red

