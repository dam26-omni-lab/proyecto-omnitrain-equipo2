/* ============================================================================
   DOMINO'S SYSTEM — CÁSCARA DEL PORTAL
   ----------------------------------------------------------------------------
   Lo que comparten todas las páginas: el menú lateral en móvil y la identidad
   de quien está dentro en la barra superior.

   Reemplaza a main.js, que solo abría el menú. Va después de progreso.js.
============================================================================ */

(function () {
    "use strict";

    /* ---- Menú lateral en pantallas chicas ---- */

    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");

    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("show");
        });

        // Tocar fuera lo cierra: en móvil el menú tapa el contenido.
        document.addEventListener("click", (e) => {
            if (!sidebar.classList.contains("show")) return;
            if (!sidebar.contains(e.target) && e.target !== menuBtn) {
                sidebar.classList.remove("show");
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") sidebar.classList.remove("show");
        });
    }

    /* ---- Identidad en la barra superior ---- */

    if (typeof window.Progreso === "undefined") return;

    const btnEntrar = document.getElementById("btnEntrar");
    const chip = document.getElementById("chipCuenta");
    const btnSalir = document.getElementById("btnSalir");
    const elNombre = document.getElementById("cuentaNombre");
    const elRol = document.getElementById("cuentaRol");
    const elInicial = document.getElementById("cuentaInicial");

    if (!btnEntrar && !chip) return;   // la página no tiene barra de cuenta

    // La ruta al login cambia según la profundidad de la página.
    const rutaLogin = btnEntrar ? btnEntrar.getAttribute("href") : "login.html";

    const mostrar = (el, visible) => {
        if (el) el.classList.toggle("oculto", !visible);
    };

    window.Progreso.alCambiarUsuario(function (usuario) {
        mostrar(btnEntrar, !usuario);
        mostrar(chip, !!usuario);
        mostrar(btnSalir, !!usuario);

        if (!usuario) return;

        const nombre = usuario.nombre || "Operador";
        if (elNombre) elNombre.textContent = nombre;
        if (elInicial) elInicial.textContent = nombre.trim().charAt(0).toUpperCase();
        // Se muestra el correo, no un rol: el rol lo elige el usuario en el
        // formulario de login y Firebase no lo conserva, así que inventarlo
        // aquí sería mostrar un dato que puede ser falso.
        if (elRol) elRol.textContent = usuario.correo || "En sesión";
    });

    if (btnSalir) {
        btnSalir.addEventListener("click", () => {
            window.Progreso.cerrarSesion(rutaLogin);
        });
    }
})();