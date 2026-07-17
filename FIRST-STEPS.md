# First Steps

> Russian version: [FIRST-STEPS-RU.md](FIRST-STEPS-RU.md)  
> If needed, you can use automatic translators.

This file is a short route for getting started with the project.

The main idea is simple:

1. first, come up with the story;
2. then build a draft script;
3. then decide whether you need 360 scenes or mini-games at all;
4. use optional tools only where they make the project clearer;
5. after that, connect, test, and refine everything together.

When downloading a release, use the full ZIP archive if you want to run the
included demo as-is, including demo media, 360 panorama packages, mini-games,
and tools. Use the `-update` ZIP archive when copying a new engine version over
an existing novel; it does not include `assets/`, `story.js`, or root
`story-example.js`. Inside the update archive, the current example is available
as `docs/examples/story-example.js`.

---

## Important

Mini-games are **not a required part** of a visual novel.
360 spaces and authoring tools are optional too.

The main story remains a plain text script in `story.js`. You can write and
edit it in any text editor without special authoring software.

You can work like this:

- first create the idea and a draft script for the novel;
- fully build the story **without mini-games**;
- add 360 scenes only where free exploration helps the location or learning task;
- mark places where a mini-game could strengthen a scene;
- add one or more mini-games later;
- or skip mini-games entirely if needed.

Mini-games should be added only where they are truly useful for the story, the learning goal, or the pacing of the experience.

---

## Step 1. Come up with the novel idea

First, define the foundation of the project:

- what the story is about;
- who the main character is;
- what the key scenes are;
- where the choices will appear;
- whether any location should be explored as a 360 scene;
- what the final effect should be: learning, atmosphere, demonstration, or an interactive story.

At this stage, you do not need to think about code, and you do not need to create mini-games yet.

---

## Step 2. Make a draft script

In this project, your script is stored in `story.js` as a text block called `window.STORY_TEXT`.
If `story.js` does not exist yet, the engine loads `story-example.js` so the demo can start.
Start your own novel by copying `story-example.js` to `story.js`, then edit `story.js`.

For larger 360 routes, keep the main story in `story.js` and store the panorama
map in an optional `story360.js` file, usually generated with
`tools/scene360-editor.html`.

The minimum structure looks like this:

```js
window.STORY_TEXT = `

[meta]
title = My Story
startScene = intro
lang = en

[bg]
hall file=assets/backgrounds/bg-hall.jpg

[char]
anna emotion=neutral file=assets/characters/anna.png name="Anna" color=#0F0

[var]
score = 0

[scene]
scene intro
bg hall
show anna neutral
anna: "Welcome!"

menu
"Go forward" -> next_scene
"Stay here" -> stay_scene

scene next_scene
"The story continues."

scene stay_scene
"You stayed where you are."
`;
```

At first, make exactly this kind of draft:

- scenes;
- transitions;
- choices;
- basic variables;
- the overall story structure.

Do not polish everything immediately. The important thing is to quickly assemble the framework.

---

## Optional. Add 360 scenes and authoring tools when needed

Use 360 scenes when the player should look around a place, choose a direction,
or move through a connected space rather than only read a static scene.

Useful local tools:

- `tools/scene360-editor.html` — build `story360.js`, place markers, and define panorama links visually;
- `tools/convert-360-img-to-js.html` — convert panorama images into offline JS packages;
- `tools/media-focus-editor.html` — tune focus points for media-heavy scenes;
- `tools/game-tester.html` — test mini-games before connecting them to the story.

These tools are helpers, not a replacement for the story text. Start with the
story structure first, then add 360 navigation only where it clearly helps.

---

## Step 3. Mark places where mini-games may be useful

Once the draft script already exists, look at whether mini-games are actually needed.

Useful questions:

- is an interactive knowledge check needed here;
- does a mini-game strengthen the scene;
- does it give the player a clear result;
- does that result affect branching;
- does the mini-game break the pacing of the story.

