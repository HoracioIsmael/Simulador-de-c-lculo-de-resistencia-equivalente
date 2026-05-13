// Arquitectura del Estado del Sistema
let currentMode = 'serie'; // serie, paralelo, mixto_simple, mixto_tp
let isMeasuring = false;
let isChallengeMode = false;
let challengeAnswer = 0;

// Constantes de topología
const defaultValues = {
    serie: { R1: 100, R2: 220, R3: 330 },
    paralelo: { R1: 100, R2: 100, R3: 100 },
    mixto_simple: { R1: 4000, R2: 2000, R3: 2000, R4: 1000 },
    mixto_tp: { R1: 10000, R2: 1000, R3: 220000, R4: 47000, R5: 220000, R6: 1000 }
};

let currentResistors = { ...defaultValues.serie };

// Referencias DOM
const svgCircuit = document.getElementById('svg-circuit');
const inputsContainer = document.getElementById('inputs-container');
const mmScreen = document.getElementById('mm-screen');
const btnMeasure = document.getElementById('btn-measure');
const measureSelector = document.getElementById('measure-selector');
const measureInfo = document.getElementById('measure-info');
const procedureContent = document.getElementById('procedure-content');
const didacticConcepts = document.getElementById('didactic-concepts');
const challengePanel = document.getElementById('challenge-panel');
const tabs = document.querySelectorAll('.tab-btn');
const mixtoOptions = document.getElementById('mixto-options');
const radioMixto = document.querySelectorAll('input[name="mixto_type"]');

// Textos Didácticos
const didacticTexts = {
    serie: `
        <li><b>Resistencia Equivalente:</b> Resistencia total del sistema. En serie, la corriente fluye por una trayectoria única.</li>
        <li><b>Modelo Matemático:</b> R<sub>eq</sub> = R<sub>1</sub> + R<sub>2</sub> + R<sub>3</sub></li>
        <li>La resistencia total del sistema <b>siempre aumenta</b> al agregar cargas en serie.</li>`,
    paralelo: `
        <li><b>Conexión Paralelo:</b> La corriente se bifurca en nodos. Existen múltiples trayectorias independientes.</li>
        <li><b>Modelo Matemático:</b> 1/R<sub>eq</sub> = 1/R<sub>1</sub> + 1/R<sub>2</sub> + 1/R<sub>3</sub></li>
        <li>En paralelo, la resistencia total <b>siempre es menor</b> que la resistencia individual más pequeña de las ramas.</li>`,
    mixto_simple: `
        <li><b>Circuito Mixto Simple:</b> Topología que combina ramas serie y paralelo.</li>
        <li><b>Metodología de Resolución:</b> Reducir primero el bloque paralelo (R2 y R3) a una única resistencia equivalente (Rp).</li>
        <li>El sistema se simplifica a un circuito serie: R1 + Rp + R4.</li>`,
    mixto_tp: `
        <li><b>Circuito Mixto TP (Estructura Compleja):</b> Contiene sub-ramas dentro del paralelo.</li>
        <li><b>Metodología de Resolución:</b>
            <br>1. Identificar el subsistema interno: La rama derecha tiene R4 y R5 en serie. Se suman (R45 = R4 + R5).
            <br>2. Resolver el bloque paralelo compuesto por 3 ramas: R2, R3 y R45.
            <br>3. Consolidar el circuito en serie final con R1, Rp y R6.</li>`
};

// --- Inicialización ---
function init() {
    setupTabs();
    setupMeasureControls();
    setupChallengeControls();
    
    radioMixto.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (!isChallengeMode) {
                loadMode(e.target.value);
            }
        });
    });

    loadMode('serie');
}

function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const mode = e.target.getAttribute('data-mode');
            if (mode === 'desafio') {
                enableChallengeMode();
            } else {
                isChallengeMode = false;
                challengePanel.classList.add('hidden');
                document.querySelector('.procedure-panel').classList.remove('hidden');
                
                if (mode === 'mixto_simple') {
                    mixtoOptions.classList.remove('hidden');
                    const selectedMixto = document.querySelector('input[name="mixto_type"]:checked').value;
                    loadMode(selectedMixto);
                } else {
                    mixtoOptions.classList.add('hidden');
                    loadMode(mode);
                }
            }
        });
    });
}

