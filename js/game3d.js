/* ==========================================================================
   OMNITRAIN · MÓDULO ENTORNO 3D
   Cocina Domino's construida por código + modelos .glb del proyecto.
   Objetivo: que el empleado se familiarice con la cocina y sepa
   dónde está cada área antes de pisar la tienda.

   Ubicación:  js/game3d.js
   Lo usa:     modules/entorno-3d/index.html
   Requiere:   js/three.module.min.js  (vía importmap "three")
               js/GLTFLoader.js  ·  js/DRACOLoader.js  ·  js/draco/
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from './GLTFLoader.js';
import { DRACOLoader } from './DRACOLoader.js';
// El refrigerador y el bote tienen esqueleto. Object3D.clone() NO reconecta
// los huesos del clon, así que se dibujan donde estaba el modelo original.
// SkeletonUtils.clone sí los reconecta, y ya venía en tu proyecto.
import { clone as clonarConEsqueleto } from './utils/SkeletonUtils.js';

const {
    Scene, Group, PerspectiveCamera, WebGLRenderer,
    PlaneGeometry, BoxGeometry, CylinderGeometry, TorusGeometry, SphereGeometry,
    MeshStandardMaterial, MeshBasicMaterial, Mesh,
    HemisphereLight, DirectionalLight, PointLight,
    Color, Fog, TextureLoader, CanvasTexture, LoadingManager,
    RepeatWrapping, DoubleSide, FrontSide,
    Box3, Vector2, Vector3, Raycaster,
    SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap
} = THREE;

/* ==========================================================================
   1 · MEDIDAS DE LA COCINA
   Todo está en metros. Si cambias esto, las estaciones se reacomodan solas
   porque sus posiciones están escritas en metros reales, no en porcentajes.
   ========================================================================== */
const COCINA = {
    ancho: 11.0,     // eje X  (de -5.5 a 5.5)
    fondo: 7.5,      // eje Z  (de -3.75 a 3.75)
    alto: 3.2
};
const LIM_X = COCINA.ancho / 2;
const LIM_Z = COCINA.fondo / 2;

const PALETA = {
    azul: 0x0077b6,
    azulOscuro: 0x002244,
    rojo: 0xe31837,
    acero: 0xc3c9cd,
    aceroOscuro: 0x596065,
    encimera: 0x2b2f33,
    pared: 0xe8e6e0,
    techo: 0x1b1a18,
    madera: 0xb07a45,
    negro: 0x17171a
};

/* ==========================================================================
   2 · LAS 10 ESTACIONES
   El campo "orden" es el paso real del flujo de trabajo: de que llega el
   insumo a que sale la pizza. El panel lateral y el modo Reto lo respetan.

   pos      → [x, z] en metros
   top      → altura útil de la estación (dónde aterriza la cámara y los props)
   hitbox   → [ancho, alto, fondo] de la caja invisible que se puede clickear
   ========================================================================== */
const ESTACIONES = [
    {
        id: 'recepcion', orden: 1, nombre: 'Recepción y almacén', icono: 'bi-truck',
        pos: [-4.5, 2.4], top: 0.85, hitbox: [1.5, 1.7, 1.6],
        resumen: 'Es la puerta de entrada de todo lo que se usa en la tienda. Aquí bajan las cajas del camión, se revisan y se acomodan antes de guardarlas.',
        tareas: [
            'Contar lo que llegó contra la nota de remisión',
            'Revisar fechas de caducidad caja por caja',
            'Acomodar por PEPS: lo más viejo adelante, lo nuevo atrás',
            'Todo sube a tarima, nada se queda en el piso'
        ],
        tip: 'Si una caja viene rota, mojada o abollada, no la metas al almacén. Repórtala al gerente en ese momento.'
    },
    {
        id: 'frio', orden: 2, nombre: 'Cámara fría', icono: 'bi-thermometer-snow',
        pos: [4.85, -3.3], top: 1.0, hitbox: [1.2, 2.0, 1.0],
        resumen: 'Guarda todo lo perecedero: masa, queso, salsas y toppings. Es el equipo más delicado de la cocina.',
        tareas: [
            'Registrar la temperatura al abrir y al cerrar el turno',
            'Mantener entre 1 °C y 4 °C',
            'Sacar solo la masa que vas a usar en la siguiente hora',
            'Nunca dejar la puerta abierta mientras acomodas'
        ],
        tip: 'La masa necesita atemperarse antes de estirarse. Si sale directo del frío se rompe.'
    },
    {
        id: 'estanteria', orden: 3, nombre: 'Estantería de secos', icono: 'bi-archive',
        pos: [5.1, 0.3], top: 1.55, hitbox: [0.9, 2.0, 3.0],
        resumen: 'Insumos que no necesitan frío: harina, latas de salsa, especias, servilletas y material de empaque.',
        tareas: [
            'Mantener las etiquetas viendo al frente para leerlas rápido',
            'Lo pesado abajo, lo ligero arriba',
            'Revisar el nivel de existencias antes de cada turno'
        ],
        tip: 'Deja siempre un dedo de espacio entre la repisa de arriba y los botes, o no vas a poder sacarlos con una mano.'
    },
    {
        id: 'armado', orden: 4, nombre: 'Mesa de armado', icono: 'bi-egg-fried',
        pos: [-0.3, -0.5], top: 0.92, hitbox: [2.2, 1.3, 1.4],
        resumen: 'El corazón de la cocina, también llamada make line. Aquí se estira la masa, se pone la salsa, el queso y los ingredientes en el orden correcto.',
        tareas: [
            'Estirar la masa sin romper la orilla',
            'Salsa en espiral desde el centro, dejando el borde limpio',
            'Queso parejo, sin montones',
            'Toppings en el orden de la receta, nunca al gusto'
        ],
        tip: 'Los botes de la barra de ingredientes están en el orden en que se usan. Si respetas ese orden no necesitas voltear a ver la receta.'
    },
    {
        id: 'horno', orden: 5, nombre: 'Horno de banda', icono: 'bi-fire',
        pos: [-1.9, -3.0], top: 1.45, hitbox: [1.9, 1.5, 1.6],
        resumen: 'Horno transportador: la pizza entra por un lado y sale por el otro ya cocida. El tiempo lo controla la velocidad de la banda, no tú.',
        tareas: [
            'Verificar temperatura y velocidad al abrir',
            'Meter la pizza centrada en la banda',
            'No amontonar dos pizzas en el mismo tramo',
            'Recibir la pizza a la salida, nunca dejarla caer'
        ],
        tip: 'Si la pizza sale pálida o quemada, el problema casi nunca es el horno: es la velocidad de la banda o el orden de entrada.'
    },
    {
        id: 'campana', orden: 6, nombre: 'Campana extractora', icono: 'bi-wind',
        pos: [-1.9, -3.0], top: 2.65, hitbox: [1.9, 0.9, 1.3],
        resumen: 'Saca el humo, la grasa y el calor que produce el horno. Sin ella la cocina se vuelve inhabitable en minutos.',
        tareas: [
            'Encenderla antes que el horno, siempre',
            'Revisar que los filtros estén puestos y limpios',
            'Reportar cualquier ruido raro o vibración'
        ],
        tip: 'Filtro con grasa acumulada es la causa número uno de incendio en cocina. Se limpia por turno, no por semana.'
    },
    {
        id: 'corte', orden: 7, nombre: 'Mesa de corte y empaque', icono: 'bi-scissors',
        pos: [1.1, 2.1], top: 0.92, hitbox: [2.1, 1.3, 1.3],
        resumen: 'La pizza sale del horno y aterriza aquí. Se corta, se revisa y se encaja para que salga presentable.',
        tareas: [
            'Cortar con el rodillo en un solo pase, sin serruchear',
            'Revisar que las rebanadas queden parejas',
            'Encajar de inmediato para que no pierda temperatura',
            'Poner el sello y la etiqueta del pedido'
        ],
        tip: 'Antes de cerrar la caja, compárala con el ticket. Es el último punto donde se puede corregir un error.'
    },
    {
        id: 'despacho', orden: 8, nombre: 'Mostrador de despacho', icono: 'bi-bag-check',
        pos: [4.2, 2.6], top: 1.05, hitbox: [1.9, 1.5, 1.1],
        resumen: 'El punto de salida. Aquí el repartidor recoge y el cliente de mostrador recibe su pedido.',
        tareas: [
            'Cotejar caja contra ticket antes de entregar',
            'Cargar primero lo que sale más lejos',
            'Mantener el mostrador despejado y limpio'
        ],
        tip: 'Nunca dejes una caja lista más de lo necesario en el rack. Cada minuto ahí es temperatura y sabor que se pierden.'
    },
    {
        id: 'lavado', orden: 9, nombre: 'Zona de lavado', icono: 'bi-droplet-fill',
        pos: [-4.95, -0.7], top: 0.8, hitbox: [1.0, 1.6, 1.5],
        resumen: 'Charolas, utensilios y manos. Es la estación que sostiene la higiene de toda la cocina.',
        tareas: [
            'Lavarte las manos al entrar y cada vez que cambies de tarea',
            'Tallar, enjuagar y desinfectar, en ese orden',
            'Dejar escurrir la charola antes de volver a usarla'
        ],
        tip: 'Lávate las manos antes de tocar masa y cada vez que cambies de tarea. El letrero de arriba no es adorno.'
    },
    {
        id: 'residuos', orden: 10, nombre: 'Higiene y residuos', icono: 'bi-trash3',
        pos: [-4.8, -2.8], top: 0.55, hitbox: [1.2, 1.3, 1.3],
        resumen: 'Bote de pedal, gel antibacterial y material de limpieza. Está lejos del armado a propósito.',
        tareas: [
            'Usar el pedal, nunca la tapa con la mano',
            'Sacar la bolsa antes de que se desborde',
            'Lavarte las manos después de tocar basura, sin excepción'
        ],
        tip: 'Fíjate qué tan lejos está esta estación de la mesa de armado. Esa distancia no es casualidad.'
    }
];

const porId = (id) => ESTACIONES.find(e => e.id === id);

/* ==========================================================================
   3 · MODO RETO
   ========================================================================== */
