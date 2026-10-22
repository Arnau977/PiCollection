# Tagging and suggestions

Each media item can have one **artist** and any number of **tags**,
**characters** and **series**. Characters and series are linked to each
other (a character can belong to several series), which is what lets the
app suggest a series once you pick a character.

## Tagging a media item

Open an item and press **Edit** (`E`), or tag it while adding it. Each field
is a picker:

- **Typing is forgiving**: typos, accents, underscores, parentheses and word
  order don't matter. `pyra xenoblade` or `pyar` both find
  "Pyra (Xenoblade)", closest match first.
- **Creating something new**: type a name that doesn't exist and pick
  **Create "…"**. It shows as "(new)" and is only created when you save, so
  cancelling the edit leaves nothing behind.
- `Ctrl+S` saves; leaving with unsaved changes (`Esc` or **Cancel**) asks
  first.

If a save fails, the error appears right under the top bar, says which field
it's about, and **Go to <field>** jumps there.

## Managing your metadata

The **Metadata** page lists your artists, tags, characters and series: add,
rename, set aliases (other names a search should also match, one per line,
so a long title can keep its commas) and delete them. Deleting one never deletes media, it only removes the link. Each entry's
media count opens the gallery filtered to it. The ⓘ next to a tag (here and on
suggested tags) shows what it means, from Danbooru's tag wiki.

## Automatic tags

**Settings > Data > Automatic tags** gives a tag of yours to every picture
with a property of the file itself:

- **Transparency** - some pixels are see-through (an alpha channel that's
  never used doesn't count);
- sizes, with Danbooru's own rules: **Lowres** (both sides 500 px or less),
  **Highres** (1600 px wide or 1200 px tall), **Absurdres** (3200 wide or
  2400 tall), **Incredibly absurdres** (10,000 px on a side), **Tall image**
  and **Wide image** (1024 px or more, and 4 times the other side). Like on
  Danbooru they stack: an absurdres picture is highres too;
- **Portrait**, **Landscape** and **Square** (sides within 5% of each other).

Pick a tag in a property's row to turn it on; the × turns it off. **Use
Danbooru tags** turns on every property still off with Danbooru's tag for it
("transparent background", "highres"...), reusing your tag of that name or
alias and creating the others - the same names SauceNAO and local AI
suggest, so their suggestions land on the same tags. A rule
covers the whole library at once: filters, search, counts and Home count it
as if the media had the tag, and removing the rule (or the tag) leaves
nothing behind, because it's never written into the media's own tags. On a
media page an automatic tag has a dashed outline (hover it to see why); the
edit form lists them read-only under **Tags**. The app reads each picture's
size and transparency once, in the background (the first time, the whole
library; Settings shows how many are left). Videos aren't analyzed.

## Forms, costumes and subseries

Characters and series can have a parent:

- a **form or costume** is a child character, e.g. "Pyra (Pro Swimmer)" under
  "Pyra";
- a **subseries** is a child series, e.g. "Xenoblade Chronicles 2" under
  "Xenoblade".

Searching or filtering by the parent also finds media tagged only with a
child, so "Pyra" finds her swimsuit pictures too. See [Gallery and
search](gallery-and-search.md#filters) for filtering by *only* the parent.

## Characters inspired by another

Some characters are modelled on one from another game - Evanescia (Honkai:
Star Rail) on Yae Sakura (Honkai Impact 3rd). Tag a picture with the
character it really shows, and in **Metadata > Characters** set **Inspired
by** on the expy; the list then shows "Inspired by Yae Sakura" under her.
It's not a parent: searching one never finds the other.

It matters for suggestions. An AI tagger trained on the original names her
for the expy too, so when SauceNAO or local AI recognize a character that
others are inspired by, they don't add her or her own series: they ask
**Recognized as Yae Sakura - which one is it?**, with a chip for each.
Picking the original adds her with her series; picking the expy adds the
expy (and her series, if she has just one).

## Suggestions

The **Suggestions** panel beside the edit form has one tab per source, each
showing how many suggestions are waiting. A capture opens on its site's tab;
otherwise the panel opens on the source you used last. Nothing is added until you click
it, except matches that already exist in your library, which some sources
apply right away. Clicked suggestions disappear from the panel.

### From the source site

For media captured with the [browser extension](adding-media.md#capturing-from-the-browser),
the site's tab (e.g. "danbooru") offers everything the post listed: the tags,
characters and series you already have (one by one, or **Add the N already
in your library**), the ones you don't (marked "new", created on click), and
the site's rating and AI-generated flag.

Sites that don't tell characters and series apart from tags (Pixiv) send
everything as tags: a name you already have as a series or character is
offered as that. Creating the artist from a Pixiv capture also links their
Pixiv profile.

### SauceNAO

**Suggest tags** sends a small thumbnail to [SauceNAO](https://saucenao.com)
to find where the picture comes from, and pre-fills its artist, characters,
series and tags. It works for images, GIFs and videos. For a video it uses
the frame the edit form's preview shows, so pause on the one you want (until
you play or move the preview, it uses the video's cover frame); local AI
tagging below does the same.

- It needs a free SauceNAO API key: **Settings > Advanced > SauceNAO API key**.
  Without one, the button doesn't appear.
- The matched post's link fills an empty **Source URL**, or is offered as a
  replacement if you already typed another. E-Hentai and nhentai matches
  have no post link: **Search on E-Hentai** / **Search on nhentai** looks
  the gallery up by title instead, and doesn't touch Source URL.
- Creating the artist from a suggestion also links their Pixiv or X profile
  when SauceNAO knows it.
- Booru character tags are read the booru way: in
  `pyra_(pro_swimmer)_(xenoblade)`, the last parenthesis is the series and
  the earlier one a form, so it's suggested as "Pyra (Pro Swimmer)", a form of
  "Pyra".
- Two characters can share a name: when a tag names one of your series
  (`asuna_(blue_archive)`), a same-named character linked only to other
  series (SAO's Asuna) isn't applied; a new "Asuna" is offered instead, and
  from then on each picture gets its own. The same applies to the local AI
  and site suggestions.
- With a Danbooru account (**Settings > Advanced**), the app asks Danbooru for
  the exact base character and the most specific series (by tag name only,
  cached for 30 days).
- When SauceNAO's daily limit is reached, the button turns off for an hour
  and its tooltip says when to try again.
- SauceNAO's bot protection sometimes blocks searches from apps (even with an
  API key). The error then says so: try again later, or search on
  saucenao.com in your browser.

This is the only feature that sends any of your media off your computer, and
only when you press the button.

### Local AI

**Suggest tags locally** (`Ctrl+Shift+A`) runs an AI tagger (WD14) entirely
on your computer: tags, characters, series and a SFW/NSFW suggestion. Nothing
is uploaded. The model (about 500 MB) is downloaded once, from **Settings >
Advanced > Local AI tagging**, where you can also set how strict the NSFW
suggestion is.

### AI-generated hint

The edit form reads the image's own metadata for traces AI generators leave
(Stable Diffusion WebUI, ComfyUI, InvokeAI, NovelAI, or the "AI-generated"
mark of Content Credentials/IPTC). When it finds one on a new or pending
media, it turns **AI** on by itself and says so under the toggle (you can
still turn it off); on media already in your library it only offers **Mark
as AI**. Most sites strip this metadata, so finding nothing proves nothing.

---
← [Adding media](adding-media.md) · [Guide index](README.md) · Next: [Pending and discarded](pending-and-discarded.md) →
