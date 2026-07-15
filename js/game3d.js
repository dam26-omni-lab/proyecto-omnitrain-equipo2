import * as THREE from './three.module.min.js';

// ==========================================
// Desestructuración
// ==========================================
const {
    Scene, Group, PerspectiveCamera, OrthographicCamera, WebGLRenderer,
    PlaneGeometry, BoxGeometry, SphereGeometry, CylinderGeometry,
    MeshStandardMaterial, Mesh, AmbientLight, DirectionalLight, PointLight,
    Color, TextureLoader, RepeatWrapping, DoubleSide
} = THREE;

// ==========================================
// Variables globales
// ==========================================
let scene, renderer;
let perspectiveCamera, orthographicCamera, activeCamera;
let plane, container, width, height;
let ambientLight, directionalLight, luzHorno;
let mouseX = 0, mouseY = 0;

// ==========================================
// Inicialización y Loop
// ==========================================
init();
renderer.setAnimationLoop(animate);

function init() {
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
    container.appendChild(renderer.domElement);

    // 3. Cámaras
    perspectiveCamera = new PerspectiveCamera(45, width / height, 0.1, 1000);
    perspectiveCamera.position.set(0, 5.5, 16);
    perspectiveCamera.lookAt(0, 2, -2);

    const frustumSize = 12;
    const aspect = width / height;
    orthographicCamera = new OrthographicCamera(
        -frustumSize * aspect / 2, frustumSize * aspect / 2,
        frustumSize / 2, -frustumSize / 2, 0.1, 1000
    );
    orthographicCamera.position.copy(perspectiveCamera.position);
    orthographicCamera.lookAt(0, 2, -2);

    activeCamera = perspectiveCamera;

    // Cargar el resto de la escena (Parte 2 y Parte 3)
    construirEntorno();
    window.addEventListener("resize", onWindowResize, false);
    container.addEventListener("mousemove", onMouseMove, false);
}

// ==========================================
// Eventos y Animación
// ==========================================
function onMouseMove(event) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    mouseX = (x / width) * 2 - 1;
    mouseY = (y / height) * 2 - 1; 
}

function animate() {
    const targetX = mouseX * 3.5;          
    const targetY = 5.5 + (mouseY * 2.5);  
    activeCamera.position.x += (targetX - activeCamera.position.x) * 0.05;
    activeCamera.position.y += (targetY - activeCamera.position.y) * 0.05;
    activeCamera.lookAt(0, 2, -2);
    renderer.render(scene, activeCamera);
}

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