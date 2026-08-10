/* ============================================================================
   DOMINO'S SYSTEM — SIMULADOR 2D: ESTACIÓN DE ARMADO
   ----------------------------------------------------------------------------
   Flujo:  Intro → Comanda → Armado (drag & drop) → Horno (QTE) →
           Resultado → [repetir hasta el límite] → Resumen de KPIs

   TODA la interfaz vive dentro del canvas: comanda, avance, procedimiento,
   mesa de ingredientes, acciones y marcadores. El HTML solo aporta el marco
   del portal. Así el texto se dibuja a resolución nativa en vez de depender
   de contenedores que lo reescalan.

   SOBRE EL ARTE
   Los ingredientes son PNG reales de recursos/texturas/ing/, cuadrados y
   de ING_PX de lado. El resto (masa, salsa untada, queso, partículas) se
   sigue generando por código en BootScene.generarTexturas().

   Para cambiar un ingrediente basta con reemplazar su PNG: el nombre del
   archivo es la key. Si alguno falta, se dibuja la ficha de respaldo y el
   juego sigue completo.

   OJO CON EL TAMAÑO: todo scale de un ingrediente va multiplicado por
   ING_K, incluido el valor final de los tweens. Un "scale: 1" suelto deja
   la pieza del tamaño del PNG (256 px) en vez de los 32 px que le tocan.

   Tamaños en pantalla: masa 300px · salsa 246px · queso 236px · pieza 32px

   MÚSICA DE FONDO
   Ver el bloque MUSICA más abajo: solo hay que escribir la ruta del archivo.
============================================================================ */

/* ---------------------------------------------------------------------------
   1. LIENZO, DISTRIBUCIÓN, PALETA Y TIPOGRAFÍA
--------------------------------------------------------------------------- */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 768;

// Rejilla de la estación. Todo lo demás se deriva de aquí.
const LAY = {
    pad: 20,
    hudH: 64,

    colW: 252,          // ancho de las columnas laterales
    filaY: 84,          // borde superior de las columnas
    filaB: 508,         // borde inferior de las columnas

    mesaY: 520,         // mesa de ingredientes
    mesaB: 748
};

LAY.izqX = LAY.pad;                                  // 20
LAY.derX = GAME_WIDTH - LAY.pad - LAY.colW;          // 1008
LAY.filaH = LAY.filaB - LAY.filaY;                   // 424
LAY.centroX = GAME_WIDTH / 2;                        // 640
LAY.centroY = LAY.filaY + LAY.filaH / 2;             // 296

// Paleta, derivada del azul institucional #002244 y el rojo #E31837.
const C = {
    night:     0x0d1b2a,
    panel:     0x16293d,
    panelSoft: 0x1e3a55,
    line:      0x2d4f72,
    red:       0xe31837,
    redDeep:   0x9e1128,
    blue:      0x2fa3e3,
    blueDeep:  0x006491,
    amber:     0xffb020,
    ember:     0xff6a1f,
    mint:      0x17c98a,
    cream:     0xf3e9d6,
    wood:      0xb0793c,
    woodDark:  0x7d5327,
    text:      0xf2f6fa,
    muted:     0x8ba5c0,

    // Tonos pensados para leerse sobre el panel #16293d. El rojo de marca
    // sirve para rellenos, pero como texto chico se pierde contra el fondo
    // oscuro: para eso está redText. Igual mutedHi releva a muted cuando el
    // texto baja de 12 px.
    redText:   0xff8fa3,
    mutedHi:   0xc2d6e8
};

const H = (key) => "#" + C[key].toString(16).padStart(6, "0");

// Tres roles tipográficos, todos con fuentes disponibles sin descargas.
/* Los ingredientes se dibujan desde PNG de 256 px. El juego venía escalando
   fichas de 32 px, así que ING_K devuelve cada sprite a ese tamaño en
   pantalla: se ve exactamente igual de grande, pero con 8 veces más
   resolución. Si algún día cambias los PNG de tamaño, ajusta ING_PX y
   todo lo demás se acomoda solo. */
const ING_PX = 256;
const ING_K  = 32 / ING_PX;

// Ingredientes con arte propio en recursos/texturas/ing/.
// El queso no lleva PNG: en la pizza es una capa, no una pieza suelta.
const SPRITES_ING = ["salsa", "pepperoni", "champinon", "pina",
                     "jamon", "aceitunas", "pimiento"];

const FONT_DISPLAY = '"Arial Black", "Haettenschweiler", Impact, sans-serif';
const FONT_BODY    = '"Trebuchet MS", Arial, sans-serif';
const FONT_TICKET  = '"Courier New", Courier, monospace';

const REDUCED_MOTION = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MOTION = REDUCED_MOTION ? 0.35 : 1;

/* ---------------------------------------------------------------------------
   1b. NITIDEZ DEL TEXTO
   Phaser dibuja cada texto en un canvas interno. Subiendo su "resolution" ese
   canvas se genera al doble o triple y se muestra al tamaño correcto, así que
   las letras no se ven suaves en pantallas HiDPI ni con Windows al 125%.
   Se parchea la fábrica una sola vez para no tocar cada llamada.
--------------------------------------------------------------------------- */

const DPR = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
const TEXT_RES = Math.min(Math.max(DPR, 2), 3);

(function nitidezDeTexto() {
    if (typeof Phaser === "undefined") return;
    const F = Phaser.GameObjects.GameObjectFactory.prototype;
    if (!F || typeof F.text !== "function" || F._resParcheada) return;
    const original = F.text;
    F.text = function (x, y, contenido, estilo) {
        const e = Object.assign({}, estilo);
        if (e.resolution === undefined) e.resolution = TEXT_RES;
        return original.call(this, x, y, contenido, e);
    };
    F._resParcheada = true;
})();

/* ---------------------------------------------------------------------------
   1c. MÚSICA DE FONDO  ← AQUÍ VA TU ARCHIVO
   ---------------------------------------------------------------------------
   1) Copia tu pista a la carpeta de audio del portal, por ejemplo:
    js/../audio/cocina-loop.mp3   →  ../../audio/cocina-loop.mp3
   2) Escribe esa ruta en `archivo`, abajo. Nada más.

   Formatos: usa .mp3 o .ogg (los dos funcionan en todos los navegadores
   modernos). Si quieres dar ambos, pon un arreglo: ["../../audio/x.ogg",
   "../../audio/x.mp3"] — Phaser toma el primero que el navegador soporte.

   La música arranca al presionar "Iniciar turno" (los navegadores exigen un
   clic antes de reproducir audio), se repite sola y el botón 🔊 del juego la
   silencia junto con los efectos. Si `archivo` queda vacío, el juego funciona
   igual y simplemente no suena música.
--------------------------------------------------------------------------- */

const MUSICA = {
    archivo: "../../recursos/audio/hitslab-jazz-restaurant-cafe-music-334836.mp3",        // ← ej. "../../audio/cocina-loop.mp3"
    volumen: 0.30,      // 0 a 1
    sonido: null,

    precargar(scene) {
        if (!MUSICA.archivo) return;
        scene.load.audio("musica_fondo", MUSICA.archivo);
    },

    iniciar(scene) {
        if (!MUSICA.archivo || MUSICA.sonido) return;
        if (!scene.cache.audio.exists("musica_fondo")) return;
        try {
            MUSICA.sonido = scene.sound.add("musica_fondo", {
                loop: true,
                volume: MUSICA.volumen
            });
            MUSICA.sonido.play();
            MUSICA.sonido.setMute(SFX.muted);
        } catch (e) {
            MUSICA.sonido = null;
        }
    },

    silenciar(valor) {
        if (MUSICA.sonido) MUSICA.sonido.setMute(valor);
    }
};

/* ---------------------------------------------------------------------------
   2. REGLAS DEL JUEGO
--------------------------------------------------------------------------- */

const INGREDIENTS = [
    { key: "salsa",     name: "Salsa",      accion: "Untar",    type: "sauce"   },
    { key: "queso",     name: "Mozzarella", accion: "Esparcir", type: "cheese"  },
    { key: "pepperoni", name: "Pepperoni",  accion: "Colocar",  type: "topping" },
    { key: "champinon", name: "Champiñón",  accion: "Colocar",  type: "topping" },
    { key: "pina",      name: "Piña",       accion: "Colocar",  type: "topping" },
    { key: "jamon",     name: "Jamón",      accion: "Colocar",  type: "topping" },
    { key: "aceitunas", name: "Aceitunas",  accion: "Colocar",  type: "topping" },
    { key: "pimiento",  name: "Pimiento",   accion: "Colocar",  type: "topping" }
];

const TOPPING_KEYS = INGREDIENTS.filter(i => i.type === "topping").map(i => i.key);
const NOMBRES = {};
INGREDIENTS.forEach(i => NOMBRES[i.key] = i.name);

const MAX_PIEZAS_POR_TOPPING = 8;
const MIN_PIEZAS_VALIDAS = 5;
const SESSION_ORDER_LIMIT = 8;

/* Horneado (QTE)
   La aguja rebota de un extremo al otro del dial y hay que detenerla dentro
   de la franja verde. Cada rebote la acelera, la franja es angosta y cambia
   de lugar en cada pedido. En paralelo corre un límite: si nadie saca la
   pizza, se quema sola. */
const HORNEADO = {
    anchoInicial: 16,
    anchoFinal: 10,
    barridoInicial: 1500,
    barridoFinal: 950,
    aceleracion: 1.05,
    velocidadTope: 1.5,
    limiteInicial: 9000,
    limiteFinal: 6000,
    nucleo: 0.34
};

function configHorneado() {
    const hechos = GameState.historialPedidos.length;
    const t = SESSION_ORDER_LIMIT > 1 ? Math.min(hechos / (SESSION_ORDER_LIMIT - 1), 1) : 0;
    const entre = (a, b) => a + (b - a) * t;

    const ancho = Math.round(entre(HORNEADO.anchoInicial, HORNEADO.anchoFinal));
    const inicio = randInt(18, 82 - ancho);
    const margen = (ancho * (1 - HORNEADO.nucleo)) / 2;

    return {
        inicio,
        fin: inicio + ancho,
        ancho,
        barridoMs: Math.round(entre(HORNEADO.barridoInicial, HORNEADO.barridoFinal)),
        limiteMs: Math.round(entre(HORNEADO.limiteInicial, HORNEADO.limiteFinal)),
        nucleoIni: inicio + margen,
        nucleoFin: inicio + ancho - margen
    };
}

const BONO_TIEMPO = [
    { hasta: 25, puntos: 60, etiqueta: "Ritmo de hora pico" },
    { hasta: 40, puntos: 30, etiqueta: "Buen ritmo" }
];

const PASOS = [
    "Leer la comanda",
    "Untar la salsa",
    "Esparcir el queso",
    "Colocar ingredientes",
    "Hornear",
    "Verificar contra comanda"
];

/* ---------------------------------------------------------------------------
   3. ESTADO DE LA SESIÓN
--------------------------------------------------------------------------- */

const GameState = {
    score: 0,
    streak: 0,
    mejorRacha: 0,
    pedidoNumero: 0,
    startTime: Date.now(),
    historialPedidos: []
};

function reiniciarSesion() {
    GameState.score = 0;
    GameState.streak = 0;
    GameState.mejorRacha = 0;
    GameState.pedidoNumero = 0;
    GameState.startTime = Date.now();
    GameState.historialPedidos = [];
}

/**
 * Reporta el turno EN CURSO al Panel de KPIs.
 *
 * Se llama al terminar cada pedido, no solo al cerrar el turno: así el
 * panel se llena desde la primera pizza y no hay que completar los ocho
 * pedidos para ver algo.
 *
 * GameState.startTime identifica al turno, y guardarSesion ACTUALIZA el
 * registro que tenga ese mismo id. Por eso reportar ocho veces deja un
 * solo turno en el historial, no ocho.
 *
 * Sin sesión iniciada no hace nada: no habría a quién atribuirle el turno.
 */
