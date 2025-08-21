# Markov Chain Visualizer

An interactive, dependency-light web app that helps you **learn and teach discrete-time Markov chains**. Model states and transitions, then watch the distribution evolve step by step.

## What it does

- **Edit states and a row‑stochastic transition matrix** \(P\)
- **Choose an initial distribution** \(p_0\)
- **Step or run** the chain: \(p_{t+1} = p_t P\)
- **See the state graph**: node fill ≈ current probability, edge width ≈ transition probability
- **Plot the distribution over time** with a color‑coded line chart
- **Compute a stationary distribution** via the power method
- **Detect absorbing states** (identity rows)

Built for GitHub Pages: no build step, just static HTML/CSS/JS.

## Why it’s useful

- **Intuition**: Ties equations to visuals for faster understanding
- **Teaching**: Great for lectures and demos—edit matrices live and show the effects
- **Debugging models**: Quickly spot invalid rows, absorbing states, and convergence behavior

## How it works

- We treat \(P\) as **row‑stochastic** (rows sum to 1) and evolve **row vectors**: \(p_{t+1} = p_t P\).
- The stationary distribution \(\pi\) satisfies \(\pi = \pi P\). We approximate \(\pi\) using the **power method** starting from uniform; we stop when the \(\ell_1\) difference is small. Convergence is guaranteed for **irreducible, aperiodic** finite-state chains.
- **Absorbing states** are detected as exact identity rows.

## Features and UX notes

- Presets: Weather, Web Navigation, and an Absorbing example
- Buttons to **normalize rows**, **randomize** the matrix, set **uniform** \(p_0\), and **normalize** \(p_0\)
- Live speed control; simulation pauses when the tab is hidden
- Edge labels hide for tiny probabilities to reduce clutter
- Keyboard‑friendly focus styles and ARIA live region for analysis output

## Quick start (GitHub Pages)

1. Create a repo (e.g., `markov-visualizer`) and enable **GitHub Pages** (Settings → Pages → Source: `main`/`root`).
2. Upload these files to the repo root:
   - `index.html`
   - `css/styles.css`
   - `js/app.js`
   - `README.md`
3. Visit your Pages URL.

## Local usage

Open `index.html` in a browser. Internet access is required for the Chart.js CDN.

## License

MIT — do whatever you like; attribution appreciated.
