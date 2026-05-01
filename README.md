# Discrete Fourier Transform & FFT Circuit Visualizer

## Course / CLO Mapping
- Course context: Algorithms II final project
- CLO-2 topic: Discrete Fourier Transform, naive DFT, and Cooley-Tukey FFT circuit visualization

## Description
This project is a standalone educational web application that teaches how the Discrete Fourier Transform (DFT) works, why the direct method costs O(n^2), and how the radix-2 Cooley-Tukey Fast Fourier Transform (FFT) reduces the structure to O(n log n).

The app is designed as an offline teaching simulator. It combines algorithm-correct computation with synchronized visual explanations, pseudocode highlighting, counters, history tracking, and verification that the FFT outputs match the naive DFT baseline.

## Features
- Dark-mode academic UI built for desktop and mobile
- Works completely offline by opening `index.html`
- Mode selector for:
  - Naive DFT
  - Recursive FFT
  - Iterative FFT / Butterfly Circuit
- Input sizes `n = 4` and `n = 8`
- Custom comma-separated sample editor with validation
- Presets:
  - Impulse signal
  - Constant signal
  - Alternating signal
  - Sine-like signal
- Playback controls:
  - Build Steps
  - Step
  - Play
  - Pause
  - Reset
- Speed slider from `0.25x` to `4x`
- Step counter and status indicator
- Operation counters for:
  - Complex multiplications
  - Complex additions
  - Butterfly operations
  - Stages completed
- Time-domain signal chart
- Frequency spectrum magnitude chart
- DFT matrix visualization with root-of-unity tooltip details
- Naive DFT accumulation animation
- Recursive FFT even/odd decomposition tree
- Iterative butterfly circuit visualization
- Bit-reversal permutation table and mapping diagram
- Pseudocode panel with line highlighting and explanations
- Plain-English step explanation box with concrete values
- Clickable history table
- Output comparison table
- Verification panel that checks FFT outputs against naive DFT
- Bottom teaching notes for overview, complexity, worked example, and presentation talking points

## Algorithms Implemented
### 1. Naive DFT
The direct formula is implemented exactly:

`X[k] = sum_{j=0}^{n-1} x[j] * exp(-2*pi*i*j*k/n)`

This mode records every multiplication and accumulation step so the O(n^2) structure is visible.

### 2. Recursive Cooley-Tukey FFT
This version uses radix-2 even/odd decomposition:
- Base case: length 1
- Recursive transform on even-indexed samples
- Recursive transform on odd-indexed samples
- Combine step with twiddle factors

### 3. Iterative Radix-2 FFT
This version uses:
- Bit-reversal permutation
- Stage-by-stage butterfly combines
- Twiddle factor updates inside each block

## Correctness Verification
The app computes:
- naive DFT output
- recursive FFT output
- iterative FFT output

Then it compares the FFT outputs to the naive DFT output using tolerance `1e-6`.

The verification panel reports:
- PASS if both FFT implementations match within tolerance
- FAIL if any bin differs by more than the tolerance

Displayed values are rounded for readability, but internal verification uses full floating-point precision.

## O(n^2) vs O(n log n)
### Naive DFT
- Each output `X[k]` uses every input `x[j]`
- There are `n` outputs
- Each output needs `n` weighted terms
- Total work scales like `n * n = n^2`

### FFT
- The transform is split into even and odd subproblems
- Smaller transforms are reused instead of recomputed
- The iterative circuit has `log2(n)` stages
- Each stage has `n/2` butterflies
- Total work scales like `O(n log n)`

For `n = 8`:
- Naive DFT shows about `64` pair interactions
- FFT shows `3` stages times `4` butterflies = `12` butterflies

## Project Structure
```text
/index.html
/styles.css
/app.js
/README.md
```

## How to Run Locally
1. Download or clone the project files.
2. Open `index.html` directly in a browser.
3. No package manager, build tool, server, or internet connection is required.

## How to Deploy on GitHub Pages
1. Push these files to a GitHub repository.
2. In GitHub, open `Settings -> Pages`.
3. Set the source to the branch that contains `index.html`, usually `main`.
4. Save the Pages settings.
5. GitHub Pages will serve the app as a static website.

Because the project uses only relative local files, it is compatible with GitHub Pages hosting.

## Tech Stack Notes
This project uses only:
- HTML5
- CSS3
- Vanilla JavaScript ES6+
- SVG

It does not use:
- React
- Vue
- D3.js
- jQuery
- Tailwind
- Bootstrap
- npm packages
- build tools
- external CDNs
- internet-dependent resources

## Default Worked Example
The teaching content includes the worked example:
- `n = 4`
- input `x = [1, 0, 1, 0]`

Expected final transform:
- `X = [2, 0, 2, 0]`

The simulator shows that:
- the naive DFT computes this directly,
- recursive FFT reaches the same result through even/odd decomposition,
- iterative FFT reaches the same result through bit reversal and butterfly stages.
