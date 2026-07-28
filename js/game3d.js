import * as THREE from './three.module.min.js';

// ==========================================
// Desestructuración
// ==========================================
const {
    Scene,
    Group,
    PerspectiveCamera,
    OrthographicCamera,
    WebGLRenderer,
    PlaneGeometry,
    BoxGeometry,
    SphereGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
    Mesh,
    AmbientLight,
    DirectionalLight,
    PointLight,
    Color,
    TextureLoader,
    RepeatWrapping,
    DoubleSide
} = THREE;

// ==========================================
// Variables globales
// ==========================================
let scene, renderer;
let perspectiveCamera, orthographicCamera, activeCamera;

let plane;
let container, width, height;

// Luces
let ambientLight, directionalLight, luzHorno;

// Variables para el control del mouse
let mouseX = 0;
let mouseY = 0;

// ==========================================
// Inicialización
// ==========================================
init();
renderer.setAnimationLoop(animate);

// ==========================================
function init() {
    // CAPTURAR EL CONTENEDOR 
    container = document.getElementById("scene-container");
    width = container.clientWidth;
    height = container.clientHeight;

    // 1. Escena
    scene = new Scene();
    scene.background = new Color(0x73bba9); 

    // 2. Renderer
    renderer = new WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    // Adjuntar canvas al contenedor
    container.appendChild(renderer.domElement);

    // 3. Cámara Perspectiva (Vista Frontal Base)
    perspectiveCamera = new PerspectiveCamera(45, width / height, 0.1, 1000);
    perspectiveCamera.position.set(0, 5.5, 16);
    perspectiveCamera.lookAt(0, 2, -2);

    // 4. Cámara Ortográfica Frontal
    const frustumSize = 12;
    const aspect = width / height;
    orthographicCamera = new OrthographicCamera(
        -frustumSize * aspect / 2, frustumSize * aspect / 2,
        frustumSize / 2, -frustumSize / 2, 0.1, 1000
    );
    orthographicCamera.position.copy(perspectiveCamera.position);
    orthographicCamera.lookAt(0, 2, -2);

    activeCamera = perspectiveCamera;

    // 5. Texturas (RUTAS Y EXTENSIONES CORREGIDAS)
    const loader = new TextureLoader();
    const floorTexture = loader.load('../../images/piso_cocina.jpeg');
    floorTexture.wrapS = RepeatWrapping;
    floorTexture.wrapT = RepeatWrapping;
    floorTexture.repeat.set(4, 4);

    const wallTexture = loader.load('../../images/mosaico_pizza.jpeg');
    wallTexture.wrapS = RepeatWrapping;
    wallTexture.wrapT = RepeatWrapping;
    wallTexture.repeat.set(4, 2);

    // 6. Piso, Paredes y Techo
    const planeGeometry = new PlaneGeometry(20, 20);
    const planeMaterial = new MeshStandardMaterial({
        map: floorTexture, roughness: 0.8, metalness: 0.1, side: DoubleSide, color: 0xeeeeee
    });
    plane = new Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    const ceilingGeometry = new PlaneGeometry(20, 20);
    const ceilingMaterial = new MeshStandardMaterial({
        color: 0xdcdcdc, roughness: 0.6, side: DoubleSide
    });
    const ceiling = new Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.set(0, 10, 0); 
    ceiling.rotation.x = Math.PI / 2; 
    ceiling.receiveShadow = true; 
    scene.add(ceiling);

    const wallGeometry = new PlaneGeometry(20, 10);
    const wallMaterial = new MeshStandardMaterial({
        map: wallTexture, roughness: 0.7, metalness: 0.05, side: DoubleSide, color: 0xffffff
    });

    const backWall = new Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, 5, -10);
    scene.add(backWall);

    const leftWall = new Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-10, 5, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    const rightWall = new Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(10, 5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    // ======================================
    // MATERIALES PROFESIONALES Y PALETA
    // ======================================
    const matAcero = new MeshStandardMaterial({ color: 0xdcdcdc, metalness: 0.7, roughness: 0.2 });
    const matAceroOscuro = new MeshStandardMaterial({ color: 0x8a9597, metalness: 0.8, roughness: 0.3 });
    const matLadrillo = new MeshStandardMaterial({ color: 0x5a5a5a, metalness: 0.2, roughness: 0.8 });
    const matNegro = new MeshStandardMaterial({ color: 0x222222 });
    const matBlanco = new MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 });
    const matCarton = new MeshStandardMaterial({ color: 0xdeb887, roughness: 0.9 }); 
    const matMadera = new MeshStandardMaterial({ color: 0xa0522d, roughness: 0.7 }); 
    const matMaderaOscura = new MeshStandardMaterial({ color: 0x4a2e2b, roughness: 0.9 }); 
    const matMasa = new MeshStandardMaterial({ color: 0xfffdd0, roughness: 0.7 }); 
    const matPizza = new MeshStandardMaterial({ color: 0xdf4722, roughness: 0.5 }); 
    const matAgua = new MeshStandardMaterial({ color: 0xa5f3fc, roughness: 0.1, metalness: 0.1 }); 
    const matRojoSalsa = new MeshStandardMaterial({ color: 0xcc2200 });
    const matMostaza = new MeshStandardMaterial({ color: 0xffcc00 });

    const geomPlato = new CylinderGeometry(0.35, 0.35, 0.02, 16);

    // ======================================
    // DETALLES DE PARED
    // ======================================
    const marcoPuerta = new Mesh(new BoxGeometry(2.2, 5.2, 0.1), matAceroOscuro);
    marcoPuerta.position.set(0, 2.6, -9.95);
    const cuerpoPuerta = new Mesh(new BoxGeometry(2, 5, 0.05), matBlanco);
    cuerpoPuerta.position.set(0, 2.5, -9.9);
    const picaporte = new Mesh(new SphereGeometry(0.06, 8, 8), matAcero);
    picaporte.position.set(-0.8, 2.5, -9.8);
    scene.add(marcoPuerta); scene.add(cuerpoPuerta); scene.add(picaporte);

    const relojBorde = new Mesh(new CylinderGeometry(0.45, 0.45, 0.1, 24), matNegro);
    relojBorde.position.set(0, 6.2, -9.9);
    relojBorde.rotation.x = Math.PI / 2;
    const relojFondo = new Mesh(new CylinderGeometry(0.4, 0.4, 0.12, 24), matBlanco);
    relojFondo.position.set(0, 6.2, -9.87);
    relojFondo.rotation.x = Math.PI / 2;
    scene.add(relojBorde); scene.add(relojFondo);

    const rj = new Mesh(new BoxGeometry(1.6, 0.7, 0.05), matAceroOscuro);
    rj.position.set(3, 5.5, -9.95);
    scene.add(rj);

    // ======================================
    // ZONA 1: HORNO Y EXTRACCIÓN
    // ======================================
    const baseHorno = new Mesh(new BoxGeometry(5, 3.5, 3), matLadrillo);
    baseHorno.position.set(-4.5, 1.75, -8.5);
    baseHorno.castShadow = true;

    const bocaHorno = new Mesh(new BoxGeometry(2.5, 1.2, 3.1), matNegro);
    bocaHorno.position.set(-4.5, 1.6, -8.5);

    const campanaBase = new Mesh(new BoxGeometry(5.5, 1, 3.5), matAceroOscuro);
    campanaBase.position.set(-4.5, 5.5, -8.5);
    campanaBase.castShadow = true;

    const campanaDucto = new Mesh(new BoxGeometry(1.5, 4, 1.5), matAceroOscuro);
    campanaDucto.position.set(-4.5, 8, -8.5);
    scene.add(baseHorno); scene.add(bocaHorno); scene.add(campanaBase); scene.add(campanaDucto);

    // ======================================
    // ZONA 2: MESA CENTRAL DE PREPARACIÓN
    // ======================================
    const muebleCentralBase = new Mesh(new BoxGeometry(5.8, 1.4, 2.6), matBlanco);
    muebleCentralBase.position.set(-0.5, 0.7, 1.5);
    muebleCentralBase.castShadow = true;
    muebleCentralBase.receiveShadow = true;
    scene.add(muebleCentralBase);

    const topeMesa = new Mesh(new BoxGeometry(6, 0.1, 2.8), matAcero);
    topeMesa.position.set(-0.5, 1.45, 1.5);
    topeMesa.castShadow = true;
    scene.add(topeMesa);

    const estantePizzas = new Mesh(new BoxGeometry(3.5, 0.4, 1.4), matBlanco);
    estantePizzas.position.set(0.7, 1.7, 2.1);
    estantePizzas.castShadow = true;
    scene.add(estantePizzas);

    for(let i = 0; i < 3; i++) {
        const pizzaLista = new Mesh(new CylinderGeometry(0.5, 0.5, 0.04, 16), matPizza);
        pizzaLista.position.set(-0.6 + (i * 1.2), 1.92, 2.1);
        pizzaLista.castShadow = true;
        scene.add(pizzaLista);
    }

    const tablaCorte = new Mesh(new BoxGeometry(1.6, 0.05, 1.2), matMadera);
    tablaCorte.position.set(-2, 1.53, 1.2);
    tablaCorte.castShadow = true;
    scene.add(tablaCorte);

    const pizzaPrep = new Mesh(new CylinderGeometry(0.45, 0.45, 0.03, 16), matMasa);
    pizzaPrep.position.set(-2, 1.57, 1.2);
    scene.add(pizzaPrep);

    const geomMasa = new SphereGeometry(0.15, 16, 16);
    const posMasas = [ [-1, 1.6, 0.8], [-1.4, 1.6, 0.8], [-1.2, 1.6, 1.1] ];
    posMasas.forEach(pos => {
        const bolita = new Mesh(geomMasa, matMasa);
        bolita.position.set(...pos);
        bolita.castShadow = true;
        scene.add(bolita);
    });

    // ======================================
    // ZONA 3: MESA AUXILIAR DE INGREDIENTES
    // ======================================
    const topeMesaAux = new Mesh(new BoxGeometry(2.5, 0.1, 1.6), matMaderaOscura);
    topeMesaAux.position.set(4.5, 1.6, -5.5);
    topeMesaAux.castShadow = true;
    scene.add(topeMesaAux);

    const posPatasAux = [ [3.4, 0.8, -6.2], [5.6, 0.8, -6.2], [3.4, 0.8, -4.8], [5.6, 0.8, -4.8] ];
    posPatasAux.forEach(pos => {
        const pata = new Mesh(new BoxGeometry(0.08, 1.6, 0.08), matNegro);
        pata.position.set(...pos);
        pata.castShadow = true;
        scene.add(pata);
    });

    const bandejaIngredientes = new Mesh(new BoxGeometry(1.2, 0.04, 0.8), matBlanco);
    bandejaIngredientes.position.set(4.3, 1.67, -5.5);
    scene.add(bandejaIngredientes);

    for(let i = 0; i < 4; i++) {
        const tomate = new Mesh(new SphereGeometry(0.08, 8, 8), matRojoSalsa);
        tomate.position.set(4.0 + (i * 0.2), 1.74, -5.5);
        scene.add(tomate);
    }

    // ======================================
    // ZONA 4: REFRIGERADOR Y BASURA
    // ======================================
    const refriCuerpo = new Mesh(new BoxGeometry(2.6, 6, 2.4), matAcero);
    refriCuerpo.position.set(-8.5, 3, -8);
    refriCuerpo.castShadow = true;

    const puertaRefri = new Mesh(new BoxGeometry(2.4, 5.6, 0.1), matBlanco);
    puertaRefri.position.set(-8.5, 3.1, -6.75);
    scene.add(refriCuerpo); scene.add(puertaRefri);

    const boteBasura = new Mesh(new BoxGeometry(1, 1.4, 1), matNegro);
    boteBasura.position.set(-4.5, 0.7, 1.5);
    boteBasura.castShadow = true;
    scene.add(boteBasura);

    // ======================================
    // ZONA 5: ESTACIÓN DE LAVADO
    // ======================================
    const cuerpoFregadero = new Mesh(new BoxGeometry(2.8, 1.8, 2.2), matBlanco);
    cuerpoFregadero.position.set(7.5, 0.9, 1.5);
    cuerpoFregadero.castShadow = true;
    scene.add(cuerpoFregadero);

    const aguaFregadero = new Mesh(new BoxGeometry(2.5, 0.1, 1.9), matAgua);
    aguaFregadero.position.set(7.5, 1.72, 1.5);
    scene.add(aguaFregadero);

    for(let i = 0; i < 5; i++) {
        const platoLavado = new Mesh(geomPlato, matBlanco);
        platoLavado.position.set(7.3, 1.76 + (i * 0.03), 1.3);
        platoLavado.rotation.z = 0.15; 
        scene.add(platoLavado);
    }

    // ======================================
    // ZONA 6: REPISA LARGA DE PARED
    // ======================================
    const repisaFlotante = new Mesh(new BoxGeometry(0.4, 0.15, 6.5), matMaderaOscura);
    repisaFlotante.position.set(9.75, 5, -1.5);
    repisaFlotante.castShadow = true;
    scene.add(repisaFlotante);

    for(let i = 0; i < 4; i++) {
        const botella = new Mesh(new CylinderGeometry(0.08, 0.08, 0.4, 8), (i % 2 === 0) ? matRojoSalsa : matMostaza);
        botella.position.set(9.7, 5.3, -3.5 + (i * 0.3));
        scene.add(botella);
    }

    for(let j = 0; j < 2; j++) { 
        for(let i = 0; i < 6; i++) {
            const platoEstante = new Mesh(geomPlato, matBlanco);
            platoEstante.position.set(9.7, 5.1 + (i * 0.03), -1 + (j * 1));
            scene.add(platoEstante);
        }
    }

    // ======================================
    // ZONA 7: RECEPCIÓN Y MOSTRADOR
    // ======================================
    const baseMostrador = new Mesh(new BoxGeometry(2, 2.2, 3), matBlanco);
    baseMostrador.position.set(8.5, 1.1, 5.5);
    baseMostrador.castShadow = true;

    const topeMostrador = new Mesh(new BoxGeometry(2.1, 0.1, 3.1), matAcero);
    topeMostrador.position.set(8.5, 2.25, 5.5);
    scene.add(baseMostrador); scene.add(topeMostrador);

    const geomCaja = new BoxGeometry(1.4, 0.12, 1.4);
    for(let i = 0; i < 5; i++) {
        const caja = new Mesh(geomCaja, matCarton);
        caja.position.set(8.5, 2.36 + (i * 0.13), 5.5);
        if(i % 2 !== 0) caja.rotation.y = 0.08; 
        caja.castShadow = true;
        scene.add(caja);
    }

    // ===================================================
    // LÁMPARAS COLGANTES
    // ===================================================
    const crearLamparaColgante = (x, z) => {
        const grupoLampara = new Group();
        
        const cable = new Mesh(new CylinderGeometry(0.02, 0.02, 2.2, 8), matNegro);
        cable.position.set(0, 8.9, 0);
        grupoLampara.add(cable);
        
        const pantalla = new Mesh(new CylinderGeometry(0.12, 0.45, 0.5, 16), matAceroOscuro);
        pantalla.position.set(0, 7.55, 0);
        pantalla.castShadow = true;
        grupoLampara.add(pantalla);
        
        const focoMat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe5aa, emissiveIntensity: 1.8 });
        const foco = new Mesh(new SphereGeometry(0.12, 8, 8), focoMat);
        foco.position.set(0, 7.35, 0);
        grupoLampara.add(foco);
        
        const luzPuntual = new PointLight(0xfff3e0, 8, 12); 
        luzPuntual.position.set(0, 7.2, 0);
        grupoLampara.add(luzPuntual);
        
        grupoLampara.position.set(x, 0, z);
        scene.add(grupoLampara);
    };

    crearLamparaColgante(-2.5, 1.5);
    crearLamparaColgante(3.5, 1.5);

    // ======================================
    // ILUMINACIÓN GENERAL DE AMBIENTE
    // ======================================
    ambientLight = new AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    directionalLight = new DirectionalLight(0xffffff, 0.95);
    directionalLight.position.set(0, 20, 10); 
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -12;
    directionalLight.shadow.camera.right = 12;
    directionalLight.shadow.camera.top = 12;
    directionalLight.shadow.camera.bottom = -12;
    scene.add(directionalLight);

    luzHorno = new PointLight(0xff4500, 20, 6);
    luzHorno.position.set(-4.5, 1.6, -7); 
    scene.add(luzHorno);

    // Escuchadores de eventos adaptados al contenedor
    window.addEventListener("resize", onWindowResize, false);
    container.addEventListener("mousemove", onMouseMove, false);
}

