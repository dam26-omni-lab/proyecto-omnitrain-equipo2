/* ============================================================================
   DOMINO'S SYSTEM — ARRANQUE DE FIREBASE (páginas del portal)
   ----------------------------------------------------------------------------
   El login inicializa Firebase por su cuenta dentro de js/login.js. Este
   archivo hace lo mismo para las DEMÁS páginas, que también necesitan la app
   inicializada para poder leer quién inició sesión.

   IMPORTANTE: este archivo NO debe cargarse en login.html.
   Si se carga, inicializa la app antes que login.js, y cuando login.js llame
   a firebase.initializeApp() Firebase lanza "duplicate-app". Ese error corta
   el script completo, el formulario se queda sin su manejador de envío y el
   botón de entrar deja de responder.

   Va DESPUÉS de firebase-app-compat / firebase-auth-compat y ANTES de
   progreso.js.

   Sobre estas claves: en Firebase la configuración del cliente es pública por
   diseño (viaja en cualquier app web). Lo que protege los datos son las reglas
   de seguridad de la consola, no esconder este archivo.
============================================================================ */

(function () {
    "use strict";

    if (typeof firebase === "undefined") {
        // Sin internet o con los scripts bloqueados el portal sigue de pie:
        // progreso.js se apoya en la última sesión guardada en el navegador.
        console.info("[firebase] no disponible; se usa la sesión guardada.");
        return;
    }

    // Guarda por si alguien ya inicializó (por ejemplo, otro script previo).
    if (firebase.apps && firebase.apps.length) return;

    firebase.initializeApp({
        apiKey: "AIzaSyD7GLaiicfXQkfXDhipEgeAL-ZVe6wqOOw",
        authDomain: "dominos-system.firebaseapp.com",
        projectId: "dominos-system",
        storageBucket: "dominos-system.firebasestorage.app",
        messagingSenderId: "589460214273",
        appId: "1:589460214273:web:b0c045dfa12f2db98ae600",
        measurementId: "G-P5R7N2L1VT"
    });
})();