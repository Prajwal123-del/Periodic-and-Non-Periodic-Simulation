// =========================================================================
// app_3d.js
// 3D WebGL Renderer (Three.js), Volumetric Tube & Pillar Generators,
// Single Harmonic Highlighter, Experiment Presets, and 2D Reference Scope
// =========================================================================

const container = document.getElementById('viewer-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);

const camera = new THREE.PerspectiveCamera(44, container.clientWidth / container.clientHeight, 0.1, 250);
camera.position.set(20, 13.5, 23);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.update();

// Scene Lighting for 3D Tubes and Cylinders
const ambientLight = new THREE.AmbientLight(0xffffff, 0.68);
scene.add(ambientLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight1.position.set(20, 30, 25);
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0x58a6ff, 0.35);
dirLight2.position.set(-20, 15, -15);
scene.add(dirLight2);

let gridHelper = new THREE.GridHelper(22, 22, 0x30363d, 0x1c2128);
scene.add(gridHelper);

const plotGroup = new THREE.Group();
scene.add(plotGroup);

let isLightMode = false;

// --- 3D Geometry Helper Functions ---
function create3DTube(points, radius, colorHex, opacity = 1.0) {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points);
    const segments = Math.min(points.length * 2, 380);
    const geometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
    const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.32,
        metalness: 0.15,
        transparent: opacity < 1.0,
        opacity: opacity
    });
    return new THREE.Mesh(geometry, material);
}

function create3DRibbon(points, colorHex, opacity = 0.20) {
    const vertices = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        vertices.push(
            p1.x, 0, p1.z,
            p1.x, p1.y, p1.z,
            p2.x, p2.y, p2.z,
            p1.x, 0, p1.z,
            p2.x, p2.y, p2.z,
            p2.x, 0, p2.z
        );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
}

function create3DPillar(x, z, height, radius, colorHex) {
    const group = new THREE.Group();
    const absH = Math.abs(height);
    if (absH > 0.01) {
        const cylGeo = new THREE.CylinderGeometry(radius, radius, absH, 12);
        const cylMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.3,
            metalness: 0.2
        });
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        cyl.position.set(x, height / 2.0, z);
        group.add(cyl);
    }
    const sphGeo = new THREE.SphereGeometry(radius * 1.65, 12, 12);
    const sphMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: colorHex,
        emissiveIntensity: 0.45,
        roughness: 0.2
    });
    const sph = new THREE.Mesh(sphGeo, sphMat);
    sph.position.set(x, height, z);
    group.add(sph);
    return group;
}

// Helper to draw a rounded rectangle badge on a 2D canvas
function drawRoundedBadge(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// Dynamic-width, crystal-clear 3D Text Sprite generator (prevents cropped edges and WebGL mipmap glitches)
function createTextLabel(text, x, y, z, colorStr = "#8b949e", scaleSize = 1.5) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const fontStr = "bold 36px 'Segoe UI', Arial, sans-serif";
    ctx.font = fontStr;
    const textMetrics = ctx.measureText(text);

    const padX = 36;
    const width = Math.ceil(textMetrics.width) + padX * 2;
    const height = 80;

    canvas.width = width;
    canvas.height = height;

    // Re-apply font after canvas resize
    ctx.font = fontStr;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Subtle dark/light pill background so text is always readable over 3D waveforms
    ctx.fillStyle = isLightMode ? "rgba(255, 255, 255, 0.90)" : "rgba(13, 17, 23, 0.82)";
    drawRoundedBadge(ctx, 4, 8, width - 8, height - 16, 14);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colorStr;
    ctx.stroke();

    // Draw full text in the exact center
    ctx.fillStyle = colorStr;
    ctx.fillText(text, width / 2, height / 2 + 1);

    // Disable mipmaps and use LinearFilter to prevent missing letters on non-power-of-2 textures
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false
    });

    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);

    // Scale proportionally to the exact aspect ratio of the measured text
    const aspect = width / height;
    const spriteHeight = scaleSize * 0.48;
    sprite.scale.set(spriteHeight * aspect, spriteHeight, 1);

    return sprite;
}