function reportarTurno() {
    if (!window.Progreso) return;

    const h = GameState.historialPedidos;
    if (!h.length) return;

    const n = h.length;
    const perfectos = h.filter(p => p.perfecto).length;
    const bake = { cruda: 0, perfecta: 0, quemada: 0 };
    h.forEach(p => { if (bake[p.bakeResult] !== undefined) bake[p.bakeResult]++; });

    const promCorrectos = h.reduce((a, p) => a + p.correctos, 0) / n;

    window.Progreso.guardarSesion(window.Progreso.MODULOS.SIM2D, {
        pedidos: n,
        puntos: GameState.score,
        perfectosPct: Math.round((perfectos / n) * 100),
        precision: Math.round((promCorrectos / TOPPING_KEYS.length) * 100),
        tiempoProm: +(h.reduce((a, p) => a + p.segundos, 0) / n).toFixed(1),
        mejorRacha: GameState.mejorRacha,
        estrellas: +(h.reduce((a, p) => a + p.estrellas, 0) / n).toFixed(2),
        coccion: bake
    }, GameState.startTime);
}

function tiempoSesion() {
    const s = Math.floor((Date.now() - GameState.startTime) / 1000);
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/* ---------------------------------------------------------------------------
   4. SONIDO SINTETIZADO (efectos, sin archivos)
--------------------------------------------------------------------------- */

const SFX = {
    ctx: null,
    muted: false,

    ensure() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
    },

    tone(freq, dur = 0.08, type = "square", vol = 0.05) {
        if (this.muted) return;
        this.ensure();
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") this.ctx.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
    },

    click()  { this.tone(520, 0.05, "square", 0.04); },
    place()  { this.tone(340 + Math.random() * 120, 0.07, "triangle", 0.05); },
    spread() { this.tone(180, 0.22, "sawtooth", 0.035); },
    denied() { this.tone(120, 0.14, "sawtooth", 0.05); },
    rebote() { this.tone(210, 0.03, "square", 0.022); },
    oven()   { this.tone(90, 0.4, "sawtooth", 0.045); },

    win() {
        [523, 659, 784, 1047].forEach((f, i) =>
            setTimeout(() => this.tone(f, 0.14, "triangle", 0.05), i * 85));
    },

    fail() {
        [330, 262, 196].forEach((f, i) =>
            setTimeout(() => this.tone(f, 0.16, "sawtooth", 0.05), i * 110));
    }
};

/* ---------------------------------------------------------------------------
   5. UTILIDADES
--------------------------------------------------------------------------- */

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomSubset(arr, count) {
    const copy = arr.slice();
    const out = [];
    while (out.length < count && copy.length) out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
    return out;
}

function generarPedidoAleatorio() {
    // La dificultad sube conforme avanza el turno: más ingredientes al final.
    const avance = GameState.pedidoNumero / SESSION_ORDER_LIMIT;
    const min = avance > 0.6 ? 3 : 2;
    const max = avance > 0.3 ? 4 : 3;
    return {
        sauce: true,
        cheese: Math.random() > 0.12,
        toppings: pickRandomSubset(TOPPING_KEYS, randInt(min, max))
    };
}

// Interpolación manual de color, sin depender de APIs que cambian de versión.
function lerpColor(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return ((ar + (br - ar) * t) << 16 | (ag + (bg - ag) * t) << 8 | (ab + (bb - ab) * t)) & 0xffffff;
}

