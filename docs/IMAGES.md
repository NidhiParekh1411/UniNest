# Images — what to download and where to put it

The site is **complete without any of these**. Every photo slot renders a
branded gradient placeholder that names the file it is waiting for, so nothing
looks broken before you add them. Drop a file in and it appears — no code change.

## Where they go

```
web/public/images/<filename>.jpg
```

`web/public/` is served at the site root, so `web/public/images/campus-1.jpg`
is referenced in code as `/images/campus-1.jpg`. That path is already wired up.

## The list

| Filename | Used on | What to look for |
|---|---|---|
| `campus-hero.jpg` | About → "The institution" | A wide shot of a university building or campus courtyard. Landscape, at least 1600px wide. |
| `campus-1.jpg` | Home → "On campus" (tall) | Two or three students studying together, laptop or notebook visible. **Portrait 3:4.** |
| `campus-2.jpg` | Home → "On campus" (square) | A library interior — shelves, reading desks. **Square.** |
| `campus-3.jpg` | Home → "On campus" (square) | A lecture hall or classroom with students seated. **Square.** |
| `campus-4.jpg` | Home → "On campus" (tall) | Graduation — caps in the air, or students in gowns. **Portrait 3:4.** |
| `campus-5.jpg` | About → story (square) | A campus building exterior, ideally warm-toned brick or stone. **Square.** |
| `campus-6.jpg` | About → story (square) | Students walking on a campus path. **Square.** |

Two more are referenced but currently fall back to initials-in-a-circle
avatars, which look fine as-is — add them only if you want real faces:

| Filename | Used on | What to look for |
|---|---|---|
| `student-1.jpg` | Home → testimonial | A young Indian man, head-and-shoulders portrait. **Square.** |
| `faculty-1.jpg` | Home → testimonial | A woman in her 40s in professional dress, portrait. **Square.** |

## Where to get them (free, no attribution required)

All of these are free for commercial and personal use under the
[Unsplash License](https://unsplash.com/license) and the
[Pexels License](https://www.pexels.com/license/). Search these terms and pick
whichever frame you like — I have deliberately given you search queries rather
than specific photo IDs, because individual photos get taken down and a dead
link is worse than a search that always works.

**Unsplash** — <https://unsplash.com/s/photos/QUERY>

| For | Search query |
|---|---|
| `campus-hero` | `university campus building` · `college architecture` |
| `campus-1` | `students studying together` · `study group laptop` |
| `campus-2` | `university library` · `library bookshelves` |
| `campus-3` | `lecture hall students` · `classroom university` |
| `campus-4` | `graduation caps` · `graduation ceremony` |
| `campus-5` | `college building exterior` |
| `campus-6` | `students walking campus` |
| `student-1` | `indian student portrait` |
| `faculty-1` | `professor portrait` · `indian woman professional portrait` |

**Pexels** — <https://www.pexels.com/search/QUERY/> — same queries. Pexels tends
to have better South Asian representation, which will look more at home for a
GLS project than the default Unsplash results.

**If you want photos of the real campus:** the GLS University site
(<https://www.glsuniversity.ac.in>) has campus photography. Those are the
university's own copyright — fine for an internal college submission, but do
not use them if this ever goes public without asking them first.

## Before you add a file

1. **Resize.** Nothing needs to be wider than 1600px. A 6MB phone photo will
   make the page crawl. Use <https://squoosh.app> — drag in, set width 1600,
   export as JPEG at quality 75, and you will land around 150–300KB.
2. **Name it exactly** as the table says, lowercase, `.jpg`.
3. **Crop to the stated shape.** A portrait photo in a square slot gets
   centre-cropped by `object-fit: cover`, which usually cuts off heads.

## Changing which photos are used

The paths live in two places:

- `web/src/pages/Landing.jsx` — the `CampusLife` section
- `web/src/pages/About.jsx` — the `Story` section
- `web/src/lib/site.js` — `TESTIMONIALS[].image`

Each is a `<Frame src="/images/…" alt="…" shape="tall|square|wide" label="…" />`.
Change `src` to point anywhere; change `shape` to change the aspect ratio.