// --- Quick Viva Experiment Preset Handler ---
function applyExperimentPreset() {
    const preset = document.getElementById('presetSelect').value;
    const noteBox = document.getElementById('preset_note');

    if (preset === 'exp1') {
        document.getElementById('viewMode').value = 'standard';
        document.getElementById('pulseShape').value = 'rect';
        document.getElementById('T0_slider').value = 4.0;
        document.getElementById('tau_slider').value = 1.0;
        document.getElementById('N_slider').value = 11;
        document.getElementById('t0_slider').value = 0.0;
        document.getElementById('k_inspect_slider').value = -1;
        changeCamera('3d');
        noteBox.innerText = "Exp 1: Observe how the blue discrete CTFS stems (T0·|ck|) sit directly on top of the red continuous CTFT sinc envelope |X(jω)|.";
    } else if (preset === 'exp2') {
        document.getElementById('viewMode').value = 'waterfall';
        document.getElementById('pulseShape').value = 'rect';
        document.getElementById('T0_slider').value = 10.0;
        document.getElementById('tau_slider').value = 1.0;
        changeCamera('3d');
        noteBox.innerText = "Exp 2: As Period T0 increases toward ∞, fundamental spacing ω0 = 2π/T0 shrinks and the discrete harmonic stems merge into the continuous CTFT wall.";
    } else if (preset === 'exp3') {
        document.getElementById('viewMode').value = 'standard';
        document.getElementById('pulseShape').value = 'rect';
        document.getElementById('T0_slider').value = 5.0;
        document.getElementById('tau_slider').value = 0.5;
        changeCamera('freq');
        noteBox.innerText = "Exp 3: Narrowing pulse width τ to 0.5s stretches the frequency main lobe wider (BW = 4π/τ = 25.13 rad/s) — proving the Time-Frequency Scaling property.";
    } else if (preset === 'exp4') {
        document.getElementById('viewMode').value = 'standard';
        document.getElementById('pulseShape').value = 'tri';
        document.getElementById('T0_slider').value = 4.0;
        document.getElementById('tau_slider').value = 1.2;
        document.getElementById('N_slider').value = 9;
        changeCamera('time');
        noteBox.innerText = "Exp 4: Switching from Rectangular to Triangular removes sharp discontinuities, eliminating Gibbs ringing and making side-lobes decay faster as sinc².";
    } else if (preset === 'exp5') {
        document.getElementById('viewMode').value = 'phasor';
        document.getElementById('pulseShape').value = 'rect';
        document.getElementById('t0_slider').value = 0.45;
        changeCamera('3d');
        noteBox.innerText = "Exp 5: Delaying the pulse by t0 = 0.45s twists the complex spectrum into a 3D helix e^(-jωt0), while the outer gold magnitude envelope |X(jω)| stays unchanged.";
    } else if (preset === 'exp6') {
        document.getElementById('viewMode').value = 'energy';
        document.getElementById('pulseShape').value = 'gauss';
        document.getElementById('T0_slider').value = 4.0;
        document.getElementById('tau_slider').value = 1.0;
        changeCamera('3d');
        noteBox.innerText = "Exp 6: Side-by-side comparison of Periodic Discrete Power Spectrum |ck|² (front slice) vs. Non-Periodic Continuous Energy Spectral Density |X(jω)|² (back slice).";
    }
    updatePlot();
}

