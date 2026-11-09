# Viewing media

Click a thumbnail to open its **media page**: the picture or video, where
the file lives (its folder inside the source folder; hover for the full
path) with its format, resolution and size, its artist, tags, characters
and series, and **Similar media** below (see
[Duplicates](duplicates.md)). `←` / `→` move to the previous or next item in
the gallery's current order, and **Edit** (`E`) opens the edit form. **Back
to gallery**, or your mouse's back button, returns to the page you were on with
the last media you viewed in sight.

## Playing videos

Videos play in PiCollection's own player: a bar over the bottom of the
video with play/pause, back and forward 5 seconds, the timeline (hover it to
see the time under the cursor), **Copy frame**, **Loop**, **Speed** (0.25× to
2×), volume and full screen. **Copy frame** puts the frame on screen on the
clipboard at full size - handy for a reverse image search (Google Lens) when
the tag suggestions find nothing. The bar fades out while the video plays and you don't move the
mouse, and stays up while it's paused or you're using the keyboard in it.
Mute keeps your volume: unmuting (or `↑` while muted) brings back the
level you had. Lowering the volume to 0 counts as mute too, and unmuting
then returns to where you started lowering it. Loop, volume and mute
carry over to the next video; speed goes back to
normal. A video pauses itself when a dialog (such as Make animation) opens over it. Keys: `Space` play/pause, `L` loop, `M` mute, `F` full screen, and
`↑` / `↓` change the volume (1% per press; hold the key to keep going), and
`←` / `→` go back or forward 5 seconds once you've tabbed into its controls
(elsewhere they still move to the previous or next item); in full screen the
arrows always go to the player.
Keys go to the player only when no other control on the page has focus.

While paused, `,` / `.` step one frame back or forward. To loop just part
of a video, press **Loop section** at the start and again at the end (or
`[` and `]`): only that part plays and repeats, and its two markers on the
timeline can be dragged. Press it once more (or `Shift+L`) to clear it. In the edit form's
smaller preview, speed, **Loop section** and **Copy frame** are under the
**More** (⋯) button, and the volume slider pops up when you point at (or tab
to) the volume button - as it does in the full player below 900 px wide.

## Finding a tag

To check whether an item has a given tag, press `Ctrl+F` (or the magnifier
next to **Tags**) on its page or in the edit form, including during a batch
import. Typing narrows the tags to the ones whose name or alias contains
the text, with a count ("1 of 37 tags") or **Not on this media**. `Esc` or
the × closes it and shows them all again.

## Full-size viewer

Click an image or animated media (on its page or in the edit form) to open it full
screen:

- zoom with the mouse wheel (toward the cursor), a double-click, `+` / `-` /
  `0`, or the zoom buttons;
- drag to pan while zoomed in;
- `Esc` or a click outside the picture closes it (and only it: a second
  `Esc` leaves the edit form).

## File actions

Next to the file's name and folder (on its page, in the edit form - also
while adding a file, before it's saved - and in the viewer):

- **Copy image** puts the picture on the clipboard, ready to paste. GIFs and
  animated WebPs are copied as a file on Windows, so they paste *animated*
  into apps like Discord or Telegram; image editors like Paint get the first
  frame.
- **Copy first frame** (animated media) copies just the first frame as a still
  picture, for a reverse image search.
- **Copy location** copies the file's full path.
- **Open in file explorer** shows the file in its folder.

## Right-click menu

Right-clicking a thumbnail in the gallery, the picture on its page or the
picture in the viewer opens a menu with **Open** (thumbnails only), **Copy
image** (not for videos; a GIF is copied whole, as above), **Copy location**
and **Open in file explorer**.

It can also compare any two pictures, related or not:

1. Right-click one and choose **Choose to compare**. A notice at the bottom
   names it until you compare or click its ×, even if you move to another
   page.
2. Right-click another and choose **Compare with "name"**: the comparison
   from [similar pictures](duplicates.md) opens with the two side by side.

Videos can't be compared this way, since the comparison slides two still
pictures over each other.

In a text box, right-click offers **Cut**, **Copy**, **Paste** and **Select
all**, and on selected text elsewhere (a picture's name and tags on its
page), **Copy**.

## Video to GIF

**Make animation** on a video's page turns a clip of it into an animated GIF
or WebP, entirely on your computer:

1. Pick the clip on the dialog's player: its two markers on the timeline are
   the start and end - drag them, or press `[` / `]` at the current time, and
   play to preview the clip in a loop. If you had [looped a
   section](#playing-videos) on the video's page, the clip starts as that
   section; otherwise as the first 5 seconds. There's no length limit (a loop
   can need 15 seconds and a few frames more); from 30 seconds on, a note
   reminds you that long animations get large and slow to make. The app saves
   them up to 1 GB; past that it tells you so - use a shorter clip or a smaller
   size.
2. Choose a format: **GIF** opens anywhere but holds 256 colors per frame;
   **WebP** keeps every color in a much smaller file (about a third of the
   GIF in a test) and Discord plays it, but X doesn't take it, so the X
   preset is only offered for GIF. The app remembers the format you used last.
   The same clip with the same format and size makes the very same file, so
   making it twice says you already have it.
3. Choose a size: **Discord (≤ 10 MB)** or **X / Twitter (≤ 15 MB)** re-encode
   smaller until the file fits (a WebP for Discord starts at 720 px and 24 fps,
   a GIF at 480 px and 15 fps, since the WebP is so much lighter); **Gallery (best quality)** keeps the video's
   own size and every frame (up to 50 fps, the fastest a GIF plays) and
   smooths colors with dithering, so the file is large - use it to rebuild a
   GIF that a site saved as MP4 (the original GIF can't be recovered exactly,
   but this gets as close as possible); **Custom** lets you set the width and
   frame rate.
4. **Create GIF** / **Create WebP**. Progress is shown, and **Stop** cancels it.
5. It's saved next to the video as "<video> (GIF).gif" or "<video> (WebP).webp" and added to your library with the
   video's artist, tags, characters, series and rating. The two list each
   other under **Similar media** ("Source video" / "Animation from it").

---
← [Gallery and search](gallery-and-search.md) · [Guide index](README.md) · Next: [Settings and backups](settings-and-backups.md) →