function puntosEstrella(cx, cy, rOut, rIn, picos = 5) {
    const pts = [];
    for (let i = 0; i < picos * 2; i++) {
        const a = (Math.PI / picos) * i - Math.PI / 2;
        const r = i % 2 ? rIn : rOut;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
}

/* ---------------------------------------------------------------------------
   6. UI — piezas compartidas por todas las escenas
--------------------------------------------------------------------------- */

const UI = {

    fondo(scene) {
        scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, C.night);
        scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vineta").setAlpha(0.55);
    },

    panel(scene, x, y, w, h, opts = {}) {
        const g = scene.add.graphics();
        g.fillStyle(opts.fill !== undefined ? opts.fill : C.panel, opts.alpha !== undefined ? opts.alpha : 1);
        g.fillRoundedRect(x, y, w, h, opts.radio || 14);
        g.lineStyle(1.5, opts.borde !== undefined ? opts.borde : C.line, 1);
        g.strokeRoundedRect(x, y, w, h, opts.radio || 14);
        return g;
    },

    eyebrow(scene, x, y, texto, color = "muted") {
        return scene.add.text(x, y, texto.toUpperCase(), {
            fontFamily: FONT_BODY, fontSize: "11px", fontStyle: "bold",
            color: H(color), letterSpacing: 3
        });
    },

    boton(scene, x, y, w, h, label, onClick, opts = {}) {
        const tono = opts.tono || "red";
        const relleno = { red: C.red, blue: C.blueDeep, ghost: C.panelSoft }[tono];
        const bordeCol = { red: C.redDeep, blue: C.blue, ghost: C.line }[tono];

        const cont = scene.add.container(x, y);

        const g = scene.add.graphics();
        g.fillStyle(relleno, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
        g.lineStyle(1.5, bordeCol, 1);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

        const txt = scene.add.text(0, 0, label, {
            fontFamily: FONT_BODY, fontSize: (opts.size || 14) + "px", fontStyle: "bold",
            color: tono === "ghost" ? H("text") : "#ffffff"
        }).setOrigin(0.5);

        const hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });

        cont.add([g, txt, hit]);
        cont.setSize(w, h);
        cont.enabled = true;

        cont.setEnabled = (on) => {
            cont.enabled = on;
            cont.setAlpha(on ? 1 : 0.35);
            hit.input.enabled = on;
            return cont;
        };
        cont.setLabel = (t) => { txt.setText(t); return cont; };

        hit.on("pointerover", () => { if (cont.enabled) scene.tweens.add({ targets: cont, scale: 1.04, duration: 110 * MOTION }); });
        hit.on("pointerout",  () => scene.tweens.add({ targets: cont, scale: 1, duration: 110 * MOTION }));
        hit.on("pointerdown", () => {
            if (!cont.enabled) { SFX.denied(); return; }
            SFX.click();
            scene.tweens.add({ targets: cont, scale: 0.95, duration: 60 * MOTION, yoyo: true });
            onClick();
        });

        return cont;
    },

    /** Barra superior: identidad, pedido, puntos, racha, tiempo y audio. */
    hud(scene, subtitulo) {
        const h = LAY.hudH;

        const g = scene.add.graphics();
        g.fillStyle(C.panel, 1);
        g.fillRect(0, 0, GAME_WIDTH, h);
        g.lineStyle(2, C.red, 1);
        g.beginPath(); g.moveTo(0, h); g.lineTo(GAME_WIDTH, h); g.strokePath();

        scene.add.text(LAY.pad, 14, "ESTACIÓN DE ARMADO", {
            fontFamily: FONT_DISPLAY, fontSize: "18px", color: H("text"), letterSpacing: 1
        });
        scene.add.text(LAY.pad + 1, 38, subtitulo, {
            fontFamily: FONT_BODY, fontSize: "12px", color: H("muted")
        });

        const hechos = GameState.historialPedidos.length;
        const cols = [
            { et: "Pedido", val: `${Math.min(hechos + 1, SESSION_ORDER_LIMIT)}/${SESSION_ORDER_LIMIT}`, color: "text" },
            { et: "Puntos", val: String(GameState.score), color: "amber" },
            { et: "Racha",  val: String(GameState.streak), color: "mint" },
            { et: "Tiempo", val: tiempoSesion(), color: "text", reloj: true }
        ];

        const anchoCol = 104;
        const derecha = GAME_WIDTH - 68;                     // hueco del botón de audio
        const primera = derecha - cols.length * anchoCol;

        cols.forEach((c, i) => {
            const cx = primera + i * anchoCol + anchoCol / 2;
            scene.add.text(cx, 14, c.et.toUpperCase(), {
                fontFamily: FONT_BODY, fontSize: "10px", fontStyle: "bold",
                color: H("muted"), letterSpacing: 1
            }).setOrigin(0.5, 0);

            const valor = scene.add.text(cx, 29, c.val, {
                fontFamily: FONT_DISPLAY, fontSize: "20px", color: H(c.color)
            }).setOrigin(0.5, 0);

            if (c.reloj) {
                scene.time.addEvent({
                    delay: 500, loop: true,
                    callback: () => valor.setText(tiempoSesion())
                });
            }
        });

        const sg = scene.add.graphics();
        sg.lineStyle(1, C.line, 0.9);
        for (let i = 1; i < cols.length; i++) {
            const lx = primera + i * anchoCol;
            sg.beginPath(); sg.moveTo(lx, 16); sg.lineTo(lx, h - 16); sg.strokePath();
        }

        // Avance del turno pegado al borde inferior del HUD.
        const pg = scene.add.graphics();
        pg.fillStyle(C.line, 1);
        pg.fillRect(0, h - 4, GAME_WIDTH, 3);
        pg.fillStyle(C.mint, 1);
        pg.fillRect(0, h - 4, GAME_WIDTH * (hechos / SESSION_ORDER_LIMIT), 3);

        const mute = scene.add.text(GAME_WIDTH - 34, 22, SFX.muted ? "🔇" : "🔊", {
            fontFamily: FONT_BODY, fontSize: "18px", color: H("muted")
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

        mute.on("pointerdown", () => {
            SFX.muted = !SFX.muted;
            MUSICA.silenciar(SFX.muted);
            mute.setText(SFX.muted ? "🔇" : "🔊");
            if (!SFX.muted) SFX.click();
        });

        return h;
    },

    /**
     * Columna derecha: en qué paso del procedimiento va el turno.
     * La numeración es real (el orden importa), por eso lleva número.
     */
    procedimiento(scene, activo) {
        const x = LAY.derX, y = LAY.filaY, w = LAY.colW, h = LAY.filaH;
        UI.panel(scene, x, y, w, h);

        scene.add.text(x + 18, y + 18, "PROCEDIMIENTO", {
            fontFamily: FONT_BODY, fontSize: "11px", fontStyle: "bold",
            color: H("blue"), letterSpacing: 3
        });

        const filaH = 52, gap = 8;
        const sy = y + 48;

        PASOS.forEach((paso, i) => {
            const fy = sy + i * (filaH + gap);
            const hecho = i < activo;
            const activa = i === activo;

            const g = scene.add.graphics();
            g.fillStyle(activa ? C.panelSoft : C.panel, activa ? 1 : 0.5);
            g.fillRoundedRect(x + 12, fy, w - 24, filaH, 10);
            g.lineStyle(activa ? 2 : 1, activa ? C.blue : (hecho ? C.mint : C.line), activa ? 1 : 0.7);
            g.strokeRoundedRect(x + 12, fy, w - 24, filaH, 10);

            // Ficha con el número, o palomita si el paso ya se cumplió.
            const cg = scene.add.graphics();
            cg.fillStyle(activa ? C.blue : (hecho ? C.mint : C.line), 1);
            cg.fillRoundedRect(x + 24, fy + filaH / 2 - 12, 24, 24, 7);

            scene.add.text(x + 36, fy + filaH / 2, hecho ? "✓" : String(i + 1), {
                fontFamily: FONT_BODY, fontSize: "12px", fontStyle: "bold", color: "#ffffff"
            }).setOrigin(0.5);

            scene.add.text(x + 58, fy + filaH / 2, paso, {
                fontFamily: FONT_BODY, fontSize: "13px",
                fontStyle: activa ? "bold" : "normal",
                color: activa ? H("text") : (hecho ? H("mint") : H("muted")),
                wordWrap: { width: w - 82 }
            }).setOrigin(0, 0.5);
        });
    },

    titulo(scene, x, y, eyebrow, titulo, align = 0, size = 30) {
        scene.add.text(x, y, eyebrow.toUpperCase(), {
            fontFamily: FONT_BODY, fontSize: "12px", fontStyle: "bold",
            color: H("red"), letterSpacing: 3
        }).setOrigin(align, 0);
        scene.add.text(x, y + 18, titulo, {
            fontFamily: FONT_DISPLAY, fontSize: size + "px", color: H("text")
        }).setOrigin(align, 0);
    },

    estrellas(scene, x, y, ganadas, escala = 1) {
        for (let i = 0; i < 3; i++) {
            const s = scene.add.image(x + (i - 1) * 40 * escala, y, "estrella")
                .setScale(escala)
                .setTint(i < ganadas ? C.amber : C.line)
                .setAlpha(i < ganadas ? 1 : 0.5);
            if (i < ganadas) {
                s.setScale(escala * 2.2).setAlpha(0);
                scene.tweens.add({
                    targets: s, scale: escala, alpha: 1,
                    duration: 320 * MOTION, delay: (200 + i * 130) * MOTION,
                    ease: "Back.out"
                });
            }
        }
    },

    irA(scene, key, data) {
        if (scene._saliendo) return;
        scene._saliendo = true;
        scene.cameras.main.fadeOut(180 * MOTION, 8, 16, 26);
        scene.cameras.main.once("camerafadeoutcomplete", () => scene.scene.start(key, data));
    },

    entrar(scene) {
        // Phaser reutiliza la instancia de escena en cada visita, así que la
        // bandera de transición tiene que limpiarse aquí.
        scene._saliendo = false;
        scene.cameras.main.fadeIn(200 * MOTION, 8, 16, 26);
    }
};

/* ---------------------------------------------------------------------------
   7. BOOT — generación de las texturas temporales
--------------------------------------------------------------------------- */

class BootScene extends Phaser.Scene {

    constructor() { super("BootScene"); }

    preload() {
        MUSICA.precargar(this);

        /* Arte real de los ingredientes. Cada PNG es UNA pieza suelta y
           cuadrada de 256 px: en la pizza se colocan cinco o más veces, y
           un racimo repetido se notaría de inmediato.

           Los nombres van sin acentos a propósito. Los originales traían
           'ñ', y ese carácter en una URL falla en varios servidores.

           Si algún archivo no está, BootScene dibuja la ficha de siempre
           en su lugar: el juego nunca se queda sin ingrediente. */
        SPRITES_ING.forEach(key => {
            this.load.image("ing_" + key, `../../recursos/texturas/ing/${key}.png`);
        });

        // Pizza de la pantalla de inicio. Si falta, la intro arma la suya
        // con las capas de siempre.
        this.load.image("pizza_intro", "../../recursos/texturas/pizza-intro.png");
    }

    create() {
        this.generarTexturas();
        this.scene.start("IntroScene");
    }

    generarTexturas() {
        const g = this.make.graphics({ add: false });

        /* ---- Viñeta de ambiente ---- */
        g.clear();
        for (let i = 0; i < 30; i++) {
            g.fillStyle(0x000000, 0.026);
            g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 900 - i * 28);
        }
        g.generateTexture("vineta", GAME_WIDTH, GAME_HEIGHT);

        /* ---- Sombra suave ---- */
        g.clear();
        for (let i = 0; i < 16; i++) {
            g.fillStyle(0x000000, 0.05);
            g.fillEllipse(200, 44, 360 - i * 17, 74 - i * 3.8);
        }
        g.generateTexture("sombra_suave", 400, 88);

        /* ---- Tabla de madera ---- */
        g.clear();
        g.fillStyle(C.woodDark, 1);
        g.fillRoundedRect(0, 0, 400, 400, 26);
        g.fillStyle(C.wood, 1);
        g.fillRoundedRect(6, 6, 388, 388, 24);
        g.lineStyle(2, C.woodDark, 0.26);
        for (let i = 1; i < 13; i++) {
            g.beginPath();
            g.moveTo(12, i * 31);
            g.lineTo(388, i * 31 + (i % 2 ? 6 : -6));
            g.strokePath();
        }
        g.generateTexture("tabla", 400, 400);

        /* ---- Masa ---- */
        g.clear();
        g.fillStyle(0x9a6b2c, 1); g.fillCircle(150, 150, 150);
        g.fillStyle(C.wood, 1);    g.fillCircle(150, 150, 145);
        g.fillStyle(0xd8a45e, 0.7);
        for (let i = 0; i < 32; i++) {
            const a = (Math.PI * 2 / 32) * i;
            g.fillCircle(150 + Math.cos(a) * 136, 150 + Math.sin(a) * 136, randInt(5, 9));
        }
        g.generateTexture("masa_corteza", 300, 300);

        g.clear();
        g.fillStyle(0xecc98f, 1); g.fillCircle(128, 128, 128);
        g.fillStyle(0xf2d5a3, 0.6); g.fillCircle(128, 128, 116);
        g.generateTexture("masa_base", 256, 256);

        /* ---- Salsa y espiral de untado ---- */
        g.clear();
        g.fillStyle(0x8f2a19, 1); g.fillCircle(123, 123, 123);
        g.fillStyle(0xb33a24, 1); g.fillCircle(123, 123, 118);
        g.fillStyle(0xc4462c, 0.5);
        for (let i = 0; i < 22; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 100;
            g.fillCircle(123 + Math.cos(a) * r, 123 + Math.sin(a) * r, randInt(7, 16));
        }
        g.generateTexture("salsa", 246, 246);

        g.clear();
        g.lineStyle(9, 0xd8512f, 0.55);
        g.beginPath();
        for (let t = 0; t < Math.PI * 6; t += 0.12) {
            const r = 8 + (t / (Math.PI * 6)) * 104;
            const x = 123 + Math.cos(t) * r, y = 123 + Math.sin(t) * r;
            if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokePath();
        g.generateTexture("salsa_espiral", 246, 246);

        /* ---- Queso ---- */
        g.clear();
        g.fillStyle(0xf7e6b4, 0.92); g.fillCircle(118, 118, 118);
        g.fillStyle(0xfff3cc, 0.55);
        for (let i = 0; i < 26; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 104;
            g.fillCircle(118 + Math.cos(a) * r, 118 + Math.sin(a) * r, randInt(6, 15));
        }
        g.fillStyle(0xe0b95f, 0.35);
        for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 100;
            g.fillCircle(118 + Math.cos(a) * r, 118 + Math.sin(a) * r, randInt(4, 8));
        }
        g.generateTexture("queso", 236, 236);

        /* ---- Toppings ----
           Estas fichas son la RED DE SEGURIDAD. Si el PNG del ingrediente
           cargó, no se dibuja nada y se usa el arte real; si faltó, se
           genera la ficha de siempre para que el juego siga completo.
           El lienzo es de ING_PX para que ambos caminos midan igual. */
        const escalaFicha = ING_PX / 32;
        const ficha = (key, dibujo) => {
            if (this.textures.exists("ing_" + key)) return;   // ya hay arte real
            console.info(`[simulador] sin PNG de "${key}": se usa la ficha dibujada.`);
            g.clear();
            // scaleCanvas es la transformación del lienzo de dibujo.
            // (Graphics.scale es una propiedad del objeto, no un método:
            //  llamarla como función truena.)
            g.save();
            g.scaleCanvas(escalaFicha, escalaFicha);
            g.fillStyle(0x000000, 0.18); g.fillCircle(17, 18, 14);
            dibujo();
            g.restore();
            g.generateTexture("ing_" + key, ING_PX, ING_PX);
        };

        ficha("pepperoni", () => {
            g.fillStyle(0x7d1f22, 1); g.fillCircle(16, 16, 14);
            g.fillStyle(0xb8352f, 1); g.fillCircle(16, 16, 12);
            g.fillStyle(0x8c2320, 1);
            g.fillCircle(11, 12, 2.4); g.fillCircle(20, 13, 1.8);
            g.fillCircle(14, 21, 2.0); g.fillCircle(21, 20, 1.5);
            g.fillStyle(0xd4574c, 0.5); g.fillCircle(12, 11, 4);
        });

        ficha("champinon", () => {
            g.fillStyle(0xd8c39a, 1); g.fillRoundedRect(12, 14, 8, 13, 3);
            g.fillStyle(0xe9d9b8, 1); g.fillEllipse(16, 13, 26, 17);
            g.fillStyle(0xc3a874, 1); g.fillEllipse(16, 18, 20, 7);
            g.fillStyle(0xf5ead2, 0.6); g.fillEllipse(13, 10, 10, 6);
        });

        ficha("pina", () => {
            g.fillStyle(0xd9a800, 1);
            g.fillPoints([{ x: 16, y: 3 }, { x: 29, y: 16 }, { x: 16, y: 29 }, { x: 3, y: 16 }], true);
            g.fillStyle(0xf6d63f, 1);
            g.fillPoints([{ x: 16, y: 5 }, { x: 27, y: 16 }, { x: 16, y: 27 }, { x: 5, y: 16 }], true);
            g.lineStyle(1.4, 0xc79300, 0.8);
            g.beginPath(); g.moveTo(9, 16); g.lineTo(23, 16); g.strokePath();
            g.beginPath(); g.moveTo(16, 9); g.lineTo(16, 23); g.strokePath();
        });

        ficha("jamon", () => {
            g.fillStyle(0xc9767f, 1); g.fillRoundedRect(3, 8, 26, 17, 6);
            g.fillStyle(0xeba4ab, 1); g.fillRoundedRect(4, 9, 24, 14, 5);
            g.fillStyle(0xf6c7cc, 0.7); g.fillRoundedRect(7, 11, 11, 4, 2);
        });

        ficha("aceitunas", () => {
            g.fillStyle(0x2a2a2a, 1); g.fillCircle(16, 16, 13);
            g.fillStyle(0x111111, 1); g.fillCircle(16, 16, 11);
            g.fillStyle(0x1b3a2a, 1); g.fillCircle(16, 16, 5);
            g.fillStyle(0x4a4a4a, 0.75); g.fillEllipse(12, 11, 8, 5);
        });

        ficha("pimiento", () => {
            g.fillStyle(0x1d7a45, 1); g.fillCircle(16, 16, 13);
            g.fillStyle(0x2fbc68, 1); g.fillCircle(16, 16, 11);
            g.fillStyle(0x0f2a1a, 1); g.fillCircle(16, 16, 5.5);
            g.fillStyle(0x7ee29f, 0.6); g.fillEllipse(12, 11, 8, 5);
        });

        /* ---- Iconos de los botes de capa ----
           La salsa ya viene como PNG (el bote de la mesa). El queso se
           sigue dibujando: en la pizza es una capa esparcida, no una pieza,
           así que un sprite suelto no le aportaría nada. */
        ficha("salsa", () => {
            g.fillStyle(0x8f2a19, 1); g.fillCircle(16, 16, 14);
            g.fillStyle(0xb33a24, 1); g.fillCircle(16, 16, 12);
            g.lineStyle(2.2, 0xd8512f, 0.9);
            g.beginPath();
            for (let t = 0; t < Math.PI * 3.4; t += 0.2) {
                const r = 2 + (t / (Math.PI * 3.4)) * 9;
                const x = 16 + Math.cos(t) * r, y = 16 + Math.sin(t) * r;
                if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            g.strokePath();
        });

        ficha("queso", () => {
            g.fillStyle(0xe0b95f, 1); g.fillCircle(16, 16, 14);
            g.fillStyle(0xf7e6b4, 1); g.fillCircle(16, 16, 12);
            g.fillStyle(0xe8cd86, 1);
            g.fillCircle(12, 13, 3); g.fillCircle(20, 15, 2.4); g.fillCircle(15, 21, 2.6);
        });

        /* ---- Partículas ---- */
        g.clear(); g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 8, 8);
        g.generateTexture("chispa", 8, 8);

        g.clear();
        for (let i = 0; i < 8; i++) { g.fillStyle(0xffffff, 0.09); g.fillCircle(16, 16, 16 - i * 1.7); }
        g.generateTexture("vapor", 32, 32);

        g.clear();
        g.fillStyle(C.ember, 0.85);
        g.fillPoints([{ x: 20, y: 0 }, { x: 34, y: 26 }, { x: 20, y: 52 }, { x: 6, y: 26 }], true);
        g.fillStyle(C.amber, 0.9);
        g.fillPoints([{ x: 20, y: 12 }, { x: 28, y: 30 }, { x: 20, y: 46 }, { x: 12, y: 30 }], true);
        g.generateTexture("flama", 40, 52);

        /* ---- Estrella ---- */
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillPoints(puntosEstrella(18, 19, 17, 7.4), true);
        g.generateTexture("estrella", 36, 38);

        /* ---- Pala ---- */
        g.clear();
        g.fillStyle(0x6d4520, 1); g.fillRoundedRect(52, 20, 96, 9, 4);
        g.fillStyle(0xb9bfc7, 1); g.fillEllipse(30, 24, 58, 34);
        g.fillStyle(0xd6dbe1, 1); g.fillEllipse(30, 22, 50, 27);
        g.generateTexture("ut_pala", 156, 48);

        g.destroy();
    }
}