function loadMode(mode) {
    currentMode = mode;
    currentResistors = { ...defaultValues[mode] };
    
    // Resetear multímetro
    isMeasuring = false;
    mmScreen.innerText = "OL";
    btnMeasure.innerText = "Conectar Puntas";
    btnMeasure.style.backgroundColor = "var(--accent-green)";
    measureInfo.classList.add('hidden');
    
    // Configurar Selector de Medición
    measureSelector.innerHTML = '<option value="total">Medir equivalente total A-B</option>';
    if (mode === 'mixto_tp' && !isChallengeMode) {
        measureSelector.innerHTML += `
            <option value="r1">Medir R1 individual</option>
            <option value="r45">Medir R45 = R4 + R5</option>
            <option value="rp">Medir Rp = R2 // R3 // R45</option>
            <option value="r2">Medir R2 individual</option>
            <option value="r3">Medir R3 individual</option>
            <option value="r4">Medir R4 individual</option>
            <option value="r5">Medir R5 individual</option>
            <option value="r6">Medir R6 individual</option>
        `;
    }
    
    didacticConcepts.innerHTML = didacticTexts[mode];
    
    renderInputs();
    updateSystem();
}

function renderInputs() {
    inputsContainer.innerHTML = '';
    for (const [key, val] of Object.entries(currentResistors)) {
        const group = document.createElement('div');
        group.className = 'input-group';
        
        const label = document.createElement('label');
        label.innerText = `${key} (Ω):`;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.value = val;
        input.min = "0.001";
        input.step = "any";
        
        input.addEventListener('input', (e) => {
            const num = parseFloat(e.target.value);
            if (num > 0) {
                currentResistors[key] = num;
                updateSystem(); // Redibuja y recalcula
            }
        });

        group.appendChild(label);
        group.appendChild(input);
        inputsContainer.appendChild(group);
    }
}

// --- Utilidades Matemáticas y Formato ---
function formatUser(num, decimals = 3) {
    return Number(num).toFixed(decimals).replace('.', ',');
}

function formatInverse(num) {
    return Number(num).toFixed(6).replace('.', ',');
}

function formatCompact(num) {
    if (num >= 1000) {
        return formatUser(num / 1000, 3) + ' kΩ';
    }
    return formatUser(num, 3) + ' Ω';
}

function formatFull(num) {
    if (num >= 1000) {
        return formatUser(num / 1000, 3) + ' kΩ (' + formatUser(num, 3) + ' Ω)';
    }
    return formatUser(num, 3) + ' Ω';
}

// --- Subsistemas de Renderizado Topológico (ZIGZAG) ---
function updateSystem() {
    drawCircuit();
    if (!isChallengeMode) {
        generateProcedure();
    }
    if (isMeasuring) {
        calculateAndDisplay();
    }
}

function drawZigzagResistorHorizontal(cx, cy, label, value) {
    const w = 40; 
    const path = `M ${cx-w} ${cy} L ${cx-20} ${cy} L ${cx-15} ${cy-12} L ${cx-5} ${cy+12} L ${cx+5} ${cy-12} L ${cx+15} ${cy+12} L ${cx+20} ${cy} L ${cx+w} ${cy}`;
    
    return `
        <path class="resistor-zigzag" d="${path}" />
        <text class="resistor-label" x="${cx}" y="${cy-20}" text-anchor="middle">${label}</text>
        <text class="resistor-val" x="${cx}" y="${cy+25}" text-anchor="middle">${formatCompact(value)}</text>
    `;
}