// ==========================================
// MOUSE
// ==========================================
function onMouseMove(event) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    // Calcula la posición del mouse relativa al contenedor
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    mouseX = (x / width) * 2 - 1;
    mouseY = (y / height) * 2 - 1; 
}

// ==========================================
// Animación
// ==========================================
function animate() {
    // Límites de desplazamiento de la cámara
    const targetX = mouseX * 3.5;          
    const targetY = 5.5 + (mouseY * 2.5);  

    activeCamera.position.x += (targetX - activeCamera.position.x) * 0.05;
    activeCamera.position.y += (targetY - activeCamera.position.y) * 0.05;

    // Fijar la vista
    activeCamera.lookAt(0, 2, -2);

    renderer.render(scene, activeCamera);
}

// ==========================================
// Resize
// ==========================================
function onWindowResize() {
    if (!container) return;

    width = container.clientWidth;
    height = container.clientHeight;

    perspectiveCamera.aspect = width / height;
    perspectiveCamera.updateProjectionMatrix();

    const frustumSize = 12;
    const aspect = width / height;

    orthographicCamera.left = -frustumSize * aspect / 2;
    orthographicCamera.right = frustumSize * aspect / 2;
    orthographicCamera.top = frustumSize / 2;
    orthographicCamera.bottom = -frustumSize / 2;
    orthographicCamera.updateProjectionMatrix();

    renderer.setSize(width, height);
}