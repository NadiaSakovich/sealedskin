# Open Graph card

`card.html` is the source for `src/app/opengraph-image.jpg` - the 1200x630 image
that link previews show (Google, Slack, iMessage, X, Facebook, LinkedIn).

It is a plain HTML page rather than a `next/og` `ImageResponse` on purpose:
`ImageResponse` only ships Geist as a built-in font, and matching the site meant
loading Schibsted Grotesk / Hanken Grotesk / Spline Sans Mono as TTFs at build
time. Screenshotting real HTML gets the real fonts, the real palette tokens and
the real photo for free, and the result is a static file with no build-time
network dependency.

## Regenerating

```sh
cd /tmp/ss-pw            # the throwaway Playwright install (see CLAUDE.md)
npm i playwright         # if it has gone missing
node shot.mjs <abs path to card.html> /tmp/og.png
sips -s format jpeg -s formatOptions 88 /tmp/og.png --out /tmp/og.jpg
cp /tmp/og.jpg <repo>/src/app/opengraph-image.jpg
```

`shot.mjs` must be run from the directory Playwright is installed in, and the
`<img src>` in `card.html` is an absolute `file://` path - repoint it if the
repo moves. Update `src/app/opengraph-image.alt.txt` if the copy changes.

Next reads the file convention and emits `og:image` plus its type and
dimensions; `twitter:image` falls back to the same file from the
`twitter.card` declaration in the root layout.