function drawZigzagResistorVertical(cx, cy, label, value) {
    const h = 40; 
    const path = `M ${cx} ${cy-h} L ${cx} ${cy-20} L ${cx-12} ${cy-15} L ${cx+12} ${cy-5} L ${cx-12} ${cy+5} L ${cx+12} ${cy+15} L ${cx} ${cy+20} L ${cx} ${cy+h}`;
    
    return `
        <path class="resistor-zigzag" d="${path}" />
        <text class="resistor-label-vert" x="${cx+20}" y="${cy-5}">${label}</text>
        <text class="resistor-val-vert" x="${cx+20}" y="${cy+15}">${formatCompact(value)}</text>
    `;
}

function drawCircuit() {
    let svgHTML = '';
    const { R1, R2, R3, R4, R5, R6 } = currentResistors;

    if (currentMode === 'serie') {
        svgHTML += `<circle class="node" cx="50" cy="150" r="6"/><text class="node-text" x="40" y="140">A</text>
                    <circle class="node" cx="950" cy="150" r="6"/><text class="node-text" x="950" y="140">B</text>`;
        
        svgHTML += `<path class="wire" d="M 50 150 L 210 150 M 290 150 L 460 150 M 540 150 L 710 150 M 790 150 L 950 150" />`;
        svgHTML += `<path class="current-flow" d="M 50 150 L 950 150" />`;
        
        svgHTML += drawZigzagResistorHorizontal(250, 150, 'R1', R1);
        svgHTML += drawZigzagResistorHorizontal(500, 150, 'R2', R2);
        svgHTML += drawZigzagResistorHorizontal(750, 150, 'R3', R3);
    } 
    else if (currentMode === 'paralelo') {
        svgHTML += `<circle class="node" cx="150" cy="150" r="6"/><text class="node-text" x="140" y="140">A</text>
                    <circle class="node" cx="850" cy="150" r="6"/><text class="node-text" x="850" y="140">B</text>`;
        
        svgHTML += `<path class="wire" d="M 150 150 L 250 150 M 250 50 L 250 250 M 250 50 L 460 50 M 540 50 L 750 50 M 250 150 L 460 150 M 540 150 L 750 150 M 250 250 L 460 250 M 540 250 L 750 250 M 750 50 L 750 250 M 750 150 L 850 150" />`;
        svgHTML += `<path class="current-flow" d="M 150 150 L 250 150 M 250 50 L 250 250 M 250 50 L 750 50 M 250 150 L 750 150 M 250 250 L 750 250 M 750 50 L 750 250 M 750 150 L 850 150" />`;
        
        svgHTML += `<circle class="node-parallel" cx="250" cy="150" r="5"/> <circle class="node-parallel" cx="750" cy="150" r="5"/>`;

        svgHTML += drawZigzagResistorHorizontal(500, 50, 'R1', R1);
        svgHTML += drawZigzagResistorHorizontal(500, 150, 'R2', R2);
        svgHTML += drawZigzagResistorHorizontal(500, 250, 'R3', R3);
    }
    else if (currentMode === 'mixto_simple') {
        svgHTML += `<circle class="node" cx="50" cy="150" r="6"/><text class="node-text" x="40" y="140">A</text>
                    <circle class="node" cx="950" cy="150" r="6"/><text class="node-text" x="950" y="140">B</text>`;
        
        svgHTML += `<path class="wire" d="M 50 150 L 110 150 M 190 150 L 300 150 M 300 90 L 300 210 M 300 90 L 460 90 M 540 90 L 700 90 M 300 210 L 460 210 M 540 210 L 700 210 M 700 90 L 700 210 M 700 150 L 810 150 M 890 150 L 950 150" />`;
        svgHTML += `<path class="current-flow" d="M 50 150 L 300 150 M 300 90 L 300 210 M 300 90 L 700 90 M 300 210 L 700 210 M 700 90 L 700 210 M 700 150 L 950 150" />`;
        
        svgHTML += `<circle class="node-parallel" cx="300" cy="150" r="5"/> <circle class="node-parallel" cx="700" cy="150" r="5"/>`;

        svgHTML += drawZigzagResistorHorizontal(150, 150, 'R1', R1);
        svgHTML += drawZigzagResistorHorizontal(500, 90, 'R2', R2);
        svgHTML += drawZigzagResistorHorizontal(500, 210, 'R3', R3);
        svgHTML += drawZigzagResistorHorizontal(850, 150, 'R4', R4);
    }
    else if (currentMode === 'mixto_tp') {
        // Título del circuito
        svgHTML += `<text x="500" y="30" fill="#abb2bf" font-size="16" font-family="monospace" font-weight="bold" text-anchor="middle">Mixto TP: R1 + [R2 // R3 // (R4 + R5)] + R6</text>`;

        // Nodos Principales
        svgHTML += `<circle class="node" cx="60" cy="90" r="6"/><text class="node-text" x="40" y="95">A</text>`;
        svgHTML += `<circle class="node" cx="60" cy="260" r="6"/><text class="node-text" x="40" y="265">B</text>`;
        
        // Nodos Paralelo
        svgHTML += `<circle class="node-parallel" cx="360" cy="90" r="5"/><text class="node-text" x="345" y="75" style="fill:var(--accent-purple);font-size:12px;">P_IN</text>`;
        svgHTML += `<circle class="node-parallel" cx="360" cy="260" r="5"/><text class="node-text" x="340" y="285" style="fill:var(--accent-purple);font-size:12px;">P_OUT</text>`;
        svgHTML += `<circle class="node-parallel" cx="540" cy="90" r="5"/>`;
        svgHTML += `<circle class="node-parallel" cx="540" cy="260" r="5"/>`;

        // Trazado de Cables
        const wirePath = `
            M 60 90 L 170 90 M 250 90 L 360 90 
            M 360 90 L 760 90 
            M 360 90 L 360 135 M 360 215 L 360 260 
            M 540 90 L 540 135 M 540 215 L 540 260 
            M 760 90 L 760 90 M 760 170 L 760 180 M 760 260 L 760 260 
            M 760 260 L 360 260 
            M 360 260 L 250 260 M 170 260 L 60 260`;
            
        const flowPath = `
            M 60 90 L 360 90 M 360 90 L 760 90 
            M 360 90 L 360 260 M 540 90 L 540 260 M 760 90 L 760 260 
            M 760 260 L 360 260 M 360 260 L 60 260`;

        svgHTML += `<path class="wire" d="${wirePath}" />`;
        svgHTML += `<path class="current-flow" d="${flowPath}" />`;

        // Dibujo de Resistencias Zigzag
        svgHTML += drawZigzagResistorHorizontal(210, 90, 'R1', R1);       
        svgHTML += drawZigzagResistorVertical(360, 175, 'R2', R2);        
        svgHTML += drawZigzagResistorVertical(540, 175, 'R3', R3);        
        svgHTML += drawZigzagResistorVertical(760, 130, 'R4', R4);        
        svgHTML += drawZigzagResistorVertical(760, 220, 'R5', R5);        
        svgHTML += drawZigzagResistorHorizontal(210, 260, 'R6', R6);      
    }

    svgCircuit.innerHTML = svgHTML;
}

