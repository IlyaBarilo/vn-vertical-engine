# First Steps

> Russian version: [FIRST-STEPS-RU.md](FIRST-STEPS-RU.md)  
> If needed, you can use automatic translators.

This file is a short route for getting started with the project.

The main idea is simple:

1. first, come up with the story;
2. then build a draft script;
3. then decide whether you need mini-games at all;
4. if you do, add them in the right places;
5. after that, connect, test, and refine everything together.

When downloading a release, use the full ZIP archive if you want to run the
included demo as-is. Use the `-update` ZIP archive when copying a new engine
version over an existing novel; it does not include `assets/` or `story.js`.

---

## Important

Mini-games are **not a required part** of a visual novel.

You can work like this:

- first create the idea and a draft script for the novel;
- fully build the story **without mini-games**;
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
- what the final effect should be: learning, atmosphere, demonstration, or an interactive story.

At this stage, you do not need to think about code, and you do not need to create mini-games yet.

---

## Step 2. Make a draft script

In this project, your script is stored in `story.js` as a text block called `window.STORY_TEXT`.
If `story.js` does not exist yet, the engine loads `story-example.js` so the demo can start.
Start your own novel by copying `story-example.js` to `story.js`, then edit `story.js`.

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
You are a senior HTML5 game developer and UX designer of vertical touch games. Create a complete mini-game based on idea #<number>. The game must fully comply with the attached SPEC-GAME.md specification. Do not simplify or ignore the specification requirements. Implement it carefully as a finished working result.
```

Why this matters:

- first you choose the mechanic;
- then you build the implementation;
- the specification already defines the compatibility, input, completion, and result-format requirements.

---

## Step 6. Test the mini-game separately

Before connecting it to the visual novel, it is convenient to test the game separately through `game-tester.html`.

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
- overly complex or confusing structural parts.

This is especially useful after adding mini-games and new branching.

---

## Step 9. Put everything into a working loop

A good practical loop looks like this:

1. story idea;
2. draft `story.js`;
3. decision on whether mini-games are needed;
4. mini-game ideas;
5. mini-game implementation according to `SPEC-GAME.md`;
6. connection to the script;
7. graph and branching check;
8. refinement of text, scenes, and games.

This is safer and more convenient than trying to generate games first and only then figuring out where to place them.

---

## The shortest route

If you need the shortest version:

1. come up with the story;
2. sketch the script;
3. decide whether mini-games are needed;
4. if they are needed, ask for ideas first, then create the game according to the specification;
5. test the game separately;
6. connect it in `story.js`;
7. check the graph and branching.

---

## What to attach to requests

For scripts:

- `SPEC-STORY.md` — if you want to generate or refine the script structure.

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
- **then the decision whether mini-games are needed**;
- **then the mini-games themselves, if they are truly useful**.

Mini-games are an additional tool, not a mandatory part of every visual novel.
