/* ============================================================================
   DOMINO'S SYSTEM — CAPA DE PROGRESO
   ----------------------------------------------------------------------------
   Una sola fuente de verdad para "quién está dentro" y "cómo va".
   La usan el dashboard, el Panel de KPIs y el Simulador 2D.

   CÓMO SE USA
     Progreso.usuario()                   → {uid, nombre, correo} o null
     Progreso.alCambiarUsuario(fn)        → avisa cuando entra o sale alguien
     Progreso.guardarSesion(mod, datos, turnoId)
     Progreso.sesiones(mod)               → historial, del más nuevo al más viejo
     Progreso.resumen(mod)                → agregados listos para pintar
     Progreso.cerrarSesion(destino)

   DE DÓNDE SALE LA SESIÓN
     De Firebase. El login llama a firebase.initializeApp() y a
     signInWithEmailAndPassword(); la sesión queda guardada en el navegador y
     este archivo la detecta en CUALQUIER página con onAuthStateChanged.

     Por eso todas las páginas del portal cargan los dos scripts de Firebase
     antes que este archivo. Si faltan, o si no hay internet, el portal sigue
     de pie: se apoya en la última sesión que quedó anotada aquí.

   DÓNDE VIVEN LOS DATOS
     En localStorage del navegador, separados por usuario. Es un prototipo de
     capacitación: no hay servidor propio y solo se guardan puntajes. Para
     pasarlo a Firestore, lo único que cambia es leerJSON/escribirJSON.

   SIN SESIÓN
     usuario() devuelve null y las pantallas muestran su estado vacío. No se
     guarda nada: sin login no hay a quién atribuirle el turno.
============================================================================ */