function generateProcedure() {
    const { R1, R2, R3, R4, R5, R6 } = currentResistors;
    let proc = '';
    let req = 0;

    if (currentMode === 'serie') {
        req = R1 + R2 + R3;
        proc = `1. Identificación Analítica: Circuito Serie.
2. Ecuación del Sistema: Req = R1 + R2 + R3
3. Sustitución: Req = ${formatUser(R1)} + ${formatUser(R2)} + ${formatUser(R3)}
4. Resultado: <span class="highlight">Req = ${formatFull(req)}</span>`;
    } 
    else if (currentMode === 'paralelo') {
        const invReq = (1/R1) + (1/R2) + (1/R3);
        req = 1 / invReq;
        proc = `1. Identificación Analítica: Circuito Paralelo.
2. Ecuación del Sistema: 1/Req = 1/R1 + 1/R2 + 1/R3
3. Sustitución: 1/Req = 1/${formatUser(R1)} + 1/${formatUser(R2)} + 1/${formatUser(R3)}
4. Desarrollo de admitancias: 1/Req = ${formatInverse(1/R1)} + ${formatInverse(1/R2)} + ${formatInverse(1/R3)}
5. Inversión: Req = 1 / ${formatUser(invReq)}
6. Resultado: <span class="highlight">Req = ${formatFull(req)}</span>`;
    }
    else if (currentMode === 'mixto_simple') {
        const rp = 1 / ((1/R2) + (1/R3));
        req = R1 + rp + R4;
        proc = `1. Identificación Analítica: Circuito Mixto Simple. Se aísla el subsistema paralelo (R2 // R3).
2. Equivalente Paralelo (Rp): 1/Rp = 1/R2 + 1/R3
   Rp = 1 / (1/${formatUser(R2)} + 1/${formatUser(R3)}) = ${formatUser(rp)} Ω
   
3. Análisis Topológico: El sistema equivale a tres resistencias en Serie: R1, Rp, R4.
4. Ecuación Final: Req = R1 + Rp + R4
5. Sustitución: Req = ${formatUser(R1)} + ${formatUser(rp)} + ${formatUser(R4)}
6. Resultado Final: <span class="highlight">Req = ${formatFull(req)}</span>`;
    }
    else if (currentMode === 'mixto_tp') {
        const r45 = R4 + R5;
        const invReq = (1/R2) + (1/R3) + (1/r45);
        const rp = 1 / invReq;
        req = R1 + rp + R6;
        
        const minRama = Math.min(R2, R3, r45);
        
        proc = `1. Identificación Analítica: Circuito Mixto TP (Descomposición de subsistemas).
2. Aislamiento de sub-rama serie (R4 y R5):
   R45 = R4 + R5
   R45 = ${formatUser(R4)} + ${formatUser(R5)} = ${formatUser(r45)} Ω
   
3. Consolidación del bloque paralelo (R2, R3 y R45):
   1/Rp = 1/R2 + 1/R3 + 1/R45
   1/Rp = 1/${formatUser(R2)} + 1/${formatUser(R3)} + 1/${formatUser(r45)}
   1/Rp = ${formatInverse(1/R2)} + ${formatInverse(1/R3)} + ${formatInverse(1/r45)} = ${formatInverse(invReq)}
   Rp = 1 / ${formatInverse(invReq)} = ${formatUser(rp)} Ω
   
<span style="color: var(--accent-purple); font-weight: bold;">[!] Verificación Técnica del Paralelo:</span>
   Rp debe ser menor que la menor resistencia de las ramas del bloque.
   Menor rama del paralelo = min(${formatUser(R2)}, ${formatUser(R3)}, ${formatUser(r45)}) = ${formatUser(minRama)} Ω
   ¿Rp (${formatUser(rp)} Ω) < ${formatUser(minRama)} Ω? <span style="color: var(--accent-green); font-weight: bold;">Sí, es coherente.</span>

4. Análisis Topológico: El sistema converge a una trayectoria en Serie: R1, Rp, R6.
   Req = R1 + Rp + R6
   Req = ${formatUser(R1)} + ${formatUser(rp)} + ${formatUser(R6)}
   
5. Resultado Final: <span class="highlight">Req = ${formatFull(req)}</span>`;
    }

    procedureContent.innerHTML = proc;
    return req;
}