const PREGUNTAS = [
    { texto: 'Acaba de llegar el camión con insumos. ¿A dónde los llevas?', id: 'recepcion' },
    { texto: '¿Dónde se guardan la masa y el queso?', id: 'frio' },
    { texto: 'Se acabaron las latas de salsa. ¿Dónde buscas el repuesto?', id: 'estanteria' },
    { texto: '¿Dónde estiras la masa y colocas los ingredientes?', id: 'armado' },
    { texto: 'La pizza ya está armada. ¿Cuál es el siguiente paso?', id: 'horno' },
    { texto: 'La cocina se está llenando de humo. ¿Qué equipo revisas primero?', id: 'campana' },
    { texto: 'La pizza salió del horno. ¿Dónde la cortas y la encajas?', id: 'corte' },
    { texto: 'El repartidor viene por su pedido. ¿Dónde lo recoge?', id: 'despacho' },
    { texto: 'Vas a empezar tu turno. ¿Dónde te lavas las manos?', id: 'lavado' },
    { texto: 'Se te cayó una caja de cartón al piso. ¿Dónde la tiras?', id: 'residuos' },
    { texto: '¿Dónde revisas las fechas de caducidad de la mercancía nueva?', id: 'recepcion' },
    { texto: '¿Dónde debes registrar la temperatura al cerrar el turno?', id: 'frio' }
];

/* ==========================================================================
   4 · ESTADO
   ========================================================================== */
let scene, renderer, camara, contenedor, ancho, alto;
let luzHorno, tiempoHorno = 0;

let hitboxes = [];
let marcadores = new Map();   // id -> anillo del piso
let estacionActiva = null;

let modo = 'explorar';        // explorar | recorrido | reto

// Cámara orbital
const VISTA_GENERAL = { pos: new Vector3(-4.2, 5.2, 9.0), target: new Vector3(0, 0.9, -0.4) };
let orbitTarget = VISTA_GENERAL.target.clone();
let orbitTheta = 0, orbitPhi = 1.05, orbitRadius = 9;
const RADIO_MIN = 1.2, RADIO_MAX = 18;
let camAnim = null;

// Recorrido en primera persona
const FP = {
    pos: new Vector3(0, 1.62, 3.0),
    yaw: Math.PI,
    pitch: -0.05,
    velocidad: 2.7,
    radio: 0.34,
    teclas: Object.create(null)
};
const OBSTACULOS = [];        // AABB en planta: {x0, z0, x1, z1}

// Puntero
let punteroBloqueado = false;   // true cuando el mouse está capturado (recorrido)
let btnPantalla, mira;
let arrastrando = false;
let ultimoPuntero = { x: 0, y: 0 };
let inicioPuntero = { x: 0, y: 0 };
const raycaster = new Raycaster();
const puntero = new Vector2();

// Reto
const reto = { orden: [], indice: 0, aciertos: 0, intentos: 0, activo: false, bloqueado: false };

// Comida sobre la mesa de armado
// Minimapa
let mapaCanvas, mapaCtx;

// DOM
let elLista, elDetalle, elBtnVista, elHint, elChips, elReto;
let overlay, overlayBarra;

let reloj = performance.now();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ==========================================================================
   5 · CARGA
   ========================================================================== */
const manager = new LoadingManager();
let recursosFallidos = 0;

manager.onProgress = (url, cargados, total) => {
    if (!overlayBarra) return;
    overlayBarra.style.width = Math.round((cargados / Math.max(total, 1)) * 100) + '%';
};
manager.onError = (url) => {
    recursosFallidos++;
    console.warn('[entorno-3d] no cargó:', url);
};
manager.onLoad = () => cerrarOverlay();

function cerrarOverlay() {
    if (!overlay || overlay.dataset.cerrado) return;
    overlay.dataset.cerrado = '1';
    if (overlayBarra) overlayBarra.style.width = '100%';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 320);
    if (recursosFallidos > 0) {
        console.warn(`[entorno-3d] ${recursosFallidos} recurso(s) no cargaron. La escena se muestra igual.`);
    }
}

/* ==========================================================================
   6 · INIT
   ========================================================================== */
function init() {
    contenedor = document.getElementById('scene-container');
    if (!contenedor) { console.error('[entorno-3d] falta #scene-container'); return; }

    ancho = contenedor.clientWidth;
    alto = contenedor.clientHeight || 600;

    crearOverlay();

    scene = new Scene();
    scene.background = new Color(0x0b0d10);
    scene.fog = new Fog(0x0b0d10, 18, 38);

    renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(ancho, alto);
    contenedor.appendChild(renderer.domElement);

    camara = new PerspectiveCamera(55, ancho / alto, 0.05, 120);
    camara.position.copy(VISTA_GENERAL.pos);
    camara.lookAt(VISTA_GENERAL.target);
    sincronizarOrbita(VISTA_GENERAL.pos, VISTA_GENERAL.target);

    ponerLuces();
    construirCocina();
    crearHitboxes();
    registrarObstaculos();

    const draco = new DRACOLoader(manager);
    draco.setDecoderPath('../../js/draco/');
    const gltf = new GLTFLoader(manager);
    gltf.setDRACOLoader(draco);

    cargarEquipoDeCocina(gltf);
    cargarUtensilios(gltf);
    cargarComida(gltf);

    construirInterfaz();
    conectarEventos();

    // Red de seguridad: si un .glb tarda demasiado o no existe, la pantalla
    // de carga no debe quedarse encima de la escena para siempre.
    setTimeout(cerrarOverlay, 12000);

    onResize();
}

function crearOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'scene-loading';
    overlay.style.transition = 'opacity .3s ease';
    overlay.innerHTML = `
        <div class="scene-loading-label">Construyendo la cocina…</div>
        <div class="scene-loading-track"><div class="scene-loading-fill"></div></div>`;
    contenedor.appendChild(overlay);
    overlayBarra = overlay.querySelector('.scene-loading-fill');
}

function ponerLuces() {
    scene.add(new HemisphereLight(0xfff4e2, 0x2a2622, 0.75));

    const sol = new DirectionalLight(0xfff2dc, 1.15);
    sol.position.set(4.5, 8, 5);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.camera.left = -7;
    sol.shadow.camera.right = 7;
    sol.shadow.camera.top = 6;
    sol.shadow.camera.bottom = -6;
    sol.shadow.camera.far = 24;
    sol.shadow.bias = -0.0004;
    scene.add(sol);

    // Cuatro plafones. Más luces puntuales que esto empiezan a costar fps.
    [[-3.2, -1.6], [1.2, -1.6], [-3.2, 1.8], [1.2, 1.8]].forEach(([x, z]) => {
        const luz = new PointLight(0xfff1d9, 22, 9, 2);
        luz.position.set(x, 2.85, z);
        scene.add(luz);
    });

    luzHorno = new PointLight(0xff7a30, 9, 5.5, 2);
    luzHorno.position.set(-1.9, 1.15, -2.15);
    scene.add(luzHorno);
}

/* ==========================================================================
   7 · TEXTURAS
   ========================================================================== */
const texLoader = new TextureLoader(manager);

function cargarTextura(ruta, repX = 1, repY = 1) {
    const t = texLoader.load(ruta);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(repX, repY);
    t.colorSpace = SRGBColorSpace;
    return t;
}

function texturaProp(ruta) {
    const t = texLoader.load(ruta);
    t.flipY = false;
    t.colorSpace = SRGBColorSpace;
    return t;
}

/** Azulejo blanco de cocina dibujado en un canvas: pesa cero y se ve limpio. */
function texturaAzulejo() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#e9e7e1'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#cfccc4'; g.lineWidth = 5;
    for (let i = 0; i <= 256; i += 64) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
    const t = new CanvasTexture(c);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = SRGBColorSpace;
    return t;
}

