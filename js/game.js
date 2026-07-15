/* ============================================================================
   DOMINO'S SYSTEM - SIMULADOR 2D DE ARMADO DE PIZZAS
   Parte 1: Configuración, Estado Global, BootScene y OrderScene
   ============================================================================ */

/* ---------------------------------------------------------------------------
   1. CONFIGURACIÓN GENERAL Y CATÁLOGO DE INGREDIENTES
--------------------------------------------------------------------------- */
const GAME_WIDTH = 600;
const GAME_HEIGHT = 600;

const INGREDIENTS = [
    { key: "salsa",     name: "Salsa de tomate",   type: "sauce",   color: 0xB33A24 },
    { key: "queso",     name: "Queso mozzarella",  type: "cheese",  color: 0xFFF3C4 },
    { key: "pepperoni", name: "Pepperoni",         type: "topping", color: 0x9C2B2B },
    { key: "champinon", name: "Champiñón",         type: "topping", color: 0xE4D3B0 },
    { key: "pina",      name: "Piña",              type: "topping", color: 0xF4D53E },
    { key: "jamon",     name: "Jamón",             type: "topping", color: 0xE8A9AE },
    { key: "aceitunas", name: "Aceitunas",         type: "topping", color: 0x1C1C1C },
    { key: "pimiento",  name: "Pimiento verde",    type: "topping", color: 0x27AE60 }
];

const TOPPING_KEYS = INGREDIENTS.filter(i => i.type === "topping").map(i => i.key);
const MAX_PIEZAS_POR_TOPPING = 6;
const SESSION_ORDER_LIMIT = 8;

const HORNEADO = {
    duracionMs: 7000,
    zonaCrudaHasta: 35,
    zonaPerfectaHasta: 72,
};

/* ---------------------------------------------------------------------------
   2. ESTADO GLOBAL DEL JUEGO + sincronización DOM
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
    actualizarPuntajeDOM();
}

function getStatNodes() {
    return document.querySelectorAll(".module-stats h4");
}

function actualizarPuntajeDOM() {
    const nodes = getStatNodes();
    if (nodes[0]) nodes[0].textContent = GameState.score;
    if (nodes[1]) nodes[1].textContent = GameState.streak;
}

function actualizarTiempoDOM() {
    const nodes = getStatNodes();
    if (!nodes[2]) return;
    const elapsedSec = Math.floor((Date.now() - GameState.startTime) / 1000);
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
    const ss = String(elapsedSec % 60).padStart(2, "0");
    nodes[2].textContent = `${mm}:${ss}`;
}

setInterval(actualizarTiempoDOM, 1000);

function actualizarComandaDOM(order) {
    const panel = document.querySelector(".info-panel");
    if (!panel) return;

    const items = [];
    items.push(order.sauce ? "✔ Salsa de tomate" : "— Sin salsa");
    items.push(order.cheese ? "✔ Queso mozzarella" : "— Sin queso");
    order.toppings.forEach(key => {
        const ing = INGREDIENTS.find(i => i.key === key);
        items.push(`✔ ${ing.name}`);
    });

    panel.innerHTML = `<h5>COMANDA EN CURSO</h5>
        <div class="ticket-order-num">Pedido #${GameState.pedidoNumero}</div>
        <ul class="ticket-list">
            ${items.map(t => `<li>${t}</li>`).join("")}
        </ul>`;
}

function actualizarProcedimientoDOM(pasos, activo) {
    const panel = document.querySelector(".process-panel");
    if (!panel) return;

    panel.innerHTML = `<h5>PROCEDIMIENTO</h5>
        <ol class="steps-list">
            ${pasos.map((p, i) => `<li class="${i === activo ? "step-active" : ""}">${p}</li>`).join("")}
        </ol>`;
}

/* ---------------------------------------------------------------------------
   3. UTILIDADES
--------------------------------------------------------------------------- */
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomSubset(arr, count) {
    const copy = [...arr];
    const result = [];
    while (result.length < count && copy.length > 0) {
        const idx = randInt(0, copy.length - 1);
        result.push(copy.splice(idx, 1)[0]);
    }
    return result;
}