// --- Main Plot Update Function ---
function updatePlot() {
    while (plotGroup.children.length > 0) {
        const obj = plotGroup.children[0];
        plotGroup.remove(obj);
    }

    const mode = document.getElementById('viewMode').value;
    const shape = document.getElementById('pulseShape').value;
    const spectrumSubMode = document.getElementById('spectrumViewMode') ? document.getElementById('spectrumViewMode').value : 'magnitude';
    const A = parseFloat(document.getElementById('A_slider').value);
    const T0 = parseFloat(document.getElementById('T0_slider').value);
    let tau = parseFloat(document.getElementById('tau_slider').value);
    const N = parseInt(document.getElementById('N_slider').value);
    const kInspect = parseInt(document.getElementById('k_inspect_slider').value);
    const t0 = parseFloat(document.getElementById('t0_slider').value);
    const wc = parseFloat(document.getElementById('wc_slider').value);

    document.getElementById('carrier_group').style.display =
        (shape === 'cosine' || shape === 'damped') ? 'block' : 'none';

    if (tau >= T0 - 0.2) {
        tau = +(T0 - 0.2).toFixed(1);
        document.getElementById('tau_slider').value = tau;
    }

    const showContPulse = document.getElementById('showContPulse').checked;
    const showIdealPeriodic = document.getElementById('showIdealPeriodic').checked;
    const showFourierSum = document.getElementById('showFourierSum').checked;
    const showSineWaves = document.getElementById('showSineWaves').checked;
    const showContSpectrum = document.getElementById('showContSpectrum').checked;
    const showDiscreteStems = document.getElementById('showDiscreteStems').checked;
    const showSigned = document.getElementById('showSigned').checked;

    const w0 = (2 * Math.PI) / T0;
    const info = getWaveformDetails(A, tau, shape);
    const totalPower = info.energy / T0;
    const metrics = computeSignalMetrics(A, T0, tau, N, shape, wc, totalPower);

    // Update UI Readouts
    document.getElementById('formula_display').innerText = info.formula;
    document.getElementById('A_val').innerText = A.toFixed(1);
    document.getElementById('T0_val').innerText = T0.toFixed(1) + " s";
    document.getElementById('tau_val').innerText = tau.toFixed(1) + " s";
    document.getElementById('N_val').innerText = N;
    document.getElementById('k_inspect_val').innerText = (kInspect < 0) ? "All" : ("k = ±" + kInspect);
    document.getElementById('t0_val').innerText = t0.toFixed(2) + " s";
    document.getElementById('wc_val').innerText = wc.toFixed(1) + " rad/s";

    document.getElementById('out_w0').innerText = w0.toFixed(2) + " rad/s";
    document.getElementById('out_bw').innerText = info.bw.toFixed(2) + " rad/s";
    document.getElementById('out_duty').innerText = ((tau / T0) * 100).toFixed(1) + " %";
    document.getElementById('out_energy').innerText = info.energy.toFixed(2) + " J";
    document.getElementById('out_power').innerText = totalPower.toFixed(3) + " W";
    document.getElementById('out_mse').innerText = metrics.mse.toFixed(4);
    document.getElementById('out_parseval').innerText = metrics.pct.toFixed(1) + " %";
    document.getElementById('parseval_bar').style.width = metrics.pct.toFixed(0) + "%";

    // Update Single Harmonic Inspector Banner
    const banner = document.getElementById('harmonicBanner');
    if (kInspect >= 0) {
        const wk_ins = kInspect * w0;
        const X_ins = calculateCTFT(wk_ins, A, tau, shape, wc);
        const ck_ins = Math.abs(X_ins) / T0;
        banner.style.display = 'block';
        document.getElementById('harmonicBannerText').innerText =
            `Inspecting Harmonic k = ${kInspect}  |  ω_${kInspect} = ${wk_ins.toFixed(2)} rad/s  |  |c_${kInspect}| = ${ck_ins.toFixed(4)}  |  T0·|c_${kInspect}| = |X(jω_${kInspect})| = ${Math.abs(X_ins).toFixed(4)}`;
    } else {
        banner.style.display = 'none';
    }

    updateHarmonicsTable(A, T0, tau, N, t0, shape, wc);

    const timeLimit = 5.5;
    const freqLimit = 22.0;
    const scaleX = 11.0 / timeLimit;
    const scaleZ = 11.0 / freqLimit;
    const scaleY = 3.2;

    const refFreq = (shape === 'cosine' || shape === 'damped') ? wc : 0;
    const peakCTFT = Math.max(0.2, Math.abs(calculateCTFT(refFreq, A, tau, shape, wc)));
    const freqScaleY = 5.2 / peakCTFT;

    // Mode 1: Standard 3D Time-Frequency Decomposition
    if (mode === 'standard') {
        const zTimeWall = 11.0;
        const xFreqWall = -11.0;

        plotGroup.add(createTextLabel("Time Domain t (s) →", 0, -0.9, zTimeWall + 1.3, "#38bdf8", 1.45));
        plotGroup.add(createTextLabel("← Frequency Domain ω (rad/s)", xFreqWall - 1.5, -0.9, 0, "#ff3366", 1.45));

        const numTimeSamples = 250;

        if (showIdealPeriodic) {
            const pts = [];
            for (let i = 0; i <= numTimeSamples; i++) {
                const t = -timeLimit + (2 * timeLimit * i) / numTimeSamples;
                let val = 0.0;
                for (let m = -3; m <= 3; m++) {
                    val += evaluateSinglePulse(t - t0 - m * T0, A, tau, shape, wc);
                }
                pts.push(new THREE.Vector3(t * scaleX, val * scaleY, zTimeWall - 0.55));
            }
            plotGroup.add(create3DTube(pts, 0.065, 0x00e5ff, 0.85));
            plotGroup.add(create3DRibbon(pts, 0x00e5ff, 0.12));
        }

        if (showContPulse) {
            const pts = [];
            for (let i = 0; i <= numTimeSamples; i++) {
                const t = -timeLimit + (2 * timeLimit * i) / numTimeSamples;
                const val = evaluateSinglePulse(t - t0, A, tau, shape, wc);
                pts.push(new THREE.Vector3(t * scaleX, val * scaleY, zTimeWall + 0.55));
            }
            plotGroup.add(create3DTube(pts, 0.085, 0xff3366, 1.0));
            plotGroup.add(create3DRibbon(pts, 0xff3366, 0.24));
        }

        if (showFourierSum) {
            const pts = [];
            const c0 = calculateCTFT(0, A, tau, shape, wc) / T0;
            for (let i = 0; i <= numTimeSamples; i++) {
                const t = -timeLimit + (2 * timeLimit * i) / numTimeSamples;
                let sum = c0;
                for (let k = 1; k <= N; k++) {
                    const wk = k * w0;
                    const ck = calculateCTFT(wk, A, tau, shape, wc) / T0;
                    sum += 2 * ck * Math.cos(wk * (t - t0));
                }
                pts.push(new THREE.Vector3(t * scaleX, sum * scaleY, zTimeWall));
            }
            plotGroup.add(create3DTube(pts, 0.075, 0xffa600, 1.0));
        }

        if (showSineWaves) {
            const maxK = Math.min(N, Math.floor(freqLimit / w0));
            for (let k = -maxK; k <= maxK; k++) {
                const wk = k * w0;
                const zPos = wk * scaleZ;
                const ck = calculateCTFT(wk, A, tau, shape, wc) / T0;
                const wavePts = [];

                for (let i = 0; i <= 130; i++) {
                    const t = -timeLimit + (2 * timeLimit * i) / 130;
                    const yVal = (k === 0) ? ck : ck * Math.cos(wk * (t - t0));
                    wavePts.push(new THREE.Vector3(t * scaleX, yVal * scaleY * 1.6, zPos));
                }

                const isHighlighted = (kInspect >= 0 && Math.abs(k) === kInspect);
                const isDimmed = (kInspect >= 0 && Math.abs(k) !== kInspect);
                const waveColor = isHighlighted ? 0xfde047 : ((k === 0) ? 0xffa600 : 0x22c55e);
                const tubeRad = isHighlighted ? 0.095 : 0.045;
                const tubeOp = isDimmed ? 0.22 : 0.90;

                plotGroup.add(create3DTube(wavePts, tubeRad, waveColor, tubeOp));
                plotGroup.add(create3DRibbon(wavePts, waveColor, isHighlighted ? 0.32 : (isDimmed ? 0.04 : 0.14)));
            }
        }

        // Apply Spectrum Sub-Mode Handling (Magnitude, Phase, or Complex Helix)
        if (spectrumSubMode === 'complex_helix') {
            // Render Complex 3D Helix along the Frequency wall
            const helixPts = [];
            const numFreq = 250;
            for (let i = 0; i <= numFreq; i++) {
                const w = -freqLimit + (2 * freqLimit * i) / numFreq;
                const X_val = calculateCTFT(w, A, tau, shape, wc);
                const phaseAngle = -w * t0;
                const re = X_val * Math.cos(phaseAngle) * freqScaleY * 0.6;
                const im = X_val * Math.sin(phaseAngle) * freqScaleY * 0.6;
                helixPts.push(new THREE.Vector3(xFreqWall + im, re + 2.5, w * scaleZ));
            }
            plotGroup.add(create3DTube(helixPts, 0.09, 0xff00ff, 1.0));
            plotGroup.add(createTextLabel("3D Complex Helix: Re, Im, ω", xFreqWall, 7.5, 0, "#ff00ff", 1.4));
        } else {
            // Standard Magnitude or Phase Spectrum
            if (showContSpectrum) {
                const envPts = [];
                const numFreq = 250;
                for (let i = 0; i <= numFreq; i++) {
                    const w = -freqLimit + (2 * freqLimit * i) / numFreq;
                    const rawX = calculateCTFT(w, A, tau, shape, wc);
                    let val = Math.abs(rawX);
                    if (spectrumSubMode === 'phase') {
                        // Phase angle calculation (-π to π)
                        val = Math.atan2(0, rawX); // Simplified phase representation or based on shifted waveform
                    } else {
                        val = showSigned ? rawX : Math.abs(rawX);
                    }
                    envPts.push(new THREE.Vector3(xFreqWall, val * (spectrumSubMode === 'phase' ? 1.5 : freqScaleY), w * scaleZ));
                }
                plotGroup.add(create3DTube(envPts, 0.085, spectrumSubMode === 'phase' ? 0xffaa00 : 0xff3366, 1.0));
                plotGroup.add(create3DRibbon(envPts, spectrumSubMode === 'phase' ? 0xffaa00 : 0xff3366, 0.25));
            }

            if (showDiscreteStems) {
                const maxHarm = Math.floor(freqLimit / w0);
                for (let k = -maxHarm; k <= maxHarm; k++) {
                    const wk = k * w0;
                    const zPos = wk * scaleZ;
                    const rawT0_ck = calculateCTFT(wk, A, tau, shape, wc);
                    let val = Math.abs(rawT0_ck);
                    if (spectrumSubMode === 'phase') {
                        val = Math.atan2(0, rawT0_ck);
                    } else {
                        val = showSigned ? rawT0_ck :