/* ---------------------------------------------------------------------------
   8. INTRO — arranque del turno
--------------------------------------------------------------------------- */

class IntroScene extends Phaser.Scene {

    constructor() { super("IntroScene"); }

    create() {
        UI.fondo(this);
        UI.entrar(this);

        const cx = GAME_WIDTH / 2, cy = 400;

        this.add.image(cx, cy + 168, "sombra_suave").setAlpha(0.55);

        const pizza = this.add.container(cx, cy);

        if (this.textures.exists("pizza_intro")) {
            // Una sola imagen: es la portada del módulo, no la pizza que se
            // arma. Esa se sigue construyendo por capas en la estación.
            pizza.add(this.add.image(0, 0, "pizza_intro"));
        } else {
            // Respaldo: si la imagen no cargó, se arma con las capas.
            pizza.add(this.add.image(0, 0, "masa_corteza"));
            pizza.add(this.add.image(0, 0, "masa_base"));
            pizza.add(this.add.image(0, 0, "salsa"));
            pizza.add(this.add.image(0, 0, "queso"));
            ["pepperoni", "champinon", "aceitunas", "pimiento"].forEach(k => {
                for (let i = 0; i < 5; i++) {
                    const a = Math.random() * Math.PI * 2, r = Math.random() * 100;
                    pizza.add(this.add.image(Math.cos(a) * r, Math.sin(a) * r, "ing_" + k)
                        .setAngle(randInt(0, 359)).setScale(ING_K));
                }
            });
        }

        pizza.setScale(0.5).setAlpha(0);
        this.tweens.add({ targets: pizza, scale: 0.92, alpha: 1, duration: 640 * MOTION, ease: "Back.out" });
        if (!REDUCED_MOTION) {
            this.tweens.add({ targets: pizza, angle: 360, duration: 36000, repeat: -1 });
            this.tweens.add({ targets: pizza, y: cy - 10, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        }

        this.add.text(cx, 92, "TURNO DE PRÁCTICA", {
            fontFamily: FONT_BODY, fontSize: "13px", fontStyle: "bold",
            color: H("red"), letterSpacing: 5
        }).setOrigin(0.5);

        this.add.text(cx, 136, "ESTACIÓN DE ARMADO", {
            fontFamily: FONT_DISPLAY, fontSize: "54px", color: H("text")
        }).setOrigin(0.5);

        this.add.text(cx, 190,
            `${SESSION_ORDER_LIMIT} pedidos. Lee la comanda, arma la pizza, sácala del horno en su punto.`, {
            fontFamily: FONT_BODY, fontSize: "16px", color: H("muted"), align: "center"
        }).setOrigin(0.5);

        // Controles: arrastrar es la mecánica central, por eso va primero.
        const tips = [
            "Arrastra los ingredientes a la pizza",
            "Teclas 1-8 para servir rápido",
            "Espacio hornea y saca la pizza"
        ];
        tips.forEach((t, i) => {
            this.add.text(cx, 600 + i * 22, t, {
                fontFamily: FONT_TICKET, fontSize: "13px", color: H("muted")
            }).setOrigin(0.5);
        });

        const arrancar = () => {
            SFX.ensure();
            MUSICA.iniciar(this);       // el clic habilita el audio del navegador
            reiniciarSesion();
            UI.irA(this, "OrderScene");
        };

        UI.boton(this, cx, 706, 300, 58, "Iniciar turno", arrancar, { tono: "red", size: 17 });
        this.input.keyboard.on("keydown-SPACE", arrancar);
    }
}

/* ---------------------------------------------------------------------------
   9. COMANDA — el ticket del pedido
--------------------------------------------------------------------------- */

class OrderScene extends Phaser.Scene {

    constructor() { super("OrderScene"); }

    create() {
        if (GameState.historialPedidos.length >= SESSION_ORDER_LIMIT) {
            this.scene.start("SummaryScene");
            return;
        }

        UI.fondo(this);
        UI.entrar(this);

        GameState.pedidoNumero += 1;
        const order = generarPedidoAleatorio();
        this.registry.set("currentOrder", order);

        const top = UI.hud(this, "Comanda recibida");
        UI.procedimiento(this, 0);

        const cx = LAY.centroX;

        UI.titulo(this, cx, top + 28, "Pedido entrante", "LEE LA COMANDA", 0.5, 34);

        /* ---- Ticket de impresora ---- */
        const tW = 340, tH = 356, tX = cx - tW / 2, tY = top + 106;

        const paper = this.add.graphics();
        paper.fillStyle(C.cream, 1);
        paper.fillRoundedRect(tX, tY, tW, tH, 4);
        paper.fillStyle(C.night, 1);
        for (let x = tX; x < tX + tW; x += 12) paper.fillCircle(x + 6, tY + tH, 6);

        const grupo = this.add.container(0, 0);

        const linea = (y, txt, opts = {}) => {
            const t = this.add.text(opts.centro ? cx : tX + 26, tY + y, txt, {
                fontFamily: FONT_TICKET,
                fontSize: (opts.size || 15) + "px",
                fontStyle: opts.bold ? "bold" : "normal",
                color: opts.color || "#2b2118"
            }).setOrigin(opts.centro ? 0.5 : 0, 0);
            grupo.add(t);
            return t;
        };

        linea(22, "DOMINO'S · CAPACITACIÓN", { centro: true, size: 12, bold: true, color: "#8a7359" });
        linea(44, `TICKET ${String(GameState.pedidoNumero).padStart(3, "0")}`, { centro: true, size: 24, bold: true });

        const sep = this.add.text(cx, tY + 82, "- ".repeat(23), {
            fontFamily: FONT_TICKET, fontSize: "13px", color: "#b3a288"
        }).setOrigin(0.5, 0);
        grupo.add(sep);

        linea(108, "1x PIZZA MEDIANA", { bold: true, size: 17 });

        let y = 142;
        const filas = [];
        if (order.sauce)  filas.push("salsa");
        if (order.cheese) filas.push("queso");
        order.toppings.forEach(k => filas.push(k));

        filas.forEach((k, i) => {
            const t = linea(y, `  + ${NOMBRES[k]}`, { size: 16 });
            t.setAlpha(0);
            this.tweens.add({ targets: t, alpha: 1, x: t.x + 8, duration: 220 * MOTION,
                delay: (260 + i * 90) * MOTION });
            y += 28;
        });

        linea(tH - 48, `SIN: ${TOPPING_KEYS.filter(k => !order.toppings.includes(k)).length} ingredientes`, {
            centro: true, size: 12, color: "#8a7359"
        });

        // El ticket "sale de la impresora".
        const stack = this.add.container(0, 0, [paper, grupo]);
        stack.setY(-48).setAlpha(0);
        this.tweens.add({ targets: stack, y: 0, alpha: 1, duration: 420 * MOTION, ease: "Cubic.out" });
        SFX.spread();

        const ir = () => UI.irA(this, "AssemblyScene");
        UI.boton(this, cx, tY + tH + 62, 300, 58, "Empezar a armar", ir, { tono: "red", size: 17 });
        this.input.keyboard.on("keydown-SPACE", ir);
    }
}

/* ---------------------------------------------------------------------------
   10. ARMADO — drag & drop sobre la pizza
--------------------------------------------------------------------------- */

class AssemblyScene extends Phaser.Scene {

    constructor() { super("AssemblyScene"); }

    create() {
        UI.fondo(this);
        UI.entrar(this);

        this.order = this.registry.get("currentOrder");
        this.pizzaState = { sauce: false, cheese: false, toppings: {} };
        TOPPING_KEYS.forEach(k => this.pizzaState.toppings[k] = 0);
        this.historial = [];
        this.arrastre = null;
        this.tiempoArmado = 0;
        this.pasoActual = 1;

        UI.hud(this, "Arma según la comanda");
        UI.procedimiento(this, 1);

        /* ---- Tabla y pizza al centro ---- */
        this.px = LAY.centroX;
        this.py = LAY.centroY;
        this.radioPizza = 150;

        this.add.image(this.px, this.py, "tabla").setScale(0.98);
        this.add.image(this.px, this.py + 158, "sombra_suave").setAlpha(0.4);

        this.pizza = this.add.container(this.px, this.py);
        this.pizza.add(this.add.image(0, 0, "masa_corteza"));
        this.pizza.add(this.add.image(0, 0, "masa_base"));

        this.guia = this.add.graphics();
        this.dibujarGuia(false);

        this.imgSalsa = null;
        this.imgQueso = null;

        this.crearColumnaIzquierda();
        this.crearMesa();
        this.registrarEntrada();

        this.refrescarUI();
    }

    /* ---------- Columna izquierda: comanda viva + avance ---------- */

    crearColumnaIzquierda() {
        const x = LAY.izqX, y = LAY.filaY, w = LAY.colW, h = LAY.filaH;
        UI.panel(this, x, y, w, h);

        this.add.text(x + 18, y + 18, "COMANDA", {
            fontFamily: FONT_BODY, fontSize: "11px", fontStyle: "bold",
            color: H("red"), letterSpacing: 3
        });

        this.add.text(x + 18, y + 32, `Ticket ${String(GameState.pedidoNumero).padStart(3, "0")}`, {
            fontFamily: FONT_DISPLAY, fontSize: "22px", color: H("text")
        });

        this.requeridos = [];
        if (this.order.sauce)  this.requeridos.push("salsa");
        if (this.order.cheese) this.requeridos.push("queso");
        this.order.toppings.forEach(k => this.requeridos.push(k));

        this.filasRiel = {};
        let fy = y + 76;

        this.requeridos.forEach(key => {
            const marca = this.add.text(x + 22, fy, "○", {
                fontFamily: FONT_BODY, fontSize: "16px", color: H("muted")
            }).setOrigin(0, 0.5);

            const nombre = this.add.text(x + 48, fy, NOMBRES[key], {
                fontFamily: FONT_TICKET, fontSize: "15px", color: H("text")
            }).setOrigin(0, 0.5);

            const tachado = this.add.graphics();
            this.filasRiel[key] = { marca, nombre, tachado, y: fy, x: x + 48 };
            fy += 26;
        });

        /* Aviso de ingredientes fuera de la comanda.
           Iba en el rojo de marca a 12 px sobre panel oscuro y casi no se
           veía. Ahora usa el rojo claro, sube a 13 px y va en negritas: es
           una corrección que el empleado tiene que alcanzar a leer. */
        this.avisoExtra = this.add.text(x + 18, y + 226, "", {
            fontFamily: FONT_BODY, fontSize: "13px", fontStyle: "bold",
            color: H("redText"), wordWrap: { width: w - 36 }
        });

        // Separador entre comanda y avance.
        const sep = this.add.graphics();
        sep.lineStyle(1, C.line, 0.8);
        sep.beginPath();
        sep.moveTo(x + 18, y + 262);
        sep.lineTo(x + w - 18, y + 262);
        sep.strokePath();

        this.add.text(x + 18, y + 272, "AVANCE", {
            fontFamily: FONT_BODY, fontSize: "11px", fontStyle: "bold",
            color: H("blue"), letterSpacing: 3
        });

        // El cronómetro comparte renglón con el rótulo: gana el espacio que
        // necesita el anillo, y las dos medidas quedan a la misma altura.
        this.cronoTxt = this.add.text(x + w - 18, y + 271, "0.0 s", {
            fontFamily: FONT_TICKET, fontSize: "13px", color: H("muted")
        }).setOrigin(1, 0);

        /* ---- Anillo de coincidencia.
           Aro ancho, trazo delgado y número más chico: el porcentaje necesita
           aire dentro del aro, si no queda pegado al trazo y no se lee. ---- */
        this.anilloX = x + w / 2;
        this.anilloY = y + 342;
        this.anilloR = 52;
        this.anilloGrosor = 9;

        this.anillo = this.add.graphics();

        this.anilloTxt = this.add.text(this.anilloX, this.anilloY, "0%", {
            fontFamily: FONT_DISPLAY, fontSize: "28px", color: H("text")
        }).setOrigin(0.5);

        this.add.text(this.anilloX, this.anilloY + this.anilloR + 12, "COINCIDENCIA", {
            fontFamily: FONT_BODY, fontSize: "10px", fontStyle: "bold",
            color: H("muted"), letterSpacing: 2
        }).setOrigin(0.5, 0);
    }

    /* ---------- Mesa de ingredientes + acciones ---------- */

    crearMesa() {
        const x = LAY.pad, y = LAY.mesaY, w = GAME_WIDTH - LAY.pad * 2, h = LAY.mesaB - LAY.mesaY;
        UI.panel(this, x, y, w, h, { fill: C.panelSoft, alpha: 0.5, borde: C.line });

        this.add.text(x + 20, y + 14, "MESA DE INGREDIENTES", {
            fontFamily: FONT_BODY, fontSize: "10px", fontStyle: "bold",
            color: H("muted"), letterSpacing: 3
        });

        const cols = 4, bw = 214, bh = 88, gx = 14, gy = 12;
        const sx = x + 16;
        const sy = y + 34;

        this.botes = {};

        INGREDIENTS.forEach((ing, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const bx = sx + col * (bw + gx) + bw / 2;
            const by = sy + row * (bh + gy) + bh / 2;
            this.botes[ing.key] = this.crearBote(ing, bx, by, bw, bh, i + 1);
        });

        /* ---- Acciones, a la derecha de la mesa ---- */
        const ax = sx + cols * (bw + gx) + 8;   // inicio de la columna de acciones
        const aw = GAME_WIDTH - LAY.pad - 16 - ax;
        const acx = ax + aw / 2;

        const divisor = this.add.graphics();
        divisor.lineStyle(1, C.line, 0.7);
        divisor.beginPath();
        divisor.moveTo(ax - 8, y + 34);
        divisor.lineTo(ax - 8, y + h - 20);
        divisor.strokePath();

        this.btnUndo = UI.boton(this, acx - aw / 4 - 4, sy + 40, aw / 2 - 10, 46, "Deshacer",
            () => this.deshacer(), { tono: "ghost", size: 13 });

        this.btnReset = UI.boton(this, acx + aw / 4 + 4, sy + 40, aw / 2 - 10, 46, "Vaciar",
            () => this.reiniciar(), { tono: "ghost", size: 13 });

        this.btnHorno = UI.boton(this, acx, sy + 128, aw - 12, 62, "Al horno",
            () => this.alHorno(), { tono: "red", size: 17 });
    }

    crearBote(ing, x, y, w, h, numero) {
        const cont = this.add.container(x, y);

        const g = this.add.graphics();
        const pintar = (estado) => {
            g.clear();
            g.fillStyle(estado === "hover" ? C.line : C.panel, 1);
            g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
            g.lineStyle(estado === "hover" ? 2 : 1.5,
                ing.type === "topping" ? C.blueDeep : C.red, 1);
            g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
            g.fillStyle(ing.type === "topping" ? C.blue : C.red, 1);
            g.fillRoundedRect(-w / 2 + 5, -h / 2 + 12, 4, h - 24, 2);
        };
        pintar("idle");

        const icono = this.add.image(-w / 2 + 40, 0, "ing_" + ing.key).setScale(1.5 * ING_K);

        this.add.text(0, 0, "");   // reserva de orden de dibujo

        const nombre = this.add.text(-w / 2 + 68, -18, ing.name, {
            fontFamily: FONT_BODY, fontSize: "16px", fontStyle: "bold", color: H("text")
        });

        /* El verbo dice qué hace el control y cuántas piezas pide.
           Antes el atajo iba escrito como "· tecla 3" en gris a 11 px y se
           perdía. Ahora el verbo sube de tamaño y de contraste, y la tecla
           se dibuja como una tecla: así se reconoce de un vistazo, sin
           leerla. */
        const pista = ing.type === "topping"
            ? `${ing.accion} ${MIN_PIEZAS_VALIDAS}+`
            : ing.accion;

        const accion = this.add.text(-w / 2 + 68, 5, pista, {
            fontFamily: FONT_BODY, fontSize: "12px", color: H("mutedHi")
        });

        // Tecla física, dibujada como tapa de teclado.
        const anchoTexto = accion.width;
        const tx = -w / 2 + 68 + anchoTexto + 10;
        const ty = 5;

        const tapa = this.add.graphics();
        tapa.fillStyle(C.night, 0.85);
        tapa.fillRoundedRect(tx, ty - 1, 17, 17, 4);
        tapa.lineStyle(1.5, C.line, 1);
        tapa.strokeRoundedRect(tx, ty - 1, 17, 17, 4);

        const tecla = this.add.text(tx + 8.5, ty + 7.5, String(numero), {
            fontFamily: FONT_BODY, fontSize: "12px", fontStyle: "bold",
            color: H("text")
        }).setOrigin(0.5);

        const contador = this.add.text(w / 2 - 16, 0, "", {
            fontFamily: FONT_DISPLAY, fontSize: "17px", color: H("mint")
        }).setOrigin(1, 0.5);

        const hit = this.add.rectangle(0, 0, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });

        cont.add([g, icono, nombre, accion, tapa, tecla, contador, hit]);

        hit.on("pointerover", () => { pintar("hover"); this.tweens.add({ targets: cont, y: y - 3, duration: 110 * MOTION }); });
        hit.on("pointerout",  () => { pintar("idle");  this.tweens.add({ targets: cont, y: y, duration: 110 * MOTION }); });

        hit.on("pointerdown", (p) => {
            SFX.ensure();
            if (ing.type === "topping") this.iniciarArrastre(ing, p);
            else this.aplicarCapa(ing);
        });

        return { cont, contador, icono, pintar, ing };
    }

    /* ---------- Entrada ---------- */

    registrarEntrada() {
        this.input.on("pointermove", (p) => {
            if (!this.arrastre) return;
            this.arrastre.setPosition(p.x, p.y);
            const dentro = Phaser.Math.Distance.Between(p.x, p.y, this.px, this.py) <= this.radioPizza;
            this.arrastre.setAlpha(dentro ? 1 : 0.55);
            this.dibujarGuia(dentro);
        });

        this.input.on("pointerup", (p) => this.soltarArrastre(p));

        const TECLAS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT"];
        INGREDIENTS.forEach((ing, i) => {
            if (!TECLAS[i]) return;
            this.input.keyboard.on("keydown-" + TECLAS[i], () => {
                this.destacarBote(ing.key);
                if (ing.type === "topping") this.servirRapido(ing);
                else this.aplicarCapa(ing);
            });
        });

        this.input.keyboard.on("keydown-Z", () => this.deshacer());
        this.input.keyboard.on("keydown-R", () => this.reiniciar());
        this.input.keyboard.on("keydown-SPACE", () => this.alHorno());
    }

    destacarBote(key) {
        const bote = this.botes[key];
        if (!bote) return;
        this.tweens.add({ targets: bote.cont, scale: 1.05, duration: 90 * MOTION, yoyo: true });
    }

    /* ---------- Capas ---------- */

    aplicarCapa(ing) {
        SFX.ensure();

        if (ing.type === "sauce") {
            if (this.pizzaState.sauce) { SFX.denied(); this.avisar("La salsa ya está untada"); return; }
            this.pizzaState.sauce = true;

            this.imgSalsa = this.add.image(0, 0, "salsa").setAlpha(0);
            this.pizza.add(this.imgSalsa);
            this.tweens.add({ targets: this.imgSalsa, alpha: 1, duration: 380 * MOTION });

            const esp = this.add.image(0, 0, "salsa_espiral").setScale(0.2).setAlpha(0.9).setAngle(-180);
            this.pizza.add(esp);
            this.tweens.add({
                targets: esp, scale: 1, angle: 0, duration: 520 * MOTION, ease: "Cubic.out",
                onComplete: () => this.tweens.add({
                    targets: esp, alpha: 0, duration: 320 * MOTION,
                    onComplete: () => esp.destroy()
                })
            });

            this.historial.push({ tipo: "sauce", obj: this.imgSalsa });
            SFX.spread();
            this.refrescarUI();
            return;
        }

        if (ing.type === "cheese") {
            if (!this.pizzaState.sauce) { SFX.denied(); this.avisar("Primero va la salsa"); return; }
            if (this.pizzaState.cheese) { SFX.denied(); this.avisar("El queso ya está esparcido"); return; }
            this.pizzaState.cheese = true;

            this.imgQueso = this.add.image(0, 0, "queso").setScale(0.5).setAlpha(0);
            this.pizza.add(this.imgQueso);
            this.tweens.add({ targets: this.imgQueso, scale: 1, alpha: 1, duration: 420 * MOTION, ease: "Back.out" });

            for (let i = 0; i < 14; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * 110;
                const bit = this.add.image(this.px + randInt(-34, 34), this.py - 190, "chispa")
                    .setScale(randInt(4, 9) / 10).setTint(0xf7e6b4);
                this.tweens.add({
                    targets: bit,
                    x: this.px + Math.cos(a) * r, y: this.py + Math.sin(a) * r,
                    alpha: 0, duration: (340 + Math.random() * 240) * MOTION,
                    delay: i * 22 * MOTION, ease: "Cubic.in",
                    onComplete: () => bit.destroy()
                });
            }

            this.historial.push({ tipo: "cheese", obj: this.imgQueso });
            SFX.spread();
            this.refrescarUI();
        }
    }

    /* ---------- Toppings ---------- */

    iniciarArrastre(ing, p) {
        if (!this.puedeTopping(ing)) return;
        this.arrastre = this.add.image(p.x, p.y, "ing_" + ing.key).setScale(1.7 * ING_K).setDepth(999);
        this.arrastre.ingKey = ing.key;
        this.tweens.add({ targets: this.arrastre, scale: 1.25 * ING_K, duration: 140 * MOTION });
    }

    soltarArrastre(p) {
        if (!this.arrastre) return;
        const key = this.arrastre.ingKey;
        const dentro = Phaser.Math.Distance.Between(p.x, p.y, this.px, this.py) <= this.radioPizza;

        this.arrastre.destroy();
        this.arrastre = null;
        this.dibujarGuia(false);

        if (!dentro) { SFX.denied(); return; }
        this.colocarTopping(key, p.x - this.px, p.y - this.py);
    }

    servirRapido(ing) {
        if (!this.puedeTopping(ing)) return;
        const a = Math.random() * Math.PI * 2, r = Math.random() * (this.radioPizza - 28);
        this.colocarTopping(ing.key, Math.cos(a) * r, Math.sin(a) * r);
    }

    puedeTopping(ing) {
        if (!this.pizzaState.sauce) { SFX.denied(); this.avisar("Primero va la salsa"); return false; }
        if (this.pizzaState.toppings[ing.key] >= MAX_PIEZAS_POR_TOPPING) {
            SFX.denied(); this.avisar(`Ya hay suficiente ${ing.name.toLowerCase()}`); return false;
        }
        return true;
    }

    colocarTopping(key, ox, oy) {
        const pieza = this.add.image(ox, oy, "ing_" + key)
            .setAngle(randInt(0, 359)).setScale(2.1 * ING_K).setAlpha(0.4);
        this.pizza.add(pieza);
        // El tamaño final SIEMPRE va multiplicado por ING_K. Si aquí quedara
        // "scale: 1", la pieza terminaría midiendo los 256 px del PNG.
        this.tweens.add({ targets: pieza, scale: ING_K, alpha: 1, duration: 240 * MOTION, ease: "Back.out" });

        this.pizzaState.toppings[key] += 1;
        this.historial.push({ tipo: "topping", key, obj: pieza });
        SFX.place();
        this.refrescarUI();
    }

    /* ---------- Deshacer / vaciar ---------- */

    deshacer() {
        const u = this.historial.pop();
        if (!u) { SFX.denied(); return; }

        if (u.tipo === "sauce") {
            // Quitar la salsa arrastra consigo todo lo que quedó encima.
            this.historial = [];
            this.pizza.list.slice(2).forEach(o => o.destroy());
            this.pizzaState.sauce = false;
            this.pizzaState.cheese = false;
            TOPPING_KEYS.forEach(k => this.pizzaState.toppings[k] = 0);
            this.imgSalsa = null;
            this.imgQueso = null;
        } else if (u.tipo === "cheese") {
            u.obj.destroy();
            this.pizzaState.cheese = false;
            this.imgQueso = null;
        } else {
            u.obj.destroy();
            this.pizzaState.toppings[u.key] -= 1;
        }

        SFX.click();
        this.refrescarUI();
    }

    reiniciar() {
        if (!this.historial.length) { SFX.denied(); return; }
        this.pizza.list.slice(2).forEach(o => o.destroy());
        this.historial = [];
        this.pizzaState = { sauce: false, cheese: false, toppings: {} };
        TOPPING_KEYS.forEach(k => this.pizzaState.toppings[k] = 0);
        this.imgSalsa = null;
        this.imgQueso = null;
        SFX.spread();
        this.refrescarUI();
    }

    /* ---------- Estado visual ---------- */

    dibujarGuia(activa) {
        this.guia.clear();
        this.guia.lineStyle(activa ? 3 : 1.5, activa ? C.mint : C.line, activa ? 0.9 : 0.3);
        this.guia.strokeCircle(this.px, this.py, this.radioPizza);
    }

    estaPuesto(key) {
        if (key === "salsa") return this.pizzaState.sauce;
        if (key === "queso") return this.pizzaState.cheese;
        return this.pizzaState.toppings[key] >= MIN_PIEZAS_VALIDAS;
    }

    refrescarUI() {
        // Contadores de los botes
        TOPPING_KEYS.forEach(k => {
            const n = this.pizzaState.toppings[k];
            const bote = this.botes[k];
            if (!bote) return;
            bote.contador.setText(n ? `${n}/${MIN_PIEZAS_VALIDAS}` : "");
            bote.contador.setColor(n >= MIN_PIEZAS_VALIDAS ? H("mint") : H("amber"));
        });
        if (this.botes.salsa) this.botes.salsa.contador.setText(this.pizzaState.sauce ? "✔" : "");
        if (this.botes.queso) this.botes.queso.contador.setText(this.pizzaState.cheese ? "✔" : "");

        // Comanda viva: tachar lo que ya está
        let listos = 0;
        this.requeridos.forEach(key => {
            const fila = this.filasRiel[key];
            const ok = this.estaPuesto(key);
            if (ok) listos++;
            fila.marca.setText(ok ? "✔" : "○").setColor(ok ? H("mint") : H("muted"));
            fila.nombre.setColor(ok ? H("muted") : H("text"));
            fila.tachado.clear();
            if (ok) {
                fila.tachado.lineStyle(1.5, C.mint, 0.8);
                fila.tachado.beginPath();
                fila.tachado.moveTo(fila.x, fila.y);
                fila.tachado.lineTo(fila.x + fila.nombre.width, fila.y);
                fila.tachado.strokePath();
            }
        });

        // Ingredientes fuera de la comanda
        const sobrantes = TOPPING_KEYS
            .filter(k => this.pizzaState.toppings[k] > 0 && !this.order.toppings.includes(k))
            .map(k => NOMBRES[k]);
        if (this.pizzaState.cheese && !this.order.cheese) sobrantes.unshift(NOMBRES.queso);
        this.avisoExtra.setText(sobrantes.length ? `No van: ${sobrantes.join(", ")}` : "");

        // Anillo de coincidencia
        const pct = this.requeridos.length ? listos / this.requeridos.length : 0;
        const valor = Math.max(0, Math.min(1, pct - sobrantes.length * 0.12));
        this.dibujarAnillo(valor);
        this.anilloTxt.setText(Math.round(valor * 100) + "%");
        this.anilloTxt.setColor(valor >= 1 ? H("mint") : (valor > 0.5 ? H("amber") : H("text")));

        this.btnHorno.setEnabled(this.pizzaState.sauce);
        this.btnHorno.setLabel(valor >= 1 ? "Al horno ✔" : "Al horno");
        this.btnUndo.setEnabled(this.historial.length > 0);
        this.btnReset.setEnabled(this.historial.length > 0);

        // El procedimiento se redibuja solo cuando cambia el paso.
        let paso = 1;
        if (this.pizzaState.sauce) paso = 2;
        if (this.pizzaState.cheese || !this.order.cheese) paso = 3;
        if (paso !== this.pasoActual) {
            this.pasoActual = paso;
            UI.procedimiento(this, paso);
        }
    }

    dibujarAnillo(v) {
        const r = this.anilloR, gr = this.anilloGrosor;
        this.anillo.clear();
        this.anillo.lineStyle(gr, C.line, 1);
        this.anillo.strokeCircle(this.anilloX, this.anilloY, r);
        if (v <= 0) return;
        this.anillo.lineStyle(gr, v >= 1 ? C.mint : C.amber, 1);
        this.anillo.beginPath();
        this.anillo.arc(this.anilloX, this.anilloY, r, Phaser.Math.DegToRad(-90),
            Phaser.Math.DegToRad(-90 + 360 * v), false);
        this.anillo.strokePath();
    }

    /** Mensaje corto sobre la tabla: qué pasó y qué hacer. */
    avisar(texto) {
        if (this.aviso) this.aviso.destroy();
        this.aviso = this.add.text(this.px, this.py + 186, texto, {
            fontFamily: FONT_BODY, fontSize: "14px", fontStyle: "bold",
            color: H("amber"), backgroundColor: "rgba(13,27,42,0.9)",
            padding: { x: 12, y: 6 }
        }).setOrigin(0.5).setDepth(500);
        this.tweens.add({
            targets: this.aviso, alpha: 0, delay: 1100 * MOTION, duration: 300 * MOTION,
            onComplete: () => { if (this.aviso) { this.aviso.destroy(); this.aviso = null; } }
        });
    }

    update(t, delta) {
        this.tiempoArmado += delta;
        if (this.cronoTxt) this.cronoTxt.setText((this.tiempoArmado / 1000).toFixed(1) + " s");
    }

    alHorno() {
        if (!this.pizzaState.sauce) { SFX.denied(); this.avisar("Unta la salsa antes de hornear"); return; }
        SFX.oven();

        this.tweens.add({
            targets: this.pizza, x: GAME_WIDTH + 260, angle: 18,
            duration: 400 * MOTION, ease: "Cubic.in"
        });

        this.time.delayedCall(360 * MOTION, () => {
            UI.irA(this, "OvenScene", {
                order: this.order,
                pizzaState: this.pizzaState,
                tiempoArmado: this.tiempoArmado
            });
        });
    }
}

/* ---------------------------------------------------------------------------
   11. HORNO — dial con la pizza dentro y aguja que rebota
--------------------------------------------------------------------------- */

class OvenScene extends Phaser.Scene {