function generarPedidoAleatorio() {
    return {
        sauce: true,
        cheese: Math.random() > 0.1,
        toppings: pickRandomSubset(TOPPING_KEYS, randInt(2, 4))
    };
}

/* ---------------------------------------------------------------------------
   4. BOOT SCENE - Generación procedural de texturas
--------------------------------------------------------------------------- */
class BootScene extends Phaser.Scene {
    constructor() { super("BootScene"); }
    preload() {}
    create() {
        this.generarTexturas();
        this.scene.start("OrderScene");
    }

    generarTexturas() {
        const g = this.make.graphics({ add: false });

        g.clear(); g.fillStyle(0xC9953B, 1); g.fillCircle(140, 140, 140); g.generateTexture("masa_corteza", 280, 280);
        g.clear(); g.fillStyle(0xE9C287, 1); g.fillCircle(125, 125, 125); g.generateTexture("masa_base", 250, 250);
        g.clear(); g.fillStyle(0xB33A24, 0.92); g.fillCircle(115, 115, 115); g.generateTexture("salsa", 230, 230);

        g.clear(); g.fillStyle(0xFFF3C4, 0.85); g.fillCircle(110, 110, 110);
        g.fillStyle(0xFFE28A, 0.5);
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * Math.PI * 2; const r = Math.random() * 95;
            g.fillCircle(110 + Math.cos(a) * r, 110 + Math.sin(a) * r, randInt(4, 9));
        }
        g.generateTexture("queso", 220, 220);

        g.clear(); g.fillStyle(0x9C2B2B, 1); g.fillCircle(13, 13, 13); g.fillStyle(0x7A1F1F, 1); g.fillCircle(9, 9, 2); g.fillCircle(17, 11, 1.5); g.fillCircle(12, 18, 1.5); g.generateTexture("ing_pepperoni", 26, 26);
        g.clear(); g.fillStyle(0xE4D3B0, 1); g.fillCircle(12, 13, 11); g.fillStyle(0xC7A97B, 1); g.fillEllipse(12, 8, 18, 8); g.generateTexture("ing_champinon", 24, 24);
        g.clear(); g.fillStyle(0xF4D53E, 1); g.fillPoints([{ x: 12, y: 0 }, { x: 24, y: 12 }, { x: 12, y: 24 }, { x: 0, y: 12 }], true); g.lineStyle(1.5, 0xC7A400, 1); g.strokePoints([{ x: 12, y: 0 }, { x: 24, y: 12 }, { x: 12, y: 24 }, { x: 0, y: 12 }], true); g.generateTexture("ing_pina", 24, 24);
        g.clear(); g.fillStyle(0xE8A9AE, 1); g.fillRoundedRect(0, 4, 24, 14, 5); g.generateTexture("ing_jamon", 24, 22);
        g.clear(); g.lineStyle(4, 0x1C1C1C, 1); g.strokeCircle(11, 11, 7); g.generateTexture("ing_aceitunas", 22, 22);
        g.clear(); g.lineStyle(5, 0x27AE60, 1); g.strokeCircle(12, 12, 8); g.generateTexture("ing_pimiento", 24, 24);

