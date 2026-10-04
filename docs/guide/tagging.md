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
rename, set aliases (other names a search should also match) and delete
them. Deleting one never deletes media, it only removes the link. Each entry's
media count opens the gallery filtered to it. The ⓘ next to a tag (here and on
suggested tags) shows what it means, from Danbooru's tag wiki.

## Forms, costumes and subseries

Characters and series can have a parent:

- a **form or costume** is a child character, e.g. "Pyra (Pro Swimmer)" under
  "Pyra";
- a **subseries** is a child series, e.g. "Xenoblade Chronicles 2" under
  "Xenoblade".

Searching or filtering by the parent also finds media tagged only with a
child, so "Pyra" finds her swimsuit pictures too. See [Gallery and
search](gallery-and-search.md#filters) for filtering by *only* the parent.

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
series and tags. It works for images, GIFs and videos.

- It needs a free SauceNAO API key: **Settings > Advanced > SauceNAO API key**.
  Without one, the button doesn't appear.
- The matched post's link fills an empty **Source URL**, or is offered as a
  replacement if you already typed another.
- Creating the artist from a suggestion also links their Pixiv or X profile
  when SauceNAO knows it.
- Booru character tags are read the booru way: in
  `pyra_(pro_swimmer)_(xenoblade)`, the last parenthesis is the series and
  the earlier one a form, so it's suggested as "Pyra (Pro Swimmer)", a form of
  "Pyra".
- With a Danbooru account (**Settings > Advanced**), the app asks Danbooru for
  the exact base character and the most specific series (by tag name only,
  cached for 30 days).
- When SauceNAO's daily limit is reached, the button turns off for an hour
  and its tooltip says when to try again.

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