    constructor() { super("OvenScene"); }

    init(data) {
        this.order = data.order;
        this.pizzaState = data.pizzaState;
        this.tiempoArmado = data.tiempoArmado || 0;
    }

    create() {
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a0e08);
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "vineta").setAlpha(0.75);
        UI.entrar(this);

        this.cfg = configHorneado();

        const top = UI.hud(this, "Vigila el punto de cocción");
        UI.procedimiento(this, 4);

        // Aguja que rebota: posición 0-100, dirección y velocidad en % por ms.
        this.pos = 0;
        this.dir = 1;
        this.velBase = 100 / this.cfg.barridoMs;
        this.vel = this.velBase;
        this.velMax = this.velBase * HORNEADO.velocidadTope;
        this.rebotes = 0;
        this.tiempo = 0;
        this.listo = false;
        this.zonaActual = null;

        const cx = (LAY.izqX + LAY.derX + LAY.colW) / 2 - 20;
        const cy = LAY.filaY + 200;
        this.cx = cx; this.cy = cy;
        this.radioDial = 176;

        UI.titulo(this, LAY.izqX + 8, top + 20, "Horno · 260 °C", "SÁCALA A TIEMPO", 0, 30);

        // La dificultad se anuncia: se ve, no se adivina.
        this.add.text(LAY.derX - 20, top + 22, `Ventana ${this.cfg.ancho}%`, {
            fontFamily: FONT_TICKET, fontSize: "13px", color: H("muted")
        }).setOrigin(1, 0);