        g.clear(); g.fillStyle(0x8B5A2B, 1); g.fillRect(35, 18, 90, 8); g.fillStyle(0xC9953B, 1); g.fillEllipse(20, 22, 40, 26); g.generateTexture("ut_pala", 130, 44);
        g.clear(); g.fillStyle(0x3A2A20, 1); g.fillRoundedRect(0, 0, 320, 220, 16); g.fillStyle(0x1A1210, 1); g.fillRoundedRect(20, 20, 280, 180, 10); g.fillStyle(0xFF7A29, 1); g.fillRoundedRect(30, 30, 260, 8, 4); g.fillRoundedRect(30, 182, 260, 8, 4); g.generateTexture("horno_fondo", 320, 220);
        g.clear(); g.fillStyle(0xEFE3CF, 1); g.fillRoundedRect(0, 0, 560, 300, 14); g.generateTexture("mesa_fondo", 560, 300);
        g.clear(); g.fillStyle(0xFFFFFF, 1); g.fillRoundedRect(0, 0, 120, 70, 10); g.lineStyle(2, 0xCED4DA, 1); g.strokeRoundedRect(1, 1, 118, 68, 10); g.generateTexture("btn_bg", 120, 70);
        g.clear(); g.fillStyle(0x006491, 1); g.fillRoundedRect(0, 0, 200, 56, 10); g.generateTexture("btn_primary_bg", 200, 56);
        g.clear(); g.fillStyle(0xE31837, 1); g.fillRoundedRect(0, 0, 200, 56, 10); g.generateTexture("btn_accent_bg", 200, 56);

        g.destroy();
    }
}

/* ---------------------------------------------------------------------------
   5. ORDER SCENE - Pantalla de lectura de comanda
--------------------------------------------------------------------------- */
class OrderScene extends Phaser.Scene {
    constructor() { super("OrderScene"); }

    create() {
        this.cameras.main.setBackgroundColor("#f4f6f9");

        if (GameState.historialPedidos.length >= SESSION_ORDER_LIMIT) {
            this.scene.start("SummaryScene");
            return;
        }

        GameState.pedidoNumero += 1;
        const order = generarPedidoAleatorio();
        this.registry.set("currentOrder", order);

        actualizarComandaDOM(order);
        actualizarProcedimientoDOM([
            "1. Leer la comanda", "2. Untar la salsa", "3. Agregar el queso",
            "4. Colocar los ingredientes", "5. Hornear la pizza", "6. Verificar contra el pedido"
        ], 0);

        this.add.text(GAME_WIDTH / 2, 40, "NUEVO PEDIDO", { fontFamily: "Arial", fontSize: "26px", fontStyle: "bold", color: "#333333" }).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, 72, `Pedido ${GameState.pedidoNumero} de ${SESSION_ORDER_LIMIT}`, { fontFamily: "Arial", fontSize: "16px", color: "#777777" }).setOrigin(0.5);

        const ticketX = GAME_WIDTH / 2 - 110, ticketY = 110, ticketW = 220;
        const gfx = this.add.graphics();
        gfx.fillStyle(0xffffff, 1); gfx.fillRoundedRect(ticketX, ticketY, ticketW, 300, 8);
        gfx.lineStyle(2, 0xdddddd, 1); gfx.strokeRoundedRect(ticketX, ticketY, ticketW, 300, 8);

        let cursorY = ticketY + 20;
        this.add.text(ticketX + ticketW / 2, cursorY, "PIZZA CLÁSICA", { fontFamily: "Arial", fontSize: "16px", fontStyle: "bold", color: "#E31837" }).setOrigin(0.5);
        cursorY += 34;

        const renderLinea = (texto) => {
            this.add.text(ticketX + 18, cursorY, texto, { fontFamily: "Arial", fontSize: "14px", color: "#333333" });
            cursorY += 26;
        };

        renderLinea(order.sauce ? "• Salsa de tomate" : "• Sin salsa");
        renderLinea(order.cheese ? "• Queso mozzarella" : "• Sin queso");
        order.toppings.forEach(key => {
            const ing = INGREDIENTS.find(i => i.key === key);
            renderLinea(`• ${ing.name}`);
        });