// --- Multímetro y Medición Avanzada ---
function setupMeasureControls() {
    btnMeasure.addEventListener('click', () => {
        isMeasuring = !isMeasuring;
        if (isMeasuring) {
            btnMeasure.innerText = "Desconectar Puntas";
            btnMeasure.style.backgroundColor = "var(--accent-red)";
            measureInfo.classList.remove('hidden');
            calculateAndDisplay();
        } else {
            btnMeasure.innerText = "Conectar Puntas";
            btnMeasure.style.backgroundColor = "var(--accent-green)";
            mmScreen.innerText = "OL";
            measureInfo.classList.add('hidden');
        }
    });

    measureSelector.addEventListener('change', () => {
        if(isMeasuring) calculateAndDisplay();
    });
}

function calculateAndDisplay() {
    if (!isMeasuring) return;
    
    const measureType = measureSelector.value;
    const { R1, R2, R3, R4, R5, R6 } = currentResistors;
    
    let val = 0;
    let title = '';
    let formula = '';

    if (measureType === 'total') {
        val = generateProcedure(); 
        title = 'Medición: Resist. Equivalente Total (A-B)';
        formula = 'Cálculo analítico completo según topología.';
    } 
    else if (measureType === 'r45') {
        val = R4 + R5;
        title = 'Medición parcial: R45';
        formula = `R45 representa la suma en serie de R4 y R5.`;
    }
    else if (measureType === 'rp') {
        const r45 = R4 + R5;
        val = 1 / (1/R2 + 1/R3 + 1/r45);
        title = 'Medición parcial: Rp (Bloque Paralelo)';
        formula = `Rp representa el equivalente del bloque paralelo formado por R2, R3 y R45.`;
    }
    else if (['r1','r2','r3','r4','r5','r6'].includes(measureType)) {
        val = currentResistors[measureType.toUpperCase()];
        title = `Medición directa del componente seleccionado (${measureType.toUpperCase()})`;
        formula = `Las puntas del óhmetro se colocan sobre los dos extremos de la resistencia.`;
    }

    // Actualizar pantalla multímetro
    mmScreen.innerText = formatCompact(val);

    // Actualizar panel info
    document.getElementById('mi-title').innerText = title;
    document.getElementById('mi-formula').innerText = formula;
    document.getElementById('mi-result').innerText = `Resultado: ${formatFull(val)}`;
}