        this.add.text(LAY.derX - 20, top + 40, `Barrido ${(this.cfg.barridoMs / 1000).toFixed(1)} s`, {
            fontFamily: FONT_TICKET, fontSize: "13px", color: H("muted")
        }).setOrigin(1, 0);

        /* ---- Dial ---- */
        this.dialBase = this.add.graphics();
        this.dibujarZonas();

        /* ---- Llamas bajo la pizza, dentro del anillo ---- */
        for (let i = 0; i < 9; i++) {
            const f = this.add.image(cx - 160 + i * 40, cy + 150, "flama")
                .setOrigin(0.5, 1).setScale(0.78).setAlpha(0.8);
            if (!REDUCED_MOTION) {
                this.tweens.add({
                    targets: f, scaleY: 1.2, alpha: 0.45,
                    duration: 380 + Math.random() * 380, yoyo: true, repeat: -1,
                    ease: "Sine.inOut", delay: Math.random() * 300
                });
            }
        }

        /* ---- Pizza dentro del anillo ---- */
        this.pizzaCont = this.add.container(cx, cy);
        this.masa = this.add.image(0, 0, "masa_corteza").setScale(0.86);
        this.pizzaCont.add(this.masa);
        this.capas = [];

        if (this.pizzaState.sauce) {
            const s = this.add.image(0, 0, "salsa").setScale(0.86);
            this.pizzaCont.add(s); this.capas.push(s);
        }
        if (this.pizzaState.cheese) {
            const q = this.add.image(0, 0, "queso").setScale(0.86);
            this.pizzaCont.add(q); this.capas.push(q);
        }
        TOPPING_KEYS.forEach(k => {
            for (let i = 0; i < this.pizzaState.toppings[k]; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * 104;
                const p = this.add.image(Math.cos(a) * r, Math.sin(a) * r, "ing_" + k)
                    .setAngle(randInt(0, 359)).setScale(0.9 * ING_K);
                this.pizzaCont.add(p); this.capas.push(p);
            }
        });

