# Visual Novel Vertical Engine

[Русский](README.md) · [English](README-EN.md)

**A lightweight offline visual novel engine for vertical screens.**

<p align="center">
  <a href="https://ilyabarilo.github.io/vn-vertical-engine/"><img src="https://img.shields.io/badge/demo-open-2ea44f?style=for-the-badge" alt="Open demo"></a>
</p>

<p align="center">
  <a href="https://github.com/IlyaBarilo/vn-vertical-engine/releases/latest"><img src="https://img.shields.io/github/v/release/IlyaBarilo/vn-vertical-engine?display_name=tag&amp;label=release&amp;color=blue&amp;style=for-the-badge" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-PolyForm%20NC%201.0.0-blue?style=for-the-badge" alt="PolyForm Noncommercial 1.0.0"></a>
  <a href="https://github.com/IlyaBarilo/vn-vertical-engine/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/IlyaBarilo/vn-vertical-engine/release.yml?event=release&amp;style=for-the-badge&amp;label=release%20build" alt="Release build"></a>
</p>

[Open demo](https://ilyabarilo.github.io/vn-vertical-engine/) ·
[Download full package](https://github.com/IlyaBarilo/vn-vertical-engine/releases/latest/download/vn-vertical-engine-latest.zip) ·
[Download update package](https://github.com/IlyaBarilo/vn-vertical-engine/releases/latest/download/vn-vertical-engine-latest-update.zip) ·
[First steps](FIRST-STEPS-EN.md)

<p align="center">
  <img src="docs/demo/images/anna-first-screen.jpg" width="360" alt="Vertical Visual Novel Vertical Engine interface with a character and dialogue">
</p>

This is a shortened English overview. The [Russian README](README.md) is the
primary project page, while the technical specifications provide the full
reference.

## About

Visual Novel Vertical Engine is an interactive story engine built with plain
HTML, CSS, and JavaScript. It is designed primarily for 9:16 portrait displays:
tablets, information stands, touch kiosks, exhibition screens, and
installations.

The project runs directly from its folder. No server, build step, or package
installation is required. Stories remain readable text, while 360° scenes and
standalone HTML mini-games can be added when they support the experience.

> **Status:** actively developed. Releases are the stable distribution channel;
> `main` may contain changes that have not been released yet.

## Quick start

1. Download the [latest full package](https://github.com/IlyaBarilo/vn-vertical-engine/releases/latest/download/vn-vertical-engine-latest.zip).
2. Extract it into a separate folder.
3. Open `index.html` in a supported browser.
4. Copy `story-example.js` to `story.js` for your own project.
5. Edit the text inside `window.STORY_TEXT` and replace all demo assets.

If `story.js` is missing, the engine automatically loads `story-example.js`.

### Full package or update package

- `vn-vertical-engine-latest.zip` is the complete package with demo media,
  360° scenes, mini-games, and tools.
- `vn-vertical-engine-latest-update.zip` updates an existing project without
  replacing `assets/`, `story.js`, or the root `story-example.js`. A current
  reference example is included as `docs/examples/story-example.js`.

See [First Steps](FIRST-STEPS-EN.md) for the recommended workflow.

## Intended users

- students and educators building learning or outreach stories;
- visual novel and interactive story authors;
- developers of touch kiosks, museum stands, and installations;
- teams that need a self-contained experience without a backend;
- prototypes and demonstrations for portrait displays.

Mini-games and panoramas are optional. A complete story can use only a script,
backgrounds, characters, and audio.

## Highlights

- branching scenes, choices, conditions, transitions, and variables;
- images, scrolling backgrounds, video, music, and sound effects;
- characters with emotions, positioning, scale, and focus points;
- connected 360° panoramas with interactive navigation points;
- offline HTML mini-games that return results to story variables;
- autosave and isolated save slots for multiple stories;
- direct scene launch for testing and save-free kiosk launches;
- playthrough statistics and a story graph;
- Russian and English interface languages;
- mouse, keyboard, and touch controls;
- an adaptive interface tested on a real 4K display.

## 9:16 target format

The public target format is a **9:16 portrait screen**.

Internally, the central adaptive area is capped at **10:16**. This deliberate
safe range keeps the interface usable on both 9:16 and slightly wider 10:16
tablets and displays. With `window = auto`, backgrounds, video, and 360° scenes
may fill the available viewport while dialogue, menus, and buttons remain in
the central area.

Optional URL spacing supports floor-standing displays and custom installations:

```text
index.html?topSpacing=500&bottomSpacing=800
```

## Tested environments

| Platform | Tested browsers |
| --- | --- |
| Desktop | Chrome, Edge, Firefox |
| Android | Chrome, Firefox |

The **4K-ready** description refers to interface behavior and scaling. The
visible quality of backgrounds, characters, and video still depends on the
assets used by each story.

## Practical use

The engine is used on demonstration tablets and on a separate screen in a
university stand. These setups exercise touch controls, readability, and
save-free public-screen behavior in addition to desktop testing.

<p align="center">
  <img src="docs/kiosk/kiosk_game.webp" width="720" alt="An embedded mini-game running on a university touch-screen stand">
</p>

For a public device, disable save restoration and hide development statistics:

```text
index.html?nosave=true&mode=release
```

Named stories and direct scene previews are also available:

```text
index.html?novel=exhibition&nosave=true
index.html?scene=scIntro01
```

## Story format

The main story is a text block in `story.js`:

```text
[meta]
title = "My Story"
lang = en
startScene = intro
engine.gameSandbox = strict

[scene]
scene intro
show anna welcome
anna: "Welcome!"

menu
"Continue" -> nextScene
"Stay here" -> intro

scene nextScene
"The story continues."
```

HTML mini-games always run in a strictly isolated iframe. You may keep
`engine.gameSandbox = strict` explicit for readability; the `legacy` mode and
per-game `sandbox` overrides are no longer supported.

The format can be edited in any text editor and reviewed independently from
the engine code. The complete command reference is currently maintained in
Russian: [story specification](docs/specs/spec-story.md).

Author-owned `story.js` and optional `story360.js` run in separate short-lived
Web Workers. The main page receives only the story text and a validated
JSON-like 360 map, so the file format and manual editing stay unchanged while
their code no longer runs in the novel DOM. This is privilege reduction rather
than a passive data format. Panorama images load only from declarative
`*-360.css` packages; `*-360.js` paths are rejected.

## 360° scenes and mini-games

Panoramas can form connected spaces, with their routes stored in the main
script or a separate `story360.js`.

<p align="center">
  <img src="docs/360/360-wide.webp" width="820" alt="A 360-degree panorama with interactive navigation points">
</p>

Browser-based authoring helpers in the repository include:

- `tools/convert-360-img-to-css.html` for offline CSS panorama packages and passive migration from old JS packages;
- `tools/scene360-editor.html` for routes and navigation points;
- `tools/media-focus-editor.html` for image and video focus points;
- `tools/panorama-cleaner.html` for replacing selected areas from a second shot;
- `tools/game-tester.html` for testing mini-games before integration.

`scene360-editor.html` imports `story360.js` as data and does not automatically
execute JavaScript packages referenced by it. The editor previews relative
`*-360.css` packages in an isolated sandbox. Direct JPEG, PNG, and WebP input,
as well as the old JS package controls, are hidden. An imported JS path is
preserved as data but is not executed by the editor, and the engine rejects JS
image packages entirely. External URLs, absolute paths, and `..` traversal are rejected.

Each panorama may contain an optional author-only `comment`, shown after its ID
in the panorama list. Editing happens in a working copy. “Save version in
browser” creates an explicit reload checkpoint, while a newer emergency copy is
kept separately and is restored only after user confirmation. Downloading
`story360.js` does not overwrite that browser checkpoint.

The game tester uses strict isolation and always validates the protocol v2
`gameId` and `sessionId` values.

### Cleaning a panorama with a second shot

Open `tools/panorama-cleaner.html` directly from the local folder. Prepare two
panoramas of the same dimensions, preferably captured from the same fixed
camera position. Image A provides the base and final metadata, while image B
provides clean areas where people or moving objects changed position.

1. Load base image A and source image B.
2. Draw a region around the object and adjust the source offset when needed.
3. Tune feathering, review the preview, and save the resulting JPEG.

The result keeps the original resolution. When A is a JPEG, the tool transfers
its EXIF, XMP/GPano, and ICC metadata. All processing stays in the browser; the
selected panoramas are not uploaded anywhere.

Check the selected release contents when you need a specific tool: `main` may
be ahead of the stable package.

Mini-games are standalone HTML files. The engine provides input data and
difficulty, then stores the returned result in a story variable.

<p align="center">
  <img src="docs/games/game3.webp" width="720" alt="An HTML mini-game embedded into a vertical interactive story">
</p>

The complete integration contract is maintained in Russian:
[mini-game specification](docs/specs/spec-game.md).

## Statistics and story graph

Development mode shows visited scenes, variables, and a local Mermaid graph of
story transitions. Mermaid runs in strict mode; user labels are escaped and the
rendered SVG is sanitized before insertion into the page.

<p align="center">
  <img src="docs/stat/stat-graph-1.webp" width="820" alt="A branching interactive-story graph in the statistics view">
</p>

Set `mode = release` in the story or use `?mode=release` to hide the statistics
button on a public display.

## Offline operation and bundled libraries

Running a story requires no npm installation, build command, server, or runtime
network connection. Mermaid, three.js, and jsrsasign are bundled with the
project. Their separate licenses are listed in [NOTICE.md](NOTICE.md).

## Project map

```text
project/
├── index.html                         entry point
├── story-example.js                   demonstration story
├── story.js                           your story, created separately
├── story360.js                        optional 360° space map
│
├── engine/
│   ├── engine.css                     interface styles
│   ├── engine.js                      main engine logic
│   ├── game-protocol.js               engine and mini-game messages
│   ├── story-sandbox-loader.js         isolated author JS data loader
│   └── story-loader.js                story loading and parsing
│
├── assets/
│   ├── backgrounds/                   backgrounds and video
│   ├── characters/                    characters and emotions
│   ├── audio/                         music and sound effects
│   ├── games/                         HTML mini-games and covers
│   └── 360/                           offline panorama packages
│
├── tools/
│   ├── scene360-editor.html           360° route editor
│   ├── convert-360-img-to-css.html    panorama converter
│   ├── panorama-cleaner.html          two-shot panorama cleanup
│   ├── media-focus-editor.html        media focus editor
│   └── game-tester.html               mini-game protocol tester
│
├── lib/                               bundled third-party libraries
├── docs/
│   ├── specs/                         story and mini-game specifications
│   ├── demo/images/                   interface screenshots
│   ├── 360/                           panorama examples
│   ├── games/                         mini-game screenshots
│   ├── kiosk/                         real installation photos
│   ├── stat/                          checks, statistics, and graphs
│   └── tools/                         authoring-tool screenshots
├── dev/                               engine development and verification
│   ├── README.md                      automated-test instructions
│   ├── package.json                   test commands and dependencies
│   ├── playwright.config.mjs          browser-test configuration
│   └── tests/                         unit and browser tests
├── .github/
│   ├── DISCUSSION_TEMPLATE/           question, idea, and showcase forms
│   └── workflows/                     tests and release automation
├── FIRST-STEPS-EN.md                  English starting guide
├── FIRST-STEPS.md                     Russian starting guide
├── README.md                          primary Russian overview
├── README-EN.md                       shortened English overview
├── LICENSE
├── COMMERCIAL-USE.md
└── NOTICE.md
```

`story.js` and `story360.js` are author workspace files. They may be absent
from a clean copy or untracked by Git; the demo falls back to
`story-example.js`.

The update ZIP excludes `assets/`, `story.js`, and the root
`story-example.js`, so it does not overwrite an existing story or its media.
The current reference story remains available as
`docs/examples/story-example.js`.

## Documentation

- [First Steps in English](FIRST-STEPS-EN.md)
- [Первые шаги на русском](FIRST-STEPS.md)
- [Story specification (Russian)](docs/specs/spec-story.md)
- [HTML mini-game specification (Russian)](docs/specs/spec-game.md)
- [Engine automated tests (Russian)](dev/README.md)
- [Third-party notices](NOTICE.md)
- [Commercial use](COMMERCIAL-USE.md)

The specifications can serve as prompt-ready technical contracts for
AI-assisted scripting or mini-game work. AI is optional and is not a runtime
feature of the engine.

## Limitations

- the engine targets portrait displays rather than a general-purpose game scene;
- the story is edited as text; there is no built-in story IDE;
- media quality and performance depend on prepared project assets;
- device browser limits for memory, audio autoplay, and WebGL still apply;
- stable installations should use Releases rather than `main`.

## Discussions

Use [GitHub Discussions](https://github.com/IlyaBarilo/vn-vertical-engine/discussions)
as the project's public feedback space:

- [Help](https://github.com/IlyaBarilo/vn-vertical-engine/discussions/categories/help) for questions, story help, and unexpected behavior;
- [Ideas](https://github.com/IlyaBarilo/vn-vertical-engine/discussions/categories/ideas) for engine, documentation, and authoring-tool proposals;
- [Show Your Project](https://github.com/IlyaBarilo/vn-vertical-engine/discussions/categories/show-your-project) for sharing your novels, installations, mini-games, and experiments.

The forms explain what context to provide. For a possible bug, include the
engine version, device, browser, launch method, and minimal reproduction steps.
Do not publish passwords, keys, `license-key.js`, or private project materials.
Issues are intentionally disabled.

## Engine tests

After changing the parser or validation logic, run `node --test`; this core
suite remains dependency-free. Browser checks for the real UI,
`localStorage`, and iframe messaging run separately with
`npm --prefix dev run test:e2e` after installing the developer dependencies.
GitHub Actions runs both suites. These tests verify the engine itself and do not
replace the statistics and graphs for a particular story. See
[dev/README.md](dev/README.md).

## License

Unless a file states otherwise, the current version's original code, authoring
tools, technical examples, and accompanying documentation are licensed under
[PolyForm Noncommercial 1.0.0](LICENSE).

Files in `assets/` and the demo story content in `story-example.js` are for
demonstration only and are not licensed for reuse under these terms. Replace
them in your own project. Third-party libraries retain their own licenses; see
[NOTICE.md](NOTICE.md). User-created stories and assets remain the property of
their authors.

Commercial use outside the cases expressly permitted by PolyForm Noncommercial
requires separate written permission. See [COMMERCIAL-USE.md](COMMERCIAL-USE.md).

The clarified license scope applies to version 0.6.0 and later versions.
Earlier versions retain the terms and notices distributed with them.

© 2026 Ilya Barilo
