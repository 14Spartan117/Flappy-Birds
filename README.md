# Dragon Flight 🐉

A fun, challenging Flappy Bird-style browser game where you fly a dragon through pipes! Built with vanilla HTML, CSS, and JavaScript using the Canvas API.

## 🎮 Play Now

[**Play Dragon Flight**](https://14spartan117.github.io/Flappy-Birds/)

## Features

- **Multiple Game Modes** — Classic and Challenge modes with different speeds and pipe behavior
- **Difficulty Levels** — Easy, Medium, and Hard settings that adjust pipe gaps and spawn rates
- **Dragon Skins** — Choose from Red, Blue, Green, and Pink dragons
- **Leaderboard** — Local leaderboard tracks your top scores
- **Achievements** — Unlock milestones as you score (First Flap, 10, 25, 50, 100 points)
- **Sound Effects** — Audio feedback for flapping, scoring, and game over
- **Day/Night Cycle** — Dynamic background that shifts between day and night
- **Share Score** — Share your score with friends via the Web Share API or clipboard
- **Responsive Design** — Plays on desktop and mobile with touch and keyboard support

### 💰 Monetization Features

- **In-Game Coin Economy** — Earn coins from gameplay (1 coin per score point), persisted in localStorage
- **Premium Dragon Skins** — Diamond and Shadow skins, unlockable with coins (100 and 200 coins)
- **Continue System** — Spend 50 coins on game over to revive and keep playing (once per run)
- **Coin Shop** — Buy coin packs or unlock premium skins from the in-game shop
- **Ad Banner** — Placeholder ad banner area for ad provider integration; removable for 500 coins
- **Rewarded Ads** — Watch an ad for +25 bonus coins on game over
- **Donate Button** — Support the developer with a donation link

### ✨ New Improvements

1. **Screen Shake on Collision** — The screen shakes when you hit a pipe or the ground for visceral impact feedback
2. **Animated Wing Flapping** — Dragon wings visually respond to velocity; they flap up on jump and angle down when falling
3. **Progressive Difficulty Scaling** — Every 10 points, pipe speed increases and gap shrinks (capped at reasonable minimums) for escalating challenge
4. **Combo Scoring System** — Score multiple pipes in quick succession for x2 (3+ combo) or x3 (5+ combo) multipliers; combo count displayed on screen
5. **Ghost/Best Run Trail** — A semi-transparent ghost dragon shows your best-run path so you can race against yourself
6. **Floating Score Popups** — "+1" (or "+2"/"+3" on combo) text floats upward and fades near scored pipes
7. **Parallax Scrolling Background** — Distant mountains scroll slowly, mid-ground bushes scroll at medium speed for depth
8. **Dragon Fire Breathing** — Scoring a point triggers a burst of orange/yellow/red flame particles from the dragon's snout
9. **Twinkling Stars at Night** — During the night phase of the day/night cycle, stars twinkle in the sky
10. **Smooth Camera Follow** — The view subtly tracks the dragon's vertical position for a dynamic feel
11. **Pipe Color Progression** — Pipes turn green → blue → purple → red/gold as your score increases (0→9, 10→24, 25→49, 50+)
12. **Animated Grass Blades** — Simple grass blades on the ground sway gently with a sine-wave animation
13. **Best Score Medal System** — Game over screen awards Bronze (10+), Silver (25+), Gold (50+), or Platinum (100+) medals
14. **FPS Counter** — Press **F** to toggle a live frames-per-second counter in the corner for performance debugging
15. **Lifetime Stats Tracking** — Total games played, cumulative score, and best streak are saved to `localStorage` and shown on the game over screen

## Controls

| Action         | Input                              |
|----------------|------------------------------------|
| Flap           | Click, Tap, Arrow Up, or W key     |
| Pause          | Space bar or Pause button          |
| Restart        | Restart button on game over screen |
| Toggle FPS     | **F** key                          |
| Toggle Mute    | **M** key or 🔊 button             |

## Testing

A comprehensive test suite is included in `tests.html`. Open it in any browser — no server required:

```bash
open tests.html        # macOS
xdg-open tests.html    # Linux
start tests.html       # Windows
```

The test file covers all 15 new features including:
- Combo scoring multiplier logic
- Progressive difficulty calculations
- Medal assignment at score thresholds
- Stats tracking and serialization
- Pipe color selection by score
- Screen shake intensity parameters
- FPS calculation
- Camera follow clamping
- Game state transitions (start → play → game over → restart)
- Coin economy (earning, spending, balance)
- Premium skin unlocking
- Continue system (cost, single-use per run)
- Ad removal system
- Rewarded ad coin bonuses

## Running Locally

No build tools or dependencies are required. Simply open `index.html` in any modern browser:

```bash
# Clone the repository
git clone https://github.com/14Spartan117/Flappy-Birds.git
cd Flappy-Birds

# Open in your default browser
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

## License

This project is open source and available for personal and educational use.

