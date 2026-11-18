# Solmar City — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/guyuan66/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/guyuan66/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

You are a wheelman with empty pockets in Solmar City, a sun-soaked town that never sleeps. Steal cars, run three story jobs for the crew, and stay one step ahead of the Solmar PD — traffic, pedestrians, a wanted system with road-following police cruisers, combat, a HUD with a live minimap, a start screen and a save.

## How it plays

- **Story jobs + repeat work** — three story missions in order (steal a car to the docks, a plaza pickup, a marked-car heat run), then endless repeat delivery jobs. Every other repeat job is a **Checkpoint Sprint**: three gates across the city, +20 s per gate, $700 on the finish.
- **Weather & day/night** — a 6-minute day cycle (dawn, day, dusk, night) drives the sun, moon, sky, fog and street lamps. Clear spells, rain (with lightning) and fog roll in on their own schedule; rain shortens visibility and fog closes it in.
- **Taxi fares** — steal a taxi and a fare starts waiting at a landmark (90 s of patience). Pick them up, beat the meter to the drop-off: the fare ticks up per metre driven, and the tip scales with time left. Crash hard with a passenger aboard and they bail out. Nearby pedestrians wave cabs down — honk (H) and the hailers turn toward you.
- **Police escalation** — 1–5 wanted stars. At 2 stars the PD throws striped roadblocks across the road ahead; at 4 stars a helicopter joins, sweeping a searchlight over you and making on-foot busts come ~60% faster. Lay low and the heat cools off.
- **Vehicles** — cars, motorcycles (quick and twitchy) and city buses (slow, wide, impossible to miss), plus traffic AI. Park a car at the safehouse and it goes into your garage for the next session.
- **Stats & achievements** — distance, top speed, cash earned, fares, crashes, busted/wasted counts, and 13 achievements with cash bonuses (including SPRINTER for finishing a checkpoint sprint). Press M to hide or show the stats panel.
- **Pedestrians** — sidewalk walkers who scatter from speeding cars; at 3+ stars, nearby crowds flee you in a panic.

## Controls

WASD walk/drive, E steal & enter a car, F punch, Shift run, Space brake, P pause, drag the mouse to look around. **H** honk the horn, **C** cycle camera (follow / close / high), **M** toggle the stats panel.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: the game is static files under `game/` (three.js vendored under `game/vendor/`). Keyboard and mouse: WASD walk/drive, E steal & enter a car, F punch, Shift run, Space brake, P pause, drag the mouse to look around, H honk, C cycle camera, M toggle stats.

## Shots

The four screenshots in `screenshots/` are staged by the game itself (`?shot=chase|city|mission|start&seed=7`): each plays the real rules forward from a fresh world with a scripted autopilot, so the frame is what a short game really looks like. Retake them with `node ../tools/shots.mjs`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
