# Images

Every image the product uses is **committed to this repo**. Nothing is fetched
at runtime, which is the point: the demo has to survive a room with no wifi,
and a landing page full of broken frames is worse than one with no photographs
at all.

Two sets, two purposes.

## `web/public/brand/` — the mascot

Derived from the owner's own artwork in `assets/`. Referenced through
`<Mascot pose="..." />` in `components/Logo.jsx`.

| File | Pose | Used on |
|---|---|---|
| `owl.webp` | The owl alone | Sign-in aside, the assistant's empty state, the hero fan |
| `owl-board.webp` | Owl at a chalkboard | Sign-in aside |
| `owl-trio.webp` | Three birds | Spare — for a "who it is for" block |

Two of the three source files arrived as RGB with the transparency
checkerboard *painted into the pixels*. It was keyed out by flood-filling the
near-grey background inwards from the border, then removing any enclosed
pocket whose pixels were bimodal at the checker's two greys — a border flood
alone cannot reach the gaps between a bird's legs.

The vector mark in `components/Logo.jsx` is the same character drawn as a
single `fill-rule: evenodd` path, so the eyes are holes and the pupils are
islands inside them. That is what lets one mark sit on white, on ink and on
lime with no variants, and it is the version that survives 20px. The raster
mascot is for sizes where warmth matters more than crispness.

## `web/public/img/` — photography

19 photographs, 879 KB in total, resized to 1280px wide and
encoded as WebP at quality 68. All **CC0 / public domain**: free for
commercial use with no attribution required. They are credited here anyway,
because knowing where a file came from is worth more than the licence
requires.

| File | Size | Source | Licence | Original |
|---|---|---|---|---|
| `books-color.webp` | 21 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/CQI990NSLK.jpg |
| `campus-arch.webp` | 82 KB | Rawpixel | CC0 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGQ1MWI1LTAzNy1qai5qcGc.jpg |
| `campus-autumn.webp` | 104 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/1D180509DF.jpg |
| `campus-quad.webp` | 50 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/E1C34B4580.jpg |
| `campus-tower.webp` | 122 KB | Rawpixel | CC0 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyMjk1NDAzNTM4My1pbWFnZS1rdHdwYTM5Zi5qcGc.jpg |
| `collab.webp` | 17 KB | Rawpixel | CC0 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJzdGFydHVwX3N0YXJ0X3VwX3Blb3BsZV8xLWltYWdlLWt5YmNtdGFpLmpwZw.jpg |
| `desk-laptop.webp` | 27 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/OR7D4PANCK.jpg |
| `exam-sheet.webp` | 40 KB | Rawpixel | CC0 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvd2s0NDM4ODIwNy1pbWFnZS1rcDZieHUwYy5qcGc.jpg |
| `lecture-hall.webp` | 37 KB | Rawpixel | CC0 | https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNDcyNzUzNzI2OC1pbWFnZS5qcGc.jpg |
| `lecture-talk.webp` | 47 KB | Rawpixel | CC0 | https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTIyNDc3OTA4NzQtaW1hZ2UuanBn.jpg |
| `library-hall.webp` | 38 KB | Rawpixel | CC0 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODA3MTcwLXdpa2ltZWRpYS1pbWFnZS1rb3drdW55dS5qcGc.jpg |
| `library-pick.webp` | 82 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/3CNOEZPLFX.jpg |
| `notebook.webp` | 16 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/N6NK9J8V0A.jpg |
| `reading.webp` | 13 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/H0VXBZUZP3.jpg |
| `student-laptop.webp` | 12 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/HIOJW30YKD.jpg |
| `study-floor.webp` | 36 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/N444PJYUP9.jpg |
| `study-group.webp` | 46 KB | StockSnap.io | CC0 | https://cdn.stocksnap.io/img-thumbs/960w/Y2AHVPYB51.jpg |
| `textbooks.webp` | 67 KB | WP Photo Directory | CC0 | https://pd.w.org/2025/02/667aedd41a60015.50868668-2048x1536.jpg |
| `writing-notes.webp` | 21 KB | Rawpixel | CC0 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg4NTEyMTYtaW1hZ2Uta3d2dXgzbTkuanBn.jpg |

Found through the [Openverse API](https://api.openverse.org/v1/images/),
filtered to `license=cc0,pdm` and to the three sources that are actual stock
libraries rather than photo archives — the general Flickr CC0 pool is mostly
scans and snapshots and was not usable.

### Adding one

Put it in `web/public/img/` as WebP, no wider than 1280px, and add a row
above. Reference it as `/img/<name>.webp` — `web/public/` is served at the
site root. Keep the whole directory under about 1.5 MB; it ships with the app.