        const startBtn = this.add.image(GAME_WIDTH / 2, 500, "btn_accent_bg").setInteractive({ useHandCursor: true });
        this.add.text(GAME_WIDTH / 2, 500, "COMENZAR ARMADO", { fontFamily: "Arial", fontSize: "16px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);

        startBtn.on("pointerover", () => startBtn.setScale(1.04));
        startBtn.on("pointerout", () => startBtn.setScale(1));
        startBtn.on("pointerdown", () => { this.scene.start("AssemblyScene"); });
    }
}


/* ============================================================================
   DOMINO'S SYSTEM - SIMULADOR 2D DE ARMADO DE PIZZAS
   Parte 2: AssemblyScene y OvenScene (Mecánicas de Interacción)
   ============================================================================ */

/* ---------------------------------------------------------------------------
   6. ASSEMBLY SCENE - Estación de armado de la pizza
--------------------------------------------------------------------------- */
class AssemblyScene extends Phaser.Scene {
    constructor() { super("AssemblyScene"); }

    create() {
        this.cameras.main.setBackgroundColor("#f4f6f9");
        this.order = this.registry.get("currentOrder");

        this.pizzaState = { sauce: false, cheese: false, toppings: {} };
        TOPPING_KEYS.forEach(k => this.pizzaState.toppings[k] = 0);
        this.historial = [];

        actualizarProcedimientoDOM([
            "1. Leer la comanda", "2. Untar la salsa", "3. Agregar el queso",
            "4. Colocar los ingredientes", "5. Hornear la pizza", "6. Verificar contra el pedido"
        ], 1);

        this.add.text(GAME_WIDTH / 2, 20, "ARMA LA PIZZA", { fontFamily: "Arial", fontSize: "22px", fontStyle: "bold", color: "#333333" }).setOrigin(0.5);
        this.add.image(GAME_WIDTH / 2, 190, "mesa_fondo");

        this.pizzaX = GAME_WIDTH / 2; this.pizzaY = 190;
        this.pizzaLayer = this.add.container(this.pizzaX, this.pizzaY);
        this.pizzaLayer.add(this.add.image(0, 0, "masa_corteza"));
        this.pizzaLayer.add(this.add.image(0, 0, "masa_base"));

        this.imgSalsa = null; this.imgQueso = null;

        this.crearBarraIngredientes();
        this.crearBotonesAccion();
    }

    crearBarraIngredientes() {
        const startY = 340, rowGap = 62, cols = 4, colGap = 148, startX = 76;
        this.botonesTopping = {};

        INGREDIENTS.forEach((ing, idx) => {
            const col = idx % cols; const row = Math.floor(idx / cols);
            const x = startX + col * colGap; const y = startY + row * rowGap;

            const bg = this.add.image(x, y, "btn_bg").setInteractive({ useHandCursor: true });
            const icono = this.add.image(x, y - 10, this.iconoDe(ing));
            icono.setScale(ing.type === "topping" ? 1.1 : 0.7);

            const label = this.add.text(x, y + 22, ing.name, {
                fontFamily: "Arial", fontSize: "11px", color: "#333333", align: "center", wordWrap: { width: 108 }
            }).setOrigin(0.5, 0);

            if (ing.type === "topping") {
                const contador = this.add.text(x + 48, y - 28, "0", {
                    fontFamily: "Arial", fontSize: "13px", fontStyle: "bold", color: "#ffffff", backgroundColor: "#E31837", padding: { x: 6, y: 2 }
                }).setOrigin(0.5);
                this.botonesTopping[ing.key] = contador;
            }

            bg.on("pointerover", () => bg.setScale(1.04));
            bg.on("pointerout", () => bg.setScale(1));
            bg.on("pointerdown", () => this.onIngredienteClick(ing));
        });
    }

    iconoDe(ing) {
        if (ing.key === "salsa" || ing.key === "queso") return ing.key;
        return "ing_" + ing.key;
    }

