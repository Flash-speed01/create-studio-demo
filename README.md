# CreateShop

CreateShop is a lightweight, browser-based graphic design editor for making graphics with text and shapes.

## Run it

Open `index.html` in a modern browser. No build step or installation is required.

## Features

- Add and drag text, rectangles, circles, and lines.
- Choose A4, A3, US Letter, square, social post, story/reel, or custom canvas dimensions; switch supported page sizes between portrait and landscape.
- Make a solid-color background or choose a custom color and a set of gradient presets.
- Edit text, font weight, font size, colors, outlines, and shape dimensions.
- Duplicate layers, adjust layer order, and select layers from the list.
- Undo/redo edits with the toolbar or Ctrl/⌘ Z and Ctrl/⌘ Shift Z.
- Export a crisp 2× PNG with the selected page dimensions and background.
- Designs are saved automatically in local browser storage.

## Files

- `index.html` — app layout and page metadata
- `styles.css` and `editor-features.css` — responsive editor styling
- `app.js` — canvas interaction, page setup, editing, local saving, history, and PNG export

The editor uses vanilla JavaScript and SVG, with no build tooling required.
