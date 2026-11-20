# assets

`Newsreader-700-subset.ttf` is the face drawn into the Open Graph card
(`src/app/opengraph-image.tsx`). It is the display face the site uses for its
headings, instanced at weight 700 and cut down to Latin.

Any character missing from it silently falls back to a different face, so when
the card's copy changes, rebuild the subset:

```sh
curl -sL -o /tmp/newsreader.ttf \
  "https://github.com/google/fonts/raw/main/ofl/newsreader/Newsreader%5Bopsz%2Cwght%5D.ttf"
fonttools varLib.instancer /tmp/newsreader.ttf wght=700 opsz=72 -o /tmp/newsreader700.ttf

pyftsubset /tmp/newsreader700.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF" \
  --output-file=assets/Newsreader-700-subset.ttf \
  --no-hinting --desubroutinize --layout-features=''
```
