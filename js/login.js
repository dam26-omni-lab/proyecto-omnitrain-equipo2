// =========================
// CONFIGURACIÓN FIREBASE
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyD7GLaiicfXQkfXDhipEgeAL-ZVe6wqOOw",
  authDomain: "dominos-system.firebaseapp.com",
  projectId: "dominos-system",
  storageBucket: "dominos-system.firebasestorage.app",
  messagingSenderId: "589460214273",
  appId: "1:589460214273:web:b0c045dfa12f2db98ae600",
  measurementId: "G-P5R7N2L1VT"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener el servicio de autenticación
const auth = firebase.auth();

// =========================
// LOGIN
// =========================
document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("loginForm");
  const feedbackEl = document.getElementById("loginFeedback");
  const loginButton = document.getElementById("loginButton");

  form.addEventListener("submit", async (event) => {

    // Evitar recarga de la página
    event.preventDefault();
    event.stopPropagation();

    // Validación Bootstrap
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    // Obtener datos del formulario
    const role = document.getElementById("role").value;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    // Mensaje y bloqueo del botón
    feedbackEl.textContent = "Iniciando sesión...";
    feedbackEl.className = "text-center mt-3 small fw-semibold text-primary";
    loginButton.disabled = true;

    try {

      // =========================
      // AUTENTICACIÓN REAL CON FIREBASE
      // =========================
      await auth.signInWithEmailAndPassword(email, password);

      // Login correcto
      feedbackEl.textContent = "¡Inicio de sesión exitoso!";
      feedbackEl.className = "text-center mt-3 small fw-semibold text-success";

      // =========================
      // REDIRECCIÓN SEGÚN EL ROL
      // =========================
      setTimeout(() => {
        if (role === "administrador") {
          window.location.href = "./modules/panel-kpis/index.html";
        } else if (role === "capacitado") {
          window.location.href = "./modules/simulador-2d/index.html";
        }
      }, 1000);

    } catch (error) {

      console.error(error);

      // Mensajes más claros
      let mensaje = "No fue posible iniciar sesión.";

      switch (error.code) {
        case "auth/invalid-email":
          mensaje = "El correo no tiene un formato válido.";
          break;

        case "auth/user-not-found":
          mensaje = "No existe una cuenta con este correo.";
          break;

        case "auth/wrong-password":
        case "auth/invalid-credential":
          mensaje = "Correo o contraseña incorrectos.";
          break;

        case "auth/too-many-requests":
          mensaje = "Demasiados intentos. Intenta de nuevo en unos minutos.";
          break;
      }

      feedbackEl.textContent = mensaje;
      feedbackEl.className = "text-center mt-3 small fw-semibold text-danger";

    } finally {

      // Volver a habilitar el botón
      loginButton.disabled = false;
    }
  });
});