        this.pizzaCont.setScale(0.4).setAlpha(0);
        this.tweens.add({ targets: this.pizzaCont, scale: 1, alpha: 1, duration: 420 * MOTION, ease: "Back.out" });
        if (!REDUCED_MOTION) this.tweens.add({ targets: this.pizzaCont, angle: 360, duration: 26000, repeat: -1 });

        this.cuenta = this.add.graphics();
        this.aguja = this.add.graphics();

        this.lectura = this.add.text(cx, cy + 246, "LE FALTA", {
            fontFamily: FONT_DISPLAY, fontSize: "30px", color: H("amber")
        }).setOrigin(0.5);

        this.pista = this.add.text(cx, cy + 282, "Detén la aguja dentro de la franja verde", {
            fontFamily: FONT_BODY, fontSize: "13px", color: H("muted")
        }).setOrigin(0.5);

        if (!REDUCED_MOTION) {
            this.time.addEvent({
                delay: 300, loop: true, callback: () => {
                    if (this.listo) return;
                    const v = this.add.image(cx + randInt(-66, 66), cy - 44, "vapor")
                        .setScale(0.7).setAlpha(0.45);
                    this.tweens.add({
                        targets: v, y: cy - 190, scale: 1.8, alpha: 0,
                        duration: 1600, onComplete: () => v.destroy()
                    });
                }
            });
        }

        this.btn = UI.boton(this, cx, GAME_HEIGHT - 58, 320, 62, "Sacar pizza",
            () => this.sacar(), { tono: "red", size: 18 });

        this.add.image(cx - 124, GAME_HEIGHT - 58, "ut_pala").setScale(0.46).setAlpha(0.85);

        this.input.keyboard.on("keydown-SPACE", () => this.sacar());
        SFX.oven();
    }

    dibujarZonas() {
        const g = this.dialBase;
        const r = this.radioDial;
        const ang = (pct) => Phaser.Math.DegToRad(135 + 270 * (pct / 100));
        this.angDe = ang;

        g.clear();

        g.fillStyle(0x24140c, 1);
        g.fillCircle(this.cx, this.cy, r + 30);
        g.lineStyle(2, 0x3d2415, 1);
        g.strokeCircle(this.cx, this.cy, r + 30);

        const banda = (desde, hasta, color, grosor = 22) => {
            g.lineStyle(grosor, color, 1);
            g.beginPath();
            g.arc(this.cx, this.cy, r, ang(desde), ang(hasta), false);
            g.strokePath();
        };

        banda(0, this.cfg.inicio, C.amber);
        banda(this.cfg.inicio, this.cfg.fin, C.mint);
        banda(this.cfg.fin, 100, 0x5c2f16);
        banda(this.cfg.nucleoIni, this.cfg.nucleoFin, 0xdcfff2, 9);   // núcleo con bono

        g.lineStyle(2, 0x000000, 0.35);
        for (let p = 0; p <= 100; p += 10) {
            const a = ang(p);
            g.beginPath();
            g.moveTo(this.cx + Math.cos(a) * (r - 12), this.cy + Math.sin(a) * (r - 12));
            g.lineTo(this.cx + Math.cos(a) * (r + 12), this.cy + Math.sin(a) * (r + 12));
            g.strokePath();
        }
    }

    update(t, delta) {
        if (this.listo) return;

        this.pos += this.dir * this.vel * delta;

        if (this.pos >= 100) { this.pos = 100; this.dir = -1; this.acelerar(); }
        else if (this.pos <= 0) { this.pos = 0; this.dir = 1; this.acelerar(); }

        // El horno no espera: la pizza se dora aunque no la muevas.
        this.tiempo += delta;
        const consumido = Math.min(this.tiempo / this.cfg.limiteMs, 1);

        this.masa.setTint(lerpColor(C.wood, 0x51301a, consumido));
        this.capas.forEach(c => c.setTint(lerpColor(0xffffff, 0xb08050, consumido * 0.85)));

        this.dibujarCuenta(1 - consumido);
        this.dibujarAguja();
        this.leerZona();

        if (consumido >= 1) this.sacar(true);
    }

    acelerar() {
        this.vel = Math.min(this.vel * HORNEADO.aceleracion, this.velMax);
        this.rebotes += 1;
        SFX.rebote();
    }

    dibujarAguja() {
        const a = this.angDe(this.pos);
        const r = this.radioDial;

        this.aguja.clear();
        this.aguja.lineStyle(5, 0xffffff, 1);
        this.aguja.beginPath();
        this.aguja.moveTo(this.cx + Math.cos(a) * (r - 30), this.cy + Math.sin(a) * (r - 30));
        this.aguja.lineTo(this.cx + Math.cos(a) * (r + 22), this.cy + Math.sin(a) * (r + 22));
        this.aguja.strokePath();
        this.aguja.fillStyle(0xffffff, 1);
        this.aguja.fillCircle(this.cx + Math.cos(a) * (r + 22), this.cy + Math.sin(a) * (r + 22), 7);
    }

    /** Anillo exterior que se vacía: cuánto falta para que se queme sola. */
    dibujarCuenta(restante) {
        const g = this.cuenta;
        g.clear();
        if (restante <= 0) return;
        g.lineStyle(5, restante > 0.35 ? C.amber : C.red, 0.85);
        g.beginPath();
        g.arc(this.cx, this.cy, this.radioDial + 44,
            Phaser.Math.DegToRad(135),
            Phaser.Math.DegToRad(135 + 270 * restante), false);
        g.strokePath();
    }

    /**
     * Solo se actualiza al cambiar de zona: redibujar el texto en cada frame
     * lo regenera a triple resolución 60 veces por segundo, y eso se nota.
     */
    leerZona() {
        const p = this.pos;
        const zona = p < this.cfg.inicio ? "falta" : (p <= this.cfg.fin ? "punto" : "pasado");
        if (zona === this.zonaActual) return;
        this.zonaActual = zona;

        const t = {
            falta:  ["LE FALTA",    "Todavía no llega al punto",     "amber", "muted"],
            punto:  ["EN SU PUNTO", "Detén la aguja aquí",           "mint",  "mint"],
            pasado: ["SE PASÓ",     "Se te fue: quedó sobre cocida", "red",   "red"]
        }[zona];

        this.lectura.setText(t[0]).setColor(H(t[2]));
        this.pista.setText(t[1]).setColor(H(t[3]));

        if (zona === "punto") SFX.tone(880, 0.05, "triangle", 0.045);
    }

    sacar(porTiempo = false) {
        if (this.listo) return;
        this.listo = true;

        const p = this.pos;
        const resultado = porTiempo ? "quemada"
            : (p < this.cfg.inicio ? "cruda" : (p <= this.cfg.fin ? "perfecta" : "quemada"));
        const exacto = !porTiempo && p >= this.cfg.nucleoIni && p <= this.cfg.nucleoFin;

        this.aguja.clear();
        this.cuenta.clear();

        if (resultado === "perfecta") {
            SFX.tone(exacto ? 1318 : 1046, 0.18, "triangle", 0.06);
            if (exacto) {
                const t = this.add.text(this.cx, this.cy, "¡EXACTO!", {
                    fontFamily: FONT_DISPLAY, fontSize: "40px", color: H("mint")
                }).setOrigin(0.5).setDepth(900).setScale(0.4);
                this.tweens.add({ targets: t, scale: 1, duration: 260 * MOTION, ease: "Back.out" });
            }
        } else {
            SFX.fail();
            this.cameras.main.shake(200 * MOTION, 0.006);
        }

        this.tweens.add({
            targets: this.pizzaCont, y: this.cy - 320, alpha: 0,
            duration: 380 * MOTION, ease: "Cubic.in"
        });

        this.time.delayedCall(420 * MOTION, () => {
            UI.irA(this, "ResultScene", {
                order: this.order,
                pizzaState: this.pizzaState,
                bakeResult: resultado,
                bakeExacto: exacto,
                tiempoArmado: this.tiempoArmado
            });
        });
    }
}

/* ---------------------------------------------------------------------------
   12. RESULTADO — verificación contra la comanda
--------------------------------------------------------------------------- */

class ResultScene extends Phaser.Scene {

    constructor() { super("ResultScene"); }

    init(data) {
        this.order = data.order;
        this.pizzaState = data.pizzaState;
        this.bakeResult = data.bakeResult;
        this.bakeExacto = !!data.bakeExacto;
        this.tiempoArmado = data.tiempoArmado || 0;
    }

    create() {
        UI.fondo(this);
        UI.entrar(this);

        const r = this.evaluar();
        this.aplicar(r);

        const top = UI.hud(this, "Verificación del pedido");
        UI.procedimiento(this, 5);

        const cx = (LAY.izqX + LAY.derX) / 2 + 10;
        const zonaX = LAY.izqX;
        const zonaW = LAY.derX - LAY.izqX - 20;

        const veredicto = r.estrellas === 3 ? "PEDIDO PERFECTO"
            : r.estrellas === 2 ? "PEDIDO ACEPTABLE"
            : r.estrellas === 1 ? "PEDIDO CON ERRORES"
            : "PEDIDO RECHAZADO";

        UI.titulo(this, cx, top + 20, `Ticket ${String(GameState.pedidoNumero).padStart(3, "0")}`, veredicto, 0.5, 36);
        UI.estrellas(this, cx, top + 108, r.estrellas, 1);

        if (r.estrellas === 3) { SFX.win(); this.confeti(); }
        else if (r.estrellas === 0) SFX.fail();

        /* ---- Detalle en dos columnas ---- */
        const py = top + 148;
        UI.panel(this, zonaX, py, zonaW, 230);

        const colW = zonaW / 2;
        [0, 1].forEach(i => {
            this.add.text(zonaX + 28 + i * colW, py + 18, "INGREDIENTE", {
                fontFamily: FONT_BODY, fontSize: "10px", fontStyle: "bold",
                color: H("muted"), letterSpacing: 2
            });
        });

        const mitad = Math.ceil(r.detalle.length / 2);
        r.detalle.forEach((item, i) => {
            const col = i < mitad ? 0 : 1;
            const fila = i < mitad ? i : i - mitad;
            const x = zonaX + 28 + col * colW;
            const y = py + 46 + fila * 32;

            const etiqueta = item.ok ? "correcto" : (item.extra ? "no iba" : "faltó");

            const nombre = this.add.text(x, y, item.nombre, {
                fontFamily: FONT_TICKET, fontSize: "15px",
                color: item.ok ? H("text") : H("red")
            });
            const estado = this.add.text(x + colW - 56, y, `${item.ok ? "✔" : "✕"} ${etiqueta}`, {
                fontFamily: FONT_BODY, fontSize: "13px", fontStyle: "bold",
                color: item.ok ? H("mint") : H("red")
            }).setOrigin(1, 0);

            [nombre, estado].forEach(o => {
                o.setAlpha(0);
                this.tweens.add({ targets: o, alpha: 1, duration: 180 * MOTION, delay: (60 + i * 45) * MOTION });
            });
        });

        /* ---- Desglose de puntos ---- */
        const dy = py + 246;
        UI.panel(this, zonaX, dy, zonaW, 110, { fill: C.panelSoft, alpha: 0.6 });

        const chip = (i, etiqueta, valor, color) => {
            const x = zonaX + zonaW / 4 * (i + 0.5);
            this.add.text(x, dy + 24, etiqueta.toUpperCase(), {
                fontFamily: FONT_BODY, fontSize: "10px", fontStyle: "bold",
                color: H("muted"), letterSpacing: 1
            }).setOrigin(0.5);
            this.add.text(x, dy + 46, valor, {
                fontFamily: FONT_DISPLAY, fontSize: "24px", color: H(color)
            }).setOrigin(0.5);
        };

        const textoHorno = this.bakeExacto
            ? "Exacto"
            : { cruda: "Cruda", perfecta: "En su punto", quemada: "Quemada" }[this.bakeResult];

        chip(0, "Horneado", textoHorno, this.bakeResult === "perfecta" ? "mint" : "red");
        chip(1, "Tiempo de armado", (this.tiempoArmado / 1000).toFixed(1) + " s", "text");
        chip(2, "Puntos del pedido", "+" + r.puntos, "amber");
        chip(3, "Total del turno", String(GameState.score), "text");

        const bonos = [];
        if (this.bakeExacto) bonos.push("Punto exacto · +70");
        if (r.bonoTiempo) bonos.push(`${r.bonoTiempo.etiqueta} · +${r.bonoTiempo.puntos}`);

        if (bonos.length) {
            this.add.text(zonaX + zonaW / 2, dy + 86, bonos.join("       "), {
                fontFamily: FONT_TICKET, fontSize: "12px", color: H("mint")
            }).setOrigin(0.5);
        }

        /* ---- Siguiente ---- */
        const ultimo = GameState.historialPedidos.length >= SESSION_ORDER_LIMIT;
        const label = ultimo
            ? "Ver resumen del turno"
            : `Siguiente pedido · ${GameState.historialPedidos.length + 1} de ${SESSION_ORDER_LIMIT}`;

        const ir = () => UI.irA(this, ultimo ? "SummaryScene" : "OrderScene");
        UI.boton(this, cx, GAME_HEIGHT - 52, 380, 58, label, ir, { tono: ultimo ? "blue" : "red", size: 16 });
        this.input.keyboard.on("keydown-SPACE", ir);
    }