/** Letrero de la tienda, también dibujado a mano para no cargar el PNG de 3840px. */
function texturaLetrero() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#002244'; g.fillRect(0, 0, 1024, 256);
    g.fillStyle = '#e31837'; g.fillRect(0, 210, 1024, 46);
    // Ficha de dominó
    g.fillStyle = '#ffffff';
    g.fillRect(64, 60, 150, 96);
    g.fillStyle = '#e31837'; g.fillRect(64, 60, 75, 96);
    g.fillStyle = '#0077b6'; g.fillRect(139, 60, 75, 96);
    g.fillStyle = '#ffffff';
    [[96, 88], [96, 128], [175, 108]].forEach(([x, y]) => {
        g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = '#ffffff';
    g.font = 'bold 78px Arial, sans-serif';
    g.fillText('COCINA', 260, 118);
    g.fillStyle = '#9fb6cc';
    g.font = 'bold 34px Arial, sans-serif';
    g.fillText('ÁREA DE PRODUCCIÓN', 262, 170);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
}

/** Estampa del ingrediente: el PNG 2D que va debajo de cada nombre. */
function texturaEtiqueta(clave) {
    const t = texLoader.load(`../../recursos/texturas/etiquetas/${clave}.png`);
    t.colorSpace = SRGBColorSpace;
    return t;
}

/** Etiqueta de texto para los botes de la barra de ingredientes. */
function etiqueta(texto, fondo = '#002244') {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = fondo; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#ffffff';
    g.font = 'bold 30px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texto.toUpperCase(), 128, 34);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
}

/* ==========================================================================
   8 · CONSTRUCCIÓN DE LA COCINA
   ========================================================================== */
function mat(color, rough = 0.7, metal = 0) {
    return new MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function caja(w, h, d, material, x, y, z, sombra = true) {
    const m = new Mesh(new BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = sombra;
    m.receiveShadow = true;
    scene.add(m);
    return m;
}

function construirCocina() {
    const matAcero = mat(PALETA.acero, 0.3, 0.72);
    const matAceroOscuro = mat(PALETA.aceroOscuro, 0.38, 0.65);
    const matEncimera = mat(PALETA.encimera, 0.5, 0.12);
    const matMadera = mat(PALETA.madera, 0.7);
    const matNegro = mat(PALETA.negro, 0.6, 0.2);
    const matRojo = mat(PALETA.rojo, 0.6);

    /* --- Piso: usa tu textura real, repetida para que no se vea estirada --- */
    const piso = new Mesh(
        new PlaneGeometry(COCINA.ancho, COCINA.fondo),
        new MeshStandardMaterial({ map: cargarTextura('../../images/piso_cocina.jpeg', 6, 4), roughness: 0.8, metalness: 0.05 })
    );
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    scene.add(piso);

    /* --- Techo --- */
    const techo = new Mesh(new PlaneGeometry(COCINA.ancho, COCINA.fondo), mat(PALETA.techo, 0.9));
    techo.position.y = COCINA.alto;
    techo.rotation.x = Math.PI / 2;
    scene.add(techo);

    /* --- Plafones de luz (solo visual, las luces reales ya están puestas) --- */
    const matPlafon = new MeshStandardMaterial({ color: 0xfff8ea, emissive: 0xfff0d2, emissiveIntensity: 1.4 });
    [-3.2, 1.2].forEach(x => {
        [-1.6, 1.8].forEach(z => {
            const p = new Mesh(new BoxGeometry(1.5, 0.06, 0.35), matPlafon);
            p.position.set(x, COCINA.alto - 0.07, z);
            scene.add(p);
        });
    });

    /* --- Paredes con azulejo + franja roja de marca --- */
    const paredes = [
        { w: COCINA.ancho, x: 0, z: -LIM_Z, rot: 0, rep: [11, 3] },
        { w: COCINA.ancho, x: 0, z: LIM_Z, rot: Math.PI, rep: [11, 3] },
        { w: COCINA.fondo, x: -LIM_X, z: 0, rot: Math.PI / 2, rep: [8, 3] },
        { w: COCINA.fondo, x: LIM_X, z: 0, rot: -Math.PI / 2, rep: [8, 3] }
    ];
    paredes.forEach(p => {
        const tex = texturaAzulejo();
        tex.repeat.set(p.rep[0], p.rep[1]);
        const m = new Mesh(new PlaneGeometry(p.w, COCINA.alto), new MeshStandardMaterial({ map: tex, roughness: 0.85 }));
        m.position.set(p.x, COCINA.alto / 2, p.z);
        m.rotation.y = p.rot;
        m.receiveShadow = true;
        scene.add(m);

        // Franja roja a la altura de la vista
        const franja = new Mesh(new PlaneGeometry(p.w, 0.16), matRojo);
        franja.position.set(p.x, 1.35, p.z);
        franja.rotation.y = p.rot;
        franja.position.add(new Vector3(Math.sin(p.rot), 0, Math.cos(p.rot)).multiplyScalar(0.012));
        scene.add(franja);
    });

    /* --- Zoclo sanitario de acero --- */
    caja(COCINA.ancho, 0.14, 0.06, matAceroOscuro, 0, 0.07, -LIM_Z + 0.03, false);
    caja(COCINA.ancho, 0.14, 0.06, matAceroOscuro, 0, 0.07, LIM_Z - 0.03, false);
    caja(0.06, 0.14, COCINA.fondo, matAceroOscuro, -LIM_X + 0.03, 0.07, 0, false);
    caja(0.06, 0.14, COCINA.fondo, matAceroOscuro, LIM_X - 0.03, 0.07, 0, false);

    /* --- Letrero sobre la pared del fondo --- */
    const letrero = new Mesh(
        new PlaneGeometry(2.8, 0.7),
        new MeshStandardMaterial({ map: texturaLetrero(), roughness: 0.6, emissive: 0x14243a, emissiveIntensity: 0.35 })
    );
    letrero.position.set(1.9, 2.45, -LIM_Z + 0.02);
    scene.add(letrero);

    /* --- Ventana de despacho en la pared del frente --- */
    const marco = caja(2.0, 1.15, 0.08, matAceroOscuro, 4.2, 1.85, LIM_Z - 0.04, false);
    marco.receiveShadow = false;
    const vidrio = new Mesh(
        new PlaneGeometry(1.82, 0.98),
        new MeshStandardMaterial({ color: 0xbfe3e0, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.28, side: DoubleSide })
    );
    vidrio.position.set(4.2, 1.85, LIM_Z - 0.09);
    scene.add(vidrio);

    construirArmado(matAcero, matEncimera, matAceroOscuro);
    construirBandaHorno(matAcero, matAceroOscuro, matNegro);
    construirCorte(matAcero, matEncimera);
    construirDespacho(matAcero, matAceroOscuro, matEncimera);
    construirEstanteria(matMadera, matAcero);
    construirRecepcion();
    construirLavado(matAcero);
    construirResiduos();
    construirMesaAuxiliar(matAcero, matEncimera);
    construirDetalles(matNegro);
    crearMarcadoresDePiso();
}

/* --- 4 · Mesa de armado con barra de ingredientes ------------------------ */
function construirArmado(matAcero, matEncimera, matAceroOscuro) {
    const st = porId('armado');
    const [x, z] = st.pos;

    // Base y cubierta de acero
    caja(2.0, st.top - 0.08, 1.0, matEncimera, x, (st.top - 0.08) / 2, z);
    caja(2.1, 0.08, 1.1, matAcero, x, st.top - 0.04, z);

    // Entrepaño inferior con charolas
    caja(1.9, 0.04, 0.85, matAceroOscuro, x, 0.22, z, false);

    // Barra refrigerada de ingredientes, pegada al lado del horno
    const barraZ = z - 0.62;
    caja(2.1, 0.32, 0.42, matAcero, x, st.top + 0.12, barraZ);

    /* El campo `arte` es el PNG de recursos/texturas/etiquetas/. Va DEBAJO
       del nombre, como la calcomanía que traen los botes en tienda: el
       empleado nuevo reconoce el dibujo antes de alcanzar a leer. */
    const ingredientes = [
        { nombre: 'Salsa', arte: 'salsa', color: 0xb02a1c },
        { nombre: 'Queso', arte: 'queso', color: 0xf2d98a },
        { nombre: 'Pepperoni', arte: 'pepperoni', color: 0xa8342c },
        { nombre: 'Jamón', arte: 'jamon', color: 0xe39a94 },
        { nombre: 'Champiñón', arte: 'champinon', color: 0xd8cbb4 },
        { nombre: 'Pimiento', arte: 'pimiento', color: 0x3f7d3a }
    ];

    const frente = barraZ + 0.212;   // cara delantera de la barra

    ingredientes.forEach((ing, i) => {
        const bx = x - 0.9 + i * 0.36;
        const bote = new Mesh(new BoxGeometry(0.31, 0.16, 0.31), matAcero);
        bote.position.set(bx, st.top + 0.32, barraZ);
        bote.castShadow = true;
        scene.add(bote);

        const contenido = new Mesh(new BoxGeometry(0.26, 0.05, 0.26), mat(ing.color, 0.85));
        contenido.position.set(bx, st.top + 0.38, barraZ);
        scene.add(contenido);

        // Nombre, un poco más arriba para dejarle sitio a la estampa.
        const et = new Mesh(
            new PlaneGeometry(0.3, 0.07),
            new MeshStandardMaterial({ map: etiqueta(ing.nombre), roughness: 0.7 })
        );
        et.position.set(bx, st.top + 0.215, frente);
        scene.add(et);

        /* Estampa del ingrediente, justo debajo del nombre.
           transparent + alphaTest recorta el fondo del PNG; sin alphaTest el
           recorte pelea con el orden de dibujado y deja un halo alrededor. */
        const estampa = new Mesh(
            new PlaneGeometry(0.13, 0.13),
            new MeshStandardMaterial({
                map: texturaEtiqueta(ing.arte),
                roughness: 0.85,
                transparent: true,
                alphaTest: 0.35
            })
        );
        estampa.position.set(bx, st.top + 0.105, frente + 0.001);
        scene.add(estampa);
    });

    // Aquí iba un harinero (el cilindro blanco de la esquina). Se quitó: no
    // se usaba para nada y solo tapaba la vista de la mesa.

    // Monitor de pedidos colgado
    const cable = new Mesh(new CylinderGeometry(0.012, 0.012, 0.78, 8), mat(PALETA.negro, 0.6));
    cable.position.set(x, 2.73, z);
    scene.add(cable);
    caja(0.62, 0.38, 0.05, mat(PALETA.negro, 0.4, 0.3), x, 2.15, z);
    const pantalla = new Mesh(
        new PlaneGeometry(0.56, 0.32),
        new MeshStandardMaterial({ color: 0x0d2b45, emissive: 0x0077b6, emissiveIntensity: 0.75 })
    );
    pantalla.position.set(x, 2.15, z + 0.03);
    scene.add(pantalla);
}

/* --- 5 · Banda de salida del horno --------------------------------------- */
function construirBandaHorno(matAcero, matAceroOscuro, matNegro) {
    const st = porId('horno');
    const [x, z] = st.pos;

    // Banda transportadora saliendo hacia la mesa de armado
    const banda = caja(1.5, 0.05, 1.0, matNegro, x + 0.05, 0.88, z + 1.15);
    banda.receiveShadow = true;
    caja(1.55, 0.5, 0.06, matAceroOscuro, x + 0.05, 0.63, z + 1.62, false);

    // Rodillos
    for (let i = 0; i < 5; i++) {
        const r = new Mesh(new CylinderGeometry(0.035, 0.035, 1.5, 12), matAcero);
        r.rotation.z = Math.PI / 2;
        r.position.set(x + 0.05, 0.92, z + 0.75 + i * 0.2);
        scene.add(r);
    }
    // Patas
    [[-0.6, 0.75], [0.7, 0.75], [-0.6, 1.55], [0.7, 1.55]].forEach(([dx, dz]) => {
        const p = new Mesh(new CylinderGeometry(0.03, 0.03, 0.88, 8), matAceroOscuro);
        p.position.set(x + 0.05 + dx, 0.44, z + dz);
        scene.add(p);
    });

    // Boca del horno: rectángulo naranja que sugiere el calor de adentro
    const boca = new Mesh(
        new PlaneGeometry(1.1, 0.22),
        new MeshBasicMaterial({ color: 0xff7a2a })
    );
    boca.position.set(x, 1.02, z + 0.84);
    scene.add(boca);
}

/* --- 7 · Mesa de corte y empaque ----------------------------------------- */
function construirCorte(matAcero, matEncimera) {
    const st = porId('corte');
    const [x, z] = st.pos;
    caja(1.9, st.top - 0.08, 1.0, matEncimera, x, (st.top - 0.08) / 2, z);
    caja(2.0, 0.08, 1.1, matAcero, x, st.top - 0.04, z);

    // Aquí iba una repisa alta con cajas. Se quitó: colgaba en el aire sin
    // soportes y no aportaba nada. Las cajas para encajar viven sobre la
    // mesa, que es donde se alcanzan.

    // Entrepaño bajo, este sí apoyado en la propia mesa.
    caja(1.75, 0.04, 0.8, matAcero, x, 0.26, z, false);
}

/* --- 8 · Mostrador de despacho con rack caliente -------------------------- */
function construirDespacho(matAcero, matAceroOscuro, matEncimera) {
    const st = porId('despacho');
    const [x, z] = st.pos;
    caja(1.8, st.top - 0.06, 0.9, matEncimera, x, (st.top - 0.06) / 2, z);
    caja(1.9, 0.06, 1.0, matAcero, x, st.top - 0.03, z);

    // Rack de tres niveles con lámpara de calor
    [0, 1, 2].forEach(i => {
        caja(1.6, 0.04, 0.7, matAcero, x, st.top + 0.32 + i * 0.34, z, false);
    });
    [[-0.78, -0.32], [0.78, -0.32], [-0.78, 0.32], [0.78, 0.32]].forEach(([dx, dz]) => {
        const p = new Mesh(new CylinderGeometry(0.022, 0.022, 1.08, 8), matAceroOscuro);
        p.position.set(x + dx, st.top + 0.56, z + dz);
        scene.add(p);
    });
    const lampara = new Mesh(
        new BoxGeometry(1.5, 0.05, 0.2),
        new MeshStandardMaterial({ color: 0xffb066, emissive: 0xff8a3c, emissiveIntensity: 1.2 })
    );
    lampara.position.set(x, st.top + 1.28, z);
    scene.add(lampara);
}

/* --- 3 · Estantería de secos ---------------------------------------------- */
function construirEstanteria(matMadera, matAcero) {
    const st = porId('estanteria');
    const [x, z] = st.pos;

    for (let i = 0; i < 4; i++) {
        const y = 0.35 + i * 0.55;
        caja(0.55, 0.05, 2.8, matMadera, x, y, z);
        for (let j = 0; j < 5; j++) {
            const bote = new Mesh(new CylinderGeometry(0.11, 0.11, 0.26, 14), matAcero);
            bote.position.set(x, y + 0.16, z - 1.15 + j * 0.58);
            bote.castShadow = true;
            scene.add(bote);
            const tapa = new Mesh(new CylinderGeometry(0.115, 0.115, 0.02, 14), mat(PALETA.azul, 0.6));
            tapa.position.set(x, y + 0.3, z - 1.15 + j * 0.58);
            scene.add(tapa);
        }
    }
    // Postes
    [-1.4, 1.4].forEach(dz => {
        const p = new Mesh(new CylinderGeometry(0.035, 0.035, 2.1, 8), matAcero);
        p.position.set(x, 1.05, z + dz);
        scene.add(p);
    });
}

/* --- 1 · Recepción -------------------------------------------------------- */
function construirRecepcion() {
    const st = porId('recepcion');
    const [x, z] = st.pos;

    // El palet, el patín y las cajas ahora son modelos reales (ver la
    // sección 10). Aquí solo queda el señalamiento de piso que delimita
    // la zona de descarga: eso sí conviene dibujarlo, porque en tienda va
    // pintado en el suelo y marca dónde NO estorbar.
    const franja = new Mesh(
        new PlaneGeometry(1.7, 1.7),
        new MeshStandardMaterial({ color: 0xf0a020, roughness: 0.9, transparent: true, opacity: 0.22 })
    );
    franja.rotation.x = -Math.PI / 2;
    franja.position.set(x, 0.006, z);
    franja.receiveShadow = true;
    scene.add(franja);
}

/* --- 9 · Lavado: pegado al muro izquierdo, bajo su letrero ---------------- */
function construirLavado(matAcero) {
    const z = porId('lavado').pos[1];
    const muro = -LIM_X;

    // El letrero vive con el lavamanos, que es donde tiene sentido leerlo.
    const cartel = new Mesh(
        new PlaneGeometry(0.8, 0.2),
        new MeshStandardMaterial({ map: etiqueta('Lava tus manos', '#0077b6'), roughness: 0.7 })
    );
    cartel.position.set(muro + 0.03, 1.78, z);
    cartel.rotation.y = Math.PI / 2;
    scene.add(cartel);

    // Escurridor de pared, al lado del mueble
    caja(0.35, 0.04, 0.9, matAcero, muro + 0.2, 1.55, z + 0.9);

    // Dispensador de jabón
    caja(0.1, 0.26, 0.12, mat(0xf2f4f6, 0.6), muro + 0.08, 1.02, z - 0.52, true);

    // Tapete antifatiga, justo donde te paras a lavar
    const tapete = new Mesh(new PlaneGeometry(1.0, 1.1), mat(0x2f2b26, 0.95));
    tapete.rotation.x = -Math.PI / 2;
    tapete.position.set(muro + 1.15, 0.008, z);
    tapete.receiveShadow = true;
    scene.add(tapete);
}

/* --- 10 · Residuos e higiene: al fondo del muro izquierdo ----------------- */
function construirResiduos() {
    const z = porId('residuos').pos[1];
    const muro = -LIM_X;

    // Dispensador de gel, por encima de la franja roja para que se vea
    caja(0.12, 0.3, 0.16, mat(0xf2f4f6, 0.6), muro + 0.09, 1.68, z, true);
    const gota = new Mesh(new SphereGeometry(0.05, 12, 10), mat(0x9ad7f0, 0.3));
    gota.position.set(muro + 0.09, 1.5, z);
    scene.add(gota);
}

/* --- Mesa auxiliar del fondo (relleno del hueco entre horno y cámara) ----- */
function construirMesaAuxiliar(matAcero, matEncimera) {
    caja(2.4, 0.84, 0.7, matEncimera, 1.5, 0.42, -3.25);
    caja(2.5, 0.06, 0.8, matAcero, 1.5, 0.87, -3.25);
    caja(2.3, 0.04, 0.6, matAcero, 1.5, 0.28, -3.25, false);
}

/* --- Detalles sueltos ----------------------------------------------------- */
function construirDetalles(matNegro) {
    // Tapete de entrada
    const tapete = new Mesh(new PlaneGeometry(1.4, 0.9), mat(0x24262a, 0.95));
    tapete.rotation.x = -Math.PI / 2;
    tapete.position.set(-0.3, 0.008, 3.1);
    tapete.receiveShadow = true;
    scene.add(tapete);

    // Reloj checador
    caja(0.28, 0.34, 0.08, matNegro, -0.3, 1.6, LIM_Z - 0.05, true);
}

/* --- Anillos en el piso que numeran el flujo de trabajo ------------------- */
function crearMarcadoresDePiso() {
    ESTACIONES.forEach(st => {
        const anillo = new Mesh(
            new TorusGeometry(0.5, 0.035, 8, 40),
            new MeshBasicMaterial({ color: PALETA.azul, transparent: true, opacity: 0.32 })
        );
        anillo.rotation.x = -Math.PI / 2;
        anillo.position.set(st.pos[0], 0.02, st.pos[1]);
        scene.add(anillo);
        marcadores.set(st.id, anillo);
    });
}

/* ==========================================================================
   9 · NORMALIZAR Y COLOCAR MODELOS
   Cada .glb viene en su propia escala y con su propio centro. Estas dos
   funciones los dejan siempre con la base en Y=0 y centrados en X/Z, para
   poder colocarlos con coordenadas reales de la cocina.
   ========================================================================== */
function normalizar(objeto, tamano, eje = 'max', escalaFija = null) {
    const modelo = clonarConEsqueleto(objeto);
    modelo.updateMatrixWorld(true);

    const bb = new Box3().setFromObject(modelo);
    const tam = bb.getSize(new Vector3());
    const centro = bb.getCenter(new Vector3());

    let escala = escalaFija;
    if (escala == null) {
        const dim = eje === 'y' ? tam.y
            : eje === 'x' ? tam.x
                : eje === 'z' ? tam.z
                    : Math.max(tam.x, tam.y, tam.z);
        escala = tamano / (dim || 1);
    }

    modelo.position.sub(new Vector3(centro.x, bb.min.y, centro.z));

    const envoltura = new Group();
    envoltura.add(modelo);
    envoltura.scale.setScalar(escala);
    envoltura.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    return envoltura;
}

/** Saca una pieza suelta de un .glb que trae varias (rodillo, cortador, caja…). */
function extraerPieza(raiz, nombre, tamano, eje = 'max') {
    raiz.updateMatrixWorld(true);
    const nodo = raiz.getObjectByName(nombre);
    if (!nodo) { console.warn('[entorno-3d] pieza no encontrada:', nombre); return null; }
    const clon = nodo.clone(true);
    clon.matrix.copy(nodo.matrixWorld);
    clon.matrix.decompose(clon.position, clon.quaternion, clon.scale);
    return normalizar(clon, tamano, eje);
}

/** Si un .glb no carga, dejamos un bloque gris en su lugar para que se note. */
function marcadorFaltante(w, h, d, x, z, etiquetaTexto) {
    const m = caja(w, h, d, mat(0x8a8f94, 0.9), x, h / 2, z);
    m.userData.faltante = etiquetaTexto;
    return m;
}

/** Encaja el modelo contra dos muros. sx/sz valen 1 o -1 y dicen a qué
 *  esquina va: (1, -1) es la esquina derecha del fondo. Se mide después de
 *  girar, para que quede a ras aunque haya cambiado de lado. */
function acomodarEnEsquina(modelo, sx, sz, margen = 0.05) {
    modelo.updateMatrixWorld(true);
    const bb = new Box3().setFromObject(modelo);
    const tam = bb.getSize(new Vector3());
    const centro = bb.getCenter(new Vector3());

    const destinoX = sx > 0 ? LIM_X - margen - tam.x / 2 : -LIM_X + margen + tam.x / 2;
    const destinoZ = sz > 0 ? LIM_Z - margen - tam.z / 2 : -LIM_Z + margen + tam.z / 2;

    modelo.position.x += destinoX - centro.x;
    modelo.position.z += destinoZ - centro.z;
    modelo.updateMatrixWorld(true);

    return { x: destinoX, z: destinoZ, ancho: tam.x, fondo: tam.z };
}

/** Recarga el modelo contra un muro lateral sin cambiar su coordenada Z.
 *  sx vale -1 para el muro izquierdo y 1 para el derecho. */
function acomodarEnPared(modelo, sx, z, margen = 0.04) {
    modelo.updateMatrixWorld(true);
    const bb = new Box3().setFromObject(modelo);
    const tam = bb.getSize(new Vector3());
    const centro = bb.getCenter(new Vector3());

    const destinoX = sx > 0 ? LIM_X - margen - tam.x / 2 : -LIM_X + margen + tam.x / 2;

    modelo.position.x += destinoX - centro.x;
    modelo.position.z += z - centro.z;
    modelo.updateMatrixWorld(true);

    return { x: destinoX, z, ancho: tam.x, fondo: tam.z };
}

/** Ajusta solo la caja de colisión de una estación, dejando su anillo y su
 *  ficha donde están (el anillo se ve mejor centrado en el piso libre). */
function obstaculoDe(id, x, z, ancho, fondo) {
    const obs = OBSTACULOS.find(o => o.id === id);
    if (!obs) return;
    obs.x0 = x - ancho / 2; obs.x1 = x + ancho / 2;
    obs.z0 = z - fondo / 2; obs.z1 = z + fondo / 2;
}

/** Reubica una estación completa: ficha, anillo del piso, zona clickeable,
 *  colisión del recorrido y punto del minimapa, todo de un jalón. */
function moverEstacion(id, x, z, ancho, fondo) {
    const st = porId(id);
    if (!st) return;
    st.pos[0] = x;
    st.pos[1] = z;

    const zona = hitboxes.find(h => h.userData.estacion === id);
    if (zona) zona.position.set(x, st.top, z);

    const anillo = marcadores.get(id);
    if (anillo) anillo.position.set(x, 0.02, z);

    const obs = OBSTACULOS.find(o => o.id === id);
    if (obs && ancho && fondo) {
        obs.x0 = x - ancho / 2; obs.x1 = x + ancho / 2;
        obs.z0 = z - fondo / 2; obs.z1 = z + fondo / 2;
    }
}

function colocar(objeto, x, y, z, rotY = 0) {
    objeto.position.set(x, y, z);
    objeto.rotation.y = rotY;
    scene.add(objeto);
    return objeto;
}

/* ==========================================================================
   10 · EQUIPO MAYOR
   Si algún modelo te queda volteado, el único número que tienes que tocar
   es el último argumento de colocar(): la rotación en Y.
   ========================================================================== */
const RUTA = '../../recursos/';

function cargarEquipoDeCocina(loader) {
    // --- Horno de banda ---
    loader.load(RUTA + 'built-in_oven.glb', g => {
        const st = porId('horno');
        colocar(normalizar(g.scene, 1.5, 'y'), st.pos[0], 0, st.pos[1] + 0.05, 0);
    }, undefined, () => marcadorFaltante(1.55, 1.5, 1.5, -1.9, -2.95, 'horno'));

    // --- Campana extractora, justo encima del horno ---
    loader.load(RUTA + 'ge_stainless_steel_chimney_stylerange_hood.glb', g => {
        const st = porId('campana');
        // El ancho de este modelo corre sobre su eje Z, por eso normalizamos
        // en 'z' y lo giramos 90°: así queda del ancho exacto del horno.
        colocar(normalizar(g.scene, 1.55, 'z'), st.pos[0], 2.0, -3.2, Math.PI / 2);
    }, undefined, () => marcadorFaltante(1.55, 1.15, 1.0, -1.9, -3.2, 'campana'));

    // --- Cámara fría: esquinada al fondo a la derecha ---
    loader.load(RUTA + 'modern_refrigerator_with_freezer_drawer.glb', g => {
        const modelo = normalizar(g.scene, 1.95, 'y');
        modelo.position.set(0, 0, 0);

        // ¡AQUÍ CONTROLAS HACIA DÓNDE MIRA!
        // Prueba con: Math.PI / 2, -Math.PI / 2, o Math.PI
        modelo.rotation.y = -Math.PI / 2;

        scene.add(modelo);

        // El giro de arriba se aplica antes de medir, así que la esquina se
        // calcula sobre la orientación que tú elegiste.
        const lugar = acomodarEnEsquina(modelo, 1, -1);
        // La ficha, el anillo y el punto del minimapa se van con él.
        moverEstacion('frio', lugar.x, lugar.z, lugar.ancho + 0.15, lugar.fondo + 0.15);
    }, undefined, () => marcadorFaltante(1.0, 1.95, 0.75, 4.85, -3.3, 'refrigerador'));

    // --- Lavamanos: recargado en el muro izquierdo, debajo de su letrero ---
    loader.load(RUTA + 'kitchen_counter_with_sink.glb', g => {
        const st = porId('lavado');
        // rotación 0: la jaladera del mueble (su frente) apunta a +X, o sea a
        // la cocina, y la llave queda contra la pared. Medido en el modelo.
        const modelo = normalizar(g.scene, 0.95, 'y');
        modelo.position.set(0, 0, 0);
        scene.add(modelo);
        const lugar = acomodarEnPared(modelo, -1, st.pos[1]);
        obstaculoDe('lavado', lugar.x, lugar.z, lugar.ancho + 0.12, lugar.fondo + 0.12);
    }, undefined, () => marcadorFaltante(0.6, 0.95, 0.62, -5.17, -0.7, 'lavamanos'));

    /* --- Recepción: patín cargado con palet y cajas ---

       El montaje va apilado: patín en el piso, palet sobre sus horquillas
       y las cajas sobre el palet. Por eso los tres modelos se cargan aquí
       juntos y se arman al final, cuando ya llegaron todos: si cada uno se
       colocara por su cuenta, el que llegara primero no sabría a qué
       altura ponerse.

       OJO: cada callback necesita su propia `const st`. Los callbacks del
       cargador corren mucho después, y fuera de ellos no existe ningún st. */
    montarRecepcion(loader);

    // --- Bote de pedal: al fondo del mismo muro ---
    loader.load(RUTA + 'trashcan.glb', g => {
        const st = porId('residuos');
        colocar(normalizar(g.scene, 0.8, 'max'), st.pos[0], 0, st.pos[1], 0.4);
    }, undefined, () => marcadorFaltante(0.5, 0.65, 0.5, -4.8, -2.8, 'bote'));
}

/* ==========================================================================
   RECEPCIÓN: PATÍN + PALET + CAJAS
   --------------------------------------------------------------------------
   Los tres van apilados, así que se cargan juntos y se arman cuando ya
   llegaron los tres. Todas las medidas que quizá quieras mover están en
   RECEPCION, aquí abajo: no hay números sueltos repartidos por el código.
   ========================================================================== */

const RECEPCION = {
    // Alto del patín, de las ruedas a la punta de la palanca.
    altoPatin: 1.22,

    /* A qué altura quedan las horquillas, como fracción del alto del patín.
       Sale de medir el modelo: las ruedas delanteras rematan al 5.7 % y las
       horquillas apoyan justo encima. Si el palet te queda hundido o flotando,
       este es EL número que hay que mover. */
    fraccionHorquillas: 0.105,

    largoPalet: 1.20,      // el lado largo corre sobre las horquillas
    aristaCaja: 0.42,

    // El palet va adelantado sobre las horquillas, no centrado en el patín:
    // así es como queda cuando de verdad lo levantas.
    paletAdelante: -0.06,

    giro: Math.PI * 0.5    // hacia dónde apunta el conjunto
};

function montarRecepcion(loader) {
    const st = porId('recepcion');
    const cx = st.pos[0], cz = st.pos[1];

    const piezas = {};
    const armarSiEstanTodas = () => {
        if (!piezas.patin || !piezas.palet || !piezas.caja) return;
        armarRecepcion(piezas, cx, cz);
    };

    loader.load(RUTA + 'diablito.glb', g => {
        piezas.patin = g.scene; armarSiEstanTodas();
    }, undefined, () => marcadorFaltante(0.6, 1.2, 1.5, cx, cz, 'patín'));

    loader.load(RUTA + 'palet_interior.glb', g => {
        piezas.palet = g.scene; armarSiEstanTodas();
    }, undefined, () => console.warn('[entorno-3d] sin palet'));

    loader.load(RUTA + 'caja_carton.glb', g => {
        piezas.caja = g.scene; armarSiEstanTodas();
    }, undefined, () => console.warn('[entorno-3d] sin cajas de cartón'));
}

function armarRecepcion(piezas, cx, cz) {
    const R = RECEPCION;

    /* 1 · El patín, en el piso. */
    const patin = normalizar(piezas.patin, R.altoPatin, 'y');
    colocar(patin, cx, 0, cz, R.giro);

    /* 2 · El palet, encima de las horquillas.
       El desplazamiento se gira junto con el conjunto: si no, al cambiar
       RECEPCION.giro el palet se quedaría apuntando a otro lado. */
    const yHorquillas = R.altoPatin * R.fraccionHorquillas;
    const dz = R.paletAdelante;
    const px = cx + Math.sin(R.giro) * dz;
    const pz = cz + Math.cos(R.giro) * dz;

    // El palet se gira 90° respecto al patín: su lado largo debe correr a lo
    // largo de las horquillas, no cruzado sobre ellas.
    const palet = normalizar(piezas.palet, R.largoPalet, 'z');
    colocar(palet, px, yHorquillas, pz, R.giro + Math.PI / 2);
    const altoPalet = alturaDe(palet);

    /* 3 · Tres cajas en triángulo: dos atrás y una al frente, centrada. */
    // Triángulo: dos atrás y una al frente. Los factores dejan unos 4 cm de
    // aire entre cajas; por debajo de 0.5 se tocarían.
    const a = R.aristaCaja;
    const sitios = [
        [-a * 0.54, -a * 0.55, 0.05],
        [a * 0.54, -a * 0.55, -0.07],
        [0, a * 0.55, 0.12]
    ];

    sitios.forEach(([ux, uz, giroCaja]) => {
        // ux/uz están en ejes del palet, así que se rotan con el conjunto.
        const gx = cx + Math.cos(R.giro) * ux + Math.sin(R.giro) * (uz + dz);
        const gz = cz - Math.sin(R.giro) * ux + Math.cos(R.giro) * (uz + dz);
        const caja = normalizar(piezas.caja, a, 'max');
        colocar(caja, gx, yHorquillas + altoPalet, gz, R.giro + giroCaja);
    });
}

function alturaDe(modelo) {
    modelo.updateMatrixWorld(true);
    return new Box3().setFromObject(modelo).getSize(new Vector3()).y;
}

/* ==========================================================================
   11 · UTENSILIOS
   ========================================================================== */
function cargarUtensilios(loader) {
    // --- Rodillo, cortador y caja vienen los tres en el mismo archivo ---
    loader.load(RUTA + 'pizza_box_rolling_pin_pizza_cutter.glb', g => {
        const armado = porId('armado');
        const corte = porId('corte');
        const raiz = g.scene;

        const rodillo = extraerPieza(raiz, 'RollingPin_ModelMain_0', 0.42);
        if (rodillo) colocar(rodillo, armado.pos[0] + 0.8, armado.top, armado.pos[1] - 0.1, 0.35);

        const cortador = extraerPieza(raiz, 'PizzaCutter_ModelMain_1', 0.22);
        // Media vuelta: el desplazamiento se espeja y la rotación suma PI.
        if (cortador) colocar(cortador, corte.pos[0] - 0.05, corte.top, corte.pos[1] - 0.35, -0.5 + Math.PI);

        // La caja de repuesto se va a la mesa auxiliar del fondo, para no
        // encimarla con la caja abierta que ya está en la mesa de corte.
        const cajita = extraerPieza(raiz, 'PizzaBox_ModelMain_2', 0.34);
        if (cajita) colocar(cajita, 2.45, 0.9, -3.25, 0.15);
    }, undefined, () => console.warn('[entorno-3d] sin rodillo/cortador'));

    // --- Charola de horno, en la banda de salida ---
    loader.load(RUTA + 'pizza__tray.glb', g => {
        const st = porId('horno');
        colocar(normalizar(g.scene, 0.44, 'max'), st.pos[0] + 0.05, 0.92, st.pos[1] + 1.25, 0.2);
    }, undefined, () => console.warn('[entorno-3d] sin charola'));

    /* --- Cajas de pizza cerradas: solo en despacho ---
       La pila que estaba en recepción se quitó: ahí ahora van cajas de
       cartón sobre el palet, que es lo que de verdad llega en el camión.
       Las cajas de pizza son producto terminado y su sitio es la salida. */
    loader.load(RUTA + 'dominos_pizza_box.glb', g => {
        const desp = porId('despacho');
        for (let i = 0; i < 3; i++) {
            const c = normalizar(g.scene, 0.38, 'max');
            colocar(c, desp.pos[0] - 0.45, desp.top + 0.35 + i * 0.05, desp.pos[1], -0.1 + i * 0.08);
        }
    }, undefined, () => console.warn('[entorno-3d] sin cajas cerradas'));

    // --- Caja abierta lista para encajar, sobre la mesa de corte ---
    loader.load(RUTA + 'pizza_box_-dominos.glb', g => {
        const st = porId('corte');
        colocar(normalizar(g.scene, 0.42, 'x'), st.pos[0] - 0.62, st.top, st.pos[1] + 0.15, -0.25 + Math.PI);
    }, undefined, () => console.warn('[entorno-3d] sin caja abierta'));

    // --- Pack de utensilios (foodpack trae su geometría embebida) ---
    loader.load(RUTA + 'foodpack.gltf', g => {
        const raiz = g.scene;
        const armado = porId('armado');
        const desp = porId('despacho');

        const M = {
            pizza1: matProp('pizza_text.jpg', 0.55),
            pizza2: matProp('pizza2_text.jpg', 0.55),
            spatula: matProp('spatula-tex.jpg', 0.45, 0.15),
            peel: matProp('pizzapeel-tex.png', 0.8, 0, true),
            plato: matProp('woodenplate-text.jpg', 0.75)
        };

        const pieza = (nombre, tam, material) => {
            const p = extraerPieza(raiz, nombre, tam);
            if (p && material) p.traverse(o => { if (o.isMesh) o.material = material; });
            return p;
        };

        /* El plato de madera, la masa cruda y los toppings sembrados uno por
           uno vivían aquí. Se quitaron: por más que se ajustaran las alturas,
           las piezas se leían como elementos flotando sobre la mesa en vez de
           una pizza. En su lugar va el modelo completo de pizza-optimized.glb
           (ver la sección 12). */

        const espatula = pieza('spatula', 0.36, M.spatula);
        if (espatula) colocar(espatula, armado.pos[0] + 0.4, armado.top + 0.02, armado.pos[1] + 0.28, -0.4);

        // La pala vive junto al horno, sobre la mesa auxiliar del fondo.
        const pala = pieza('pizza_peel', 0.7, M.peel);
        if (pala) colocar(pala, 0.7, 0.9, -3.25, 0.12);

        const platoChico = pieza('woodenplate_small', 0.24, M.plato);
        if (platoChico) colocar(platoChico, armado.pos[0] - 0.8, armado.top, armado.pos[1] - 0.3);

        const pizzaLista = pieza('pizza1', 0.32, M.pizza1);
        if (pizzaLista) colocar(pizzaLista, desp.pos[0] + 0.5, desp.top + 0.36, desp.pos[1]);

        const pizzaRack = pieza('pizza2', 0.32, M.pizza2);
        if (pizzaRack) colocar(pizzaRack, desp.pos[0] + 0.5, desp.top + 0.7, desp.pos[1]);
    }, undefined, () => console.warn('[entorno-3d] sin foodpack'));
}

function matProp(archivo, rough = 0.7, metal = 0, recorte = false) {
    return new MeshStandardMaterial({
        map: texturaProp(RUTA + 'texturas/' + archivo),
        roughness: rough,
        metalness: metal,
        alphaTest: recorte ? 0.5 : 0,
        side: recorte ? DoubleSide : FrontSide
    });
}

/* ==========================================================================
   12 · COMIDA
   El pepperoni y el queso se cargan por separado y pueden llegar antes o
   después que la masa, así que cada uno intenta acomodarse cuando termina.
   ========================================================================== */
function cargarComida(loader) {
    loader.load(RUTA + 'pizza-optimized.glb', g => {
        const corte = porId('corte');
        colocar(normalizar(g.scene, 0.34, 'max'),
            corte.pos[0] + 0.55, corte.top + 0.05, corte.pos[1] + 0.02, Math.PI);

        // Segunda pizza sobre la mesa de armado. Antes ahí había un montaje
        // de piezas sueltas (plato, masa, quesos y pepperonis colocados uno
        // por uno) que se veía flotando. Este modelo es una pizza entera.
        const armado = porId('armado');
        colocar(normalizar(g.scene, 0.42, 'max'),
            armado.pos[0] - 0.5, armado.top + 0.04, armado.pos[1] + 0.16, 0.4);
    }, undefined, () => console.warn('[entorno-3d] sin pizza'));

    /* Aquí se cargaban pepperoni.glb y shredded_cheese_melted.glb para
       sembrarlos rebanada por rebanada sobre la masa cruda. Con la pizza
       completa ya no hacen falta, y se quitaron también del proyecto:
       eran 832 KB que se descargaban para no dibujar nada. */
}

/* ==========================================================================
   13 · HITBOXES Y COLISIONES
   ========================================================================== */
function crearHitboxes() {
    const invisible = new MeshBasicMaterial({ visible: false });
    ESTACIONES.forEach(st => {
        const [w, h, d] = st.hitbox;
        const c = new Mesh(new BoxGeometry(w, h, d), invisible);
        c.position.set(st.pos[0], st.top, st.pos[1]);
        c.userData.estacion = st.id;
        scene.add(c);
        hitboxes.push(c);
    });
}

function obstaculo(x, z, w, d, id = null) {
    OBSTACULOS.push({ id, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
}

function registrarObstaculos() {
    obstaculo(-0.3, -0.5, 2.1, 1.1);      // mesa de armado
    obstaculo(-0.3, -1.12, 2.1, 0.5);     // barra de ingredientes
    obstaculo(1.1, 2.1, 2.0, 1.1);        // mesa de corte
    obstaculo(4.2, 2.6, 1.9, 1.0);        // despacho
    obstaculo(-1.9, -2.95, 1.7, 1.6);     // horno
    obstaculo(-1.85, -1.85, 1.6, 1.1);    // banda de salida
    obstaculo(4.85, -3.3, 1.1, 0.85, 'frio');   // cámara fría
    obstaculo(5.1, 0.3, 0.7, 2.9);        // estantería
    obstaculo(-5.17, -0.7, 0.7, 0.7, 'lavado');   // lavamanos
    obstaculo(-4.8, -2.8, 0.9, 0.9, 'residuos');  // bote de basura
    obstaculo(-4.5, 2.40, 1.6, 1.3, 'recepcion');   // patín con palet y cajas
    obstaculo(1.5, -3.25, 2.5, 0.8);      // mesa auxiliar
}

/** Choca contra muebles y paredes. Prueba cada eje por separado para que
 *  al rozar una mesa el jugador se deslice en vez de quedarse pegado. */
function moverConColision(nx, nz) {
    const r = FP.radio;
    const chocaX = OBSTACULOS.some(o => nx + r > o.x0 && nx - r < o.x1 && FP.pos.z + r > o.z0 && FP.pos.z - r < o.z1);
    if (!chocaX) FP.pos.x = clamp(nx, -LIM_X + 0.4, LIM_X - 0.4);

    const chocaZ = OBSTACULOS.some(o => FP.pos.x + r > o.x0 && FP.pos.x - r < o.x1 && nz + r > o.z0 && nz - r < o.z1);
    if (!chocaZ) FP.pos.z = clamp(nz, -LIM_Z + 0.4, LIM_Z - 0.4);
}

/* ==========================================================================
   14 · INTERFAZ
   ========================================================================== */
function construirInterfaz() {
    elLista = document.querySelector('.station-list');
    elDetalle = document.querySelector('.station-detail');
    elBtnVista = document.getElementById('btnVistaGeneral');
    elChips = document.getElementById('modeChips');
    elHint = document.getElementById('viewerHint');
    elReto = document.getElementById('retoPanel');

    // Lista de estaciones, en orden de flujo
    if (elLista) {
        elLista.innerHTML = '';
        ESTACIONES.forEach(st => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'station-item';
            b.dataset.estacion = st.id;
            b.innerHTML = `<span class="station-step">${st.orden}</span><i class="${st.icono}"></i><span>${st.nombre}</span>`;
            b.addEventListener('click', () => seleccionar(st.id, true));
            elLista.appendChild(b);
        });
    }

    if (elDetalle) {
        elDetalle.innerHTML = `
            <h6>Explora la cocina</h6>
            <p>Arrastra para girar la vista y haz clic sobre cualquier zona para conocerla. También puedes elegirla en la lista de arriba.</p>`;
    }

    if (elBtnVista) {
        elBtnVista.disabled = false;
        elBtnVista.addEventListener('click', vistaGeneral);
    }

    // Barra de modos
    if (elChips) {
        elChips.querySelectorAll('[data-modo]').forEach(btn => {
            btn.addEventListener('click', () => cambiarModo(btn.dataset.modo));
        });
    }

    // Minimapa
    mapaCanvas = document.getElementById('minimapa');
    if (mapaCanvas) {
        mapaCanvas.width = 220;
        mapaCanvas.height = Math.round(220 * (COCINA.fondo / COCINA.ancho));
        mapaCtx = mapaCanvas.getContext('2d');
    }

    crearControlesVisor();
    actualizarHint();
}

/** Botón de pantalla completa y mira central. Se crean desde aquí para no
 *  tener que tocar el HTML ni el CSS del módulo. */
function crearControlesVisor() {
    btnPantalla = document.createElement('button');
    btnPantalla.type = 'button';
    btnPantalla.title = 'Pantalla completa';
    btnPantalla.setAttribute('aria-label', 'Pantalla completa');
    btnPantalla.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
    Object.assign(btnPantalla.style, {
        position: 'absolute', top: '12px', right: '12px', zIndex: '4',
        width: '38px', height: '38px', borderRadius: '10px', cursor: 'pointer',
        border: '1px solid rgba(255,255,255,.25)', background: 'rgba(0,34,68,.75)',
        color: '#fff', fontSize: '15px', lineHeight: '1',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    btnPantalla.addEventListener('click', alternarPantallaCompleta);
    contenedor.appendChild(btnPantalla);

    // Mira: solo aparece con el mouse capturado, para saber a qué apuntas
    // cuando ya no hay cursor en pantalla.
    mira = document.createElement('div');
    Object.assign(mira.style, {
        position: 'absolute', left: '50%', top: '50%', zIndex: '4',
        width: '14px', height: '14px', marginLeft: '-7px', marginTop: '-7px',
        borderRadius: '50%', border: '2px solid rgba(255,255,255,.9)',
        boxShadow: '0 0 0 1px rgba(0,0,0,.5)', pointerEvents: 'none', display: 'none'
    });
    contenedor.appendChild(mira);

    document.addEventListener('fullscreenchange', onCambioPantalla);
    document.addEventListener('webkitfullscreenchange', onCambioPantalla);
}

function alternarPantallaCompleta() {
    const panel = contenedor.closest('.viewer-panel') || contenedor;
    const activa = document.fullscreenElement || document.webkitFullscreenElement;
    if (activa) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (panel.requestFullscreen || panel.webkitRequestFullscreen)?.call(panel);
}

function onCambioPantalla() {
    const activa = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (btnPantalla) {
        btnPantalla.innerHTML = activa
            ? '<i class="bi bi-fullscreen-exit"></i>'
            : '<i class="bi bi-arrows-fullscreen"></i>';
        btnPantalla.title = activa ? 'Salir de pantalla completa' : 'Pantalla completa';
    }
    // El navegador reacomoda el layout después del evento, de ahí el respiro.
    setTimeout(onResize, 90);
}

/* ---- Captura del mouse (Pointer Lock) --------------------------------------
   Sin esto, girar en el recorrido depende de arrastrar dentro del visor y el
   cursor se sale a la primera. Capturado, el mouse deja de existir como
   cursor: giras sin tope y sin mantener el botón apretado. */
function pedirBloqueoPuntero() {
    const el = renderer.domElement;
    try {
        const r = (el.requestPointerLock || el.mozRequestPointerLock)?.call(el);
        // Chrome devuelve una promesa. Si el navegador lo niega, se sigue
        // usando el arrastre de siempre y no se rompe nada.
        if (r && typeof r.catch === 'function') r.catch(() => { });
    } catch (_) { /* respaldo: arrastre */ }
}

function soltarBloqueoPuntero() {
    if (document.pointerLockElement) document.exitPointerLock?.();
}

function onCambioBloqueo() {
    punteroBloqueado = document.pointerLockElement === renderer.domElement;
    if (mira) mira.style.display = punteroBloqueado ? 'block' : 'none';
    if (renderer) renderer.domElement.style.cursor = punteroBloqueado ? 'none' : 'grab';
    if (!punteroBloqueado) arrastrando = false;
}

/** Rayo desde el centro exacto de la pantalla: es lo que apunta la mira. */
function raycastCentro() {
    if (!hitboxes.length) return null;
    puntero.set(0, 0);
    raycaster.setFromCamera(puntero, camara);
    const hits = raycaster.intersectObjects(hitboxes, false);
    return hits.length ? hits[0].object.userData.estacion : null;
}

function actualizarHint() {
    if (!elHint) return;
    const textos = {
        explorar: 'Arrastra para girar · rueda para acercar · clic en una zona para ver su ficha',
        recorrido: 'Haz clic para capturar el mouse y mirar libremente · W A S D o flechas para caminar · Esc para soltarlo',
        reto: 'Lee la pregunta y haz clic en la estación correcta dentro de la cocina'
    };
    elHint.textContent = textos[modo];
}

function cambiarModo(nuevo) {
    if (nuevo === modo) return;
    modo = nuevo;

    if (elChips) {
        elChips.querySelectorAll('[data-modo]').forEach(b => {
            b.classList.toggle('modo-activo', b.dataset.modo === modo);
        });
    }

    if (modo === 'recorrido') {
        // Entra caminando desde la puerta, a altura de persona
        FP.pos.set(-0.3, 1.62, 3.0);
        FP.yaw = Math.PI;
        FP.pitch = -0.05;
        camara.fov = 68;
    } else {
        camara.fov = 55;
        FP.teclas = Object.create(null);
        soltarBloqueoPuntero();
    }
    camara.updateProjectionMatrix();

    if (modo === 'reto') iniciarReto();
    else terminarReto();

    if (modo === 'explorar') vistaGeneral();

    actualizarHint();
}

function pintarDetalle(st) {
    if (!elDetalle) return;
    elDetalle.innerHTML = `
        <div class="detalle-cabeza">
            <span class="station-step station-step-lg">${st.orden}</span>
            <h6>${st.nombre}</h6>
        </div>
        <p>${st.resumen}</p>
        <p class="detalle-subtitulo">Qué haces aquí</p>
        <ul class="detalle-tareas">${st.tareas.map(t => `<li>${t}</li>`).join('')}</ul>
        <div class="station-tip"><i class="bi bi-lightbulb-fill"></i><span>${st.tip}</span></div>`;
}

function seleccionar(id, volar = true) {
    const st = porId(id);
    if (!st) return;

    estacionActiva = id;

    if (elLista) {
        elLista.querySelectorAll('.station-item').forEach(b => {
            b.classList.toggle('station-active', b.dataset.estacion === id);
        });
        const activo = elLista.querySelector('.station-active');
        if (activo) activo.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    pintarDetalle(st);
    resaltarMarcador(id);

    if (volar && modo !== 'recorrido') volarA(st);
}

function resaltarMarcador(id) {
    marcadores.forEach((anillo, key) => {
        const activo = key === id;
        anillo.material.color.setHex(activo ? PALETA.rojo : PALETA.azul);
        anillo.material.opacity = activo ? 0.9 : 0.32;
        anillo.scale.setScalar(activo ? 1.12 : 1);
    });
}

/* ==========================================================================
   15 · MODO RETO
   ========================================================================== */
function iniciarReto() {
    reto.orden = PREGUNTAS.map((_, i) => i).sort(() => Math.random() - 0.5);
    reto.indice = 0;
    reto.aciertos = 0;
    reto.intentos = 0;
    reto.activo = true;
    reto.bloqueado = false;
    if (elReto) elReto.hidden = false;
    marcadores.forEach(a => { a.material.color.setHex(PALETA.azul); a.material.opacity = 0.32; a.scale.setScalar(1); });
    pintarPregunta();
}

function terminarReto() {
    reto.activo = false;
    if (elReto) elReto.hidden = true;
}

function pintarPregunta() {
    if (!elReto) return;
    if (reto.indice >= reto.orden.length) {
        const pct = Math.round((reto.aciertos / Math.max(reto.intentos, 1)) * 100);
        elReto.innerHTML = `
            <div class="reto-cabeza"><i class="bi bi-trophy-fill"></i><span>Reto terminado</span></div>
            <p class="reto-pregunta">Acertaste ${reto.aciertos} de ${reto.orden.length} · ${pct}% de precisión</p>
            <button type="button" class="btn btn-sm btn-outline-primary w-100" id="btnRepetirReto">Volver a intentar</button>`;
        const b = document.getElementById('btnRepetirReto');
        if (b) b.addEventListener('click', iniciarReto);
        return;
    }

    const p = PREGUNTAS[reto.orden[reto.indice]];
    elReto.innerHTML = `
        <div class="reto-cabeza">
            <span><i class="bi bi-question-circle-fill"></i> Pregunta ${reto.indice + 1} de ${reto.orden.length}</span>
            <span class="reto-marcador">${reto.aciertos} / ${reto.intentos}</span>
        </div>
        <p class="reto-pregunta">${p.texto}</p>
        <p class="reto-ayuda">Haz clic en la estación correcta dentro de la cocina.</p>`;
}

function responderReto(idElegido) {
    if (reto.bloqueado || reto.indice >= reto.orden.length) return;
    const p = PREGUNTAS[reto.orden[reto.indice]];
    const correcto = idElegido === p.id;

    reto.intentos++;
    if (correcto) reto.aciertos++;
    reto.bloqueado = true;

    const st = porId(p.id);
    const anillo = marcadores.get(p.id);
    if (anillo) {
        anillo.material.color.setHex(correcto ? 0x13b97d : PALETA.rojo);
        anillo.material.opacity = 0.95;
        anillo.scale.setScalar(1.2);
    }
    if (!correcto) {
        const equivocado = marcadores.get(idElegido);
        if (equivocado) { equivocado.material.color.setHex(PALETA.rojo); equivocado.material.opacity = 0.9; }
    }

    if (elReto) {
        elReto.innerHTML = `
            <div class="reto-cabeza">
                <span><i class="bi ${correcto ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i> ${correcto ? 'Correcto' : 'Esa no era'}</span>
                <span class="reto-marcador">${reto.aciertos} / ${reto.intentos}</span>
            </div>
            <p class="reto-pregunta">${correcto ? st.nombre : `La respuesta era <strong>${st.nombre}</strong> (paso ${st.orden})`}</p>
            <p class="reto-ayuda">${st.resumen}</p>`;
        elReto.classList.toggle('reto-ok', correcto);
        elReto.classList.toggle('reto-mal', !correcto);
    }

    volarA(st);

    setTimeout(() => {
        reto.indice++;
        reto.bloqueado = false;
        if (elReto) elReto.classList.remove('reto-ok', 'reto-mal');
        marcadores.forEach(a => { a.material.color.setHex(PALETA.azul); a.material.opacity = 0.32; a.scale.setScalar(1); });
        pintarPregunta();
    }, 2600);
}

/* ==========================================================================
   16 · CÁMARA
   ========================================================================== */
function volarA(st) {
    const [w, h, d] = st.hitbox;
    const radio = clamp(new Vector3(w, h, d).length() * 0.75 + 0.7, 1.8, 4.2);
    const objetivo = new Vector3(st.pos[0], st.top, st.pos[1]);

    // Nos acercamos siempre desde el centro de la cocina, así nunca
    // terminamos con la cámara metida dentro de una pared.
    const dir = new Vector3(0, 0, 0).sub(objetivo);
    dir.y = 0;
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, 1); else dir.normalize();

    const destino = objetivo.clone().addScaledVector(dir, radio);
    destino.y = st.top + clamp(h * 0.45 + 0.35, 0.5, 1.6);

    animarCamara(destino, objetivo.clone());
}

function vistaGeneral() {
    estacionActiva = null;
    marcadores.forEach(a => { a.material.color.setHex(PALETA.azul); a.material.opacity = 0.32; a.scale.setScalar(1); });
    if (elLista) elLista.querySelectorAll('.station-item').forEach(b => b.classList.remove('station-active'));
    animarCamara(VISTA_GENERAL.pos.clone(), VISTA_GENERAL.target.clone());
}

function animarCamara(pos, target) {
    if (modo === 'recorrido') return;
    camAnim = {
        t0: performance.now(), dur: 850,
        desdePos: camara.position.clone(), haciaPos: pos,
        desdeTarget: orbitTarget.clone(), haciaTarget: target
    };
}

function sincronizarOrbita(pos, target) {
    orbitTarget.copy(target);
    const rel = new Vector3().subVectors(pos, target);
    orbitRadius = rel.length() || 1;
    orbitPhi = Math.acos(clamp(rel.y / orbitRadius, -1, 1));
    orbitTheta = Math.atan2(rel.x, rel.z);
}

/* ==========================================================================
   17 · EVENTOS
   ========================================================================== */
function conectarEventos() {
    const lienzo = renderer.domElement;
    lienzo.addEventListener('pointerdown', onPointerDown);
    lienzo.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    lienzo.addEventListener('wheel', onWheel, { passive: false });
    lienzo.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('pointerlockchange', onCambioBloqueo);
    document.addEventListener('pointerlockerror', onCambioBloqueo);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', () => { FP.teclas = Object.create(null); });
}

function onPointerDown(e) {
    if (modo === 'recorrido') {
        if (punteroBloqueado) {
            // Ya con el mouse capturado, el clic selecciona lo que marca la mira.
            const id = raycastCentro();
            if (id) seleccionar(id, false);
            return;
        }
        // Primer clic dentro del visor: capturamos el mouse. Seguimos armando
        // el arrastre como respaldo por si el navegador no concede la captura.
        pedirBloqueoPuntero();
    }

    arrastrando = true;
    camAnim = null;
    ultimoPuntero = { x: e.clientX, y: e.clientY };
    inicioPuntero = { x: e.clientX, y: e.clientY };
    try { renderer.domElement.setPointerCapture?.(e.pointerId); } catch (_) { /* lo lleva la captura */ }
}

function onPointerMove(e) {
    // Con el mouse capturado no hay cursor ni bordes: giramos con el
    // desplazamiento crudo del ratón, sin importar si hay botón apretado.
    if (punteroBloqueado) {
        FP.yaw -= (e.movementX || 0) * 0.0024;
        FP.pitch = clamp(FP.pitch - (e.movementY || 0) * 0.0024, -0.9, 0.75);
        return;
    }
    if (!arrastrando) {
        renderer.domElement.style.cursor = raycastEstacion(e) ? 'pointer' : 'grab';
        return;
    }
    const dx = e.clientX - ultimoPuntero.x;
    const dy = e.clientY - ultimoPuntero.y;
    ultimoPuntero = { x: e.clientX, y: e.clientY };

    if (modo === 'recorrido') {
        FP.yaw -= dx * 0.0045;
        FP.pitch = clamp(FP.pitch - dy * 0.0045, -0.9, 0.75);
    } else {
        orbitTheta -= dx * 0.006;
        orbitPhi = clamp(orbitPhi - dy * 0.006, 0.18, 1.48);
    }
    renderer.domElement.style.cursor = 'grabbing';
}

function onPointerUp(e) {
    // Con el mouse capturado la selección ya la hizo onPointerDown con la mira.
    if (punteroBloqueado) { arrastrando = false; return; }
    if (!arrastrando) return;
    const movio = Math.hypot(e.clientX - inicioPuntero.x, e.clientY - inicioPuntero.y);
    arrastrando = false;
    renderer.domElement.style.cursor = 'grab';

    if (movio < 6) {
        const id = raycastEstacion(e);
        if (!id) return;
        if (modo === 'reto') { responderReto(id); seleccionar(id, false); }
        else seleccionar(id, modo !== 'recorrido');
    }
}

function onWheel(e) {
    if (modo === 'recorrido') return;
    e.preventDefault();
    orbitRadius = clamp(orbitRadius + e.deltaY * 0.0035 * Math.max(orbitRadius * 0.5, 1), RADIO_MIN, RADIO_MAX);
}

function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (modo === 'recorrido' && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
    }
    FP.teclas[k] = true;
}

function onKeyUp(e) {
    FP.teclas[e.key.toLowerCase()] = false;
}

function raycastEstacion(e) {
    if (!hitboxes.length) return null;
    const r = renderer.domElement.getBoundingClientRect();
    puntero.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    puntero.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(puntero, camara);
    const hits = raycaster.intersectObjects(hitboxes, false);
    return hits.length ? hits[0].object.userData.estacion : null;
}

function onResize() {
    if (!contenedor) return;
    ancho = contenedor.clientWidth;
    alto = contenedor.clientHeight || 600;
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    renderer.setSize(ancho, alto);
}

/* ==========================================================================
   18 · MINIMAPA
   Vista de planta que muestra dónde estás parado. Es la pieza que de verdad
   ayuda a orientarse cuando andas caminando en primera persona.
   ========================================================================== */
function dibujarMinimapa() {
    if (!mapaCtx) return;
    const W = mapaCanvas.width, H = mapaCanvas.height;
    const aX = v => ((v + LIM_X) / COCINA.ancho) * W;
    const aZ = v => ((v + LIM_Z) / COCINA.fondo) * H;

    mapaCtx.clearRect(0, 0, W, H);
    mapaCtx.fillStyle = 'rgba(0, 34, 68, 0.86)';
    mapaCtx.fillRect(0, 0, W, H);

    // Muebles
    mapaCtx.fillStyle = 'rgba(255,255,255,0.14)';
    OBSTACULOS.forEach(o => {
        mapaCtx.fillRect(aX(o.x0), aZ(o.z0), aX(o.x1) - aX(o.x0), aZ(o.z1) - aZ(o.z0));
    });

    // Estaciones
    ESTACIONES.forEach(st => {
        const x = aX(st.pos[0]), y = aZ(st.pos[1]);
        const activa = st.id === estacionActiva;
        mapaCtx.beginPath();
        mapaCtx.arc(x, y, activa ? 9 : 7, 0, Math.PI * 2);
        mapaCtx.fillStyle = activa ? '#e31837' : '#0077b6';
        mapaCtx.fill();
        mapaCtx.fillStyle = '#ffffff';
        mapaCtx.font = 'bold 9px Arial, sans-serif';
        mapaCtx.textAlign = 'center';
        mapaCtx.textBaseline = 'middle';
        mapaCtx.fillText(String(st.orden), x, y + 0.5);
    });

    // Tú
    const px = aX(modo === 'recorrido' ? FP.pos.x : camara.position.x);
    const py = aZ(modo === 'recorrido' ? FP.pos.z : camara.position.z);
    const rumbo = modo === 'recorrido'
        ? FP.yaw
        : Math.atan2(camara.position.x - orbitTarget.x, camara.position.z - orbitTarget.z) + Math.PI;

    mapaCtx.save();
    mapaCtx.translate(px, py);
    mapaCtx.rotate(-rumbo);
    mapaCtx.beginPath();
    mapaCtx.moveTo(0, -9);
    mapaCtx.lineTo(6, 7);
    mapaCtx.lineTo(0, 3.5);
    mapaCtx.lineTo(-6, 7);
    mapaCtx.closePath();
    mapaCtx.fillStyle = '#ffd166';
    mapaCtx.fill();
    mapaCtx.restore();
}

/* ==========================================================================
   19 · BUCLE
   ========================================================================== */
function animate() {
    const ahora = performance.now();
    const dt = Math.min((ahora - reloj) / 1000, 0.05);
    reloj = ahora;

    // Parpadeo del horno
    tiempoHorno += dt;
    if (luzHorno) luzHorno.intensity = 8 + Math.sin(tiempoHorno * 2.6) * 1.4 + Math.sin(tiempoHorno * 7.1) * 0.6;

    if (modo === 'recorrido') {
        actualizarRecorrido(dt);
    } else if (camAnim) {
        const t = Math.min(1, (ahora - camAnim.t0) / camAnim.dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camara.position.lerpVectors(camAnim.desdePos, camAnim.haciaPos, e);
        orbitTarget.lerpVectors(camAnim.desdeTarget, camAnim.haciaTarget, e);
        camara.lookAt(orbitTarget);
        if (t >= 1) { camAnim = null; sincronizarOrbita(camara.position, orbitTarget); }
    } else {
        camara.position.set(
            orbitTarget.x + orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta),
            Math.max(0.35, orbitTarget.y + orbitRadius * Math.cos(orbitPhi)),
            orbitTarget.z + orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta)
        );
        camara.lookAt(orbitTarget);
    }

    dibujarMinimapa();
    renderer.render(scene, camara);
}

function actualizarRecorrido(dt) {
    const t = FP.teclas;
    const adelante = (t['w'] || t['arrowup'] ? 1 : 0) - (t['s'] || t['arrowdown'] ? 1 : 0);
    const lado = (t['d'] || t['arrowright'] ? 1 : 0) - (t['a'] || t['arrowleft'] ? 1 : 0);

    if (adelante || lado) {
        const vel = FP.velocidad * (t['shift'] ? 1.7 : 1) * dt;
        const sin = Math.sin(FP.yaw), cos = Math.cos(FP.yaw);
        let dx = (-sin * adelante + cos * lado);
        let dz = (-cos * adelante - sin * lado);
        const largo = Math.hypot(dx, dz) || 1;
        moverConColision(FP.pos.x + (dx / largo) * vel, FP.pos.z + (dz / largo) * vel);
    }

    camara.position.copy(FP.pos);
    const mira = new Vector3(
        FP.pos.x - Math.sin(FP.yaw) * Math.cos(FP.pitch),
        FP.pos.y + Math.sin(FP.pitch),
        FP.pos.z - Math.cos(FP.yaw) * Math.cos(FP.pitch)
    );
    camara.lookAt(mira);
    orbitTarget.copy(mira);
}

/* ==========================================================================
   ARRANQUE
   ========================================================================== */
init();
if (renderer) renderer.setAnimationLoop(animate);