If the answer is no, **do not add a game just for the sake of having a game**.

Good places for mini-games:

- a short check of understanding;
- an active scene instead of a long explanation;
- a moment of choice through action rather than only through text;
- a repeatable episode where the result can be saved into a variable.

---

## Step 4. If a mini-game is needed, ask for ideas first

Do not start by generating code immediately.

First, ask the AI to suggest several game ideas.

Prompt #1:

```text
You are a game designer of short educational browser mini-games. Suggest 5 game ideas on the topic "<topic>" for the audience "<audience>" in the style "<style>". No code. For each idea, briefly describe the mechanic, what it teaches, why it works, and the main risk.
```

Example:

```text
You are a game designer of short educational browser mini-games. Suggest 5 game ideas on the topic "logarithms" for the audience "students aged 14–17" in the style "cyberpunk". No code. For each idea, briefly describe the mechanic, what it teaches, why it works, and the main risk.
```

After that, choose one idea that:

- fits the scene;
- is not too complex;
- is clear to the player;
- genuinely strengthens the visual novel.

---

## Step 5. Then create the game based on the chosen idea

Once the idea has been selected, attach the `SPEC-GAME.md` file to the request and use the second prompt.

Prompt #2:

```text
Create a mini-game about <TOPIC> in the style of <STYLE>, where the player must <WHAT THE PLAYER DOES>.

When developing the game, you must use the attached SPEC-GAME.md specification file.
```

Why this matters:

- first you choose the mechanic;
- then you build the implementation;
- the specification already defines the compatibility, input, completion, and result-format requirements.

---

## Step 6. Test the mini-game separately

Before connecting it to the visual novel, it is convenient to test the game separately through `tools/game-tester.html`.

What to check:

- the game opens locally;
- it starts correctly;
- it works with mouse and touch;
- it looks fine in vertical format;
- it does not require a server or external dependencies;
- it sends the final `gameResult`;
- after finishing, it does not continue accepting input.

If the game fails this standalone check, do not connect it to the story until it is fixed.

---

## Step 7. Connect the game to the script

When the game is ready, register it in the `[game]` section and call it from a scene.

Example:

```text
[game]
mathHack file=assets/games/math-hack.html

[var]
mathResult = 0

[scene]
scene lab_test
"We need to hack the terminal."

game mathHack difficulty=2 result=mathResult

if mathResult == 1 -> success_scene
if mathResult == 0 -> fail_scene
```

This order is convenient:

1. the game is declared in `[game]`;
2. the result variable is declared in `[var]`;
3. the game is launched with the `game` command;
4. after that, you can use `if` and send the player to different scenes.

If a mini-game is not needed, simply skip this step.

---

## Step 8. Check the story structure through the graph

After assembling the script, open the visual novel and view the scene graph through the built-in statistics panel.

This helps you see:

- unreachable scenes;
- broken transitions;
- unnecessary branches;
- scenes that cannot be reached;
- overly complex or confusing structural parts;
- resource usage and repeated assets;
- mini-game launches and returned `gameResult` values.
- case-sensitive variable names that differ only by letter case.
- variable names containing characters other than English letters, digits, and `_`.
- scene, asset, emotion, and story360 identifiers containing characters other
  than English letters, digits, and `_`.

This is especially useful after adding 360 scenes, mini-games, and new branching.
The `SUMMARY CHECK` line at the beginning gives a quick overview of parsing,
variables, identifiers, files, image sizes, script validation, and story360
conditions, as well as unreachable scenes and cycles. A red cross points to a
detailed section below.

The `VARIABLES` statistics section reports groups such as `Score`, `score`, and
`SCORE` with their usage locations. They remain separate runtime variables;
the warning only helps find likely typing mistakes. The same section checks
that a variable name starts with an English letter or `_` and contains only
English letters, digits, and `_`.