(function (global) {
    "use strict";

    const CLAVE_SESION = "omnitrain:sesion";
    const CLAVE_DATOS = "omnitrain:progreso:v1";

    /* ---- localStorage puede fallar (modo privado, cuota llena) ---------- */

    function leerJSON(clave, porDefecto) {
        try {
            const crudo = localStorage.getItem(clave);
            return crudo ? JSON.parse(crudo) : porDefecto;
        } catch (e) {
            return porDefecto;
        }
    }

    function escribirJSON(clave, valor) {
        try {
            localStorage.setItem(clave, JSON.stringify(valor));
            return true;
        } catch (e) {
            return false;
        }
    }

    /* ---- Quién está dentro --------------------------------------------- */

    let usuarioActual = leerJSON(CLAVE_SESION, null);
    const oyentes = [];

    function avisar() {
        oyentes.forEach(fn => {
            try { fn(usuarioActual); } catch (e) { console.warn("[progreso]", e); }
        });
    }

    function fijarUsuario(u) {
        const antes = usuarioActual ? (usuarioActual.uid || usuarioActual.correo) : null;
        const ahora = u ? (u.uid || u.correo) : null;
        usuarioActual = u;
        if (u) escribirJSON(CLAVE_SESION, u);
        else { try { localStorage.removeItem(CLAVE_SESION); } catch (e) { } }
        if (antes !== ahora || !u) avisar();
    }

    // Nombre legible a partir del correo, para saludar sin pedir más datos.
    function nombreDesdeCorreo(correo) {
        if (!correo) return "Operador";
        const base = correo.split("@")[0].replace(/[._-]+/g, " ").trim();
        return base.replace(/\b\w/g, c => c.toUpperCase()) || "Operador";
    }

    /* Firebase es la autoridad cuando está disponible.

       El login inicializa la app, así que en las demás páginas puede que este
       archivo corra ANTES de que exista: por eso se reintenta un momento en
       vez de rendirse al primer intento. */
    function engancharFirebase(intento) {
        intento = intento || 0;

        const listo = typeof global.firebase !== "undefined"
            && global.firebase.apps
            && global.firebase.apps.length > 0;

        if (!listo) {
            if (intento < 20) return setTimeout(() => engancharFirebase(intento + 1), 150);
            console.info("[progreso] Firebase no respondió; se usa la sesión guardada.");
            return;
        }

        try {
            global.firebase.auth().onAuthStateChanged(u => {
                if (u) {
                    const previo = leerJSON(CLAVE_SESION, {}) || {};
                    fijarUsuario({
                        uid: u.uid,
                        correo: u.email || "",
                        nombre: u.displayName || previo.nombre || nombreDesdeCorreo(u.email)
                    });
                } else {
                    fijarUsuario(null);
                }
            });
        } catch (e) {
            console.warn("[progreso] no se pudo escuchar la sesión.", e);
        }
    }

    /* ---- Historial ------------------------------------------------------ */

    const MAX_SESIONES = 60;   // suficiente para tendencias, sin llenar el disco

    function todo() { return leerJSON(CLAVE_DATOS, {}) || {}; }

    function llaveUsuario() {
        return usuarioActual ? (usuarioActual.uid || usuarioActual.correo) : null;
    }

    /**
     * Historial del más nuevo al más viejo.
     *
     * Se invierte el arreglo en vez de ordenarlo por fecha: los turnos se
     * guardan en orden, y dos que caigan en el mismo milisegundo empatarían
     * en un sort y saldrían desordenados.
     */
    function sesiones(modulo) {
        const k = llaveUsuario();
        if (!k) return [];
        const mio = todo()[k] || {};
        return (mio[modulo] || []).slice().reverse();
    }

    /**
     * Guarda un turno.
     *
     * `turnoId` identifica al turno en curso. Al mandarlo, el registro se
     * ACTUALIZA en vez de duplicarse: así el simulador puede ir reportando
     * después de cada pedido y el panel se llena desde la primera pizza, sin
     * que el mismo turno aparezca ocho veces en el historial.
     */
    function guardarSesion(modulo, datos, turnoId) {
        const k = llaveUsuario();
        if (!k) return false;                 // sin sesión no se atribuye nada

        const banco = todo();
        if (!banco[k]) banco[k] = {};
        if (!banco[k][modulo]) banco[k][modulo] = [];

        const lista = banco[k][modulo];
        const registro = Object.assign({ fecha: Date.now(), turnoId: turnoId }, datos);

        const i = (turnoId != null) ? lista.findIndex(s => s.turnoId === turnoId) : -1;
        if (i >= 0) {
            registro.fecha = lista[i].fecha;   // conserva cuándo empezó el turno
            lista[i] = registro;
        } else {
            lista.push(registro);
            if (lista.length > MAX_SESIONES) banco[k][modulo] = lista.slice(-MAX_SESIONES);
        }

        return escribirJSON(CLAVE_DATOS, banco);
    }

    const prom = (lista, campo) =>
        lista.length ? lista.reduce((a, s) => a + (s[campo] || 0), 0) / lista.length : 0;

    /**
     * Agregados de un módulo. `hayDatos` es lo que decide entre pintar cifras
     * o pintar el estado vacío, así que las pantallas no tienen que adivinar.
     */
    function resumen(modulo) {
        const s = sesiones(modulo);
        if (!s.length) {
            return {
                hayDatos: false, turnos: 0, pedidos: 0, mejorPuntaje: 0,
                puntajeProm: 0, perfectosPct: 0, precision: 0, tiempoProm: 0,
                mejorRacha: 0, dominio: 0, ultima: null, serie: []
            };
        }

        // "Dominio" mezcla lo que de verdad mide el desempeño en la estación:
        // qué tan seguido sale perfecta, qué tan preciso es el armado y cuánto
        // se sostiene la racha. Es la cifra que ve el empleado en el dashboard.
        const perfectosPct = prom(s, "perfectosPct");
        const precision = prom(s, "precision");
        const rachaTope = Math.max.apply(null, s.map(x => x.mejorRacha || 0));
        const constancia = Math.min(100, rachaTope * 12.5);   // racha de 8 = 100
        const dominio = Math.round(perfectosPct * 0.45 + precision * 0.4 + constancia * 0.15);

        return {
            hayDatos: true,
            turnos: s.length,
            pedidos: s.reduce((a, x) => a + (x.pedidos || 0), 0),
            mejorPuntaje: Math.max.apply(null, s.map(x => x.puntos || 0)),
            puntajeProm: Math.round(prom(s, "puntos")),
            perfectosPct: Math.round(perfectosPct),
            precision: Math.round(precision),
            tiempoProm: +prom(s, "tiempoProm").toFixed(1),
            mejorRacha: rachaTope,
            dominio: Math.max(0, Math.min(100, dominio)),
            ultima: s[0],
            serie: s.slice(0, 12).reverse()   // cronológico, para la gráfica
        };
    }

    /* ---- API ------------------------------------------------------------ */

    const Progreso = {
        MODULOS: { SIM2D: "simulador-2d", ENTORNO3D: "entorno-3d" },

        usuario() { return usuarioActual; },
        haySesion() { return !!llaveUsuario(); },

        alCambiarUsuario(fn) {
            if (typeof fn !== "function") return;
            oyentes.push(fn);
            fn(usuarioActual);           // primer disparo inmediato
        },

        /** Refresca las pantallas sin cambiar de usuario (tras guardar datos). */
        refrescar() { avisar(); },

        cerrarSesion(destino) {
            const salir = () => {
                fijarUsuario(null);
                if (destino) global.location.href = destino;
            };
            if (typeof global.firebase !== "undefined"
                && global.firebase.apps && global.firebase.apps.length) {
                global.firebase.auth().signOut().then(salir).catch(salir);
            } else {
                salir();
            }
        },

        guardarSesion, sesiones, resumen,

        borrarTodo() {
            const k = llaveUsuario();
            if (!k) return;
            const banco = todo();
            delete banco[k];
            escribirJSON(CLAVE_DATOS, banco);
        }
    };

    global.Progreso = Progreso;
    engancharFirebase();

})(window);