    crearBotonesAccion() {
        const y = 570;

        const undoBg = this.add.image(140, y, "btn_bg").setInteractive({ useHandCursor: true });
        this.add.text(140, y, "↩ Deshacer", { fontFamily: "Arial", fontSize: "13px", color: "#333333" }).setOrigin(0.5);
        undoBg.on("pointerdown", () => this.deshacer());

        const resetBg = this.add.image(300, y, "btn_bg").setInteractive({ useHandCursor: true });
        this.add.text(300, y, "⟳ Reiniciar", { fontFamily: "Arial", fontSize: "13px", color: "#333333" }).setOrigin(0.5);
        resetBg.on("pointerdown", () => this.reiniciar());

        this.hornoBg = this.add.image(470, y, "btn_primary_bg").setDisplaySize(150, 60).setInteractive({ useHandCursor: true });
        this.hornoLabel = this.add.text(470, y, "🔥 Meter al horno", { fontFamily: "Arial", fontSize: "13px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);
        this.actualizarEstadoBotonHorno();
        this.hornoBg.on("pointerdown", () => {
            if (!this.pizzaState.sauce) return;
            this.scene.start("OvenScene", { order: this.order, pizzaState: this.pizzaState });
        });
    }

    actualizarEstadoBotonHorno() {
        const habilitado = this.pizzaState.sauce;
        this.hornoBg.setAlpha(habilitado ? 1 : 0.4);
        this.hornoLabel.setAlpha(habilitado ? 1 : 0.4);
    }

    onIngredienteClick(ing) {
        if (ing.type === "sauce") {
            if (this.pizzaState.sauce) return;
            this.pizzaState.sauce = true;
            this.imgSalsa = this.add.image(0, 0, "salsa"); this.pizzaLayer.add(this.imgSalsa);
            this.historial.push({ tipo: "sauce" }); this.actualizarEstadoBotonHorno(); return;
        }
        if (ing.type === "cheese") {
            if (!this.pizzaState.sauce || this.pizzaState.cheese) return;
            this.pizzaState.cheese = true;
            this.imgQueso = this.add.image(0, 0, "queso"); this.pizzaLayer.add(this.imgQueso);
            this.historial.push({ tipo: "cheese" }); return;
        }
        if (!this.pizzaState.sauce || this.pizzaState.toppings[ing.key] >= MAX_PIEZAS_POR_TOPPING) return;

        const angulo = Math.random() * Math.PI * 2; const radio = Math.random() * 85;
        const px = Math.cos(angulo) * radio; const py = Math.sin(angulo) * radio;

        const pieza = this.add.image(px, py, "ing_" + ing.key);
        pieza.setAngle(randInt(0, 359)); this.pizzaLayer.add(pieza);

        this.pizzaState.toppings[ing.key] += 1;
        this.historial.push({ tipo: "topping", key: ing.key, obj: pieza });
        this.botonesTopping[ing.key].setText(String(this.pizzaState.toppings[ing.key]));
    }

    deshacer() {
        const ultimo = this.historial.pop(); if (!ultimo) return;
        if (ultimo.tipo === "sauce") { this.imgSalsa.destroy(); this.imgSalsa = null; this.pizzaState.sauce = false; }
        else if (ultimo.tipo === "cheese") { this.imgQueso.destroy(); this.imgQueso = null; this.pizzaState.cheese = false; }
        else if (ultimo.tipo === "topping") { ultimo.obj.destroy(); this.pizzaState.toppings[ultimo.key] -= 1; this.botonesTopping[ultimo.key].setText(String(this.pizzaState.toppings[ultimo.key])); }
        this.actualizarEstadoBotonHorno();
    }

    reiniciar() { while (this.historial.length > 0) this.deshacer(); }
}

/* ---------------------------------------------------------------------------
   7. OVEN SCENE - Estación de cocción y barra interactiva
--------------------------------------------------------------------------- */
class OvenScene extends Phaser.Scene {
    constructor() { super("OvenScene"); }
    init(data) { this.order = data.order; this.pizzaState = data.pizzaState; }

    create() {
        this.cameras.main.setBackgroundColor("#2b1f18");
        actualizarProcedimientoDOM(["1. Leer la comanda", "2. Untar la salsa", "3. Agregar el queso", "4. Colocar los ingredientes", "5. Hornear la pizza", "6. Verificar contra el pedido"], 4);

        this.add.text(GAME_WIDTH / 2, 30, "HORNEANDO LA PIZZA", { fontFamily: "Arial", fontSize: "22px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);
        this.add.image(GAME_WIDTH / 2, 220, "horno_fondo");

        this.pizzaImg = this.add.image(GAME_WIDTH / 2, 220, "masa_corteza").setScale(0.5).setTint(0xE9C287);
        this.add.image(GAME_WIDTH / 2, 220, "salsa").setScale(0.5);
        if (this.pizzaState.cheese) this.add.image(GAME_WIDTH / 2, 220, "queso").setScale(0.5);

        const barX = 100, barY = 380, barW = 400, barH = 30;
        const gfx = this.add.graphics();
        const anchoCruda = (HORNEADO.zonaCrudaHasta / 100) * barW;
        const anchoPerfecta = ((HORNEADO.zonaPerfectaHasta - HORNEADO.zonaCrudaHasta) / 100) * barW;
        const anchoQuemada = barW - anchoCruda - anchoPerfecta;

        gfx.fillStyle(0xF4D53E, 1); gfx.fillRect(barX, barY, anchoCruda, barH);
        gfx.fillStyle(0x8BC34A, 1); gfx.fillRect(barX + anchoCruda, barY, anchoPerfecta, barH);
        gfx.fillStyle(0x4A2C1D, 1); gfx.fillRect(barX + anchoCruda + anchoPerfecta, barY, anchoQuemada, barH);
        gfx.lineStyle(3, 0xffffff, 1); gfx.strokeRect(barX, barY, barW, barH);

        this.add.text(GAME_WIDTH / 2, barY - 20, "Saca la pizza cuando el indicador esté en la zona VERDE", { fontFamily: "Arial", fontSize: "13px", color: "#ffcc80" }).setOrigin(0.5);
        this.indicador = this.add.rectangle(barX, barY + barH / 2, 6, barH + 10, 0xffffff);
        this.estadoText = this.add.text(GAME_WIDTH / 2, barY + barH + 16, "CRUDA", { fontFamily: "Arial", fontSize: "15px", fontStyle: "bold", color: "#F4D53E" }).setOrigin(0.5);

        this.barX = barX; this.barW = barW; this.terminado = false;

        const sacarBg = this.add.image(GAME_WIDTH / 2, 470, "btn_accent_bg").setInteractive({ useHandCursor: true });
        this.add.image(GAME_WIDTH / 2 - 70, 470, "ut_pala").setScale(0.5);
        this.add.text(GAME_WIDTH / 2, 470, "SACAR PIZZA", { fontFamily: "Arial", fontSize: "16px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);
        sacarBg.on("pointerdown", () => this.sacarPizza());

        this.hornTween = this.tweens.addCounter({
            from: 0, to: 100, duration: HORNEADO.duracionMs,
            onUpdate: (tween) => {
                const progresoPct = tween.getValue();
                this.indicador.x = this.barX + (progresoPct / 100) * this.barW;
                if (progresoPct < HORNEADO.zonaCrudaHasta) { this.estadoText.setText("CRUDA").setColor("#F4D53E"); }
                else if (progresoPct <= HORNEADO.zonaPerfectaHasta) { this.estadoText.setText("¡PERFECTA! SÁCALA AHORA").setColor("#2e7d32"); }
                else { this.estadoText.setText("SE ESTÁ QUEMANDO").setColor("#c62828"); this.pizzaImg.setTint(0x8a5a2b); }
            },
            onComplete: () => this.sacarPizza()
        });
    }

    sacarPizza() {
        if (this.terminado) return; this.terminado = true;
        const progresoPct = this.hornTween.getValue(); this.hornTween.stop();
        let resultado = progresoPct < HORNEADO.zonaCrudaHasta ? "cruda" : (progresoPct <= HORNEADO.zonaPerfectaHasta ? "perfecta" : "quemada");
        this.scene.start("ResultScene", { order: this.order, pizzaState: this.pizzaState, bakeResult: resultado });
    }
}