# 🎮 Visual Novel Vertical Engine (HTML/CSS/JS)

[![GitHub
stars](https://img.shields.io/github/stars/IlyaBarilo/vn-vertical-engine?style=social)](https://github.com/IlyaBarilo/vn-vertical-engine)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Demo](https://img.shields.io/badge/demo-available-brightgreen)](https://github.com/IlyaBarilo/vn-vertical-engine)

A lightweight visual novel engine built with **HTML, CSS, and
JavaScript**, designed specifically for **vertical screens** and
**portrait displays**, including **4K TVs mounted vertically**.

The engine works **fully offline** and does not require any build tools
or backend. Simply open `index.html` in a browser.

The project is inspired by visual novel scripting systems (such as
Ren'Py), but implemented as a **minimalistic browser-based solution**,
suitable for demos and educational use.

---

## ✨ Features

-   📱 UI optimized for **vertical screens**
-   🖥 optimized for **4K displays**
-   📐 interface ratio **7:16**, with support for other aspect ratios
-   🌐 **fully offline**
-   ⚡ no build tools or frameworks required
-   🧾 simple **text-based scripting format**
-   🖼 support for **backgrounds**
-   🎭 **characters and emotions**
-   💬 dialogue system
-   🔀 **branching storylines**
-   🎵 background music support
-   🎮 ability to embed **mini-games via iframe** _(in progress)_
-   📊 built-in **resource loading statistics**

---

## 📷 Demo

### 🖼️ Visual Novel Demo

<p align="center">
<img src="docs/demo/images/anna-first-screen.jpg" width="300">
<img src="docs/demo/images/igor-second-screen.jpg" width="300">
<img src="docs/demo/images/menu.jpg" width="300">
<img src="docs/demo/images/bg-cafe.jpg" width="300">
</p>

Also supports horizontal mode:

<p align="center">
<img src="docs/demo/images/wide-first-screen.jpg" width="600">
</p>

---

### 📊 Analysis Tools

Script validation and graph generation in Mermaid format.

<p align="center">
<img src="docs/stat/stat-check.jpg" width="300">
</p>

Graph rendering inside the engine with navigation support. Useful for
debugging scripts and detecting unreachable nodes (marked in red).

<p align="center">
<img src="docs/stat/stat-mermaid.jpg" width="600">
<img src="docs/stat/stat-mermaid-zoom.jpg" height="300">
</p>

---

## 🧩 Use Cases

This engine is suitable for:
- interactive stories
- museum installations
- exhibition stands
- educational projects
- university interactive displays
- browser-based narrative games
- vertical information kiosks

---

## 📁 Project Structure

    project/
    │
    ├── index.html
    ├── engine.css
    ├── engine.js
    ├── story-loader.js
    │
    ├── story.js
    │
    ├── README.md
    ├── LICENSE
    │
    ├── libs/
    └── assets/
             ├── backgrounds/
             ├── characters/
             ├── audio/
             └── minigames/

---

## 🚀 Quick Start

1.  Download the latest version:

👉 **[Download Latest Release](https://github.com/IlyaBarilo/vn-vertical-engine/releases/latest)**

2.  Extract the archive.

3.  Open **index.html** in your browser.

The engine runs completely **offline**.

---

## 📏 Vertical Screen Adjustment

To add top and bottom margins (useful for floor-mounted displays), use
URL parameters:

    index.html?topSpacing=500&bottomSpacing=800

Replace `500` and `800` with your desired values (in pixels).

---

## 📝 Script Format

The script is stored in `story.js` as a text block.

Example:

``` javascript
window.STORY_TEXT = `

[meta]
title: Demo Story
startScene: intro

[bg]
hall = assets/backgrounds/bg_hall.jpg

[char]
anna image neutral = assets/characters/ch_anna_neutral.png
anna name = "Anna"
anna color = #0F0

[audio]
bgmDay = assets/audio/bgm_day.mp3

[scene]
scene intro

bg hall

show anna neutral

anna: "Welcome to the demo."

menu
"Go to the lab" -> lab_scene
"Go to the cafe" -> cafe_scene

`;
```

---

## 🎬 Core Commands

### Scene

    scene scene_id

### Background

    bg backgroundId

### Characters

    show character emotion
    hide all

### Dialogue

Character:

    anna: "Text"

Narrator:

    "Text"

### Choices

    menu
    "Option 1" -> scene_a
    "Option 2" -> scene_b

### Navigation

    goto scene_id

### Music

    bgm musicId
    bgm musicId loop
    bgm stop

---

## 🎮 Mini-games (in progress)

The engine supports embedding mini-games via **iframe**.

This allows integrating any HTML-based game directly into the story.

---

## ⚙ Interface Configuration

The UI is designed for **tall vertical displays**.

Available settings:
- top spacing
- bottom spacing

This allows adapting the interface for **very tall screens and vertical
TVs**.

---

## ⚠ Current Limitations

-   no save/load system
-   minimalistic script format

The engine is focused on **simple interactive projects and
installations**.

---

## 📝 License

### Source Code

The engine source code (`engine.js`, `engine.css`, `index.html`,
`story-loader.js`) is licensed under the **MIT License**.

Copyright (c) 2026 Ilya Barilo

See the full license text in the [LICENSE](LICENSE).


## 📦 Content (Demo Assets)

All media files located in the `assets/` folder --- including character
images, backgrounds, videos, audio files, and other materials used in
the demo novel --- are **NOT covered by the MIT License**.

These files are provided **for demonstration purposes only**. You **are
not allowed** to use them in your own projects (commercial or
non-commercial) without obtaining separate permission from the copyright
holder.

When creating your own stories using this engine, you must replace all
demo assets with your own content.

---

## 📦 Third-Party Components

This project uses the following open-source libraries:

### Mermaid (MIT License)

-   **Purpose:** visualization of story graphs in debug and analysis
    mode\
-   **File:** `lib/mermaid.min.js` (version 11.x)\
-   **License:** MIT (see `NOTICE.md` for details)\
-   **Usage:** included in the repository without modifications, works
    fully offline

### Full Notices List

Detailed information about licenses and usage terms of third-party
software can be found in the [NOTICE.md](NOTICE.md) file.

---

## 🔮 Possible Improvements

-   save/load system\
-   animations\
-   additional scripting commands

---

## 🔄 Dependency Updates

Mermaid is updated manually as new versions are released.



