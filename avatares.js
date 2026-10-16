const AVATARES = [
  { id: "av1", archivo: "imagenes/avatares/avatar1.png" },
  { id: "av2", archivo: "imagenes/avatares/avatar2.png" },
  { id: "av3", archivo: "imagenes/avatares/avatar3.png" },
  { id: "av4", archivo: "imagenes/avatares/avatar4.png" },
  { id: "av5", archivo: "imagenes/avatares/avatar5.png" },
  { id: "av6", archivo: "imagenes/avatares/avatar6.png" },
  { id: "av7", archivo: "imagenes/avatares/avatar7.png" },
  { id: "av8", archivo: "imagenes/avatares/avatar8.png" },
  { id: "av9", archivo: "imagenes/avatares/avatar9.png" },
  { id: "av10", archivo: "imagenes/avatares/avatar10.png" },
  { id: "av11", archivo: "imagenes/avatares/avatar11.png" },
  { id: "av12", archivo: "imagenes/avatares/avatar12.png" },
  { id: "av13", archivo: "imagenes/avatares/avatar13.png" },
  { id: "av14", archivo: "imagenes/avatares/avatar14.png" },
  { id: "av15", archivo: "imagenes/avatares/avatar15.png" },
  { id: "av16", archivo: "imagenes/avatares/avatar16.png" },
  { id: "av17", archivo: "imagenes/avatares/avatar17.png" },
  { id: "av18", archivo: "imagenes/avatares/avatar18.png" },
  { id: "av19", archivo: "imagenes/avatares/avatar19.png" },
  { id: "av20", archivo: "imagenes/avatares/avatar20.png" }
];

const BANNERS = [
  { id: "bn1", nombre: "Estadio de noche", archivo: "imagenes/banners/banner1.jpg" },
  { id: "bn2", nombre: "La cancha", archivo: "imagenes/banners/banner2.jpg" },
  { id: "bn3", nombre: "Túnel de entrada", archivo: "imagenes/banners/banner3.png" },
  { id: "bn4", nombre: "La copa", archivo: "imagenes/banners/banner4.jpg" },
  { id: "bn5", nombre: "Atardecer", archivo: "imagenes/banners/banner5.jpg" },
  { id: "bn6", nombre: "Festejos de gol", archivo: "imagenes/banners/banner6.jpg" },
  { id: "bn7", nombre: "Estadio con lluvia", archivo: "imagenes/banners/banner7.jpg" },
  { id: "bn8", nombre: "Pelota junto a la red", archivo: "imagenes/banners/banner8.png" },
  { id: "bn9", nombre: "Arco con el sol de fondo", archivo: "imagenes/banners/banner9.png" },
  { id: "bn10", nombre: "Césped", archivo: "imagenes/banners/banner10.png" },
  { id: "bn11", nombre: "Vestuario con pizarra táctica", archivo: "imagenes/banners/banner11.png" },
  { id: "bn12", nombre: "Público alentando en las tribunas", archivo: "imagenes/banners/banner12.png" },
  { id: "bn13", nombre: "Bandera en el córner al atardecer", archivo: "imagenes/banners/banner13.png" }
];