    confeti() {
        const colores = [C.red, C.amber, C.mint, C.blue, C.cream];
        for (let i = 0; i < 70; i++) {
            const c = this.add.image(GAME_WIDTH / 2 + randInt(-60, 60), 150, "chispa")
                .setTint(colores[i % colores.length])
                .setScale(randInt(6, 15) / 10)
                .setAngle(randInt(0, 359))
                .setDepth(500);
            this.tweens.add({
                targets: c,
                x: c.x + randInt(-480, 480),
                y: GAME_HEIGHT + 40,
                angle: c.angle + randInt(180, 720),
                duration: (1200 + Math.random() * 900) * MOTION,
                delay: Math.random() * 280 * MOTION,
                ease: "Cubic.in",
                onComplete: () => c.destroy()
            });
        }
    }

    evaluar() {
        const detalle = [];
        let correctos = 0, faltantes = 0, extras = 0;

        const puesto = (key) => {
            if (key === "salsa") return this.pizzaState.sauce;
            if (key === "queso") return this.pizzaState.cheese;
            return this.pizzaState.toppings[key] >= MIN_PIEZAS_VALIDAS;
        };

        const revisar = (key, requerido) => {
            const hay = puesto(key);
            const ok = requerido === hay;
            detalle.push({ nombre: NOMBRES[key], ok, extra: !requerido && hay });
            if (ok) correctos++;
            else if (requerido) faltantes++;
            else extras++;
        };

        revisar("salsa", this.order.sauce);
        revisar("queso", this.order.cheese);
        TOPPING_KEYS.forEach(k => revisar(k, this.order.toppings.includes(k)));

        const bakeOk = this.bakeResult === "perfecta";
        const errores = faltantes + extras;
        const perfecto = errores === 0 && bakeOk;

        let puntos = correctos * 100 - faltantes * 60 - extras * 40;
        if (bakeOk) puntos += 90;
        if (this.bakeExacto) puntos += 70;
        if (perfecto) puntos += 160;

        let bonoTiempo = null;
        if (errores === 0) {
            const seg = this.tiempoArmado / 1000;
            bonoTiempo = BONO_TIEMPO.find(b => seg <= b.hasta) || null;
            if (bonoTiempo) puntos += bonoTiempo.puntos;
        }

        const estrellas = perfecto ? 3
            : (errores === 0 || bakeOk) ? 2
            : errores <= 2 ? 1 : 0;

        return {
            detalle, correctos, faltantes, extras, bakeOk, perfecto,
            errores, estrellas, bonoTiempo,
            puntos: Math.max(puntos, 0)
        };
    }

    aplicar(r) {
        GameState.score += r.puntos;
        GameState.streak = r.perfecto ? GameState.streak + 1 : 0;
        GameState.mejorRacha = Math.max(GameState.mejorRacha, GameState.streak);
        GameState.historialPedidos.push({
            puntos: r.puntos,
            correctos: r.correctos,
            faltantes: r.faltantes,
            extras: r.extras,
            estrellas: r.estrellas,
            bakeResult: this.bakeResult,
            segundos: this.tiempoArmado / 1000,
            perfecto: r.perfecto
        });

        reportarTurno();   // el Panel de KPIs se entera pedido a pedido
    }
}

/* ---------------------------------------------------------------------------
   13. RESUMEN — KPIs del turno
--------------------------------------------------------------------------- */

class SummaryScene extends Phaser.Scene {

    constructor() { super("SummaryScene"); }

    create() {
        UI.fondo(this);
        UI.entrar(this);

        const h = GameState.historialPedidos;
        const total = h.length || 1;
        const perfectos = h.filter(p => p.perfecto).length;
        const pctPerfectos = Math.round((perfectos / total) * 100);
        const promCorrectos = h.reduce((a, p) => a + p.correctos, 0) / total;
        const promSeg = h.reduce((a, p) => a + p.segundos, 0) / total;
        const promEstrellas = h.reduce((a, p) => a + p.estrellas, 0) / total;
        const bake = { cruda: 0, perfecta: 0, quemada: 0 };
        h.forEach(p => bake[p.bakeResult]++);

        // Cierre del turno. Comparte id con los reportes por pedido, así que
        // actualiza ese registro en vez de agregar uno nuevo.
        reportarTurno();

        const top = UI.hud(this, "Resumen del turno");
        const cx = GAME_WIDTH / 2;

        UI.titulo(this, cx, top + 24, `${h.length} pedidos completados`, "RESUMEN DEL TURNO", 0.5, 38);
        UI.estrellas(this, cx, top + 116, Math.round(promEstrellas), 1);

        /* ---- Tarjetas de KPI con conteo animado ---- */
        const kpis = [
            { et: "Puntos del turno", val: GameState.score, suf: "", color: "amber" },
            { et: "Pedidos perfectos", val: pctPerfectos, suf: "%", color: "mint" },
            { et: "Mejor racha", val: GameState.mejorRacha, suf: "", color: "red" },
            { et: "Ingredientes OK", val: promCorrectos, suf: " prom", color: "blue", dec: 1 }
        ];

        const cw = 272, ch = 104, gap = 18;
        const sx = (GAME_WIDTH - (kpis.length * cw + (kpis.length - 1) * gap)) / 2;
        const cy = top + 156;

        kpis.forEach((k, i) => {
            const x = sx + i * (cw + gap);
            UI.panel(this, x, cy, cw, ch);

            const franja = this.add.graphics();
            franja.fillStyle(C[k.color], 1);
            franja.fillRoundedRect(x, cy, cw, 5, 2);

            this.add.text(x + 20, cy + 24, k.et.toUpperCase(), {
                fontFamily: FONT_BODY, fontSize: "11px", fontStyle: "bold",
                color: H("muted"), letterSpacing: 1
            });

            const num = this.add.text(x + 20, cy + 48, "0", {
                fontFamily: FONT_DISPLAY, fontSize: "36px", color: H(k.color)
            });

            const obj = { v: 0 };
            this.tweens.add({
                targets: obj, v: k.val, duration: 900 * MOTION, delay: (150 + i * 90) * MOTION,
                ease: "Cubic.out",
                onUpdate: () => num.setText((k.dec ? obj.v.toFixed(k.dec) : Math.round(obj.v)) + k.suf)
            });
        });

        /* ---- Gráfica de cocción ---- */
        const gy = cy + ch + 26;
        const gw = GAME_WIDTH - sx * 2;
        UI.panel(this, sx, gy, gw, 226, { fill: C.panelSoft, alpha: 0.5 });

        this.add.text(sx + 22, gy + 18, "PUNTO DE COCCIÓN", {
            fontFamily: FONT_BODY, fontSize: "11px", fontStyle: "bold",
            color: H("muted"), letterSpacing: 2
        });

        this.add.text(sx + gw - 22, gy + 18, `Armado promedio ${promSeg.toFixed(1)} s`, {
            fontFamily: FONT_TICKET, fontSize: "13px", color: H("muted")
        }).setOrigin(1, 0);

        const barras = [
            { et: "Cruda", n: bake.cruda, c: C.amber },
            { et: "En su punto", n: bake.perfecta, c: C.mint },
            { et: "Quemada", n: bake.quemada, c: 0x8a4a22 }
        ];

        const maxN = Math.max(1, ...barras.map(b => b.n));
        const baseY = gy + 180;
        const maxH = 104;
        const bw = 104;
        const bStart = GAME_WIDTH / 2 - (barras.length * bw + (barras.length - 1) * 60) / 2;

        barras.forEach((b, i) => {
            const x = bStart + i * (bw + 60);
            const hFinal = Math.max((b.n / maxN) * maxH, 5);

            const g = this.add.graphics();
            const obj = { h: 0 };
            this.tweens.add({
                targets: obj, h: hFinal, duration: 700 * MOTION, delay: (320 + i * 120) * MOTION,
                ease: "Cubic.out",
                onUpdate: () => {
                    g.clear();
                    g.fillStyle(b.c, 1);
                    g.fillRoundedRect(x, baseY - obj.h, bw, obj.h, 7);
                }
            });

            this.add.text(x + bw / 2, baseY - hFinal - 24, String(b.n), {
                fontFamily: FONT_DISPLAY, fontSize: "22px", color: H("text")
            }).setOrigin(0.5);

            this.add.text(x + bw / 2, baseY + 12, b.et, {
                fontFamily: FONT_BODY, fontSize: "13px", color: H("muted")
            }).setOrigin(0.5, 0);
        });

        /* ---- Acciones ---- */
        const nuevo = () => { reiniciarSesion(); UI.irA(this, "OrderScene"); };
        UI.boton(this, cx - 116, GAME_HEIGHT - 48, 220, 54, "Repetir turno", nuevo, { tono: "red", size: 15 });
        UI.boton(this, cx + 116, GAME_HEIGHT - 48, 220, 54, "Volver al inicio",
            () => UI.irA(this, "IntroScene"), { tono: "ghost", size: 15 });

        this.input.keyboard.on("keydown-SPACE", nuevo);
    }
}

/* ---------------------------------------------------------------------------
   14. ARRANQUE
--------------------------------------------------------------------------- */

const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#0d1b2a",
    render: {
        antialias: true,
        roundPixels: false,
        powerPreference: "high-performance"
    },
    scale: {
        // El contenedor se topa en 1280 px (ver styles.css), así que FIT
        // resuelve escala 1.0 y el canvas se dibuja a tamaño nativo.
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,

        // expandParent y max son el seguro contra el lienzo desbocado.
        //
        // Phaser mide el contenedor para calcular su escala. Si el
        // contenedor no tiene altura propia, la hereda del canvas, y
        // entonces cada medición lee un padre más grande y agranda el
        // canvas otra vez: el juego crece solo hasta reventar la página.
        //
        // expandParent:false impide que Phaser toque el contenedor, y
        // max le pone un techo al lienzo. Aun si alguien borrara las
        // reglas de #game-container en el CSS, el juego no se dispara.
        expandParent: false,
        max: { width: GAME_WIDTH, height: GAME_HEIGHT }
    },
    scene: [BootScene, IntroScene, OrderScene, AssemblyScene, OvenScene, ResultScene, SummaryScene]
};

new Phaser.Game(config);