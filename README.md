# Click Moment

A cooperative browser art game inspired by the idea that *"My click moment is always created through conversation."*

Two players guide transparent yo-yos connected by a glowing elastic ribbon. Only the ribbon — not the yo-yos — can interact with floating broken circles. Together, reveal every circle before time runs out, then witness the final click moment.

## Play

Open `index.html` in a browser, or serve the directory locally:

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

## Controls

| Player | Keys |
|--------|------|
| Player 1 | W A S D |
| Player 2 | Arrow Keys |

Guide the ribbon through the center of each broken circle. Multiple passes gradually complete each ring. Cooperate to finish all circles within 90 seconds.

## Tech

- HTML, CSS, and vanilla JavaScript
- Canvas rendering with elastic ribbon simulation
- Web Audio API for subtle sound feedback
- No frameworks or dependencies