The `IDENTIFIERS` section checks scene, background, character, emotion, audio,
video, game, and story360 space and entry IDs. Story360 panorama and mark IDs
are not checked when declared, but a panorama ID used as a `goto360` target is
checked. Digits may be the first character. Resource file and folder paths are
checked separately in `FILE CHECK`: every path segment may contain only English
letters, digits, `-`, and `_`. The dot before a file extension is allowed.

---

## Step 9. Put everything into a working loop

A good practical loop looks like this:

1. story idea;
2. draft `story.js`;
3. optional 360 places and media focus checks;
4. decision on whether mini-games are needed;
5. mini-game ideas;
6. mini-game implementation according to `SPEC-GAME.md`;
7. connection to the script;
8. graph, resource, and branching check;
9. refinement of text, scenes, 360 routes, and games.

This is safer and more convenient than trying to generate games first and only then figuring out where to place them.

By default, story progress is saved automatically in the browser, so regular
reloads during testing do not erase the current playthrough.

### URL launch modes

Use these modes when one `story.js` contains several independent entry points
or when a public screen must never restore the previous visitor's progress:

| URL | Result |
| --- | --- |
| `index.html` | Starts from `[meta] startScene` and uses the standard autosave |
| `index.html?novel=game01` | Starts or restores the independent novel whose entry scene is `game01` |
| `index.html?scene=scScene02` | Opens a scene directly without reading, writing, or deleting saves |
| `index.html?novel=game01&nosave=true` | Starts `game01` from the beginning without touching saves |

Each `novel` gets a separate localStorage slot, so different novels do not
overwrite one another. The `novel` value is also its entry scene id. Scene ids
are matched without regard to letter case.

The regular slot is `vn_engine_autosave_v1`. A novel such as `game01` uses
`vn_engine_autosave_v1:novel:game01`. The `novel` parameter selects an entry
point at page load; it does not add in-story switching between novels.

Use `nosave=true` or the short `nosave` form for exhibitions and interactive
kiosks. It overrides autosave settings, always starts from the relevant entry
scene, and leaves all existing saves untouched. If `scene` and `novel` are
specified together, `scene` takes priority and saving remains disabled.
Recommended enabled values are `true`, `1`, `yes`, and `on`; only `false`, `0`,
`no`, or `off` explicitly disable the flag.

Use `mode=release` or the short `release` URL flag to force release mode without
editing `[meta]`. Both forms hide the statistics button but do not change the
start scene or autosave behavior:

    index.html?mode=release
    index.html?release

Restart clears only the active slot during a regular or `novel` launch. In
`scene` or `nosave` mode it restarts the entry point without deleting any save.
An unknown or case-ambiguous scene id displays an error. Setting
`autosave = false` in `[meta]` disables regular and `novel` autosave; `scene`
and `nosave` always disable storage.

---

## The shortest route

If you need the shortest version:

1. come up with the story;
2. sketch the script;
3. decide whether 360 scenes or mini-games are needed;
4. if 360 scenes are needed, prepare `story360.js` with the local tools;
5. if mini-games are needed, ask for ideas first, then create the game according to the specification;
6. test the game separately;
7. connect it in `story.js`;
8. check the graph, resources, games view, and branching.

---

## What to attach to requests

For scripts:

- `SPEC-STORY.md` — if you want to generate or refine the script structure.
- optional `story360.js` — if you want to refine an existing 360 route.

For mini-games:

- `SPEC-GAME.md` — if you want to generate a compatible mini-game.

Usually this is enough:

- for the story — the idea description and `SPEC-STORY.md`;
- for the game — the chosen idea and `SPEC-GAME.md`.

---

## Result

A good start in this project usually looks like this:

- **first the story**;
- **then the script structure**;
- **then optional 360 locations, if exploration helps the project**;
- **then the decision whether mini-games are needed**;
- **then the mini-games themselves, if they are truly useful**.

Mini-games are an additional tool, not a mandatory part of every visual novel.