function escaparHTML(texto) {
  return String(texto == null ? "" : texto).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function buscarAvatar(id) {
  return id ? AVATARES.find(a => a.id === id) || null : null;
}

function buscarBanner(id) {
  return id ? BANNERS.find(b => b.id === id) || null : null;
}


function avatarHTML(id, tamano, nombre) {
  const opcion = buscarAvatar(id);
  const inicial = escaparHTML(
    (Array.from((nombre || "?").trim())[0] || "?").toUpperCase()
  );

  const contenido = opcion
    ? `<span class="avatar-respaldo">${inicial}</span>
       <img src="${opcion.archivo}" alt="Avatar"
            onerror="this.remove()">`
    : `<span class="avatar-respaldo">${inicial}</span>`;

  return `<span class="avatar avatar-${tamano}">${contenido}</span>`;
}

function cabeceraPerfilHTML(avatarId, bannerId, nombre) {
  const banner = buscarBanner(bannerId);
  const imagen = banner
    ? `<img src="${banner.archivo}" alt=""
            onerror="this.remove()">`
    : "";

  return `
    <div class="perfil-banner">${imagen}</div>
    <div class="perfil-avatar">
      ${avatarHTML(avatarId, "l", nombre)}
    </div>
  `;
}

function pintarCabeceraPerfil(cuenta, nombre, esElMio) {
  const cabecera = document.getElementById("perfil-cabecera");

  if (cabecera) {
    cabecera.innerHTML = cabeceraPerfilHTML(
      cuenta.avatar,
      cuenta.banner,
      nombre
    );
  }

  const boton = document.getElementById("btn-cambiar-avatar");

  if (boton) {
    boton.style.display = esElMio ? "" : "none";
  }
}

let origenAvatar = "perfil";
let avatarElegido = null;
let bannerElegido = null;

function abrirSelectorAvatar(origen) {
  origenAvatar = origen;

  if (!AVATARES.length && !BANNERS.length) {
    continuarDespuesDeAvatar();
    return;
  }

  const u = usuario();

  avatarElegido = (u && u.avatar) || null;
  bannerElegido = (u && u.banner) || null;

  const app = document.getElementById("app");

  if (origen === "perfil" && app) {
    app.classList.remove("activa");
  }

  document.getElementById("avatar-bloque-avatares").style.display =
    AVATARES.length ? "" : "none";

  document.getElementById("avatar-bloque-banners").style.display =
    BANNERS.length ? "" : "none";

  document.getElementById("btn-avatar-guardar").textContent =
    origen === "registro" ? "Guardar y continuar" : "Guardar";

  document.getElementById("btn-avatar-omitir").textContent =
    origen === "registro" ? "Ahora no" : "Cancelar";

  pintarSelectorAvatar();
  irAPantalla("pantalla-avatar");
}

function pintarSelectorAvatar() {
  const u = usuario();
  const nombre = (u && u.nombre) || "Entrenador";

  document.getElementById("avatar-preview").innerHTML =
    cabeceraPerfilHTML(avatarElegido, bannerElegido, nombre) +
    `<p class="avatar-preview-nombre">${escaparHTML(nombre)}</p>`;

  document.getElementById("avatar-grilla").innerHTML =
    AVATARES.map(a => `
      <button
        type="button"
        class="avatar-opcion ${a.id === avatarElegido ? "elegida" : ""}"
        onclick="elegirAvatarOpcion('${a.id}')">

        ${avatarHTML(a.id, "m", nombre)}
        <span>Avatar ${a.id.replace("av", "")}</span>
      </button>
    `).join("");

  document.getElementById("banner-grilla").innerHTML =
    BANNERS.map(b => `
      <button
        type="button"
        class="banner-opcion ${b.id === bannerElegido ? "elegida" : ""}"
        onclick="elegirBannerOpcion('${b.id}')">

        <img src="${b.archivo}" alt=""
             onerror="this.remove()">

        <span>${escaparHTML(b.nombre)}</span>
      </button>
    `).join("");
}

function elegirAvatarOpcion(id) {
  avatarElegido = id;
  pintarSelectorAvatar();
}

function elegirBannerOpcion(id) {
  bannerElegido = id;
  pintarSelectorAvatar();
}


async function guardarPerfilVisual() {
  const u = usuario();

  if (!u) {
    mostrarAviso("Iniciá sesión para guardar los cambios.");
    return;
  }

  const boton = document.getElementById("btn-avatar-guardar");
  if (!boton) return;

  boton.disabled = true;

  try {
    const { data, error } = await supa.auth.updateUser({
      data: {
        avatar: avatarElegido,
        banner: bannerElegido
      }
    });

    if (error) {
      console.error("Error al guardar el perfil visual:", error);
      mostrarAviso("No se pudieron guardar los cambios. Probá de nuevo.");
      return;
    }

    u.avatar = avatarElegido;
    u.banner = bannerElegido;

    if (data && data.user) {
      u.avatar = data.user.user_metadata?.avatar ?? avatarElegido;
      u.banner = data.user.user_metadata?.banner ?? bannerElegido;
    }

    if (
      u.club &&
      typeof sincronizarRankingOnline === "function"
    ) {
      sincronizarRankingOnline();
    }

    mostrarAviso(" Perfil actualizado");
    continuarDespuesDeAvatar();

  } catch (error) {
    console.error("Error al guardar el perfil visual:", error);
    mostrarAviso("Ocurrió un error al guardar los cambios.");
  } finally {
    boton.disabled = false;
  }
}

function continuarDespuesDeAvatar() {
  if (origenAvatar === "registro") {
    mostrarPantallaLigas();
    return;
  }

  document.querySelectorAll(".pantalla").forEach(p => {
    p.classList.remove("activa");
  });

  document.getElementById("app").classList.add("activa");
  irAPantalla2("perfil");
}



function iniciarModuloAvatares() {
  const encabezado = document.querySelector(
    "#vista-perfil .encabezado-simple"
  );

  if (!encabezado) return;

  if (document.getElementById("btn-cambiar-avatar")) return;

  const botonVolver = encabezado.querySelector("button");

  const cabecera = `
    <div class="perfil-cabecera" id="perfil-cabecera"></div>
  `;

  if (botonVolver) {
    botonVolver.insertAdjacentHTML("afterend", cabecera);
  } else {
    encabezado.insertAdjacentHTML("afterbegin", cabecera);
  }

  encabezado.insertAdjacentHTML(
    "beforeend",
    `<button
      class="boton boton-gris"
      id="btn-cambiar-avatar"
      style="display:none;"
      onclick="abrirSelectorAvatar('perfil')">
       Cambiar avatar y banner
    </button>`
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    iniciarModuloAvatares
  );
} else {
  iniciarModuloAvatares();
}
