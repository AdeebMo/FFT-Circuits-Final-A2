"use strict";

(() => {
    const TOLERANCE = 1e-6;
    const TOLERANCE_LABEL = "1e-6";

    class Complex {
        constructor(re = 0, im = 0) {
            this.re = Number(re);
            this.im = Number(im);
        }

        clone() {
            return new Complex(this.re, this.im);
        }

        add(other) {
            return new Complex(this.re + other.re, this.im + other.im);
        }

        sub(other) {
            return new Complex(this.re - other.re, this.im - other.im);
        }

        mul(other) {
            return new Complex(
                (this.re * other.re) - (this.im * other.im),
                (this.re * other.im) + (this.im * other.re)
            );
        }

        magnitude() {
            return Math.hypot(this.re, this.im);
        }

        phase() {
            return Math.atan2(this.im, this.re);
        }

        approxEqual(other, tolerance = TOLERANCE) {
            return Math.abs(this.re - other.re) <= tolerance && Math.abs(this.im - other.im) <= tolerance;
        }

        formatComplex(digits = 3) {
            return formatComplex(this, digits);
        }

        static fromReal(value) {
            return new Complex(value, 0);
        }
    }

    const MODE_LABELS = {
        naive: "Naive DFT",
        recursive: "Recursive FFT",
        iterative: "Iterative FFT / Butterfly Circuit"
    };

    const MODE_TAB_MAP = {
        naive: "naive",
        recursive: "recursive",
        iterative: "butterfly"
    };

    const PSEUDOCODE = {
        naive: [
            { line: 1, text: "for k = 0 to n - 1:", tip: "Choose one output frequency bin X[k] at a time." },
            { line: 2, text: "    X[k] = 0", tip: "Start the running sum for X[k] at zero." },
            { line: 3, text: "    for j = 0 to n - 1:", tip: "Visit every input sample x[j]." },
            { line: 4, text: "        X[k] += x[j] * omega^(j * k)", tip: "Multiply the sample by the matching root of unity and accumulate the result." }
        ],
        recursive: [
            { line: 1, text: "FFT(x):", tip: "Start a recursive FFT call on the current subproblem." },
            { line: 2, text: "    n = length(x)", tip: "Measure the current subproblem size." },
            { line: 3, text: "    if n == 1: return x", tip: "A length-1 DFT is already solved." },
            { line: 4, text: "    even = FFT(x[0], x[2], ...)", tip: "Recursively transform the even-indexed inputs." },
            { line: 5, text: "    odd = FFT(x[1], x[3], ...)", tip: "Recursively transform the odd-indexed inputs." },
            { line: 6, text: "    for k = 0 to n/2 - 1:", tip: "Combine matching entries from the even and odd halves." },
            { line: 7, text: "        t = omega^k * odd[k]", tip: "Apply the twiddle factor to the odd half." },
            { line: 8, text: "        X[k] = even[k] + t", tip: "The top butterfly output adds the twiddled odd term." },
            { line: 9, text: "        X[k+n/2] = even[k] - t", tip: "The bottom butterfly output subtracts the twiddled odd term." },
            { line: 10, text: "    return X", tip: "Return the completed transform for this subproblem." }
        ],
        iterative: [
            { line: 1, text: "bit_reverse_copy(x)", tip: "Reorder the input so iterative butterflies can process the right subproblems." },
            { line: 2, text: "for stage = 1 to log2(n):", tip: "Advance through each butterfly stage." },
            { line: 3, text: "    m = 2^stage; omega_m = exp(-2pi i / m)", tip: "Set the block size and stage root of unity." },
            { line: 4, text: "    for block = 0 to n - 1 step m:", tip: "Process one block of size m at a time." },
            { line: 5, text: "        omega = 1", tip: "Reset the twiddle factor at the start of each block." },
            { line: 6, text: "        for j = 0 to m/2 - 1:", tip: "Visit every butterfly inside the current block." },
            { line: 7, text: "            t = omega * A[block + j + m/2]", tip: "Multiply the lower wire by the current twiddle factor." },
            { line: 8, text: "            u = A[block + j]", tip: "Read the upper wire value." },
            { line: 9, text: "            A[block + j] = u + t", tip: "Store the upper butterfly output." },
            { line: 10, text: "            A[block + j + m/2] = u - t; omega *= omega_m", tip: "Store the lower output, then rotate omega for the next butterfly." }
        ]
    };

    const state = {
        mode: "naive",
        n: 4,
        inputSamples: [1, 0, 1, 0],
        inputText: "1, 0, 1, 0",
        currentPreset: "alternating",
        activeTab: "naive",
        status: "Idle",
        speed: 1,
        currentStepIndex: -1,
        results: null,
        timelines: {
            naive: [],
            recursive: [],
            iterative: []
        },
        playbackTimer: null
    };

    const dom = {};

    function initApp() {
        cacheDom();
        bindEvents();
        renderAll();
        runSelfChecks();
    }

    function cacheDom() {
        dom.modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
        dom.sizeButtons = Array.from(document.querySelectorAll("[data-size]"));
        dom.presetButtons = Array.from(document.querySelectorAll("[data-preset]"));
        dom.tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
        dom.tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
        dom.sampleInput = document.getElementById("sample-input");
        dom.inputError = document.getElementById("input-error");
        dom.buildButton = document.getElementById("build-btn");
        dom.stepButton = document.getElementById("step-btn");
        dom.playButton = document.getElementById("play-btn");
        dom.pauseButton = document.getElementById("pause-btn");
        dom.resetButton = document.getElementById("reset-btn");
        dom.speedSlider = document.getElementById("speed-slider");
        dom.speedLabel = document.getElementById("speed-label");
        dom.stepCounter = document.getElementById("step-counter");
        dom.statusPill = document.getElementById("status-pill");
        dom.activeModeLabel = document.getElementById("active-mode-label");
        dom.counterMult = document.getElementById("counter-mult");
        dom.counterAdd = document.getElementById("counter-add");
        dom.counterButterfly = document.getElementById("counter-butterfly");
        dom.counterStage = document.getElementById("counter-stage");
        dom.complexityCompare = document.getElementById("complexity-compare");
        dom.verificationStatus = document.getElementById("verification-status");
        dom.verificationDetails = document.getElementById("verification-details");
        dom.timeDomainSvg = document.getElementById("time-domain-svg");
        dom.frequencySpectrumSvg = document.getElementById("frequency-spectrum-svg");
        dom.dftMatrixSvg = document.getElementById("dft-matrix-svg");
        dom.naiveDftSvg = document.getElementById("naive-dft-svg");
        dom.recursiveFftSvg = document.getElementById("recursive-fft-svg");
        dom.butterflySvg = document.getElementById("butterfly-svg");
        dom.bitReversalPanel = document.getElementById("bit-reversal-panel");
        dom.outputComparisonPanel = document.getElementById("output-comparison-panel");
        dom.pseudocodePanel = document.getElementById("pseudocode-panel");
        dom.pseudocodeModeLabel = document.getElementById("pseudocode-mode-label");
        dom.stepExplanation = document.getElementById("step-explanation");
        dom.historyBody = document.getElementById("history-body");
        dom.tooltip = document.getElementById("tooltip");
        dom.timeSummaryLabel = document.getElementById("time-summary-label");
        dom.spectrumSummaryLabel = document.getElementById("spectrum-summary-label");
    }

    function bindEvents() {
        dom.modeButtons.forEach((button) => {
            button.addEventListener("click", () => {
                if (state.mode === button.dataset.mode) {
                    return;
                }
                stopPlayback();
                state.mode = button.dataset.mode;
                state.activeTab = MODE_TAB_MAP[state.mode];
                if (state.results) {
                    state.currentStepIndex = -1;
                    state.status = "Ready";
                }
                renderAll();
            });
        });

        dom.sizeButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const newSize = Number(button.dataset.size);
                if (state.n === newSize) {
                    return;
                }
                stopPlayback();
                state.n = newSize;
                const presetName = state.currentPreset || "alternating";
                const presetSamples = getPresetSamples(presetName, state.n);
                state.inputSamples = presetSamples.slice();
                state.inputText = presetSamples.join(", ");
                dom.sampleInput.value = state.inputText;
                clearBuiltState();
                renderAll();
            });
        });

        dom.sampleInput.addEventListener("input", () => {
            stopPlayback();
            state.inputText = dom.sampleInput.value;
            state.currentPreset = null;
            const parsed = parseSampleInput(state.inputText, state.n);
            if (parsed.ok) {
                state.inputSamples = parsed.samples.slice();
            }
            clearBuiltState();
            renderAll();
        });

        dom.presetButtons.forEach((button) => {
            button.addEventListener("click", () => {
                stopPlayback();
                state.currentPreset = button.dataset.preset;
                state.inputSamples = getPresetSamples(state.currentPreset, state.n);
                state.inputText = state.inputSamples.join(", ");
                dom.sampleInput.value = state.inputText;
                clearBuiltState();
                renderAll();
            });
        });

        dom.buildButton.addEventListener("click", handleBuild);
        dom.stepButton.addEventListener("click", stepForward);
        dom.playButton.addEventListener("click", playTimeline);
        dom.pauseButton.addEventListener("click", pauseTimeline);
        dom.resetButton.addEventListener("click", resetTimeline);

        dom.speedSlider.addEventListener("input", () => {
            state.speed = Number(dom.speedSlider.value);
            renderMeta();
        });

        dom.tabButtons.forEach((button) => {
            button.addEventListener("click", () => {
                state.activeTab = button.dataset.tab;
                renderTabs();
            });
        });

        dom.historyBody.addEventListener("click", (event) => {
            const row = event.target.closest(".history-row");
            if (!row) {
                return;
            }
            jumpToStep(Number(row.dataset.timelineIndex));
        });

        dom.dftMatrixSvg.addEventListener("mousemove", (event) => {
            const tooltipTarget = findTooltipTarget(event.target, dom.dftMatrixSvg);
            if (!tooltipTarget) {
                hideTooltip();
                return;
            }
            showTooltip(tooltipTarget.dataset.tooltip, event.clientX, event.clientY);
        });

        dom.dftMatrixSvg.addEventListener("mouseleave", hideTooltip);
    }

    function handleBuild() {
        const parsed = parseSampleInput(dom.sampleInput.value, state.n);
        state.inputText = dom.sampleInput.value;
        if (!parsed.ok) {
            dom.inputError.textContent = parsed.error;
            state.status = "Idle";
            renderAll();
            return;
        }

        stopPlayback();
        state.inputSamples = parsed.samples.slice();
        state.results = buildResults(state.inputSamples);
        state.timelines = {
            naive: state.results.naive.timeline,
            recursive: state.results.recursive.timeline,
            iterative: state.results.iterative.timeline
        };
        state.currentStepIndex = -1;
        state.status = "Ready";
        state.activeTab = MODE_TAB_MAP[state.mode];
        renderAll();
    }

    function playTimeline() {
        const timeline = getActiveTimeline();
        if (!timeline.length) {
            return;
        }
        if (state.currentStepIndex >= timeline.length - 1) {
            state.currentStepIndex = -1;
        }
        stopPlayback();
        state.status = "Playing";
        advancePlayback();
        renderAll();
    }

    function advancePlayback() {
        const timeline = getActiveTimeline();
        if (!timeline.length) {
            stopPlayback();
            return;
        }
        if (state.currentStepIndex >= timeline.length - 1) {
            state.status = "Done";
            renderAll();
            return;
        }
        const delay = Math.max(110, 760 / state.speed);
        state.playbackTimer = window.setTimeout(() => {
            state.currentStepIndex += 1;
            if (state.currentStepIndex >= timeline.length - 1) {
                state.status = "Done";
                stopPlayback(false);
            } else {
                state.status = "Playing";
            }
            renderAll();
            if (state.status === "Playing") {
                advancePlayback();
            }
        }, delay);
    }

    function pauseTimeline() {
        if (!state.results) {
            return;
        }
        stopPlayback();
        if (state.currentStepIndex >= getActiveTimeline().length - 1 && getActiveTimeline().length > 0) {
            state.status = "Done";
        } else {
            state.status = "Paused";
        }
        renderAll();
    }

    function resetTimeline() {
        stopPlayback();
        state.currentStepIndex = -1;
        state.status = state.results ? "Ready" : "Idle";
        renderAll();
    }

    function stepForward() {
        const timeline = getActiveTimeline();
        if (!timeline.length) {
            return;
        }
        stopPlayback();
        if (state.currentStepIndex < timeline.length - 1) {
            state.currentStepIndex += 1;
        }
        if (state.currentStepIndex >= timeline.length - 1) {
            state.status = "Done";
        } else {
            state.status = "Paused";
        }
        renderAll();
    }

    function jumpToStep(index) {
        const timeline = getActiveTimeline();
        if (!timeline.length) {
            return;
        }
        stopPlayback();
        state.currentStepIndex = clamp(index, -1, timeline.length - 1);
        if (state.currentStepIndex >= timeline.length - 1) {
            state.status = "Done";
        } else {
            state.status = "Paused";
        }
        renderAll();
    }

    function stopPlayback(clearStatus = true) {
        if (state.playbackTimer) {
            window.clearTimeout(state.playbackTimer);
            state.playbackTimer = null;
        }
        if (clearStatus && state.status === "Playing") {
            state.status = "Paused";
        }
    }

    function clearBuiltState() {
        state.results = null;
        state.timelines = {
            naive: [],
            recursive: [],
            iterative: []
        };
        state.currentStepIndex = -1;
        state.status = "Idle";
    }

    function renderAll() {
        renderMeta();
        renderTabs();
        renderOverviewCharts();
        renderDeepDivePanels();
        renderPseudocode();
        renderExplanation();
        renderHistory();
        renderCounters();
        renderVerification();
        renderControlStates();
    }

    function renderMeta() {
        const timeline = getActiveTimeline();
        const currentDisplayStep = state.currentStepIndex >= 0 ? state.currentStepIndex + 1 : 0;
        dom.stepCounter.textContent = `Step ${currentDisplayStep} / ${timeline.length}`;
        dom.speedLabel.textContent = `${state.speed.toFixed(2)}x`;
        dom.statusPill.textContent = state.status;
        dom.statusPill.className = `status-pill ${state.status.toLowerCase()}`;
        dom.activeModeLabel.textContent = MODE_LABELS[state.mode];
        dom.pseudocodeModeLabel.textContent = MODE_LABELS[state.mode];
        dom.timeSummaryLabel.textContent = `n = ${state.n} | x = [${getPreviewSamples().map((value) => formatNumber(value)).join(", ")}]`;
    }

    function renderTabs() {
        dom.tabButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.tab === state.activeTab);
        });
        dom.tabPanels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.id === `tab-${state.activeTab}`);
        });
    }

    function renderOverviewCharts() {
        const currentStep = getCurrentStep();
        const previewSamples = getPreviewSamples();
        const activeInputs = currentStep && currentStep.snapshot.activeInputIndices ? currentStep.snapshot.activeInputIndices : [];
        const activeOutputs = currentStep && currentStep.snapshot.activeOutputIndices ? currentStep.snapshot.activeOutputIndices : [];
        const availableOutputs = currentStep ? currentStep.snapshot.availableOutputs : [];
        dom.timeDomainSvg.innerHTML = renderTimeDomainSvg(previewSamples, activeInputs);
        dom.frequencySpectrumSvg.innerHTML = renderSpectrumSvg(state.n, availableOutputs, activeOutputs);

        const revealedCount = availableOutputs.filter(Boolean).length;
        if (revealedCount > 0) {
            dom.spectrumSummaryLabel.textContent = `${revealedCount} of ${state.n} bins currently visible`;
        } else if (state.results) {
            dom.spectrumSummaryLabel.textContent = "Built and ready to reveal frequency bins";
        } else {
            dom.spectrumSummaryLabel.textContent = "Build steps to reveal bins";
        }
    }

    function renderDeepDivePanels() {
        const currentStep = getCurrentStep();
        const dftMatrix = state.results ? state.results.dftMatrix : computeDFTMatrix(state.n);
        dom.dftMatrixSvg.innerHTML = renderDftMatrixSvg(dftMatrix, currentStep);
        dom.naiveDftSvg.innerHTML = renderNaiveSvg(getPreviewSamples(), state.results ? state.results.naive.output : [], currentStep);
        dom.recursiveFftSvg.innerHTML = renderRecursiveSvg(state.results ? state.results.recursive.treeNodes : [], currentStep, state.results ? state.results.recursive.output : []);
        dom.butterflySvg.innerHTML = renderButterflySvg(state.n, state.results ? state.results.iterative.bitReversalMap : buildBitReversalMap(getPreviewSamples()), currentStep);
        dom.bitReversalPanel.innerHTML = renderBitReversalPanel();
        dom.outputComparisonPanel.innerHTML = renderOutputComparisonPanel();
    }

    function renderPseudocode() {
        const currentStep = getCurrentStep();
        const activeLines = currentStep ? currentStep.pseudoLines : [];
        const lines = PSEUDOCODE[state.mode];
        dom.pseudocodePanel.innerHTML = lines.map((item) => {
            const isActive = activeLines.includes(item.line);
            return `
                <div class="code-line ${isActive ? "is-active" : ""}" title="${escapeAttr(item.tip)}">
                    <span class="line-number">${item.line}</span>
                    <span class="line-text">${escapeHtml(item.text)}</span>
                </div>
            `;
        }).join("");
    }

    function renderExplanation() {
        const currentStep = getCurrentStep();
        if (currentStep) {
            dom.stepExplanation.textContent = currentStep.explanation;
            return;
        }
        if (state.results) {
            dom.stepExplanation.textContent = `The ${MODE_LABELS[state.mode]} trace has been built. Click Step or Play to walk through the algorithm from the start. Each step will synchronize the visualization, counters, pseudocode lines, and explanation text.`;
            return;
        }
        dom.stepExplanation.textContent = "Build the steps to start tracing the transform. The explanation box will update with the exact values used in each multiplication, split, and butterfly combine.";
    }

    function renderHistory() {
        const timeline = getActiveTimeline();
        if (!timeline.length) {
            dom.historyBody.innerHTML = `
                <tr>
                    <td colspan="6">No execution history yet. Build the steps to populate the trace table.</td>
                </tr>
            `;
            return;
        }
        dom.historyBody.innerHTML = timeline.map((step, index) => `
            <tr class="history-row ${index === state.currentStepIndex ? "is-active" : ""}" data-timeline-index="${index}">
                <td>${step.step}</td>
                <td class="history-mode">${escapeHtml(step.mode)}</td>
                <td>${escapeHtml(step.action)}</td>
                <td>${escapeHtml(step.indicesText)}</td>
                <td>${escapeHtml(step.importantValue)}</td>
                <td>${escapeHtml(formatPseudoLines(step.pseudoLines))}</td>
            </tr>
        `).join("");
    }

    function renderCounters() {
        const currentStep = getCurrentStep();
        const counters = currentStep ? currentStep.counters : makeCounters();
        dom.counterMult.textContent = String(counters.complexMultiplications);
        dom.counterAdd.textContent = String(counters.complexAdditions);
        dom.counterButterfly.textContent = String(counters.butterflyOperations);
        dom.counterStage.textContent = String(counters.stagesCompleted);

        const fftStages = Math.log2(state.n);
        const butterfliesPerStage = state.n / 2;
        const totalButterflies = fftStages * butterfliesPerStage;
        dom.complexityCompare.innerHTML = `
            <strong>Complexity comparison</strong><br>
            Naive DFT computes ${state.n} outputs and each output touches ${state.n} samples, so it performs about ${state.n * state.n} pair interactions and grows like O(n^2).<br>
            FFT reorganizes the same work into ${fftStages} stages with ${butterfliesPerStage} butterflies per stage, so it uses about ${totalButterflies} butterflies and grows like O(n log n).
        `;
    }

    function renderVerification() {
        if (!state.results) {
            dom.verificationStatus.textContent = "Verification pending.";
            dom.verificationStatus.className = "verification-heading";
            dom.verificationDetails.textContent = "Build the algorithms to compare recursive and iterative FFT outputs against the naive DFT baseline.";
            return;
        }

        const verification = state.results.verification;
        const overallClass = verification.allPass ? "success" : "fail";
        dom.verificationStatus.textContent = verification.allPass
            ? `PASS - FFT outputs match naive DFT within tolerance ${TOLERANCE_LABEL}.`
            : `FAIL - At least one FFT output differs from naive DFT by more than ${TOLERANCE_LABEL}.`;
        dom.verificationStatus.className = `verification-heading ${overallClass}`;
        dom.verificationDetails.textContent = `Recursive FFT max difference: ${formatNumber(verification.recursiveMaxDiff, 6)}. Iterative FFT max difference: ${formatNumber(verification.iterativeMaxDiff, 6)}.`;
    }

    function renderControlStates() {
        const hasTimeline = getActiveTimeline().length > 0;
        const atEnd = hasTimeline && state.currentStepIndex >= getActiveTimeline().length - 1;
        dom.stepButton.disabled = !hasTimeline || atEnd;
        dom.playButton.disabled = !hasTimeline || state.status === "Playing";
        dom.pauseButton.disabled = state.status !== "Playing";
        dom.resetButton.disabled = !hasTimeline && state.currentStepIndex < 0;

        dom.modeButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.mode === state.mode);
            button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
        });
        dom.sizeButtons.forEach((button) => {
            button.classList.toggle("is-active", Number(button.dataset.size) === state.n);
            button.setAttribute("aria-pressed", String(Number(button.dataset.size) === state.n));
        });
        dom.presetButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.preset === state.currentPreset);
        });

        const parsed = parseSampleInput(state.inputText, state.n);
        dom.inputError.textContent = parsed.ok ? "" : parsed.error;
    }

    function buildResults(samples) {
        const naive = computeNaiveDFT(samples);
        const recursive = computeRecursiveFFT(samples);
        const iterative = computeIterativeFFT(samples);
        return {
            n: samples.length,
            samples: samples.slice(),
            dftMatrix: computeDFTMatrix(samples.length),
            naive,
            recursive,
            iterative,
            verification: compareAllOutputs(naive.output, recursive.output, iterative.output)
        };
    }

    function computeNaiveDFT(samples) {
        const n = samples.length;
        const timeline = [];
        const counters = makeCounters();
        const partialOutputs = Array.from({ length: n }, () => null);
        let stepNumber = 1;

        for (let k = 0; k < n; k += 1) {
            const zero = new Complex(0, 0);
            timeline.push({
                step: stepNumber,
                mode: "naive",
                action: `Initialize X[${k}]`,
                explanation: `We begin computing X[${k}]. The running sum starts at 0 so the algorithm can accumulate one weighted sample at a time.`,
                pseudoLines: [1, 2],
                counters: { ...counters },
                indicesText: `k=${k}`,
                importantValue: "X[k] = 0",
                snapshot: {
                    availableOutputs: cloneComplexArray(partialOutputs),
                    activeInputIndices: [],
                    activeOutputIndices: [k],
                    currentSum: zero.clone(),
                    currentProduct: null,
                    currentFactor: null,
                    currentK: k,
                    currentJ: null
                }
            });
            stepNumber += 1;

            let runningSum = zero.clone();
            for (let j = 0; j < n; j += 1) {
                const factor = twiddle(n, j * k);
                const product = Complex.fromReal(samples[j]).mul(factor);
                runningSum = runningSum.add(product);
                counters.complexMultiplications += 1;
                counters.complexAdditions += 1;
                const displayOutputs = cloneComplexArray(partialOutputs);
                displayOutputs[k] = runningSum.clone();
                timeline.push({
                    step: stepNumber,
                    mode: "naive",
                    action: `Accumulate x[${j}] into X[${k}]`,
                    explanation: `We are computing X[${k}]. The algorithm multiplies x[${j}] = ${formatNumber(samples[j])} by omega^(${j}*${k}) = ${formatComplex(factor)}, producing ${formatComplex(product)}. Adding that to the running sum gives ${formatComplex(runningSum)}.`,
                    pseudoLines: [3, 4],
                    counters: { ...counters, stagesCompleted: k },
                    indicesText: `k=${k}, j=${j}`,
                    importantValue: `sum = ${formatComplex(runningSum)}`,
                    snapshot: {
                        availableOutputs: displayOutputs,
                        activeInputIndices: [j],
                        activeOutputIndices: [k],
                        currentSum: runningSum.clone(),
                        currentProduct: product.clone(),
                        currentFactor: factor.clone(),
                        currentK: k,
                        currentJ: j
                    }
                });
                stepNumber += 1;
            }

            partialOutputs[k] = runningSum.clone();
            counters.stagesCompleted = k + 1;
            timeline.push({
                step: stepNumber,
                mode: "naive",
                action: `Finalize X[${k}]`,
                explanation: `All ${n} terms for X[${k}] have now been added. The final value is ${formatComplex(runningSum)}, so the algorithm moves on to the next output bin.`,
                pseudoLines: [1],
                counters: { ...counters },
                indicesText: `k=${k}`,
                importantValue: `X[${k}] = ${formatComplex(runningSum)}`,
                snapshot: {
                    availableOutputs: cloneComplexArray(partialOutputs),
                    activeInputIndices: [],
                    activeOutputIndices: [k],
                    currentSum: runningSum.clone(),
                    currentProduct: null,
                    currentFactor: null,
                    currentK: k,
                    currentJ: null
                }
            });
            stepNumber += 1;
        }

        return {
            output: cloneComplexArray(partialOutputs),
            timeline
        };
    }

    function computeRecursiveFFT(samples) {
        const n = samples.length;
        const timeline = [];
        const counters = makeCounters();
        const rootOutputs = Array.from({ length: n }, () => null);
        const nodes = [];
        const completedNodesBySize = {};
        const totalNodesBySize = {};
        let nextNodeId = 1;
        let stepNumber = 1;

        for (let size = 2; size <= n; size *= 2) {
            totalNodesBySize[size] = n / size;
            completedNodesBySize[size] = 0;
        }

        function completedLevels() {
            return Object.keys(totalNodesBySize)
                .map(Number)
                .filter((size) => completedNodesBySize[size] === totalNodesBySize[size])
                .length;
        }

        function snapshotNodes() {
            return nodes.map((node) => ({
                id: node.id,
                parentId: node.parentId,
                depth: node.depth,
                size: node.size,
                indices: node.indices.slice(),
                inputValues: cloneComplexArray(node.inputValues),
                output: cloneComplexArray(node.output),
                status: node.status
            }));
        }

        function pushStep(step) {
            timeline.push({
                ...step,
                step: stepNumber,
                mode: "recursive",
                counters: { ...counters, stagesCompleted: completedLevels() }
            });
            stepNumber += 1;
        }

        function visit(values, indices, depth, parentId, isRoot = false) {
            const node = {
                id: `node-${nextNodeId}`,
                parentId,
                depth,
                size: values.length,
                indices: indices.slice(),
                inputValues: cloneComplexArray(values),
                output: Array.from({ length: values.length }, () => null),
                status: "visiting"
            };
            nextNodeId += 1;
            nodes.push(node);

            pushStep({
                action: `Visit FFT subproblem of size ${values.length}`,
                explanation: `The recursive FFT is called on samples x[${indices.join(", ")}]. This subproblem has n = ${values.length}, so the algorithm checks whether it should split again or stop at the base case.`,
                pseudoLines: [1, 2],
                indicesText: `x[${indices.join(", ")}]`,
                importantValue: `n = ${values.length}`,
                snapshot: {
                    availableOutputs: cloneComplexArray(rootOutputs),
                    activeInputIndices: indices.slice(),
                    activeOutputIndices: [],
                    treeNodes: snapshotNodes(),
                    recursiveActiveNodeId: node.id,
                    recursiveCombine: null
                }
            });

            if (values.length === 1) {
                node.status = "base";
                node.output[0] = values[0].clone();
                pushStep({
                    action: "Return base case",
                    explanation: `This branch has only one value left: x[${indices[0]}] = ${formatComplex(values[0])}. A length-1 DFT is already complete, so the recursion returns immediately.`,
                    pseudoLines: [3],
                    indicesText: `x[${indices[0]}]`,
                    importantValue: formatComplex(values[0]),
                    snapshot: {
                        availableOutputs: cloneComplexArray(rootOutputs),
                        activeInputIndices: indices.slice(),
                        activeOutputIndices: [],
                        treeNodes: snapshotNodes(),
                        recursiveActiveNodeId: node.id,
                        recursiveCombine: null
                    }
                });
                return [values[0].clone()];
            }

            const evenValues = values.filter((_, index) => index % 2 === 0).map((value) => value.clone());
            const oddValues = values.filter((_, index) => index % 2 === 1).map((value) => value.clone());
            const evenIndices = indices.filter((_, index) => index % 2 === 0);
            const oddIndices = indices.filter((_, index) => index % 2 === 1);
            node.status = "split";

            pushStep({
                action: "Split into even and odd subsequences",
                explanation: `The FFT separates x[${indices.join(", ")}] into even indices [${evenIndices.join(", ")}] and odd indices [${oddIndices.join(", ")}]. This reuse of two smaller transforms is the structural reason FFT is faster than the naive DFT.`,
                pseudoLines: [4, 5],
                indicesText: `even:[${evenIndices.join(", ")}] odd:[${oddIndices.join(", ")}]`,
                importantValue: `size ${values.length} -> ${evenValues.length} + ${oddValues.length}`,
                snapshot: {
                    availableOutputs: cloneComplexArray(rootOutputs),
                    activeInputIndices: indices.slice(),
                    activeOutputIndices: [],
                    treeNodes: snapshotNodes(),
                    recursiveActiveNodeId: node.id,
                    recursiveEvenIndices: evenIndices.slice(),
                    recursiveOddIndices: oddIndices.slice(),
                    recursiveCombine: null
                }
            });

            const evenOutput = visit(evenValues, evenIndices, depth + 1, node.id);
            const oddOutput = visit(oddValues, oddIndices, depth + 1, node.id);

            node.status = "combining";
            const half = values.length / 2;
            const combined = Array.from({ length: values.length }, () => null);

            for (let k = 0; k < half; k += 1) {
                const factor = twiddle(values.length, k);
                const t = factor.mul(oddOutput[k]);
                const upper = evenOutput[k].add(t);
                const lower = evenOutput[k].sub(t);
                combined[k] = upper.clone();
                combined[k + half] = lower.clone();
                node.output[k] = upper.clone();
                node.output[k + half] = lower.clone();

                if (isRoot) {
                    rootOutputs[k] = upper.clone();
                    rootOutputs[k + half] = lower.clone();
                }

                counters.complexMultiplications += 1;
                counters.complexAdditions += 2;
                counters.butterflyOperations += 1;

                pushStep({
                    action: `Combine butterfly at k=${k}`,
                    explanation: `At this combine step, even[${k}] = ${formatComplex(evenOutput[k])} and odd[${k}] = ${formatComplex(oddOutput[k])}. Multiplying odd[${k}] by omega^${k} = ${formatComplex(factor)} gives t = ${formatComplex(t)}. The butterfly outputs become ${formatComplex(upper)} and ${formatComplex(lower)}.`,
                    pseudoLines: [6, 7, 8, 9],
                    indicesText: `k=${k} in size-${values.length} subproblem`,
                    importantValue: `t = ${formatComplex(t)}`,
                    snapshot: {
                        availableOutputs: cloneComplexArray(rootOutputs),
                        activeInputIndices: indices.slice(),
                        activeOutputIndices: isRoot ? [k, k + half] : [],
                        treeNodes: snapshotNodes(),
                        recursiveActiveNodeId: node.id,
                        recursiveCombine: {
                            nodeId: node.id,
                            k,
                            factor: factor.clone(),
                            evenValue: evenOutput[k].clone(),
                            oddValue: oddOutput[k].clone(),
                            t: t.clone(),
                            upper: upper.clone(),
                            lower: lower.clone()
                        }
                    }
                });
            }

            node.status = "done";
            node.output = cloneComplexArray(combined);
            completedNodesBySize[values.length] += 1;
            pushStep({
                action: `Return size-${values.length} transform`,
                explanation: `The size-${values.length} subproblem for x[${indices.join(", ")}] is complete. Its transform is [${combined.map((value) => formatComplex(value)).join(", ")}], so the recursion returns this vector to the previous level.`,
                pseudoLines: [10],
                indicesText: `x[${indices.join(", ")}]`,
                importantValue: `[${combined.map((value) => formatComplex(value)).join(", ")}]`,
                snapshot: {
                    availableOutputs: cloneComplexArray(rootOutputs),
                    activeInputIndices: indices.slice(),
                    activeOutputIndices: isRoot ? indices.map((_, index) => index) : [],
                    treeNodes: snapshotNodes(),
                    recursiveActiveNodeId: node.id,
                    recursiveCombine: null
                }
            });

            return cloneComplexArray(combined);
        }

        const complexSamples = samples.map((value) => Complex.fromReal(value));
        const indices = samples.map((_, index) => index);
        const output = visit(complexSamples, indices, 0, null, true);
        return {
            output,
            timeline,
            treeNodes: nodes.map((node) => ({
                id: node.id,
                parentId: node.parentId,
                depth: node.depth,
                size: node.size,
                indices: node.indices.slice(),
                inputValues: cloneComplexArray(node.inputValues),
                output: cloneComplexArray(node.output),
                status: node.status
            }))
        };
    }

    function computeIterativeFFT(samples) {
        const n = samples.length;
        const bits = Math.log2(n);
        const timeline = [];
        const counters = makeCounters();
        const bitReversalMap = buildBitReversalMap(samples);
        const working = Array.from({ length: n }, () => null);
        const finalOutputProgress = Array.from({ length: n }, () => null);
        let stepNumber = 1;

        function pushStep(step) {
            timeline.push({
                ...step,
                step: stepNumber,
                mode: "iterative",
                counters: { ...counters }
            });
            stepNumber += 1;
        }

        for (let i = 0; i < n; i += 1) {
            const record = bitReversalMap[i];
            working[record.reversedIndex] = Complex.fromReal(record.value);
            pushStep({
                action: `Bit-reverse copy x[${record.index}]`,
                explanation: `The iterative FFT first reorders the input. Index ${record.index} has binary form ${record.binary}, which reverses to ${record.reversedBinary}, so x[${record.index}] = ${formatNumber(record.value)} moves to position ${record.reversedIndex}.`,
                pseudoLines: [1],
                indicesText: `${record.index} -> ${record.reversedIndex}`,
                importantValue: `${record.binary} -> ${record.reversedBinary}`,
                snapshot: {
                    availableOutputs: Array.from({ length: n }, () => null),
                    activeInputIndices: [record.index],
                    activeOutputIndices: [],
                    iterativeArray: cloneComplexArray(working),
                    bitRows: buildBitRows(bitReversalMap, i, true),
                    iterativeStage: 0,
                    activePair: null,
                    iterativeDetail: {
                        type: "bitreversal",
                        mapping: record
                    }
                }
            });
        }

        for (let stage = 1; stage <= bits; stage += 1) {
            const m = 2 ** stage;
            const omegaM = twiddle(m, 1);
            pushStep({
                action: `Start stage ${stage}`,
                explanation: `Stage ${stage} combines subproblems of size ${m}. The stage root of unity is omega_${m} = ${formatComplex(omegaM)}, and there will be ${n / 2} butterflies across the full stage.`,
                pseudoLines: [2, 3],
                indicesText: `stage=${stage}, m=${m}`,
                importantValue: `omega_${m} = ${formatComplex(omegaM)}`,
                snapshot: {
                    availableOutputs: stage === bits ? cloneComplexArray(finalOutputProgress) : Array.from({ length: n }, () => null),
                    activeInputIndices: [],
                    activeOutputIndices: [],
                    iterativeArray: cloneComplexArray(working),
                    bitRows: buildBitRows(bitReversalMap, n, false),
                    iterativeStage: stage,
                    activePair: null,
                    iterativeDetail: {
                        type: "stage",
                        stage,
                        m,
                        omegaM: omegaM.clone()
                    }
                }
            });

            let processedButterflies = 0;
            for (let block = 0; block < n; block += m) {
                let omega = new Complex(1, 0);
                for (let j = 0; j < m / 2; j += 1) {
                    const upperIndex = block + j;
                    const lowerIndex = block + j + (m / 2);
                    const upperBefore = working[upperIndex].clone();
                    const lowerBefore = working[lowerIndex].clone();
                    const twiddleFactor = omega.clone();
                    const t = twiddleFactor.mul(lowerBefore);
                    const newUpper = upperBefore.add(t);
                    const newLower = upperBefore.sub(t);
                    working[upperIndex] = newUpper.clone();
                    working[lowerIndex] = newLower.clone();

                    counters.complexMultiplications += 1;
                    counters.complexAdditions += 2;
                    counters.butterflyOperations += 1;

                    processedButterflies += 1;
                    if (stage === bits) {
                        finalOutputProgress[upperIndex] = newUpper.clone();
                        finalOutputProgress[lowerIndex] = newLower.clone();
                    }
                    if (processedButterflies === n / 2) {
                        counters.stagesCompleted = stage;
                    }

                    pushStep({
                        action: `Butterfly pair ${upperIndex}/${lowerIndex}`,
                        explanation: `This butterfly combines positions ${upperIndex} and ${lowerIndex}. The current twiddle factor is omega_${m}^${j} = ${formatComplex(twiddleFactor)}. Multiplying the lower value ${formatComplex(lowerBefore)} gives t = ${formatComplex(t)}, so the updated pair becomes ${formatComplex(newUpper)} and ${formatComplex(newLower)}.`,
                        pseudoLines: [4, 5, 6, 7, 8, 9, 10],
                        indicesText: `stage=${stage}, block=${block}, pair=${upperIndex}/${lowerIndex}`,
                        importantValue: `t = ${formatComplex(t)}`,
                        snapshot: {
                            availableOutputs: stage === bits ? cloneComplexArray(finalOutputProgress) : Array.from({ length: n }, () => null),
                            activeInputIndices: [],
                            activeOutputIndices: stage === bits ? [upperIndex, lowerIndex] : [],
                            iterativeArray: cloneComplexArray(working),
                            bitRows: buildBitRows(bitReversalMap, n, false),
                            iterativeStage: stage,
                            activePair: [upperIndex, lowerIndex],
                            iterativeDetail: {
                                type: "butterfly",
                                stage,
                                block,
                                j,
                                m,
                                omegaM: omegaM.clone(),
                                twiddleFactor,
                                upperIndex,
                                lowerIndex,
                                upperBefore,
                                lowerBefore,
                                t,
                                newUpper,
                                newLower
                            }
                        }
                    });

                    omega = omega.mul(omegaM);
                }
            }
        }

        return {
            output: cloneComplexArray(working),
            timeline,
            bitReversalMap
        };
    }

    function compareAllOutputs(naiveOutput, recursiveOutput, iterativeOutput) {
        const recursiveDiffs = naiveOutput.map((value, index) => value.sub(recursiveOutput[index]).magnitude());
        const iterativeDiffs = naiveOutput.map((value, index) => value.sub(iterativeOutput[index]).magnitude());
        const recursiveMaxDiff = Math.max(...recursiveDiffs);
        const iterativeMaxDiff = Math.max(...iterativeDiffs);
        return {
            recursivePass: recursiveMaxDiff <= TOLERANCE,
            iterativePass: iterativeMaxDiff <= TOLERANCE,
            recursiveMaxDiff,
            iterativeMaxDiff,
            allPass: recursiveMaxDiff <= TOLERANCE && iterativeMaxDiff <= TOLERANCE
        };
    }

    function renderTimeDomainSvg(samples, activeIndices) {
        const width = 760;
        const height = 280;
        const margin = { top: 28, right: 30, bottom: 52, left: 52 };
        const baseline = height / 2;
        const plotWidth = width - margin.left - margin.right;
        const maxAbs = Math.max(1, ...samples.map((value) => Math.abs(value)));
        const barSpacing = plotWidth / Math.max(samples.length, 1);
        const activeSet = new Set(activeIndices || []);

        const axes = `
            <line x1="${margin.left}" y1="${baseline}" x2="${width - margin.right}" y2="${baseline}" stroke="rgba(148, 163, 184, 0.35)" stroke-width="1.5"></line>
            <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1"></line>
            <text x="${margin.left - 8}" y="${margin.top + 10}" text-anchor="end" fill="#94a3b8" font-size="12">value</text>
            <text x="${width - margin.right}" y="${height - 14}" text-anchor="end" fill="#94a3b8" font-size="12">sample index j</text>
        `;

        const stems = samples.map((value, index) => {
            const x = margin.left + (barSpacing * index) + (barSpacing / 2);
            const y = baseline - ((value / maxAbs) * ((height - margin.top - margin.bottom) / 2.2));
            const active = activeSet.has(index);
            const color = active ? "#38bdf8" : "#94a3b8";
            const dotFill = active ? "#0ea5e9" : "#cbd5e1";
            return `
                <line x1="${x}" y1="${baseline}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="${active ? 5 : 3}" stroke-linecap="round"></line>
                <circle cx="${x}" cy="${y}" r="${active ? 7 : 5}" fill="${dotFill}" stroke="${active ? "#7dd3fc" : "#334155"}" stroke-width="2"></circle>
                <text x="${x}" y="${height - 28}" text-anchor="middle" fill="#94a3b8" font-size="12">j=${index}</text>
                <text x="${x}" y="${y - 12}" text-anchor="middle" fill="#e5eefb" font-size="12">${escapeHtml(formatNumber(value))}</text>
            `;
        }).join("");

        return `
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            ${axes}
            ${stems}
        `;
    }

    function renderSpectrumSvg(n, outputs, activeIndices) {
        const width = 760;
        const height = 280;
        const margin = { top: 28, right: 30, bottom: 52, left: 52 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        const slotWidth = plotWidth / n;
        const activeSet = new Set(activeIndices || []);
        const actualOutputs = outputs || [];
        const magnitudes = actualOutputs.filter(Boolean).map((value) => value.magnitude());
        const maxMagnitude = Math.max(1, ...magnitudes);

        const axes = `
            <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="rgba(148, 163, 184, 0.35)" stroke-width="1.5"></line>
            <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1"></line>
            <text x="${margin.left - 8}" y="${margin.top + 10}" text-anchor="end" fill="#94a3b8" font-size="12">|X[k]|</text>
            <text x="${width - margin.right}" y="${height - 14}" text-anchor="end" fill="#94a3b8" font-size="12">frequency bin k</text>
        `;

        const bars = Array.from({ length: n }, (_, index) => {
            const output = actualOutputs[index] || null;
            const x = margin.left + (slotWidth * index) + 10;
            const widthBar = Math.max(24, slotWidth - 20);
            const active = activeSet.has(index);
            if (!output) {
                return `
                    <rect x="${x}" y="${margin.top + 12}" width="${widthBar}" height="${plotHeight - 12}" fill="rgba(15, 23, 42, 0.55)" stroke="rgba(148, 163, 184, 0.16)" stroke-dasharray="6 6" rx="10"></rect>
                    <text x="${x + (widthBar / 2)}" y="${height - 28}" text-anchor="middle" fill="#94a3b8" font-size="12">k=${index}</text>
                `;
            }
            const magnitude = output.magnitude();
            const barHeight = (magnitude / maxMagnitude) * (plotHeight - 16);
            const y = (height - margin.bottom) - barHeight;
            const fill = active ? "#38bdf8" : "#60a5fa";
            return `
                <rect x="${x}" y="${y}" width="${widthBar}" height="${barHeight}" fill="${fill}" opacity="${active ? "1" : "0.82"}" rx="12"></rect>
                <text x="${x + (widthBar / 2)}" y="${y - 10}" text-anchor="middle" fill="#e5eefb" font-size="12">${escapeHtml(formatNumber(magnitude))}</text>
                <text x="${x + (widthBar / 2)}" y="${height - 28}" text-anchor="middle" fill="#94a3b8" font-size="12">k=${index}</text>
            `;
        }).join("");

        const placeholder = magnitudes.length === 0
            ? `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#94a3b8" font-size="16">No frequency bins revealed yet. Step through the algorithm to populate X[k].</text>`
            : "";

        return `
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            ${axes}
            ${bars}
            ${placeholder}
        `;
    }

    function renderDftMatrixSvg(matrix, currentStep) {
        const n = matrix.length;
        const width = 760;
        const height = 480;
        const margin = { top: 54, right: 36, bottom: 92, left: 76 };
        const gridWidth = width - margin.left - margin.right;
        const gridHeight = height - margin.top - margin.bottom - 40;
        const cellSize = Math.min(gridWidth / n, gridHeight / n);
        const offsetX = margin.left + ((gridWidth - (cellSize * n)) / 2);
        const offsetY = margin.top + ((gridHeight - (cellSize * n)) / 2);
        const activeK = currentStep && currentStep.mode === "naive" ? currentStep.snapshot.currentK : null;
        const activeJ = currentStep && currentStep.mode === "naive" ? currentStep.snapshot.currentJ : null;

        const cells = matrix.map((row, k) => row.map((entry, j) => {
            const x = offsetX + (j * cellSize);
            const y = offsetY + (k * cellSize);
            const phase = entry.value.phase();
            const fill = phaseToColor(phase);
            const tooltip = `omega^(${j}*${k})\\nvalue ~= ${formatComplex(entry.value)}\\nphase = ${formatNumber((phase * 180) / Math.PI)} degrees`;
            const stroke = activeK === k && activeJ === j
                ? "#f59e0b"
                : activeK === k
                    ? "#38bdf8"
                    : "rgba(148, 163, 184, 0.16)";
            const strokeWidth = activeK === k && activeJ === j ? 4 : activeK === k ? 2.5 : 1.2;
            return `
                <g data-tooltip="${escapeAttr(tooltip)}">
                    <rect x="${x}" y="${y}" width="${cellSize - 4}" height="${cellSize - 4}" rx="12" fill="${fill}" fill-opacity="0.92" stroke="${stroke}" stroke-width="${strokeWidth}"></rect>
                    <text x="${x + ((cellSize - 4) / 2)}" y="${y + ((cellSize - 4) / 2) + 4}" text-anchor="middle" fill="#e5eefb" font-size="${n === 8 ? 10 : 12}" font-family="SFMono-Regular, Consolas, monospace">w^${(j * k) % n}</text>
                </g>
            `;
        }).join("")).join("");

        const rowLabels = Array.from({ length: n }, (_, k) => {
            const y = offsetY + (k * cellSize) + (cellSize / 2);
            return `<text x="${offsetX - 18}" y="${y + 4}" text-anchor="end" fill="${activeK === k ? "#7dd3fc" : "#94a3b8"}" font-size="13">X[${k}]</text>`;
        }).join("");

        const columnLabels = Array.from({ length: n }, (_, j) => {
            const x = offsetX + (j * cellSize) + (cellSize / 2);
            return `<text x="${x}" y="${offsetY - 16}" text-anchor="middle" fill="${activeJ === j ? "#fcd34d" : "#94a3b8"}" font-size="13">x[${j}]</text>`;
        }).join("");

        const legendX = offsetX;
        const legendY = offsetY + (cellSize * n) + 28;
        const legendStops = Array.from({ length: 12 }, (_, index) => {
            const phase = -Math.PI + ((index / 11) * (2 * Math.PI));
            return `<rect x="${legendX + (index * 26)}" y="${legendY}" width="26" height="14" fill="${phaseToColor(phase)}"></rect>`;
        }).join("");

        return `
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            <text x="${offsetX}" y="28" fill="#e5eefb" font-size="16" font-weight="700">DFT matrix W where W[k][j] = omega^(j*k)</text>
            <text x="${offsetX}" y="46" fill="#94a3b8" font-size="12">The naive DFT multiplies each matrix row by the input vector x to compute one output X[k].</text>
            ${cells}
            ${rowLabels}
            ${columnLabels}
            <text x="${legendX}" y="${legendY - 8}" fill="#94a3b8" font-size="12">phase-colored roots of unity</text>
            ${legendStops}
            <text x="${legendX}" y="${legendY + 32}" fill="#94a3b8" font-size="12">-180 deg</text>
            <text x="${legendX + 286}" y="${legendY + 32}" fill="#94a3b8" font-size="12">+180 deg</text>
        `;
    }

    function renderNaiveSvg(samples, finalOutput, currentStep) {
        const n = samples.length;
        const width = 760;
        const height = 420;
        const marginX = 60;
        const slotWidth = (width - (marginX * 2)) / n;
        const activeStep = currentStep && currentStep.mode === "naive" ? currentStep : null;
        const currentK = activeStep ? activeStep.snapshot.currentK : null;
        const currentJ = activeStep ? activeStep.snapshot.currentJ : null;
        const currentFactor = activeStep ? activeStep.snapshot.currentFactor : null;
        const currentProduct = activeStep ? activeStep.snapshot.currentProduct : null;
        const currentSum = activeStep ? activeStep.snapshot.currentSum : null;
        const availableOutputs = activeStep ? activeStep.snapshot.availableOutputs : [];

        const inputRow = samples.map((value, index) => {
            const x = marginX + (slotWidth * index);
            const active = index === currentJ;
            return renderVectorBox(x, 54, slotWidth - 14, 58, `x[${index}]`, formatNumber(value), active ? "#38bdf8" : "rgba(148, 163, 184, 0.18)");
        }).join("");

        const factorRow = Array.from({ length: n }, (_, index) => {
            const x = marginX + (slotWidth * index);
            const active = activeStep && currentK !== null && index === currentJ;
            let label = currentK !== null ? `omega^(${index}*${currentK})` : "omega^(j*k)";
            let value = active && currentFactor ? formatComplex(currentFactor) : "waiting";
            if (currentK !== null && !active) {
                value = formatComplex(twiddle(n, index * currentK));
            }
            return renderVectorBox(x, 176, slotWidth - 14, 58, label, value, active ? "#f59e0b" : "rgba(148, 163, 184, 0.18)");
        }).join("");

        const outputRow = Array.from({ length: n }, (_, index) => {
            const x = marginX + (slotWidth * index);
            const active = index === currentK;
            const value = availableOutputs[index] ? formatComplex(availableOutputs[index]) : (finalOutput[index] ? "pending" : "waiting");
            return renderVectorBox(x, 300, slotWidth - 14, 62, `X[${index}]`, value, active ? "#8b5cf6" : "rgba(148, 163, 184, 0.18)");
        }).join("");

        const callout = activeStep
            ? `
                <rect x="500" y="78" width="214" height="168" rx="18" fill="rgba(8, 15, 30, 0.95)" stroke="rgba(56, 189, 248, 0.24)"></rect>
                <text x="518" y="108" fill="#e5eefb" font-size="14" font-weight="700">Current accumulation</text>
                <text x="518" y="136" fill="#94a3b8" font-size="12">k = ${currentK}, j = ${currentJ === null ? "-" : currentJ}</text>
                <text x="518" y="164" fill="#cbd5e1" font-size="12">factor: ${currentFactor ? formatComplex(currentFactor) : "waiting"}</text>
                <text x="518" y="190" fill="#cbd5e1" font-size="12">product: ${currentProduct ? formatComplex(currentProduct) : "waiting"}</text>
                <text x="518" y="216" fill="#7dd3fc" font-size="12">sum: ${currentSum ? formatComplex(currentSum) : "waiting"}</text>
                <text x="518" y="242" fill="#94a3b8" font-size="12">Matrix-vector view makes the O(n^2) work visible.</text>
            `
            : `
                <rect x="500" y="78" width="214" height="168" rx="18" fill="rgba(8, 15, 30, 0.95)" stroke="rgba(148, 163, 184, 0.18)"></rect>
                <text x="518" y="108" fill="#e5eefb" font-size="14" font-weight="700">Naive DFT explanation</text>
                <text x="518" y="136" fill="#94a3b8" font-size="12">Each output X[k] needs every input x[j].</text>
                <text x="518" y="162" fill="#94a3b8" font-size="12">That means n outputs times n samples.</text>
                <text x="518" y="188" fill="#94a3b8" font-size="12">The highlighted row and sum appear when you step.</text>
            `;

        return `
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            <text x="54" y="30" fill="#e5eefb" font-size="16" font-weight="700">Naive DFT as explicit matrix-vector multiplication</text>
            <text x="54" y="48" fill="#94a3b8" font-size="12">The algorithm walks across one matrix row for each output bin X[k].</text>
            ${inputRow}
            <text x="54" y="164" fill="#94a3b8" font-size="12">Selected DFT matrix row / root-of-unity factors</text>
            ${factorRow}
            <text x="54" y="288" fill="#94a3b8" font-size="12">Output bins as they are accumulated</text>
            ${outputRow}
            ${callout}
        `;
    }

    function renderRecursiveSvg(treeNodes, currentStep, finalOutput) {
        const width = 760;
        const height = 460;
        if (!treeNodes.length) {
            return `
                <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
                <text x="${width / 2}" y="${height / 2 - 8}" text-anchor="middle" fill="#e5eefb" font-size="18">Build the recursive FFT steps to draw the decomposition tree.</text>
                <text x="${width / 2}" y="${height / 2 + 18}" text-anchor="middle" fill="#94a3b8" font-size="13">You will see even/odd splits, base cases, and combine steps with twiddle factors.</text>
            `;
        }

        const snapshotNodes = currentStep && currentStep.mode === "recursive" && currentStep.snapshot.treeNodes
            ? currentStep.snapshot.treeNodes
            : treeNodes;
        const activeNodeId = currentStep && currentStep.mode === "recursive" ? currentStep.snapshot.recursiveActiveNodeId : null;
        const combine = currentStep && currentStep.mode === "recursive" ? currentStep.snapshot.recursiveCombine : null;
        const maxDepth = Math.max(...snapshotNodes.map((node) => node.depth), 0);
        const xGap = maxDepth === 0 ? 1 : 560 / maxDepth;
        const boxWidth = 132;
        const boxHeight = 54;

        const leafOrder = [...new Set(snapshotNodes.flatMap((node) => node.indices))].sort((a, b) => a - b);
        const leafYMap = new Map(leafOrder.map((value, index) => [value, 78 + (index * ((height - 160) / Math.max(1, leafOrder.length - 1)))]));
        const positions = new Map(snapshotNodes.map((node) => {
            const y = average(node.indices.map((index) => leafYMap.get(index)));
            const x = 68 + (node.depth * xGap);
            return [node.id, { x, y }];
        }));

        const lines = snapshotNodes.filter((node) => node.parentId).map((node) => {
            const parent = positions.get(node.parentId);
            const child = positions.get(node.id);
            return `
                <line x1="${parent.x + (boxWidth / 2)}" y1="${parent.y}" x2="${child.x - (boxWidth / 2)}" y2="${child.y}" stroke="rgba(148, 163, 184, 0.2)" stroke-width="2"></line>
            `;
        }).join("");

        const nodesMarkup = snapshotNodes.map((node) => {
            const { x, y } = positions.get(node.id);
            const isActive = node.id === activeNodeId;
            const statusFill = node.status === "base"
                ? "rgba(245, 158, 11, 0.18)"
                : node.status === "done"
                    ? "rgba(34, 197, 94, 0.18)"
                    : node.status === "combining"
                        ? "rgba(139, 92, 246, 0.16)"
                        : "rgba(15, 23, 42, 0.9)";
            const stroke = isActive ? "#38bdf8" : "rgba(148, 163, 184, 0.18)";
            const outputPreview = node.output.filter(Boolean).length
                ? `[${node.output.map((value) => value ? formatNumber(value.re) : "_").join(", ")}]`
                : "pending";
            return `
                <g>
                    <rect x="${x - (boxWidth / 2)}" y="${y - (boxHeight / 2)}" width="${boxWidth}" height="${boxHeight}" rx="16" fill="${statusFill}" stroke="${stroke}" stroke-width="${isActive ? 3 : 1.4}"></rect>
                    <text x="${x}" y="${y - 6}" text-anchor="middle" fill="#e5eefb" font-size="12" font-weight="700">x[${node.indices.join(",")}]</text>
                    <text x="${x}" y="${y + 12}" text-anchor="middle" fill="#94a3b8" font-size="11">n=${node.size} | ${outputPreview}</text>
                </g>
            `;
        }).join("");

        const outputStrip = Array.from({ length: finalOutput.length }, (_, index) => {
            const x = 54 + (index * 82);
            const outputValue = currentStep && currentStep.mode === "recursive"
                ? currentStep.snapshot.availableOutputs[index]
                : finalOutput[index];
            const highlighted = currentStep && currentStep.mode === "recursive" && currentStep.snapshot.activeOutputIndices.includes(index);
            return renderVectorBox(x, 382, 72, 48, `X[${index}]`, outputValue ? formatComplex(outputValue) : "pending", highlighted ? "#38bdf8" : "rgba(148, 163, 184, 0.18)");
        }).join("");

        const combineCallout = combine
            ? `
                <rect x="470" y="42" width="232" height="120" rx="18" fill="rgba(8, 15, 30, 0.95)" stroke="rgba(56, 189, 248, 0.22)"></rect>
                <text x="488" y="70" fill="#e5eefb" font-size="14" font-weight="700">Current combine</text>
                <text x="488" y="96" fill="#cbd5e1" font-size="12">even = ${formatComplex(combine.evenValue)}</text>
                <text x="488" y="118" fill="#cbd5e1" font-size="12">odd = ${formatComplex(combine.oddValue)}</text>
                <text x="488" y="140" fill="#7dd3fc" font-size="12">omega^${combine.k} = ${formatComplex(combine.factor)}</text>
            `
            : "";

        return `
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            <text x="50" y="28" fill="#e5eefb" font-size="16" font-weight="700">Recursive Cooley-Tukey FFT tree</text>
            <text x="50" y="46" fill="#94a3b8" font-size="12">The signal splits into even and odd branches, then each branch is combined by butterflies with twiddle factors.</text>
            ${lines}
            ${nodesMarkup}
            ${combineCallout}
            <text x="50" y="368" fill="#94a3b8" font-size="12">Top-level output bins revealed during the root combine step</text>
            ${outputStrip}
        `;
    }

    function renderButterflySvg(n, bitReversalMap, currentStep) {
        const width = 760;
        const height = 460;
        const stages = Math.log2(n);
        const left = 80;
        const right = 650;
        const inputX = left;
        const stageXs = Array.from({ length: stages }, (_, index) => left + (((right - left) / Math.max(1, stages)) * (index + 1)));
        const valueX = 698;
        const rowGap = n === 8 ? 48 : 82;
        const startY = n === 8 ? 64 : 110;
        const rows = Array.from({ length: n }, (_, index) => startY + (index * rowGap));
        const activeStep = currentStep && currentStep.mode === "iterative" ? currentStep : null;
        const activePair = activeStep ? activeStep.snapshot.activePair : null;
        const activeStage = activeStep ? activeStep.snapshot.iterativeStage : 0;
        const arrayValues = activeStep && activeStep.snapshot.iterativeArray ? activeStep.snapshot.iterativeArray : Array.from({ length: n }, () => null);
        const pairsByStage = buildButterflyPairs(n);
        const bitReversedOrder = Array.from({ length: n }, (_, index) => bitReversalMap.find((record) => record.reversedIndex === index) || null);

        const baseWires = rows.map((y, index) => `
            <g>
                <line x1="${inputX}" y1="${y}" x2="${valueX - 32}" y2="${y}" stroke="rgba(148, 163, 184, 0.16)" stroke-width="1.5"></line>
                <text x="${inputX - 16}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="12">A[${index}]</text>
            </g>
        `).join("");

        const stageLabels = stageXs.map((x, index) => `
            <text x="${x}" y="30" text-anchor="middle" fill="${activeStage === index + 1 ? "#7dd3fc" : "#94a3b8"}" font-size="13">stage ${index + 1}</text>
        `).join("");

        const circles = stageXs.map((x) => rows.map((y) => `
            <circle cx="${x}" cy="${y}" r="5.5" fill="#0f172a" stroke="rgba(148, 163, 184, 0.22)" stroke-width="1.4"></circle>
        `).join("")).join("");

        const butterflies = pairsByStage.map((pairs, stageIndex) => {
            const x = stageXs[stageIndex];
            const prevX = stageIndex === 0 ? inputX : stageXs[stageIndex - 1];
            return pairs.map((pair) => {
                const [upper, lower] = pair;
                const y1 = rows[upper];
                const y2 = rows[lower];
                const isActive = activePair && activeStage === stageIndex + 1 && activePair[0] === upper && activePair[1] === lower;
                const stroke = isActive ? "#38bdf8" : "rgba(148, 163, 184, 0.2)";
                const strokeWidth = isActive ? 4 : 2;
                return `
                    <path d="M ${prevX} ${y1} C ${(prevX + x) / 2} ${y1}, ${(prevX + x) / 2} ${y2}, ${x} ${y2}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${isActive ? 1 : 0.55}"></path>
                    <path d="M ${prevX} ${y2} C ${(prevX + x) / 2} ${y2}, ${(prevX + x) / 2} ${y1}, ${x} ${y1}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${isActive ? 1 : 0.55}"></path>
                `;
            }).join("");
        }).join("");

        const values = rows.map((y, index) => {
            const value = arrayValues[index];
            const isActive = activePair && activePair.includes(index);
            return `
                <g>
                    <rect x="${valueX - 14}" y="${y - 16}" width="64" height="32" rx="12" fill="${isActive ? "rgba(56, 189, 248, 0.14)" : "rgba(15, 23, 42, 0.95)"}" stroke="${isActive ? "rgba(56, 189, 248, 0.44)" : "rgba(148, 163, 184, 0.16)"}"></rect>
                    <text x="${valueX + 18}" y="${y + 4}" text-anchor="middle" fill="#e5eefb" font-size="11">${value ? escapeHtml(formatComplex(value)) : "--"}</text>
                </g>
            `;
        }).join("");

        const detail = activeStep && activeStep.snapshot.iterativeDetail && activeStep.snapshot.iterativeDetail.type === "butterfly"
            ? `
                <rect x="456" y="340" width="252" height="88" rx="18" fill="rgba(8, 15, 30, 0.95)" stroke="rgba(56, 189, 248, 0.22)"></rect>
                <text x="474" y="366" fill="#e5eefb" font-size="14" font-weight="700">Active butterfly</text>
                <text x="474" y="388" fill="#cbd5e1" font-size="12">omega_${activeStep.snapshot.iterativeDetail.m}^${activeStep.snapshot.iterativeDetail.j} = ${formatComplex(activeStep.snapshot.iterativeDetail.twiddleFactor)}</text>
                <text x="474" y="410" fill="#7dd3fc" font-size="12">u + t = ${formatComplex(activeStep.snapshot.iterativeDetail.newUpper)}, u - t = ${formatComplex(activeStep.snapshot.iterativeDetail.newLower)}</text>
            `
            : `
                <rect x="456" y="340" width="252" height="88" rx="18" fill="rgba(8, 15, 30, 0.95)" stroke="rgba(148, 163, 184, 0.16)"></rect>
                <text x="474" y="366" fill="#e5eefb" font-size="14" font-weight="700">Circuit summary</text>
                <text x="474" y="388" fill="#94a3b8" font-size="12">${stages} stages, ${n / 2} butterflies per stage, total O(n log n) structure.</text>
                <text x="474" y="410" fill="#94a3b8" font-size="12">Bit-reversed inputs flow from left to right through the network.</text>
            `;

        const leftLabels = bitReversedOrder.length
            ? bitReversedOrder.map((record, index) => `
                <text x="${inputX + 8}" y="${rows[index] - 10}" fill="#64748b" font-size="10">from x[${record.index}]</text>
            `).join("")
            : "";

        return `
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            <text x="52" y="28" fill="#e5eefb" font-size="16" font-weight="700">Iterative radix-2 butterfly circuit</text>
            <text x="52" y="46" fill="#94a3b8" font-size="12">The iterative FFT uses bit-reversed input order, then applies stage-by-stage butterfly combines.</text>
            ${stageLabels}
            ${baseWires}
            ${leftLabels}
            ${butterflies}
            ${circles}
            ${values}
            <text x="${valueX + 18}" y="30" text-anchor="middle" fill="#94a3b8" font-size="12">current A[i]</text>
            ${detail}
        `;
    }

    function renderBitReversalPanel() {
        const samples = getPreviewSamples();
        const mapping = state.results ? state.results.iterative.bitReversalMap : buildBitReversalMap(samples);
        const currentStep = getCurrentStep();
        const bitRows = currentStep && currentStep.mode === "iterative" && currentStep.snapshot.bitRows
            ? currentStep.snapshot.bitRows
            : buildBitRows(mapping, state.results ? mapping.length : 0, false);
        const activeRow = bitRows.find((row) => row.status === "active");
        const linesSvg = renderBitReversalSvg(bitRows);
        const tableRows = bitRows.map((row) => `
            <tr class="bit-row ${row.status === "active" ? "is-active" : ""}">
                <td>${row.index}</td>
                <td><code>${row.binary}</code></td>
                <td><code>${row.reversedBinary}</code></td>
                <td>${row.reversedIndex}</td>
                <td>${formatNumber(row.value)}</td>
                <td><span class="pill ${row.status === "done" ? "success" : row.status === "active" ? "ready" : "pending"}">${row.status}</span></td>
            </tr>
        `).join("");

        const caption = activeRow
            ? `Current mapping: index ${activeRow.index} uses binary ${activeRow.binary}, which reverses to ${activeRow.reversedBinary}, so its value moves to position ${activeRow.reversedIndex}.`
            : "The iterative FFT first places every sample into bit-reversed order so butterfly stages combine the correct subproblems.";

        return `
            <div class="bit-layout">
                <p class="bit-caption">${escapeHtml(caption)}</p>
                ${linesSvg}
                <table class="bit-reversal-table">
                    <thead>
                        <tr>
                            <th>Original Index</th>
                            <th>Binary</th>
                            <th>Reversed</th>
                            <th>New Index</th>
                            <th>Value</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    function renderOutputComparisonPanel() {
        if (!state.results) {
            return `
                <p class="comparison-caption">Build the algorithms to compare the final output vectors from naive DFT, recursive FFT, and iterative FFT.</p>
            `;
        }

        const rows = state.results.naive.output.map((value, index) => {
            const recursiveValue = state.results.recursive.output[index];
            const iterativeValue = state.results.iterative.output[index];
            const recursiveDiff = value.sub(recursiveValue).magnitude();
            const iterativeDiff = value.sub(iterativeValue).magnitude();
            return `
                <tr>
                    <td>${index}</td>
                    <td>${escapeHtml(formatComplex(value))}</td>
                    <td>${escapeHtml(formatComplex(recursiveValue))}</td>
                    <td>${escapeHtml(formatComplex(iterativeValue))}</td>
                    <td>${escapeHtml(formatNumber(recursiveDiff, 6))}</td>
                    <td>${escapeHtml(formatNumber(iterativeDiff, 6))}</td>
                </tr>
            `;
        }).join("");

        const verification = state.results.verification;
        return `
            <p class="comparison-caption">
                ${verification.allPass ? "PASS" : "FAIL"}: both FFT implementations are checked against the naive DFT with tolerance ${TOLERANCE_LABEL}. Recursive max difference = ${formatNumber(verification.recursiveMaxDiff, 6)}, iterative max difference = ${formatNumber(verification.iterativeMaxDiff, 6)}.
            </p>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>k</th>
                        <th>Naive DFT</th>
                        <th>Recursive FFT</th>
                        <th>Iterative FFT</th>
                        <th>|Naive - Recursive|</th>
                        <th>|Naive - Iterative|</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    function renderBitReversalSvg(bitRows) {
        const width = 700;
        const height = 180;
        const leftX = 120;
        const rightX = 580;
        const startY = 36;
        const rowGap = bitRows.length > 4 ? 16 : 28;
        const boxesLeft = bitRows.map((row, index) => {
            const y = startY + (index * rowGap);
            return `
                <g>
                    <rect x="${leftX - 54}" y="${y - 10}" width="64" height="20" rx="10" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(148, 163, 184, 0.16)"></rect>
                    <text x="${leftX - 22}" y="${y + 4}" text-anchor="middle" fill="#e5eefb" font-size="10">x[${row.index}]</text>
                </g>
            `;
        }).join("");
        const boxesRight = bitRows.map((row, index) => {
            const y = startY + (index * rowGap);
            return `
                <g>
                    <rect x="${rightX - 12}" y="${y - 10}" width="80" height="20" rx="10" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(148, 163, 184, 0.16)"></rect>
                    <text x="${rightX + 28}" y="${y + 4}" text-anchor="middle" fill="#e5eefb" font-size="10">A[${index}]</text>
                </g>
            `;
        }).join("");
        const mappingLines = bitRows.map((row, index) => {
            const fromY = startY + (index * rowGap);
            const toY = startY + (row.reversedIndex * rowGap);
            const isActive = row.status === "active";
            const isDone = row.status === "done";
            const stroke = isActive ? "#38bdf8" : isDone ? "#22c55e" : "rgba(148, 163, 184, 0.16)";
            const strokeWidth = isActive ? 4 : isDone ? 2.5 : 1.5;
            return `
                <path d="M ${leftX + 10} ${fromY} C 250 ${fromY}, 430 ${toY}, ${rightX - 12} ${toY}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${isDone || isActive ? 0.95 : 0.3}"></path>
            `;
        }).join("");

        return `
            <svg viewBox="0 0 ${width} ${height}" aria-label="Bit reversal mapping">
                <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
                <text x="${leftX - 22}" y="18" text-anchor="middle" fill="#94a3b8" font-size="12">original order</text>
                <text x="${rightX + 28}" y="18" text-anchor="middle" fill="#94a3b8" font-size="12">bit-reversed order</text>
                ${mappingLines}
                ${boxesLeft}
                ${boxesRight}
            </svg>
        `;
    }

    function renderVectorBox(x, y, width, height, label, value, accent) {
        return `
            <g>
                <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="rgba(15, 23, 42, 0.95)" stroke="${accent}" stroke-width="1.5"></rect>
                <text x="${x + (width / 2)}" y="${y + 20}" text-anchor="middle" fill="#94a3b8" font-size="12">${escapeHtml(label)}</text>
                <text x="${x + (width / 2)}" y="${y + 40}" text-anchor="middle" fill="#e5eefb" font-size="12">${escapeHtml(value)}</text>
            </g>
        `;
    }

    function renderNoDataMessage(width, height, heading, subheading) {
        return `
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            <text x="${width / 2}" y="${height / 2 - 8}" text-anchor="middle" fill="#e5eefb" font-size="18">${escapeHtml(heading)}</text>
            <text x="${width / 2}" y="${height / 2 + 18}" text-anchor="middle" fill="#94a3b8" font-size="13">${escapeHtml(subheading)}</text>
        `;
    }

    function getActiveTimeline() {
        return state.timelines[state.mode] || [];
    }

    function getCurrentStep() {
        const timeline = getActiveTimeline();
        if (!timeline.length || state.currentStepIndex < 0) {
            return null;
        }
        return timeline[state.currentStepIndex] || null;
    }

    function getPreviewSamples() {
        const parsed = parseSampleInput(state.inputText, state.n);
        return parsed.ok ? parsed.samples : state.inputSamples;
    }

    function parseSampleInput(text, expectedLength) {
        if (!text.trim()) {
            return { ok: false, error: `Enter exactly ${expectedLength} comma-separated samples.` };
        }
        const parts = text.split(",").map((part) => part.trim());
        if (parts.some((part) => part.length === 0)) {
            return { ok: false, error: "Each sample must be a real number. Remove empty entries and keep comma separators." };
        }
        if (parts.length !== expectedLength) {
            return { ok: false, error: `Expected ${expectedLength} samples because n = ${expectedLength}, but received ${parts.length}.` };
        }
        const values = parts.map((part) => Number(part));
        if (values.some((value) => Number.isNaN(value))) {
            return { ok: false, error: "Every sample must be numeric. Example: 1, 0, 1, 0" };
        }
        return { ok: true, samples: values };
    }

    function getPresetSamples(name, n) {
        switch (name) {
            case "impulse":
                return Array.from({ length: n }, (_, index) => (index === 0 ? 1 : 0));
            case "constant":
                return Array.from({ length: n }, () => 1);
            case "sine":
                return Array.from({ length: n }, (_, index) => Number(Math.sin((2 * Math.PI * index) / n).toFixed(3)));
            case "alternating":
            default:
                return Array.from({ length: n }, (_, index) => (index % 2 === 0 ? 1 : 0));
        }
    }

    function computeDFTMatrix(n) {
        return Array.from({ length: n }, (_, k) => Array.from({ length: n }, (_, j) => ({
            row: k,
            column: j,
            power: j * k,
            value: twiddle(n, j * k)
        })));
    }

    function buildBitReversalMap(samples) {
        const n = samples.length;
        const bits = Math.log2(n);
        return samples.map((value, index) => {
            const binary = index.toString(2).padStart(bits, "0");
            const reversedBinary = binary.split("").reverse().join("");
            return {
                index,
                binary,
                reversedBinary,
                reversedIndex: parseInt(reversedBinary, 2),
                value
            };
        });
    }

    function buildBitRows(map, activeIndex, useActiveRow) {
        return map.map((record, index) => ({
            ...record,
            status: useActiveRow
                ? (index < activeIndex ? "done" : index === activeIndex ? "active" : "pending")
                : (activeIndex <= 0 ? "pending" : index < activeIndex ? "done" : "done")
        }));
    }

    function buildButterflyPairs(n) {
        const stages = Math.log2(n);
        return Array.from({ length: stages }, (_, stageIndex) => {
            const stage = stageIndex + 1;
            const m = 2 ** stage;
            const half = m / 2;
            const pairs = [];
            for (let block = 0; block < n; block += m) {
                for (let j = 0; j < half; j += 1) {
                    pairs.push([block + j, block + j + half]);
                }
            }
            return pairs;
        });
    }

    function twiddle(n, power) {
        const angle = (-2 * Math.PI * power) / n;
        return new Complex(Math.cos(angle), Math.sin(angle));
    }

    function formatNumber(value, digits = 3) {
        const normalized = Math.abs(value) < 1e-12 ? 0 : value;
        return Number(normalized.toFixed(digits)).toString();
    }

    function formatComplex(value, digits = 3) {
        if (!value) {
            return "--";
        }
        const real = formatNumber(value.re, digits);
        const imagMagnitude = formatNumber(Math.abs(value.im), digits);
        const sign = value.im >= -1e-12 ? "+" : "-";
        return `${real} ${sign} ${imagMagnitude}i`;
    }

    function formatPseudoLines(lines) {
        if (!lines || !lines.length) {
            return "--";
        }
        const unique = [...new Set(lines)].sort((a, b) => a - b);
        const contiguous = unique.every((value, index) => index === 0 || value === unique[index - 1] + 1);
        if (contiguous) {
            return unique.length === 1 ? String(unique[0]) : `${unique[0]}-${unique[unique.length - 1]}`;
        }
        return unique.join(", ");
    }

    function phaseToColor(phase) {
        const normalized = (phase + Math.PI) / (2 * Math.PI);
        const hue = Math.round(200 + (normalized * 160));
        return `hsl(${hue} 75% 48%)`;
    }

    function makeCounters() {
        return {
            complexMultiplications: 0,
            complexAdditions: 0,
            butterflyOperations: 0,
            stagesCompleted: 0
        };
    }

    function cloneComplexArray(array) {
        return array.map((value) => value ? value.clone() : null);
    }

    function average(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function findTooltipTarget(target, root) {
        let current = target;
        while (current && current !== root) {
            if (current.dataset && current.dataset.tooltip) {
                return current;
            }
            current = current.parentNode;
        }
        return null;
    }

    function showTooltip(text, clientX, clientY) {
        if (!text) {
            hideTooltip();
            return;
        }
        dom.tooltip.hidden = false;
        dom.tooltip.innerHTML = escapeHtml(text).replace(/\\n/g, "<br>");
        const parentRect = dom.tooltip.parentElement.getBoundingClientRect();
        dom.tooltip.style.left = `${clientX - parentRect.left + 14}px`;
        dom.tooltip.style.top = `${clientY - parentRect.top + 14}px`;
    }

    function hideTooltip() {
        dom.tooltip.hidden = true;
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function escapeAttr(text) {
        return escapeHtml(text);
    }

    function runSelfChecks() {
        const testCases = [
            [1, 0, 1, 0],
            [1, 1, 1, 1],
            getPresetSamples("sine", 8)
        ];

        const allPassed = testCases.every((samples) => {
            const naive = computeNaiveDFT(samples).output;
            const recursive = computeRecursiveFFT(samples).output;
            const iterative = computeIterativeFFT(samples).output;
            return compareAllOutputs(naive, recursive, iterative).allPass;
        });

        if (allPassed) {
            console.info("[FFT Visualizer] Self-checks passed.");
        } else {
            console.error("[FFT Visualizer] Self-checks failed.");
        }
        return allPassed;
    }

    globalThis.FFTApp = {
        Complex,
        computeNaiveDFT,
        computeRecursiveFFT,
        computeIterativeFFT,
        compareAllOutputs,
        getPresetSamples,
        runSelfChecks,
        parseSampleInput
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = globalThis.FFTApp;
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", initApp);
    }
})();