// --- Subsistema de Desafío Analítico ---
function enableChallengeMode() {
    isChallengeMode = true;
    mixtoOptions.classList.add('hidden');
    measureSelector.innerHTML = '<option value="total">Medir equivalente total A-B</option>';
    
    const modes = ['serie', 'paralelo', 'mixto_simple', 'mixto_tp'];
    currentMode = modes[Math.floor(Math.random() * modes.length)];
    
    inputsContainer.innerHTML = '<i>Hardware bloqueado por el docente en Modo Desafío. Resuelva en hoja de cálculo.</i>';
    document.querySelector('.procedure-panel').classList.add('hidden');
    challengePanel.classList.remove('hidden');
    
    generateRandomChallenge();
}

function generateRandomChallenge() {
    const r = () => Math.floor(Math.random() * 9 + 1) * 100;
    
    if (currentMode === 'serie' || currentMode === 'paralelo') {
        currentResistors = { R1: r(), R2: r(), R3: r() };
    } else if (currentMode === 'mixto_simple') {
        currentResistors = { R1: r(), R2: r(), R3: r(), R4: r() };
    } else {
        currentResistors = { R1: r(), R2: r(), R3: r(), R4: r(), R5: r(), R6: r() };
    }
    
    if(isMeasuring) btnMeasure.click(); 
    
    challengeAnswer = generateProcedure(); 
    updateSystem();
    
    document.getElementById('challenge-feedback').innerHTML = '';
    document.getElementById('challenge-input').value = '';
}

function setupChallengeControls() {
    document.getElementById('btn-new-challenge').addEventListener('click', generateRandomChallenge);
    
    document.getElementById('btn-check-challenge').addEventListener('click', () => {
        let rawInput = document.getElementById('challenge-input').value;
        rawInput = rawInput.replace(',', '.');
        const inputVal = parseFloat(rawInput);
        const feedback = document.getElementById('challenge-feedback');
        
        if (isNaN(inputVal)) {
            feedback.innerHTML = '<span style="color:var(--accent-yellow)">Error de Sintaxis: Ingresa un parámetro numérico válido.</span>';
            return;
        }

        if (Math.abs(inputVal - challengeAnswer) <= 0.05) {
            feedback.innerHTML = '<span style="color:var(--accent-green)">✓ ¡Cálculo Analítico Correcto!</span>';
            document.querySelector('.procedure-panel').classList.remove('hidden'); 
        } else {
            feedback.innerHTML = `<span style="color:var(--accent-red)">✕ Divergencia detectada. Revisa la topología y vuelve a intentar.</span>`;
        }
    });
}

// Arranque de Sistema
window.onload = init;