let LIGAS = [];
let POOL_MERCADO = [];

async function cargarDatosDelJuego(){
  const { data: ligasData, error: errorLigas } = await supa
    .from("ligas")
    .select("id, nombre, imagen, equipos(id, nombre, calidad, presupuesto, imagen, jugadores(nombre, puesto, nivel, valor, edad))")
    .order("id");

  if(errorLigas){
    console.log("Error al cargar ligas:", errorLigas);
    throw errorLigas;
  }

  LIGAS = ligasData.map(liga => ({
    nombre: liga.nombre,
    escudo: liga.imagen,
    equipos: liga.equipos.map(equipo => ({
      nombre: equipo.nombre,
      calidad: equipo.calidad,
      presupuesto: equipo.presupuesto,
      escudo: equipo.imagen,
      real: equipo.jugadores
    }))
  }));

  const { data: mercadoData, error: errorMercado } = await supa
    .from("mercado_jugadores")
    .select("nombre, puesto, nivel, valor, edad");

  if(errorMercado){
    console.log("Error al cargar mercado:", errorMercado);
    throw errorMercado;
  }

  POOL_MERCADO = mercadoData;
}


const FORMACIONES={
  "4-3-3": { DEF: 4, MED: 3, DEL: 3 },
  "4-4-2": { DEF: 4, MED: 4, DEL: 2 },
  "3-5-2": { DEF: 3, MED: 5, DEL: 2 }
};


const FASES_COPA = ["previa", "octavos", "cuartos", "semifinal", "final"];

const NOMBRE_FASE = {
  previa: "Fase Previa",
  octavos: "Octavos de Final",
  cuartos: "Cuartos de Final",
  semifinal: "Semifinal",
  final: "Final"
};

const PREMIOS_COPA = {
  previa: 1000000,
  octavos: 3000000,
  cuartos: 5000000,
  semifinal: 7000000,
  final: 10000000
};

const PREMIO_SUPERCOPA = 4000000;


const FRASES_GOL_PROPIO = [
  "¡GOLAZO de {j}!",
  "{j} define de zurda y la clava en el ángulo",
  "Gran jugada colectiva y {j} la empuja al gol",
  "{j} cabecea y no perdona en el área chica",
  "¡Golazo de tiro libre de {j}!",
  "{j} entra solo y define ante el arquero",
  "Remate cruzado de {j}, imposible para el arquero",
  "{j} aprovecha el rebote y anota",
  "{j} la pica por encima del arquero, ¡qué categoría!",
];

const FRASES_GOL_RIVAL = [
  "{r} descuenta en un contragolpe letal",
  "Error defensivo y gol de {r}",
  "{r} anota de penal",
  "Remate lejano y gol de {r}",
  "{r} cabecea tras un córner y marca",
  "{r} sorprende con un zapatazo",
  "{r} aprovecha un rebote y define",
];


let baseDeDatos = cargarBaseDeDatos();
let emailActual = null;
let ligaElegidaTemporal = null;
let filtroPlantelActual = "TODOS";
let tabMercadoActual = "comprar";
let filtrosMercado = { texto: "", posicion: "TODOS", nivelMin: null, edadMax: null, valorMax: null };
let perfilVistoEmail = null;
let perfilOrigen = "stats";

function cargarBaseDeDatos(){
    return {};
}
async function guardarBaseDeDatos(){
  if(!emailActual) return;

  const cuenta = baseDeDatos[emailActual];
  if(!cuenta || !cuenta.club) return;

  const { error } = await supa
    .from("partidas")
    .upsert({
      usuario_id: cuenta.id,
      datos: cuenta.club
    });

  if(error){
    console.log("Error al guardar la partida:", error);
  }
}

function usuario(){
  return baseDeDatos[emailActual] ? baseDeDatos[emailActual] : null;
}
function irAPantalla(idPantalla){
  document.querySelectorAll(".pantalla").forEach(p => p.classList.remove("activa"));
  document.getElementById(idPantalla).classList.add("activa");
}

function irARegistro(){
  irAPantalla("pantalla-auth");
  mostrarTab("registro");
}

function irAPantalla2(nombreVista){
  document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));
  document.getElementById("vista-" + nombreVista).classList.add("activa");
  document.querySelectorAll(".nav-boton").forEach(b => {
    b.classList.toggle("activa", b.dataset.vista === nombreVista);
  });

  if(nombreVista === "inicio") mostrarInicio();
  if(nombreVista === "plantel") mostrarPlantel();
  if(nombreVista === "alineacion") mostrarAlineacion();
  if(nombreVista === "mercado") mostrarMercado();
  if(nombreVista === "liga") mostrarTablaLiga();
  if(nombreVista === "calendario") mostrarCalendario();
  if(nombreVista === "stats") mostrarStats();
  if(nombreVista === "historial") pintarHistorial();
  if(nombreVista === "ranking") pintarRanking();
  if(nombreVista === "perfil") mostrarPerfil();

  ajustarVolumenSegunVista(nombreVista === "partido" ? "partido" : "menu");
  asegurarMusicaSonando();
}

function mostrarTab(tab){
  document.getElementById("tab-login").classList.toggle("activa", tab === "login");
  document.getElementById("tab-registro").classList.toggle("activa", tab === "registro");
  document.getElementById("form-login").classList.toggle("oculto", tab !== "login");
  document.getElementById("form-registro").classList.toggle("oculto", tab !== "registro");
}

function mostrarAviso(texto){
  const aviso = document.getElementById("aviso");
  aviso.textContent = texto;
  aviso.classList.add("mostrar");
  setTimeout(() => aviso.classList.remove("mostrar"), 2600);
}


async function crearCuenta(evento){
    evento.preventDefault();

    const email = document.getElementById("registro-email").value.trim().toLowerCase();
    const clave = document.getElementById("registro-pass").value;
    const mensaje = document.getElementById("registro-mensaje");

    if(clave.length < 4){
        mensaje.textContent = "La contraseña debe tener al menos 4 caracteres.";
        return false;
    }

    const { data, error } = await supa.auth.signUp({
        email: email,
        password: clave
    });

    if(error){
        mensaje.textContent = error.message === "User already registered"
            ? "Ese email ya está registrado."
            : error.message;
        return false;
    }

    emailActual = email;
    baseDeDatos[email] = {
        id: data.user.id,
        club: null
    };
    mostrarPantallaLigas();
    return false;
}

async function iniciarSesion(evento){
    evento.preventDefault();

    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const clave = document.getElementById("login-pass").value;
    const mensaje = document.getElementById("login-mensaje");

    const { data, error } = await supa.auth.signInWithPassword({
        email: email,
        password: clave
    });

    if(error){
        mensaje.textContent = "Email o contraseña incorrectos.";
        return false;
    }

    const usuarioId = data.user.id;

    const { data: partidaGuardada } = await supa
        .from("partidas")
        .select("datos")
        .eq("usuario_id", usuarioId)
        .maybeSingle();

    emailActual = email;
    baseDeDatos[email] = {
        id: usuarioId,
        club: partidaGuardada ? partidaGuardada.datos : null
    };

    if(baseDeDatos[email].club){
        entrarAlJuego();
    }else{
        mostrarPantallaLigas();
    }

    return false;
}
async function cerrarSesion(){
  await supa.auth.signOut();
  emailActual = null;
  document.getElementById("app").classList.remove("activa");
  irAPantalla("pantalla-auth");
}


function mostrarPantallaLigas(){
  const contenedor = document.getElementById("lista-ligas");
  contenedor.innerHTML = "";
  LIGAS.forEach((liga, indice) => {
    const div = document.createElement("div");
    div.className = "tarjeta-liga";
    div.onclick = () => elegirLiga(indice);
    div.innerHTML = `
      ${liga.escudo ? `<img src="${liga.escudo}" alt="${liga.nombre}" class="escudo-liga escudo-mediano" />` : ""}
      <div>
        <p class="nombre-liga">${liga.nombre}</p>
        <p class="detalle-liga">${liga.equipos.length} equipos</p>
      </div>
      <span class="flecha">→</span>
    `;
    contenedor.appendChild(div);
  });
  irAPantalla("pantalla-liga");
}

function elegirLiga(indice){
  ligaElegidaTemporal = LIGAS[indice];
  document.getElementById("titulo-liga-elegida").textContent = "Equipos de " + ligaElegidaTemporal.nombre;

  const contenedor = document.getElementById("lista-equipos");
  contenedor.innerHTML = "";
  ligaElegidaTemporal.equipos.forEach((equipo, indiceEquipo) => {
    const div = document.createElement("div");
    div.className = "tarjeta-equipo";
    div.onclick = () => elegirEquipo(indiceEquipo);
    div.innerHTML = `
      ${escudoEquipoHTML(equipo, "mediano")}
      <div>
        <p class="nombre-equipo">${equipo.nombre}</p>
        <p class="detalle-equipo">Presupuesto: ${formatearPlata(equipo.presupuesto)} · Calidad: ${equipo.calidad}</p>
      </div>
      <span class="flecha">→</span>
    `;
    contenedor.appendChild(div);
  });
  irAPantalla("pantalla-equipo");
}

function elegirEquipo(indiceEquipo){
  const equipo = ligaElegidaTemporal.equipos[indiceEquipo];
  baseDeDatos[emailActual].club = crearClubNuevo(equipo, ligaElegidaTemporal);
  guardarBaseDeDatos();
  entrarAlJuego();
}


function numeroAleatorio(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function elegirAlAzar(lista){ return lista[Math.floor(Math.random() * lista.length)]; }
function formatearPlata(numero){
  return "$" + (numero / 1000000).toFixed(numero % 1000000 === 0 ? 0 : 1) + "M";
}


const EMOJI_NOTICIA = { gol: "⚽", fichaje: "💰", lesion: "🏥", copa: "🏆" };

function agregarNoticia(club, texto, tipo){
  club.noticias = club.noticias || [];
  club.noticias.unshift({ texto, tipo, temporada: club.temporada, fecha: club.fecha });
  if(club.noticias.length > 20) club.noticias.length = 20;
}


function buscarEquipoPorNombre(nombre, club){
  if(!nombre) return null;
  if(club){
    if(club.nombre === nombre) return club;
    const enRivales = (club.rivales || []).find(r => r.nombre === nombre);
    if(enRivales) return enRivales;
    const enOtros = (club.otrosEquipos || []).find(r => r.nombre === nombre);
    if(enOtros) return enOtros;
  }
  for(const liga of LIGAS){
    const encontrado = liga.equipos.find(e => e.nombre === nombre);
    if(encontrado) return encontrado;
  }
  return null;
}

function escudoEquipoHTML(equipoONombre, tamano, club){
  let nombre, escudo;
  if(equipoONombre && typeof equipoONombre === "object"){
    nombre = equipoONombre.nombre;
    escudo = equipoONombre.escudo;
  } else {
    nombre = equipoONombre;
    const encontrado = buscarEquipoPorNombre(nombre, club);
    escudo = encontrado ? encontrado.escudo : null;
  }
  const clase = "escudo-equipo" + (tamano ? " escudo-" + tamano : "");
  return `<img src="${escudo}" alt="${nombre}" class="${clase}" />`;
}

function crearJugadorReal(real){
  return {
    id: "j" + Date.now() + numeroAleatorio(1, 99999),
    nombre: real.nombre, puesto: real.puesto,
    edad: real.edad,
    nivel: real.nivel,
    valor: real.valor,
    esReal: true, lesionado: 0
  };
}
function crearPlantelInicial(equipo){
  return (equipo.real || []).map(real => crearJugadorReal(real));
}

function generarObjetivosTemporada(club){
  const calidad = club.calidadBase;

  let posicionLiga = 15;
  if(calidad >= 87) posicionLiga = 3;
  else if(calidad >= 80) posicionLiga = 5;
  else if(calidad >= 76) posicionLiga = 8;
  else if(calidad >= 72) posicionLiga = 12;

  let faseCopa = "octavos";
  if(calidad >= 87) faseCopa = "final";
  else if(calidad >= 80) faseCopa = "semifinal";
  else if(calidad >= 74) faseCopa = "cuartos";

  const golesObjetivo = Math.max(15, Math.round(20 + (calidad - 65) * 1.1));
  const finanzasObjetivo = Math.max(500000, Math.round(club.presupuesto * 0.12 / 500000) * 500000);

  club.objetivosTemporada = {
    liga: { texto: `Terminar entre los ${posicionLiga} primeros`, valor: posicionLiga },
    copa: { texto: `Llegar a ${NOMBRE_FASE[faseCopa]}`, valor: faseCopa },
    goles: { texto: `Marcar más de ${golesObjetivo} goles`, valor: golesObjetivo },
    finanzas: { texto: `Terminar con +${formatearPlata(finanzasObjetivo)}`, valor: finanzasObjetivo, presupuestoInicial: club.presupuesto }
  };
}


function calcularProgresoObjetivos(club){
  if(!club.objetivosTemporada) return [];
  const obj = club.objetivosTemporada;

  const tabla = obtenerTablaOrdenada(club);
  const posicionActual = tabla.findIndex(f => f.nombre === club.nombre) + 1;

  let faseActualTexto = "Sin arrancar";
  if(club.copa.campeon === club.nombre) faseActualTexto = "Campeón";
  else if(club.copa.eliminado && club.copa.fase) faseActualTexto = `Eliminado en ${NOMBRE_FASE[club.copa.fase]}`;
  else if(club.copa.fase) faseActualTexto = NOMBRE_FASE[club.copa.fase];

  const golesActuales = club.golesTemporadaActual || 0;

  const gananciaActual = club.presupuesto - obj.finanzas.presupuestoInicial;
  const signoGanancia = gananciaActual >= 0 ? "+" : "-";
  const actualFinanzas = signoGanancia + formatearPlata(Math.abs(gananciaActual));

  return [
    { icono: "", texto: "Liga: " + obj.liga.texto, actual: `Actualmente: ${posicionActual > 0 ? posicionActual + "° posición" : "—"}` },
    { icono: "", texto: "Copa: " + obj.copa.texto, actual: `Actualmente: ${faseActualTexto}` },
    { icono: "", texto: "Goles: " + obj.goles.texto, actual: `Actualmente: ${golesActuales} goles` },
    { icono: "", texto: "Finanzas: " + obj.finanzas.texto, actual: `Actualmente: ${actualFinanzas}` }
  ];
}


function evaluarObjetivos(club, miPosicion, golesTemporada){
  if(!club.objetivosTemporada) return null;
  const obj = club.objetivosTemporada;

  const cumplLiga = miPosicion <= obj.liga.valor;

  let indiceAlcanzado = -1;
  if(club.copa.campeon === club.nombre) indiceAlcanzado = FASES_COPA.length - 1;
  else if(club.copa.fase) indiceAlcanzado = FASES_COPA.indexOf(club.copa.fase);
  const cumplCopa = indiceAlcanzado >= FASES_COPA.indexOf(obj.copa.valor);

  const cumplGoles = golesTemporada > obj.goles.valor;

  const gananciaTemporada = club.presupuesto - obj.finanzas.presupuestoInicial;
  const cumplFinanzas = gananciaTemporada >= obj.finanzas.valor;

  const items = [
    { icono: "🏆", texto: "Liga: " + obj.liga.texto, cumplido: cumplLiga },
    { icono: "🏆", texto: "Copa: " + obj.copa.texto, cumplido: cumplCopa },
    { icono: "⚽", texto: "Goles: " + obj.goles.texto, cumplido: cumplGoles },
    { icono: "💰", texto: "Finanzas: " + obj.finanzas.texto, cumplido: cumplFinanzas }
  ];
  return { items: items, cumplidos: items.filter(i => i.cumplido).length, total: items.length };
}


function clonarEquipoParaClub(equipo, nombreLiga){
  return {
    nombre: equipo.nombre,
    liga: nombreLiga,
    presupuesto: equipo.presupuesto,
    calidad: equipo.calidad,
    escudo: equipo.escudo,
    real: (equipo.real || []).map(j => ({ ...j }))
  };
}

function crearClubNuevo(equipoElegido, liga){
  const plantel = crearPlantelInicial(equipoElegido);
  const rivales = liga.equipos
    .filter(e => e.nombre !== equipoElegido.nombre)
    .map(e => clonarEquipoParaClub(e, liga.nombre));


  const otrosEquipos = LIGAS
    .filter(l => l.nombre !== liga.nombre)
    .flatMap(l => l.equipos.map(e => clonarEquipoParaClub(e, l.nombre)));

  const tabla = {};
  tabla[equipoElegido.nombre] = filaVacia();
  rivales.forEach(r => tabla[r.nombre] = filaVacia());

  const ordenRivales = rivales.map(r => r.nombre).sort(() => Math.random() - 0.5);

  const club = {
    nombre: equipoElegido.nombre,
    liga: liga.nombre,
    presupuesto: equipoElegido.presupuesto,
    calidadBase: equipoElegido.calidad,
    escudo: equipoElegido.escudo,
    plantel: plantel,
    rivales: rivales,
    otrosEquipos: otrosEquipos,
    tabla: tabla,
    calendario: ordenRivales,
    fecha: 1,
    temporada: 1,
    formacion: "4-3-3",
    alineacion: { POR: "", DEF: [], MED: [], DEL: [] },
    resultados: [],
    estadisticas: { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, copas: 0 },
    goleadores: {},
    noticias: [],
    jugadoresRealesComprados: [],
    ofertasRecibidas: [],
    ofertasSalientes: [],
    equipoFichando: null,
    trofeos: { ligas: 0 },
    totalGastadoFichajes: 0,
    golesTemporadaActual: 0,
    objetivosTemporada: null,
    copa: copaVacia(),
    supercopa: null,
    historial: [],
    resumenTemporadaPendiente: null
  };
  generarObjetivosTemporada(club);
  autoCompletarAlineacion(club);
  return club;
}

function filaVacia(){ return { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }; }

function copaVacia(){
  return {
    activa: false, fase: null, eliminado: false, campeon: null,
    pendiente: null, esperandoLiga: false,
    cruces: [], miCruce: null, byesPendientes: []
  };
}

function autoCompletarAlineacion(club){
  const necesita = FORMACIONES[club.formacion];
  const porPuesto = puesto => club.plantel
    .filter(j => j.puesto === puesto)
    .sort((a, b) => b.nivel - a.nivel);

  const arqueros = porPuesto("POR");
  club.alineacion.POR = arqueros[0] ? arqueros[0].id : "";
  club.alineacion.DEF = porPuesto("DEF").slice(0, necesita.DEF).map(j => j.id);
  club.alineacion.MED = porPuesto("MED").slice(0, necesita.MED).map(j => j.id);
  club.alineacion.DEL = porPuesto("DEL").slice(0, necesita.DEL).map(j => j.id);
}

function entrarAlJuego(){
  document.querySelectorAll(".pantalla").forEach(p => p.classList.remove("activa"));
  document.getElementById("app").classList.add("activa");
  asegurarCamposNuevosDelClub(usuario().club);
  actualizarEncabezado();
  irAPantalla2("inicio");
}

function asegurarCamposNuevosDelClub(club){
  let cambio = false;
  if(!club.ofertasRecibidas){ club.ofertasRecibidas = []; cambio = true; }
  if(!club.ofertasSalientes){ club.ofertasSalientes = []; cambio = true; }
  if(club.equipoFichando === undefined){ club.equipoFichando = null; cambio = true; }
  if(!club.trofeos){ club.trofeos = { ligas: 0 }; cambio = true; }
  if(club.supercopa === undefined){ club.supercopa = null; cambio = true; }
  if(club.totalGastadoFichajes === undefined){ club.totalGastadoFichajes = 0; cambio = true; }
  if(club.golesTemporadaActual === undefined){ club.golesTemporadaActual = 0; cambio = true; }
  if(!club.objetivosTemporada){ generarObjetivosTemporada(club); cambio = true; }
  if(cambio) guardarBaseDeDatos();
}

function actualizarEncabezado(){
  const club = usuario().club;
  document.getElementById("hud-club").innerHTML = escudoEquipoHTML(club, "chico") + club.nombre;
  document.getElementById("hud-info").textContent = "Temporada " + club.temporada + " · Fecha " + club.fecha;
  document.getElementById("hud-plata").textContent = formatearPlata(club.presupuesto);
}


function proximoRival(club){
  const indice = (club.fecha - 1) % club.calendario.length;
  return club.calendario[indice];
}

function tipoProximoPartido(club){
  if(club.supercopa && club.supercopa.pendiente) return "supercopa";
  if(club.copa && club.copa.pendiente && !club.copa.esperandoLiga) return "copa";
  return "liga";
}

function rivalDeMiCruce(club){
  const cruce = club.copa.miCruce;
  if(!cruce) return null;
  return cruce.equipoA === club.nombre ? cruce.equipoB : cruce.equipoA;
}

function obtenerProximoRivalGenerico(club){
  const tipo = tipoProximoPartido(club);
  if(tipo === "supercopa") return club.supercopa.rival;
  if(tipo === "copa") return rivalDeMiCruce(club);
  return proximoRival(club);
}

function etiquetaProximoPartido(club){
  const tipo = tipoProximoPartido(club);
  if(tipo === "supercopa") return "SUPERCOPA";
  if(tipo === "copa"){
    const cruce = club.copa.miCruce;
    if(cruce.esFinal) return "COPA · FINAL";
    return "COPA · " + (club.copa.pendiente === "vuelta" ? "VUELTA" : "IDA") + " · " + NOMBRE_FASE[club.copa.fase];
  }
  return "LIGA · Fecha " + club.fecha;
}


function mostrarInicio(){
  mostrarResumenTemporadaSiCorresponde();

  const club = usuario().club;

  document.getElementById("inicio-tipo-partido").textContent = etiquetaProximoPartido(club);
  const rivalInicio = obtenerProximoRivalGenerico(club) || "—";
  document.getElementById("inicio-mi-equipo").innerHTML = escudoEquipoHTML(club, "mediano") + club.nombre;
  document.getElementById("inicio-rival").innerHTML = escudoEquipoHTML(rivalInicio, "mediano", club) + rivalInicio;

  const tablaOrdenada = obtenerTablaOrdenada(club);
  const posicion = tablaOrdenada.findIndex(fila => fila.nombre === club.nombre) + 1;
  document.getElementById("inicio-posicion").textContent = posicion + "°";

  const listaGoleadores = Object.values(club.goleadores).sort((a, b) => b.goles - a.goles);
  document.getElementById("inicio-goleador").textContent = listaGoleadores.length
    ? listaGoleadores[0].nombre.split(" ")[0] + " (" + listaGoleadores[0].goles + ")"
    : "—";

  document.getElementById("inicio-racha").textContent = calcularRachaActual(club);

  const objetivosDiv = document.getElementById("inicio-objetivos");
  if(objetivosDiv){
    const progreso = calcularProgresoObjetivos(club);
    objetivosDiv.innerHTML = progreso.length
      ? `<p class="subtitulo-seccion" style="margin-top:16px;"> Objetivos de la temporada</p>` +
        progreso.map(o => `<div class="fila-objetivo"><span>${o.icono} ${o.texto}</span><span class="objetivo-actual">${o.actual}</span></div>`).join("")
      : "";
  }


  const noticiasDiv = document.getElementById("inicio-noticias");
  if(noticiasDiv){
    const noticias = club.noticias || [];
    noticiasDiv.innerHTML = noticias.length
      ? noticias.slice(0, 8).map(n => `
        <div class="noticia-item">
          <span class="noticia-icono">${EMOJI_NOTICIA[n.tipo] || "📰"}</span>
          <div>
            <p class="noticia-texto">${n.texto}</p>
            <p class="noticia-fecha">Temporada ${n.temporada} · Fecha ${n.fecha}</p>
          </div>
        </div>`).join("")
      : '<p class="vacio">Todavía no pasó nada relevante. Jugá algunas fechas y esto se va a ir llenando.</p>';
  }
}


function filtrarPlantel(puesto, boton){
  filtroPlantelActual = puesto;
  document.querySelectorAll("#filtros-posicion .filtro").forEach(b => b.classList.remove("activa"));
  boton.classList.add("activa");
  mostrarPlantel();
}

const LOGO_POSICION = {
  POR: "imagenes/Logo_Arquero.png",
  DEF: "imagenes/Logo_Defensa.png",
  MED: "imagenes/Logo_Centrocampista.png",
  DEL: "imagenes/Logo_Delantero.png"
};

function tarjetaJugadorHTML(jugador, botonExtra){
  const claseCrack = jugador.esCrack ? " jugador-crack" : "";
  const etiquetaCrack = jugador.esCrack ? ' <span class="etiqueta-crack">🌟 CRACK</span>' : "";
  const etiquetaLesion = jugador.lesionado > 0 ? ` · 🤕 afuera ${jugador.lesionado} fecha(s)` : "";
  const precioHTML = jugador.valorOriginal
    ? `<span class="precio-tachado">${formatearPlata(jugador.valorOriginal)}</span> ${formatearPlata(jugador.valor)}`
    : formatearPlata(jugador.valor);

  return `
    <div class="jugador${claseCrack}">
      <img class="jugador-pos" src="${LOGO_POSICION[jugador.puesto] || ""}" alt="${jugador.puesto}" />
      <div class="jugador-info">
        <p class="jugador-nombre">${jugador.esReal ? " " : ""}${jugador.nombre}${etiquetaCrack}</p>
        <p class="jugador-detalle">${jugador.edad} años${etiquetaLesion}</p>
      </div>
      <div class="jugador-nivel">${jugador.nivel}</div>
      <div class="jugador-valor">${precioHTML}</div>
      ${botonExtra || ""}
    </div>`;
}

function mostrarPlantel(){
  const club = usuario().club;
  let jugadores = club.plantel;
  if(filtroPlantelActual !== "TODOS"){
    jugadores = jugadores.filter(j => j.puesto === filtroPlantelActual);
  }
  jugadores = jugadores.slice().sort((a, b) => b.nivel - a.nivel);

  const contenedor = document.getElementById("lista-plantel");
  contenedor.innerHTML = jugadores.length
    ? jugadores.map(j => tarjetaJugadorHTML(j)).join("")
    : '<p class="vacio">No hay jugadores en este puesto.</p>';
}


function cambiarFormacion(){
  const club = usuario().club;
  club.formacion = document.getElementById("select-formacion").value;
  const necesita = FORMACIONES[club.formacion];

  ["DEF", "MED", "DEL"].forEach(puesto => {
    const actual = club.alineacion[puesto].slice(0, necesita[puesto]);
    while(actual.length < necesita[puesto]) actual.push("");
    club.alineacion[puesto] = actual;
  });

  guardarBaseDeDatos();
  mostrarAlineacion();
}

function jugadoresYaElegidos(club){
  return [club.alineacion.POR, ...club.alineacion.DEF, ...club.alineacion.MED, ...club.alineacion.DEL]
    .filter(id => id !== "");
}

const NOMBRE_PUESTO_LARGO = { POR: "arquero", DEF: "defensor", MED: "mediocampista", DEL: "delantero" };


function nombreCortoJugador(nombreCompleto){
  const partes = nombreCompleto.trim().split(" ");
  if(partes.length === 1) return partes[0];
  return partes[0][0] + ". " + partes.slice(1).join(" ");
}

function crearChipDePuesto(club, puesto, indice, idElegido){
  const jugador = idElegido ? club.plantel.find(j => j.id === idElegido) : null;
  const contenido = jugador
    ? `<span class="chip-jugador-nombre">${nombreCortoJugador(jugador.nombre)}${jugador.lesionado ? " 🤕" : ""}</span>
       <span class="chip-jugador-nivel">${jugador.nivel}</span>`
    : `<span class="chip-jugador-nombre">Elegir</span>
       <span class="chip-jugador-flecha">▾</span>`;

  return `<button type="button" class="chip-jugador ${jugador ? "" : "chip-vacio"}"
    onclick="abrirSelectorJugador('${puesto}', ${indice})">${contenido}</button>`;
}


let selectorActual = { puesto: null, indice: null };

function abrirSelectorJugador(puesto, indice){
  selectorActual = { puesto, indice };
  const club = usuario().club;
  const idActual = puesto === "POR" ? club.alineacion.POR : club.alineacion[puesto][indice];
  const yaElegidos = jugadoresYaElegidos(club);

  const disponibles = club.plantel
    .filter(j => j.puesto === puesto && (j.id === idActual || (!yaElegidos.includes(j.id) && !j.lesionado)))
    .sort((a, b) => b.nivel - a.nivel);

  document.getElementById("selector-titulo").textContent = "Elegir " + NOMBRE_PUESTO_LARGO[puesto];

  let html = `<div class="selector-item ${idActual === "" ? "selector-item-activo" : ""}" onclick="elegirJugadorDesdeSelector('')">
    <span class="selector-item-nombre">— Dejar vacío —</span>
  </div>`;
  html += disponibles.map(j => `
    <div class="selector-item ${j.id === idActual ? "selector-item-activo" : ""}" onclick="elegirJugadorDesdeSelector('${j.id}')">
      <span class="selector-item-nombre">${j.nombre}${j.lesionado ? " 🤕" : ""}</span>
      <span class="selector-item-nivel">${j.nivel}</span>
    </div>`).join("");

  document.getElementById("lista-selector-jugador").innerHTML = html;
  document.getElementById("modal-selector-jugador").classList.add("mostrar");
}

function elegirJugadorDesdeSelector(idJugador){
  cambiarJugadorAlineacion(selectorActual.puesto, selectorActual.indice, idJugador);
  cerrarSelectorJugador();
}

function cerrarSelectorJugador(){
  document.getElementById("modal-selector-jugador").classList.remove("mostrar");
}

function mostrarAlineacion(){
  const club = usuario().club;
  document.getElementById("select-formacion").value = club.formacion;
  const necesita = FORMACIONES[club.formacion];

  function filaHTML(puesto, cantidad, idsElegidos){
    let html = "";
    for(let i = 0; i < cantidad; i++){
      html += `<div class="puesto">
        <span class="puesto-etiqueta">${puesto}</span>
        ${crearChipDePuesto(club, puesto, i, idsElegidos[i] || "")}
      </div>`;
    }
    return html;
  }

  document.getElementById("fila-del").innerHTML = filaHTML("DEL", necesita.DEL, club.alineacion.DEL);
  document.getElementById("fila-med").innerHTML = filaHTML("MED", necesita.MED, club.alineacion.MED);
  document.getElementById("fila-def").innerHTML = filaHTML("DEF", necesita.DEF, club.alineacion.DEF);
  document.getElementById("fila-por").innerHTML = filaHTML("POR", 1, [club.alineacion.POR]);

  const completa = alineacionCompleta(club);
  document.getElementById("ayuda-alineacion").textContent = completa
    ? "¡Once titular completo! Ya podés jugar tu partido."
    : "Elegí un jugador para cada puesto vacío.";
}

function cambiarJugadorAlineacion(puesto, indice, idJugador){
  const club = usuario().club;
  if(puesto === "POR"){ club.alineacion.POR = idJugador; }
  else { club.alineacion[puesto][indice] = idJugador; }
  guardarBaseDeDatos();
  mostrarAlineacion();
}

function alineacionCompleta(club){
  return club.alineacion.POR !== "" &&
    club.alineacion.DEF.every(id => id !== "") &&
    club.alineacion.MED.every(id => id !== "") &&
    club.alineacion.DEL.every(id => id !== "");
}


function cambiarTabMercado(tab){
  tabMercadoActual = tab;
  document.getElementById("tab-comprar").classList.toggle("activa", tab === "comprar");
  document.getElementById("tab-vender").classList.toggle("activa", tab === "vender");
  document.getElementById("tab-ofertas").classList.toggle("activa", tab === "ofertas");
  document.getElementById("tab-fichar").classList.toggle("activa", tab === "fichar");
  if(tab !== "fichar"){
    const club = usuario().club;
    if(club) club.equipoFichando = null;
  }
  resetearFiltrosMercado();
  mostrarMercado();
}


const NOMBRE_POSICION_FILTRO = { POR: "Arqueros", DEF: "Defensores", MED: "Mediocampistas", DEL: "Delanteros" };

function toggleFiltrosMercado(){
  const panel = document.getElementById("panel-filtros-mercado");
  const btn = document.getElementById("btn-toggle-filtros-mercado");
  const seVaAAbrir = panel.style.display === "none";
  panel.style.display = seVaAAbrir ? "flex" : "none";
  btn.classList.toggle("activa", seVaAAbrir);
}

function leerFiltrosMercadoDesdeInputs(){
  filtrosMercado.texto = (document.getElementById("buscador-mercado-texto").value || "").trim().toLowerCase();
  filtrosMercado.posicion = document.getElementById("filtro-posicion").value;

  const nivelMin = parseInt(document.getElementById("filtro-nivel-min").value, 10);
  filtrosMercado.nivelMin = isNaN(nivelMin) ? null : nivelMin;

  const edadMax = parseInt(document.getElementById("filtro-edad-max").value, 10);
  filtrosMercado.edadMax = isNaN(edadMax) ? null : edadMax;

  const valorMaxEnMillones = parseFloat(document.getElementById("filtro-valor-max").value);
  filtrosMercado.valorMax = isNaN(valorMaxEnMillones) ? null : Math.round(valorMaxEnMillones * 1000000);
}

function actualizarFiltrosMercado(){
  leerFiltrosMercadoDesdeInputs();
  mostrarMercado();
}


function resetearFiltrosMercado(){
  filtrosMercado = { texto: "", posicion: "TODOS", nivelMin: null, edadMax: null, valorMax: null };
  const campoTexto = document.getElementById("buscador-mercado-texto");
  const campoPosicion = document.getElementById("filtro-posicion");
  const campoNivel = document.getElementById("filtro-nivel-min");
  const campoEdad = document.getElementById("filtro-edad-max");
  const campoValor = document.getElementById("filtro-valor-max");
  if(campoTexto) campoTexto.value = "";
  if(campoPosicion) campoPosicion.value = "TODOS";
  if(campoNivel) campoNivel.value = "";
  if(campoEdad) campoEdad.value = "";
  if(campoValor) campoValor.value = "";
}

function limpiarFiltrosMercado(){
  resetearFiltrosMercado();
  mostrarMercado();
}

function hayFiltrosActivosMercado(){
  return !!(filtrosMercado.texto || filtrosMercado.posicion !== "TODOS" ||
    filtrosMercado.nivelMin !== null || filtrosMercado.edadMax !== null || filtrosMercado.valorMax !== null);
}

function jugadorPasaFiltrosMercado(jugador){
  if(filtrosMercado.texto && !jugador.nombre.toLowerCase().includes(filtrosMercado.texto)) return false;
  if(filtrosMercado.posicion !== "TODOS" && jugador.puesto !== filtrosMercado.posicion) return false;
  if(filtrosMercado.nivelMin !== null && jugador.nivel < filtrosMercado.nivelMin) return false;
  if(filtrosMercado.edadMax !== null && jugador.edad > filtrosMercado.edadMax) return false;
  if(filtrosMercado.valorMax !== null && jugador.valor > filtrosMercado.valorMax) return false;
  return true;
}

function mostrarResumenFiltrosMercado(){
  const resumen = document.getElementById("resumen-filtros-mercado");
  if(!resumen) return;
  if(!hayFiltrosActivosMercado()){
    resumen.style.display = "none";
    return;
  }
  const partes = [];
  if(filtrosMercado.posicion !== "TODOS") partes.push(NOMBRE_POSICION_FILTRO[filtrosMercado.posicion]);
  if(filtrosMercado.nivelMin !== null) partes.push(`Nivel ${filtrosMercado.nivelMin}+`);
  if(filtrosMercado.edadMax !== null) partes.push(`Edad <${filtrosMercado.edadMax}`);
  if(filtrosMercado.valorMax !== null) partes.push(`Valor <${formatearPlata(filtrosMercado.valorMax)}`);
  if(filtrosMercado.texto) partes.push(`"${filtrosMercado.texto}"`);
  resumen.innerHTML = `Filtrando: ${partes.join(" · ")} <button onclick="limpiarFiltrosMercado()">Limpiar</button>`;
  resumen.style.display = "flex";
}


function actualizarVisibilidadBuscadorMercado(club){
  const buscador = document.getElementById("buscador-mercado");
  if(!buscador) return;
  const corresponde =
    tabMercadoActual === "comprar" ||
    tabMercadoActual === "vender" ||
    (tabMercadoActual === "fichar" && !!club.equipoFichando);

  buscador.style.display = corresponde ? "flex" : "none";
  if(!corresponde){
    document.getElementById("panel-filtros-mercado").style.display = "none";
    document.getElementById("resumen-filtros-mercado").style.display = "none";
  } else {
    mostrarResumenFiltrosMercado();
  }
}


function obtenerJugadoresDisponiblesMercado(club){
  const yaComprados = club.jugadoresRealesComprados || [];
  return POOL_MERCADO.filter(r =>
    !yaComprados.includes(r.nombre) && !club.plantel.some(j => j.nombre === r.nombre)
  );
}

function mostrarMercado(){
  const club = usuario().club;
  club.ofertasRecibidas = club.ofertasRecibidas || [];
  club.ofertasSalientes = club.ofertasSalientes || [];

  const info = document.getElementById("mercado-info");
  if(info) info.style.display = tabMercadoActual === "comprar" ? "block" : "none";

  actualizarVisibilidadBuscadorMercado(club);

  if(tabMercadoActual === "comprar") return mostrarMercadoComprar(club);
  if(tabMercadoActual === "vender") return mostrarMercadoVender(club);
  if(tabMercadoActual === "ofertas") return mostrarOfertas(club);
  if(tabMercadoActual === "fichar") return mostrarFichar(club);
}

function mostrarMercadoComprar(club){
  const contenedor = document.getElementById("lista-mercado");
  const info = document.getElementById("mercado-info");
  const disponibles = obtenerJugadoresDisponiblesMercado(club);

  if(!disponibles.length){
    if(info) info.textContent = "No quedan jugadores disponibles en el mercado.";
    contenedor.innerHTML = '<p class="vacio">Ya fichaste a todos los jugadores disponibles en el mercado.</p>';
    return;
  }

  const jugadores = disponibles
    .map(r => crearJugadorReal(r))
    .filter(jugadorPasaFiltrosMercado)
    .sort((a, b) => b.nivel - a.nivel);

  if(info){
    info.textContent = hayFiltrosActivosMercado()
      ? `${jugadores.length} de ${disponibles.length} jugadores coinciden con tu búsqueda`
      : `${disponibles.length} jugadores disponibles en el mercado`;
  }

  contenedor.innerHTML = jugadores.length ? jugadores.map(j => {
    const alcanza = club.presupuesto >= j.valor;
    const boton = `<button class="boton boton-chico" ${alcanza ? "" : "disabled"} onclick="comprarJugadorDelMercado('${j.nombre.replace(/'/g, "\\'")}')">Comprar</button>`;
    return tarjetaJugadorHTML(j, boton);
  }).join("") : '<p class="vacio">Ningún jugador del mercado coincide con tu búsqueda.</p>';
}

function mostrarMercadoVender(club){
  const contenedor = document.getElementById("lista-mercado");
  if(!club.plantel.length){
    contenedor.innerHTML = '<p class="vacio">No te quedan jugadores.</p>';
    return;
  }
  const jugadores = club.plantel.filter(jugadorPasaFiltrosMercado);
  contenedor.innerHTML = jugadores.length ? jugadores.map(j => {
    const precioVenta = Math.round(j.valor * 0.85);
    const boton = `<button class="boton boton-chico" onclick="venderJugador('${j.id}')">Vender ${formatearPlata(precioVenta)}</button>`;
    return tarjetaJugadorHTML(j, boton);
  }).join("") : '<p class="vacio">Ningún jugador de tu plantel coincide con tu búsqueda.</p>';
}

function comprarJugadorDelMercado(nombreJugador){
  const club = usuario().club;
  const real = POOL_MERCADO.find(r => r.nombre === nombreJugador);
  if(!real) return;

  const yaComprados = club.jugadoresRealesComprados || [];
  if(yaComprados.includes(real.nombre) || club.plantel.some(j => j.nombre === real.nombre)){
    mostrarAviso("Ese jugador ya es tuyo ❌");
    mostrarMercado();
    return;
  }

  const jugador = crearJugadorReal(real);
  if(club.presupuesto < jugador.valor){
    mostrarAviso("No te alcanza el presupuesto ❌");
    return;
  }

  club.presupuesto -= jugador.valor;
  club.plantel.push(jugador);
  club.jugadoresRealesComprados = yaComprados;
  club.jugadoresRealesComprados.push(jugador.nombre);
  club.totalGastadoFichajes = (club.totalGastadoFichajes || 0) + jugador.valor;

  guardarBaseDeDatos();
  actualizarEncabezado();
  mostrarMercado();
  mostrarAviso("Fichaste a " + jugador.nombre + "!");
}

function venderJugador(idJugador){
  const club = usuario().club;
  if(club.plantel.length <= 11){
    mostrarAviso("No podés vender: te quedarías sin plantel suficiente ❌");
    return;
  }
  const jugador = club.plantel.find(j => j.id === idJugador);
  if(!jugador) return;

  const precioVenta = Math.round(jugador.valor * 0.85);
  club.presupuesto += precioVenta;
  club.plantel = club.plantel.filter(j => j.id !== idJugador);

  if(club.alineacion.POR === idJugador) club.alineacion.POR = "";
  ["DEF", "MED", "DEL"].forEach(puesto => {
    club.alineacion[puesto] = club.alineacion[puesto].map(id => id === idJugador ? "" : id);
  });

  guardarBaseDeDatos();
  actualizarEncabezado();
  mostrarMercado();
  mostrarAviso("Vendiste a " + jugador.nombre + " por " + formatearPlata(precioVenta) + " 💰");
}


function elegirPonderado(lista, pesos){
  const total = pesos.reduce((a, b) => a + b, 0);
  if(total <= 0) return elegirAlAzar(lista);
  let r = Math.random() * total;
  for(let i = 0; i < lista.length; i++){
    r -= pesos[i];
    if(r <= 0) return lista[i];
  }
  return lista[lista.length - 1];
}


function asegurarOtrosEquipos(club){
  if(club.otrosEquipos) return;
  club.otrosEquipos = LIGAS
    .filter(l => l.nombre !== club.liga)
    .flatMap(l => l.equipos.map(e => clonarEquipoParaClub(e, l.nombre)));
}


function equiposParaFichaje(club){
  asegurarOtrosEquipos(club);
  return club.rivales.concat(club.otrosEquipos || []);
}

function buscarEquipoParaFichaje(club, nombreEquipo){
  return equiposParaFichaje(club).find(e => e.nombre === nombreEquipo);
}

function generarOfertaRecibidaAlAzar(club){
  club.ofertasRecibidas = club.ofertasRecibidas || [];
  if(club.ofertasRecibidas.length >= 6) return;
  if(club.plantel.length <= 13) return; 
  if(Math.random() > 0.45) return; 

  const candidatos = club.plantel.filter(j =>
    !j.lesionado && !club.ofertasRecibidas.some(o => o.jugadorId === j.id)
  );
  if(!candidatos.length) return;

  const pesos = candidatos.map(j => Math.max(1, j.nivel - 60));
  const elegido = elegirPonderado(candidatos, pesos);

  const factor = 0.85 + Math.random() * 0.55; 
  const monto = Math.max(500000, Math.round(elegido.valor * factor / 100000) * 100000);

  const equiposQuePueden = equiposParaFichaje(club).filter(e => (e.presupuesto || 0) >= monto);
  if(!equiposQuePueden.length) return; 
  const equipoComprador = elegirAlAzar(equiposQuePueden);

  club.ofertasRecibidas.push({
    id: "o" + Date.now() + numeroAleatorio(1, 99999),
    jugadorId: elegido.id,
    jugadorNombre: elegido.nombre,
    puesto: elegido.puesto,
    nivel: elegido.nivel,
    equipoComprador: equipoComprador.nombre,
    monto: monto,
    estado: "pendiente" 
  });

  agregarNoticia(club, `${equipoComprador.nombre} realizó una oferta de ${formatearPlata(monto)} por ${elegido.nombre}.`, "fichaje");
  mostrarAviso("📩 " + equipoComprador.nombre + " hizo una oferta por " + elegido.nombre + "!");
}


function resolverNegociacionesPendientes(club){
  club.ofertasRecibidas = club.ofertasRecibidas || [];
  const siguen = [];
  club.ofertasRecibidas.forEach(oferta => {
    if(oferta.estado !== "negociando"){ siguen.push(oferta); return; }

    const chance = Math.random();
    if(chance < 0.40){
      oferta.monto = oferta.montoPedido;
      oferta.estado = "pendiente";
      mostrarAviso("💬 " + oferta.equipoComprador + " aceptó pagar " + formatearPlata(oferta.monto) + " por " + oferta.jugadorNombre);
      siguen.push(oferta);
    } else if(chance < 0.80){
      const nuevoMonto = Math.round((oferta.monto + oferta.montoPedido) / 2 / 100000) * 100000;
      oferta.monto = nuevoMonto;
      oferta.estado = "pendiente";
      mostrarAviso("💬 " + oferta.equipoComprador + " subió su oferta a " + formatearPlata(oferta.monto) + " por " + oferta.jugadorNombre);
      siguen.push(oferta);
    } else {
      mostrarAviso("❌ " + oferta.equipoComprador + " retiró su oferta por " + oferta.jugadorNombre);
    }
  });
  club.ofertasRecibidas = siguen;
}

function responderOferta(idOferta, accion){
  const club = usuario().club;
  const oferta = (club.ofertasRecibidas || []).find(o => o.id === idOferta);
  if(!oferta) return;

  if(accion === "rechazar"){
    club.ofertasRecibidas = club.ofertasRecibidas.filter(o => o.id !== idOferta);
    mostrarAviso("Rechazaste la oferta por " + oferta.jugadorNombre);
  } else if(accion === "aceptar"){
    const jugador = club.plantel.find(j => j.id === oferta.jugadorId);
    if(jugador){
      club.presupuesto += oferta.monto;
      club.plantel = club.plantel.filter(j => j.id !== oferta.jugadorId);
      if(club.alineacion.POR === jugador.id) club.alineacion.POR = "";
      ["DEF", "MED", "DEL"].forEach(p => {
        club.alineacion[p] = club.alineacion[p].map(id => id === jugador.id ? "" : id);
      });
      const rivalComprador = buscarEquipoParaFichaje(club, oferta.equipoComprador);
      if(rivalComprador){
        rivalComprador.real = rivalComprador.real || [];
        rivalComprador.real.push({
          nombre: jugador.nombre, puesto: jugador.puesto,
          edad: jugador.edad, nivel: jugador.nivel, valor: jugador.valor
        });
        rivalComprador.presupuesto = Math.max(0, (rivalComprador.presupuesto || 0) - oferta.monto);
      }
      mostrarAviso("Vendiste a " + jugador.nombre + " por " + formatearPlata(oferta.monto) + " a " + oferta.equipoComprador + " 💰");
    }
    club.ofertasRecibidas = club.ofertasRecibidas.filter(o => o.id !== idOferta);
  } else if(accion === "negociar"){
    const pedido = Math.round(oferta.monto * 1.25 / 100000) * 100000;
    oferta.montoPedido = pedido;
    oferta.estado = "negociando";
    mostrarAviso("Le pediste " + formatearPlata(pedido) + " a " + oferta.equipoComprador + ". Te responden la próxima fecha.");
  }

  guardarBaseDeDatos();
  actualizarEncabezado();
  mostrarMercado();
}

function verPlantelParaFichar(nombreEquipo){
  const club = usuario().club;
  club.equipoFichando = nombreEquipo;
  mostrarFichar(club);
}

function volverAListaFichar(){
  const club = usuario().club;
  club.equipoFichando = null;
  mostrarFichar(club);
}

function mostrarFichar(club){
  club.ofertasSalientes = club.ofertasSalientes || [];
  actualizarVisibilidadBuscadorMercado(club);
  const contenedor = document.getElementById("lista-mercado");

  if(!club.equipoFichando){
    const equipos = equiposParaFichaje(club);
    const porLiga = {};
    equipos.forEach(e => {
      porLiga[e.liga] = porLiga[e.liga] || [];
      porLiga[e.liga].push(e);
    });
    const ligasOrdenadas = Object.keys(porLiga).sort((a, b) =>
      a === club.liga ? -1 : b === club.liga ? 1 : a.localeCompare(b)
    );

    let html = `<p class="info-mercado" style="text-align:left; margin:0 0 10px;">Elegí un equipo (de tu liga o de cualquier otra) para ver su plantel</p>`;
    ligasOrdenadas.forEach(nombreLiga => {
      html += `<h3 class="subtitulo-seccion">${nombreLiga}${nombreLiga === club.liga ? " (tu liga)" : ""}</h3>`;
      html += porLiga[nombreLiga].map(r => `
        <div class="tarjeta-equipo" onclick="verPlantelParaFichar('${r.nombre.replace(/'/g, "\\'")}')">
          ${escudoEquipoHTML(r, "mediano")}
          <div>
            <p class="nombre-equipo">${r.nombre}</p>
            <p class="detalle-equipo">Calidad: ${r.calidad} · ${(r.real || []).length} jugadores</p>
          </div>
          <span class="flecha">→</span>
        </div>`).join("");
    });
    contenedor.innerHTML = html;
    return;
  }

  const rival = buscarEquipoParaFichaje(club, club.equipoFichando);
  if(!rival){ club.equipoFichando = null; return mostrarFichar(club); }

  const yaOfertados = club.ofertasSalientes.map(o => o.jugadorNombre);
  const plantelRival = rival.real || [];
  const jugadoresFiltrados = plantelRival.filter(jugadorPasaFiltrosMercado);

  let html = `<button class="boton boton-chico" style="margin-bottom:10px;" onclick="volverAListaFichar()">← Volver a equipos</button>`;

  if(!plantelRival.length){
    html += '<p class="vacio">Este equipo no tiene plantel cargado.</p>';
  } else if(!jugadoresFiltrados.length){
    html += '<p class="vacio">Ningún jugador de este equipo coincide con tu búsqueda.</p>';
  } else {
    html += jugadoresFiltrados.map(j => {
      const jugadorParaTarjeta = { nombre: j.nombre, puesto: j.puesto, nivel: j.nivel, edad: j.edad, valor: j.valor };
      const yaOfertado = yaOfertados.includes(j.nombre);
      const boton = yaOfertado
        ? `<span class="etiqueta empato">Oferta enviada</span>`
        : `<button class="boton boton-chico" onclick="hacerOferta('${rival.nombre.replace(/'/g, "\\'")}','${j.nombre.replace(/'/g, "\\'")}','${j.puesto}',${j.nivel},${j.valor})">Ofertar</button>`;
      return tarjetaJugadorHTML(jugadorParaTarjeta, boton);
    }).join("");
  }

  contenedor.innerHTML = html;
}

function hacerOferta(equipoVendedor, nombreJugador, puesto, nivel, valorReal){
  const club = usuario().club;
  const sugerido = Math.round(valorReal / 100000) * 100000;
  const input = prompt(
    `¿Cuánto ofrecés por ${nombreJugador} (${puesto}, nivel ${nivel})?\nValor estimado: ${formatearPlata(valorReal)}`,
    sugerido
  );
  if(input === null) return;
  const monto = parseInt(String(input).replace(/[^0-9]/g, ""), 10);
  if(!monto || monto <= 0){
    mostrarAviso("Ingresá un monto válido ❌");
    return;
  }
  if(monto > club.presupuesto){
    mostrarAviso("No te alcanza el presupuesto para esa oferta ❌");
    return;
  }

  club.ofertasSalientes = club.ofertasSalientes || [];
  club.ofertasSalientes.push({
    id: "os" + Date.now() + numeroAleatorio(1, 99999),
    equipoVendedor: equipoVendedor,
    jugadorNombre: nombreJugador,
    puesto: puesto,
    nivel: nivel,
    montoOfertado: monto,
    valorEstimado: valorReal,
    estado: "pendiente"
  });

  guardarBaseDeDatos();
  mostrarAviso(`Enviaste una oferta de ${formatearPlata(monto)} por ${nombreJugador}. Te responden la próxima fecha.`);
  mostrarFichar(club);
}


function rivalFichaReemplazo(rival, puestoNecesario){
  if(!rival) return;
  rival.real = rival.real || [];
  const disponibles = POOL_MERCADO.filter(r =>
    !rival.real.some(j => j.nombre === r.nombre) && r.valor <= rival.presupuesto
  );
  if(!disponibles.length) return;

  const delMismoPuesto = disponibles.filter(r => r.puesto === puestoNecesario);
  const candidatos = delMismoPuesto.length ? delMismoPuesto : disponibles;
  candidatos.sort((a, b) => b.nivel - a.nivel);
  const elegido = candidatos[0];

  rival.real.push({
    nombre: elegido.nombre, puesto: elegido.puesto,
    edad: elegido.edad, nivel: elegido.nivel, valor: elegido.valor
  });
  rival.presupuesto -= elegido.valor;
}

function transferirJugadorEntreClubes(rival, jugadorNombre, puesto, monto){
  if(!rival) return;
  rival.real = (rival.real || []).filter(j => j.nombre !== jugadorNombre);
  rival.presupuesto = (rival.presupuesto || 0) + monto;
  rivalFichaReemplazo(rival, puesto);
}

function resolverOfertasSalientesPendientes(club){
  club.ofertasSalientes = club.ofertasSalientes || [];

  club.ofertasSalientes.forEach(oferta => {
    if(oferta.estado !== "pendiente") return;

    const ratio = oferta.montoOfertado / oferta.valorEstimado;
    if(ratio >= 1.15){
      oferta.estado = "aceptada";
    } else if(ratio >= 0.8){
      oferta.estado = "contraoferta_pendiente";
      oferta.montoContraoferta = Math.round(oferta.valorEstimado * (1.05 + Math.random() * 0.15) / 100000) * 100000;
      mostrarAviso("💬 " + oferta.equipoVendedor + " te hizo una contraoferta por " + oferta.jugadorNombre);
    } else {
      oferta.estado = "rechazada";
    }
  });

  club.ofertasSalientes.filter(o => o.estado === "aceptada").forEach(oferta => {
    if(club.presupuesto < oferta.montoOfertado){
      mostrarAviso("⚠️ " + oferta.equipoVendedor + " aceptó tu oferta por " + oferta.jugadorNombre + ", pero ya no te alcanza el presupuesto.");
      return;
    }
    club.presupuesto -= oferta.montoOfertado;
    const nuevoJugador = crearJugadorReal({ nombre: oferta.jugadorNombre, puesto: oferta.puesto, nivel: oferta.nivel });
    nuevoJugador.valor = oferta.montoOfertado;
    club.plantel.push(nuevoJugador);
    club.totalGastadoFichajes = (club.totalGastadoFichajes || 0) + oferta.montoOfertado;
    const rivalVendedor = buscarEquipoParaFichaje(club, oferta.equipoVendedor);
    transferirJugadorEntreClubes(rivalVendedor, oferta.jugadorNombre, oferta.puesto, oferta.montoOfertado);
    mostrarAviso("✅ " + oferta.equipoVendedor + " aceptó tu oferta. ¡Fichaste a " + oferta.jugadorNombre + "!");
  });

  club.ofertasSalientes.filter(o => o.estado === "rechazada").forEach(oferta => {
    mostrarAviso("❌ " + oferta.equipoVendedor + " rechazó tu oferta por " + oferta.jugadorNombre);
  });

  club.ofertasSalientes = club.ofertasSalientes.filter(o =>
    o.estado === "contraoferta_pendiente" || o.estado === "pendiente"
  );
}

function responderContraoferta(idOferta, accion){
  const club = usuario().club;
  const oferta = (club.ofertasSalientes || []).find(o => o.id === idOferta);
  if(!oferta) return;

  if(accion === "aceptar"){
    if(club.presupuesto < oferta.montoContraoferta){
      mostrarAviso("No te alcanza el presupuesto para aceptar la contraoferta ❌");
      return;
    }
    club.presupuesto -= oferta.montoContraoferta;
    const nuevoJugador = crearJugadorReal({ nombre: oferta.jugadorNombre, puesto: oferta.puesto, nivel: oferta.nivel });
    nuevoJugador.valor = oferta.montoContraoferta;
    club.plantel.push(nuevoJugador);
    club.totalGastadoFichajes = (club.totalGastadoFichajes || 0) + oferta.montoContraoferta;
    const rivalVendedor = buscarEquipoParaFichaje(club, oferta.equipoVendedor);
    transferirJugadorEntreClubes(rivalVendedor, oferta.jugadorNombre, oferta.puesto, oferta.montoContraoferta);
    mostrarAviso("✅ ¡Fichaste a " + oferta.jugadorNombre + " por " + formatearPlata(oferta.montoContraoferta) + "!");
  } else {
    mostrarAviso("Retiraste tu oferta por " + oferta.jugadorNombre);
  }

  club.ofertasSalientes = club.ofertasSalientes.filter(o => o.id !== idOferta);
  guardarBaseDeDatos();
  actualizarEncabezado();
  mostrarFichar(club);
}


function tarjetaOfertaRecibidaHTML(o){
  if(o.estado === "negociando"){
    return `
    <div class="tarjeta-oferta">
      <p class="oferta-titulo">${o.equipoComprador} quiere comprar a <strong>${o.jugadorNombre}</strong></p>
      <p class="oferta-detalle">${o.puesto} · Nivel ${o.nivel}</p>
      <p class="oferta-monto">Le pediste ${formatearPlata(o.montoPedido)}</p>
      <p class="oferta-esperando">⏳ Esperando respuesta la próxima fecha...</p>
    </div>`;
  }
  return `
  <div class="tarjeta-oferta">
    <p class="oferta-titulo">📩 ${o.equipoComprador} quiere comprar a <strong>${o.jugadorNombre}</strong></p>
    <p class="oferta-detalle">${o.puesto} · Nivel ${o.nivel}</p>
    <p class="oferta-monto">Oferta: ${formatearPlata(o.monto)}</p>
    <div class="oferta-botones">
      <button class="boton boton-chico boton-gris" onclick="responderOferta('${o.id}','rechazar')">❌ Rechazar</button>
      <button class="boton boton-chico boton-gris" onclick="responderOferta('${o.id}','negociar')">🤝 Negociar</button>
      <button class="boton boton-chico boton-amarillo" onclick="responderOferta('${o.id}','aceptar')">💰 Aceptar</button>
    </div>
  </div>`;
}

function tarjetaOfertaSalienteHTML(o){
  if(o.estado === "contraoferta_pendiente"){
    return `
    <div class="tarjeta-oferta">
      <p class="oferta-titulo">${o.equipoVendedor} te hizo una contraoferta por <strong>${o.jugadorNombre}</strong></p>
      <p class="oferta-detalle">${o.puesto} · Nivel ${o.nivel} · Ofertaste ${formatearPlata(o.montoOfertado)}</p>
      <p class="oferta-monto">Piden: ${formatearPlata(o.montoContraoferta)}</p>
      <div class="oferta-botones">
        <button class="boton boton-chico boton-gris" onclick="responderContraoferta('${o.id}','retirar')">❌ Retirar</button>
        <button class="boton boton-chico boton-amarillo" onclick="responderContraoferta('${o.id}','aceptar')">💰 Aceptar</button>
      </div>
    </div>`;
  }
  return `
  <div class="tarjeta-oferta">
    <p class="oferta-titulo">📤 Oferta por <strong>${o.jugadorNombre}</strong> (${o.equipoVendedor})</p>
    <p class="oferta-detalle">${o.puesto} · Nivel ${o.nivel}</p>
    <p class="oferta-monto">Ofertaste: ${formatearPlata(o.montoOfertado)}</p>
    <p class="oferta-esperando">⏳ Esperando respuesta la próxima fecha...</p>
  </div>`;
}

function mostrarOfertas(club){
  const contenedor = document.getElementById("lista-mercado");
  let html = `<h3 class="subtitulo-seccion" style="margin-top:0;">📩 Ofertas por tus jugadores</h3>`;
  html += club.ofertasRecibidas.length
    ? club.ofertasRecibidas.map(tarjetaOfertaRecibidaHTML).join("")
    : `<p class="vacio">Nadie hizo ofertas por tus jugadores todavía.</p>`;

  html += `<h3 class="subtitulo-seccion">📤 Tus ofertas por otros jugadores</h3>`;
  html += club.ofertasSalientes.length
    ? club.ofertasSalientes.map(tarjetaOfertaSalienteHTML).join("")
    : `<p class="vacio">No hiciste ofertas por jugadores de otros clubes. Probá en la pestaña "Fichar".</p>`;

  contenedor.innerHTML = html;
}


function nivelPromedioTitulares(club){
  const ids = jugadoresYaElegidos(club);
  const titulares = club.plantel.filter(j => ids.includes(j.id));
  if(titulares.length === 0) return 60;
  const suma = titulares.reduce((total, j) => total + j.nivel, 0);
  return suma / titulares.length;
}

function calcularGoles(nivelPropio, nivelRival){
  const diferencia = (nivelPropio - nivelRival) / 12;
  let goles = Math.round(1 + diferencia + (Math.random() * 2 - 1));
  if(goles < 0) goles = 0;
  if(goles > 6) goles = 6;
  return goles;
}

function elegirGoleadorEnVivo(club, sim){
  const enCancha = club.plantel.filter(j => sim.enCancha.includes(j.id));
  const pesoDelanteros = sim.mentalidad === "ofensiva" ? 4 : (sim.mentalidad === "defensiva" ? 2 : 3);

  const candidatos = [];
  enCancha.forEach(j => {
    if(j.puesto === "DEL"){ for(let i = 0; i < pesoDelanteros; i++) candidatos.push(j.id); }
    if(j.puesto === "MED") candidatos.push(j.id);
  });
  if(!candidatos.length) return enCancha[0] || null;
  return club.plantel.find(j => j.id === elegirAlAzar(candidatos)) || null;
}

function resolverGolEnVivo(evento){
  const club = usuario().club;
  const sim = simulacionActual;
  if(!club || !sim) return;

  const goleador = elegirGoleadorEnVivo(club, sim);
  if(goleador){
    if(!club.goleadores[goleador.id]) club.goleadores[goleador.id] = { nombre: goleador.nombre, goles: 0 };
    club.goleadores[goleador.id].goles++;
    sim.golesDeEstePartido[goleador.id] = (sim.golesDeEstePartido[goleador.id] || 0) + 1;
    evento.texto = evento.esPenal
      ? goleador.nombre + " cambia el penal por gol"
      : elegirAlAzar(FRASES_GOL_PROPIO).replace("{j}", goleador.nombre);
  } else {
    evento.texto = club.nombre + " anota";
  }
}

function aplicarLesionEnVivo(evento){
  const club = usuario().club;
  const sim = simulacionActual;
  if(!club || !sim) return;

  const jugador = club.plantel.find(j => j.id === evento.jugadorId);
  if(!jugador) return;

  jugador.lesionado = numeroAleatorio(1, 2);
  if(club.alineacion.POR === jugador.id) club.alineacion.POR = "";
  ["DEF", "MED", "DEL"].forEach(p => {
    club.alineacion[p] = club.alineacion[p].map(id => id === jugador.id ? "" : id);
  });
  sim.enCancha = sim.enCancha.filter(id => id !== jugador.id);

  agregarNoticia(club, `${jugador.nombre} sufrió una lesión y estará afuera durante ${jugador.lesionado} partido(s).`, "lesion");
  mostrarAviso(" Se lesionó " + jugador.nombre + ". Va a estar afuera unos partidos.");
}

function aplicarCambioEnVivo(evento){
  const sim = simulacionActual;
  if(!sim) return;
  sim.enCancha = sim.enCancha.filter(id => id !== evento.jugadorSaleId);
  if(!sim.enCancha.includes(evento.jugadorEntraId)) sim.enCancha.push(evento.jugadorEntraId);
}

function calcularMvpFinal(club, sim){
  const idsConGoles = Object.keys(sim.golesDeEstePartido || {});
  if(idsConGoles.length){
    let mejorId = idsConGoles[0];
    idsConGoles.forEach(id => { if(sim.golesDeEstePartido[id] > sim.golesDeEstePartido[mejorId]) mejorId = id; });
    return club.plantel.find(j => j.id === mejorId) || null;
  }
  const titulares = club.plantel.filter(j => (sim.titularesIniciales || []).includes(j.id));
  return titulares.length ? elegirAlAzar(titulares) : null;
}

function bajarContadorLesiones(club){
  club.plantel.forEach(j => { if(j.lesionado > 0) j.lesionado--; });
}


function jugarEventosDePartido(club, golesMios, golesRival, rivalNombre, nivelMio, nivelRival){
  nivelMio = (nivelMio == null) ? 75 : nivelMio;
  nivelRival = (nivelRival == null) ? 75 : nivelRival;

  const idsTitulares = jugadoresYaElegidos(club);
  const titulares = club.plantel.filter(j => idsTitulares.includes(j.id));
  const banco = club.plantel.filter(j => !idsTitulares.includes(j.id) && !j.lesionado);

  const eventos = [];
  const minutosUsados = [];
  function minutoLibre(min){
    min = min || 1;
    let m;
    do { m = numeroAleatorio(min, 90); } while(minutosUsados.includes(m));
    minutosUsados.push(m);
    return m;
  }

  
  for(let i = 0; i < golesMios; i++){
    const minuto = minutoLibre();
    const esPenal = Math.random() < 0.18;
    if(esPenal){
      eventos.push({ minuto, tipo: "penal", texto: "¡Penal para " + club.nombre + "!", pantallazo: "¡PENAL!" });
    }
    eventos.push({ minuto, tipo: "gol", mio: true, esPenal: esPenal, texto: null, pantallazo: "¡GOLLLL!" });
  }
  for(let i = 0; i < golesRival; i++){
    const minuto = minutoLibre();
    const esPenal = Math.random() < 0.15;
    if(esPenal){
      eventos.push({ minuto, tipo: "penal", texto: "¡Penal para " + rivalNombre + "!", pantallazo: "¡PENAL!" });
    }
    const texto = esPenal
      ? rivalNombre + " convierte el penal"
      : elegirAlAzar(FRASES_GOL_RIVAL).replace("{r}", rivalNombre);
    eventos.push({ minuto, tipo: "gol", mio: false, texto, pantallazo: "¡GOLLLL!" });
  }


  let amarillasMias = 0, amarillasRival = 0;
  const cantidadAmarillas = numeroAleatorio(0, 3);
  for(let i = 0; i < cantidadAmarillas; i++){
    const minuto = minutoLibre();
    const esMia = Math.random() < 0.5 && titulares.length;
    const nombre = esMia ? elegirAlAzar(titulares).nombre : rivalNombre;
    if(esMia) amarillasMias++; else amarillasRival++;
    eventos.push({ minuto, tipo: "amarilla", texto: "🟨 Amarilla para " + nombre });
  }
  if(Math.random() < 0.08){
    const minuto = minutoLibre();
    const esMia = Math.random() < 0.5 && titulares.length;
    const nombre = esMia ? elegirAlAzar(titulares).nombre : rivalNombre;
    eventos.push({ minuto, tipo: "roja", texto: "🟥 ¡Expulsado " + nombre + "!", pantallazo: "¡ROJA!" });
  }
  if(Math.random() < 0.06){
    const minuto = minutoLibre();
    const esMia = Math.random() < 0.5;
    const nombre = esMia ? club.nombre : rivalNombre;
    eventos.push({ minuto, tipo: "penal_errado", texto: "😱 ¡Penal errado por " + nombre + "!" });
  }

  
  const puestosConCambio = ["DEF", "MED", "DEL"].filter(puesto =>
    titulares.some(j => j.puesto === puesto) && banco.some(j => j.puesto === puesto)
  );
  const usadosParaCambio = new Set();
  const cantidadCambios = Math.min(puestosConCambio.length, Math.random() < 0.55 ? (Math.random() < 0.35 ? 2 : 1) : 0);
  for(let i = 0; i < cantidadCambios; i++){
    const opciones = puestosConCambio.filter(p => {
      const key = p;
      return !usadosParaCambio.has(key);
    });
    if(!opciones.length) break;
    const puesto = elegirAlAzar(opciones);
    usadosParaCambio.add(puesto);

    const salientes = titulares.filter(j => j.puesto === puesto);
    const entrantes = banco.filter(j => j.puesto === puesto);
    if(!salientes.length || !entrantes.length) continue;

    const sale = elegirAlAzar(salientes);
    const entra = elegirAlAzar(entrantes);
    const minuto = minutoLibre(50);
    eventos.push({
      minuto, tipo: "cambio", jugadorSaleId: sale.id, jugadorEntraId: entra.id,
      texto: "🔄 Cambio: sale " + sale.nombre + ", entra " + entra.nombre
    });
  }

  
  if(titulares.length && Math.random() < 0.08){
    const jugadorLesionado = elegirAlAzar(titulares);
    const minuto = minutoLibre();
    eventos.push({
      minuto, tipo: "lesion", jugadorId: jugadorLesionado.id,
      texto: "🤕 Se resiente " + jugadorLesionado.nombre + " y no puede continuar"
    });
  }

  eventos.sort((a, b) => a.minuto - b.minuto);


  const diferencia = nivelMio - nivelRival;
  const posesionMia = Math.max(32, Math.min(68, 50 + Math.round(diferencia / 2) + numeroAleatorio(-5, 5)));
  const tirosMios = Math.max(golesMios + numeroAleatorio(1, 4), numeroAleatorio(7, 15) + Math.round(diferencia / 8));
  const tirosRival = Math.max(golesRival + numeroAleatorio(1, 4), numeroAleatorio(6, 13) - Math.round(diferencia / 8));
  const tirosArcoMios = Math.max(golesMios, Math.min(tirosMios, Math.round(tirosMios * (0.35 + Math.random() * 0.25))));
  const tirosArcoRival = Math.max(golesRival, Math.min(tirosRival, Math.round(tirosRival * (0.3 + Math.random() * 0.25))));

  const estadisticas = {
    posesionMia: posesionMia, posesionRival: 100 - posesionMia,
    tirosMios: tirosMios, tirosRival: tirosRival,
    tirosArcoMios: tirosArcoMios, tirosArcoRival: tirosArcoRival,
    cornersMios: numeroAleatorio(2, 9), cornersRival: numeroAleatorio(2, 9),
    faltasMias: numeroAleatorio(6, 15), faltasRival: numeroAleatorio(6, 15),
    amarillasMias: amarillasMias, amarillasRival: amarillasRival
  };

  return { eventos: eventos, estadisticas: estadisticas, titularesIniciales: idsTitulares };
}


let simulacionActual = null;

function iniciarSimulacionEnVivo(datos){
  document.getElementById("partido-fecha").textContent = datos.etiquetaFecha;
  document.getElementById("partido-local").innerHTML = escudoEquipoHTML(usuario().club, "mediano") + usuario().club.nombre;
  document.getElementById("partido-visita").innerHTML = escudoEquipoHTML(datos.rivalNombre, "mediano", usuario().club) + datos.rivalNombre;
  document.getElementById("partido-goles-local").textContent = "0";
  document.getElementById("partido-goles-visita").textContent = "0";
  document.getElementById("partido-goles").innerHTML = "";
  document.getElementById("partido-mvp").style.display = "none";
  document.getElementById("partido-stats").style.display = "none";
  document.getElementById("partido-minuto").textContent = "0'";
  document.getElementById("btn-simular-todo").style.display = "block";
  document.getElementById("btn-continuar-partido").style.display = "none";
  document.getElementById("btn-cambios").style.display = "block";
  document.getElementById("panel-cambios").style.display = "none";
  document.getElementById("panel-cambios").innerHTML = "";

  const club = usuario().club;
  const titularesIds = datos.titularesIniciales || jugadoresYaElegidos(club);

  simulacionActual = {
    eventos: datos.eventos,
    indice: 0,
    minuto: 0,
    golesMios: 0,
    golesRival: 0,
    datosFinal: datos,
    timer: null,
    enCancha: titularesIds.slice(),
    titularesIniciales: titularesIds.slice(),
    mentalidad: "equilibrada",
    golesDeEstePartido: {}
  };

  irAPantalla2("partido");
  simulacionActual.timer = setInterval(avanzarMinuto, 180);
}

function avanzarMinuto(){
  const sim = simulacionActual;
  if(!sim) return;
  sim.minuto = Math.min(90, sim.minuto + 1);
  document.getElementById("partido-minuto").textContent = sim.minuto + "'";

  while(sim.indice < sim.eventos.length && sim.eventos[sim.indice].minuto <= sim.minuto){
    mostrarEventoEnVivo(sim.eventos[sim.indice]);
    sim.indice++;
  }

  if(sim.minuto >= 90) finalizarSimulacion();
}

function mostrarEventoEnVivo(evento){
  const sim = simulacionActual;

  if(evento.tipo === "gol" && evento.mio && !evento.texto) resolverGolEnVivo(evento);
  if(evento.tipo === "lesion") aplicarLesionEnVivo(evento);
  if(evento.tipo === "cambio") aplicarCambioEnVivo(evento);

  if(evento.tipo === "gol"){
    if(evento.mio){ sim.golesMios++; document.getElementById("partido-goles-local").textContent = sim.golesMios; }
    else { sim.golesRival++; document.getElementById("partido-goles-visita").textContent = sim.golesRival; }
  }

  const lista = document.getElementById("partido-goles");
  const linea = document.createElement("div");
  linea.className = evento.tipo === "gol" ? "gol" : (evento.tipo === "cambio" ? "evento-cambio" : "evento-flavor");
  linea.textContent = `${evento.minuto}' — ${evento.texto}`;
  lista.appendChild(linea);
  lista.scrollTop = lista.scrollHeight;

  if(evento.pantallazo) mostrarPantallazo(evento.pantallazo, evento.tipo);
}

function mostrarPantallazo(texto, tipo){
  const overlay = document.getElementById("overlay-evento");
  overlay.textContent = texto;
  overlay.className = "overlay-evento mostrar tipo-" + tipo;
  setTimeout(() => { overlay.className = "overlay-evento"; }, 1300);
}

function saltarSimulacion(){
  const sim = simulacionActual;
  if(!sim) return;
  clearInterval(sim.timer);

  const lista = document.getElementById("partido-goles");
  while(sim.indice < sim.eventos.length){
    const evento = sim.eventos[sim.indice];
    if(evento.tipo === "gol" && evento.mio && !evento.texto) resolverGolEnVivo(evento);
    if(evento.tipo === "lesion") aplicarLesionEnVivo(evento);
    if(evento.tipo === "cambio") aplicarCambioEnVivo(evento);
    if(evento.tipo === "gol"){
      if(evento.mio) sim.golesMios++; else sim.golesRival++;
    }
    const linea = document.createElement("div");
    linea.className = evento.tipo === "gol" ? "gol" : (evento.tipo === "cambio" ? "evento-cambio" : "evento-flavor");
    linea.textContent = `${evento.minuto}' — ${evento.texto}`;
    lista.appendChild(linea);
    sim.indice++;
  }
  document.getElementById("partido-goles-local").textContent = sim.golesMios;
  document.getElementById("partido-goles-visita").textContent = sim.golesRival;
  document.getElementById("partido-minuto").textContent = "90'";
  finalizarSimulacion();
}

function finalizarSimulacion(){
  const sim = simulacionActual;
  if(!sim) return;
  clearInterval(sim.timer);

  document.getElementById("btn-cambios").style.display = "none";
  document.getElementById("panel-cambios").style.display = "none";

  const lista = document.getElementById("partido-goles");
  if(!lista.children.length){
    lista.innerHTML = '<div class="gol">Partido sin goles ni incidencias.</div>';
  }

  document.getElementById("btn-simular-todo").style.display = "none";
  document.getElementById("btn-continuar-partido").style.display = "block";

  const club = usuario().club;
  const datos = sim.datosFinal;
  if(datos.mensajeExtra){
    document.getElementById("partido-fecha").textContent = datos.etiquetaFecha + datos.mensajeExtra;
  }

  const mvp = calcularMvpFinal(club, sim);
  const mvpDiv = document.getElementById("partido-mvp");
  if(mvp){
    mvpDiv.style.display = "block";
    mvpDiv.innerHTML = `
      <p class="mvp-titulo">Jugador del partido</p>
      <p class="mvp-nombre">${mvp.nombre}</p>
      <p class="mvp-detalle">${mvp.puesto} · Nivel ${mvp.nivel}</p>`;
  }

  const statsDiv = document.getElementById("partido-stats");
  const e = datos.estadisticas;
  if(e){
    statsDiv.style.display = "block";
    statsDiv.innerHTML = `
      <p class="stats-titulo"> Estadísticas del partido</p>
      <div class="fila-stat"><span>${e.posesionMia}%</span><span class="stat-label">Posesión</span><span>${e.posesionRival}%</span></div>
      <div class="fila-stat"><span>${e.tirosMios}</span><span class="stat-label">Tiros</span><span>${e.tirosRival}</span></div>
      <div class="fila-stat"><span>${e.tirosArcoMios}</span><span class="stat-label">Tiros al arco</span><span>${e.tirosArcoRival}</span></div>
      <div class="fila-stat"><span>${e.cornersMios}</span><span class="stat-label">Córners</span><span>${e.cornersRival}</span></div>
      <div class="fila-stat"><span>${e.faltasMias}</span><span class="stat-label">Faltas</span><span>${e.faltasRival}</span></div>
      <div class="fila-stat"><span>${e.amarillasMias}</span><span class="stat-label">Amarillas</span><span>${e.amarillasRival}</span></div>
    `;
  } else {
    statsDiv.style.display = "none";
  }

  registrarRachaGoles(club, sim);
  guardarBaseDeDatos();
  sincronizarRankingOnline();
  simulacionActual = null;
}

function registrarRachaGoles(club, sim){
  club.historialGoles = club.historialGoles || {};
  club.plantel.forEach(j => {
    const historial = club.historialGoles[j.id] = club.historialGoles[j.id] || [];
    historial.push((sim.golesDeEstePartido || {})[j.id] || 0);
    if(historial.length > 6) historial.shift();
  });

  const idsConGoles = Object.keys(sim.golesDeEstePartido || {});
  let mejor = null;
  idsConGoles.forEach(id => {
    const jugador = club.plantel.find(j => j.id === id);
    if(!jugador) return;
    const ultimos = (club.historialGoles[id] || []).slice(-4);
    const total = ultimos.reduce((a, b) => a + b, 0);
    if(total >= 3 && (!mejor || total > mejor.total)){
      mejor = { jugador, total, partidos: ultimos.length };
    }
  });

  if(mejor){
    agregarNoticia(club, `${mejor.jugador.nombre} lleva ${mejor.total} goles en los últimos ${mejor.partidos} partidos.`, "gol");
  }
}

function togglePanelCambios(){
  const panel = document.getElementById("panel-cambios");
  if(!panel) return;
  const abierto = panel.style.display === "block";
  if(abierto){
    panel.style.display = "none";
  } else {
    pintarPanelCambios();
    panel.style.display = "block";
  }
}

function pintarPanelCambios(){
  const sim = simulacionActual;
  const panel = document.getElementById("panel-cambios");
  if(!sim || !panel) return;
  const club = usuario().club;

  let html = `<p class="cambios-titulo">⚙️ Ajustes del partido</p>`;

  html += `<div class="cambios-seccion">
    <p class="cambios-subtitulo">Mentalidad</p>
    <div class="filtros">
      <button class="filtro ${sim.mentalidad === 'defensiva' ? 'activa' : ''}" onclick="cambiarMentalidad('defensiva')">🛡️ Defensiva</button>
      <button class="filtro ${sim.mentalidad === 'equilibrada' ? 'activa' : ''}" onclick="cambiarMentalidad('equilibrada')">⚖️ Equilibrada</button>
      <button class="filtro ${sim.mentalidad === 'ofensiva' ? 'activa' : ''}" onclick="cambiarMentalidad('ofensiva')">⚔️ Ofensiva</button>
    </div>
  </div>`;

  html += `<div class="cambios-seccion">
    <p class="cambios-subtitulo">Formación</p>
    <select onchange="cambiarFormacionEnVivo(this.value)">
      ${Object.keys(FORMACIONES).map(f => `<option value="${f}" ${club.formacion === f ? "selected" : ""}>${f}</option>`).join("")}
    </select>
  </div>`;

  html += `<p class="cambios-nota">🔄 Los cambios de jugadores se hacen solos durante el partido.</p>`;

  panel.innerHTML = html;
}

function cambiarMentalidad(m){
  const sim = simulacionActual;
  if(!sim) return;
  sim.mentalidad = m;
  const nombres = { defensiva: "Defensiva 🛡️", equilibrada: "Equilibrada ⚖️", ofensiva: "Ofensiva ⚔️" };
  mostrarAviso("Mentalidad: " + nombres[m]);
  pintarPanelCambios();
}

function cambiarFormacionEnVivo(nuevaFormacion){
  const club = usuario().club;
  club.formacion = nuevaFormacion;
  guardarBaseDeDatos();

  const sim = simulacionActual;
  if(sim){
    const linea = document.createElement("div");
    linea.className = "evento-cambio";
    linea.textContent = `${sim.minuto}' — 🔄 Cambio de formación a ${nuevaFormacion}`;
    document.getElementById("partido-goles").appendChild(linea);
    document.getElementById("partido-goles").scrollTop = document.getElementById("partido-goles").scrollHeight;
  }
  mostrarAviso("Cambio de formación a " + nuevaFormacion);
}

function calcularPremioPorPosicion(posicion){
  if(posicion === 1) return 8000000;
  if(posicion <= 3) return 5000000;
  if(posicion <= 6) return 3000000;
  if(posicion <= 10) return 1500000;
  if(posicion <= 15) return 800000;
  return 300000;
}

function guardarHistorialTemporada(club){
  const tablaFinal = obtenerTablaOrdenada(club);
  const miFila = tablaFinal.find(f => f.nombre === club.nombre);
  const miPosicion = tablaFinal.findIndex(f => f.nombre === club.nombre) + 1;

  const premio = calcularPremioPorPosicion(miPosicion);
  club.presupuesto += premio;

  const objetivos = evaluarObjetivos(club, miPosicion, club.golesTemporadaActual || 0);

  club.trofeos = club.trofeos || { ligas: 0 };
  if(miPosicion === 1) club.trofeos.ligas = (club.trofeos.ligas || 0) + 1;

  const entrada = {
    temporada: club.temporada,
    posicion: miPosicion,
    puntos: miFila ? miFila.pts : 0,
    golesFavor: miFila ? miFila.gf : 0,
    golesContra: miFila ? miFila.gc : 0,
    campeonLiga: tablaFinal[0] ? tablaFinal[0].nombre : "—",
    campeonCopa: club.copa.campeon || null,
    eliminadoCopa: club.copa.eliminado,
    premio: premio,
    objetivos: objetivos
  };

  if(!club.historial) club.historial = [];
  club.historial.unshift(entrada);
  club.historial = club.historial.slice(0, 10);

  club.resumenTemporadaPendiente = entrada;
}

function prepararSupercopa(club){
  const entrada = club.historial[0];
  if(!entrada) return;
  const campeonLiga = entrada.campeonLiga;
  const campeonCopa = entrada.campeonCopa;

  if(!campeonCopa || campeonCopa === campeonLiga){
    club.supercopa = null;
    return;
  }

  if(campeonLiga !== club.nombre && campeonCopa !== club.nombre){
    const calA = calidadDe(club, campeonLiga);
    const calB = calidadDe(club, campeonCopa);
    let golA = calcularGoles(calA, calB);
    let golB = calcularGoles(calB, calA);
    if(golA === golB){
      const [pa, pb] = jugarProrroga(calA, calB);
      golA += pa; golB += pb;
      if(golA === golB){
        const ganoA = jugarPenales() === "A";
        golA += ganoA ? 1 : 0; golB += ganoA ? 0 : 1;
      }
    }
    const ganador = golA > golB ? campeonLiga : campeonCopa;
    const perdedor = ganador === campeonLiga ? campeonCopa : campeonLiga;
    agregarNoticia(club, `🏆 ${ganador} se consagró campeón de la Supercopa, venciendo a ${perdedor}.`, "copa");
    club.supercopa = null;
    return;
  }

  const rival = campeonLiga === club.nombre ? campeonCopa : campeonLiga;
  club.supercopa = { pendiente: true, rival };
  agregarNoticia(club, `Arrancás la temporada disputando la Supercopa ante ${rival}.`, "copa");
}

function procesarCierreDeTemporada(club){
  club.plantel.forEach(j => {
    const nivelAnterior = j.nivel;
    j.edad++;
    if(j.edad >= 34) j.nivel = Math.max(45, j.nivel - numeroAleatorio(1, 3));
    else if(j.edad <= 22) j.nivel = Math.min(99, j.nivel + numeroAleatorio(0, 2));

    
    if(j.nivel !== nivelAnterior && nivelAnterior > 0){
      const nuevoValor = Math.round(j.valor * (j.nivel / nivelAnterior) / 100000) * 100000;
      j.valor = Math.max(300000, nuevoValor);
    }
  });

  let retiros = 0;
  const nuevoPlantel = [];
  club.plantel.forEach(j => {
    if(j.edad >= 38){
      retiros++;
      if(club.alineacion.POR === j.id) club.alineacion.POR = "";
      ["DEF", "MED", "DEL"].forEach(p => {
        club.alineacion[p] = club.alineacion[p].map(id => id === j.id ? "" : id);
      });
     
    } else {
      nuevoPlantel.push(j);
    }
  });
  club.plantel = nuevoPlantel;

  if(retiros > 0){
    mostrarAviso(`📋 Se retiraron ${retiros} jugador(es). Reforzá esas posiciones en el mercado.`);
  }
}


function calidadDe(club, nombreEquipo){
  if(nombreEquipo === club.nombre) return nivelPromedioTitulares(club);
  const rival = club.rivales.find(r => r.nombre === nombreEquipo);
  return (rival ? rival.calidad : 74) + numeroAleatorio(-3, 3);
}


function jugarProrroga(nivelA, nivelB){
  const golA = Math.random() < (0.22 + (nivelA - nivelB) / 100) ? 1 : 0;
  const golB = Math.random() < (0.22 + (nivelB - nivelA) / 100) ? 1 : 0;
  return [Math.max(0, golA), Math.max(0, golB)];
}


function jugarPenales(){
  function tandaDeCinco(){
    let goles = 0;
    for(let i = 0; i < 5; i++){ if(Math.random() < 0.75) goles++; }
    return goles;
  }
  let a = tandaDeCinco();
  let b = tandaDeCinco();
  let intentos = 0;
  while(a === b && intentos < 20){
    const golA = Math.random() < 0.75 ? 1 : 0;
    const golB = Math.random() < 0.75 ? 1 : 0;
    if(golA !== golB) return golA > golB ? "A" : "B";
    intentos++;
  }
  return a >= b ? "A" : "B";
}


function autoResolverCruce(club, cruce){
  const calA = calidadDe(club, cruce.equipoA);
  const calB = calidadDe(club, cruce.equipoB);

  if(cruce.esFinal){
    let ga = calcularGoles(calA, calB);
    let gb = calcularGoles(calB, calA);
    if(ga === gb){
      const [pa, pb] = jugarProrroga(calA, calB);
      ga += pa; gb += pb;
      if(ga === gb) cruce.ganador = jugarPenales() === "A" ? cruce.equipoA : cruce.equipoB;
    }
    if(!cruce.ganador) cruce.ganador = ga > gb ? cruce.equipoA : cruce.equipoB;
    cruce.golesIdaA = ga; cruce.golesIdaB = gb;
    return;
  }

  const idaA = calcularGoles(calA, calB), idaB = calcularGoles(calB, calA);
  const vueltaA = calcularGoles(calA, calB), vueltaB = calcularGoles(calB, calA);
  cruce.golesIdaA = idaA; cruce.golesIdaB = idaB;
  cruce.golesVueltaA = vueltaA; cruce.golesVueltaB = vueltaB;

  let agA = idaA + vueltaA, agB = idaB + vueltaB;
  if(agA === agB){
    const [pa, pb] = jugarProrroga(calA, calB);
    agA += pa; agB += pb;
    if(agA === agB) cruce.ganador = jugarPenales() === "A" ? cruce.equipoA : cruce.equipoB;
  }
  if(!cruce.ganador) cruce.ganador = agA > agB ? cruce.equipoA : cruce.equipoB;
}


function generarRondaCopa(club, fase, equiposQueEntran){
  club.copa.fase = fase;
  club.copa.activa = true;
  club.copa.pendiente = null;
  club.copa.miCruce = null;
  club.copa.cruces = [];

  let jugables = equiposQueEntran.slice();

  if(fase === "previa"){
    jugables = jugables.sort(() => Math.random() - 0.5);
    club.copa.byesPendientes = jugables.slice(8);
    jugables = jugables.slice(0, 8);
  }

  jugables = jugables.sort(() => Math.random() - 0.5);
  const esFinal = jugables.length === 2;

  for(let i = 0; i < jugables.length; i += 2){
    const cruce = {
      equipoA: jugables[i], equipoB: jugables[i + 1], esFinal,
      golesIdaA: null, golesIdaB: null, golesVueltaA: null, golesVueltaB: null,
      prorroga: false, penales: false, ganador: null
    };
    const esMiCruce = cruce.equipoA === club.nombre || cruce.equipoB === club.nombre;
    if(esMiCruce){
      club.copa.miCruce = cruce;
      club.copa.pendiente = esFinal ? "unica" : "ida";
    } else {
      autoResolverCruce(club, cruce);
    }
    club.copa.cruces.push(cruce);
  }

  let textoSorteo = `Se sorteó ${esFinal ? "la Final" : NOMBRE_FASE[fase]} de la Copa Nacional.`;
  if(club.copa.miCruce){
    const rival = club.copa.miCruce.equipoA === club.nombre ? club.copa.miCruce.equipoB : club.copa.miCruce.equipoA;
    textoSorteo += ` Te tocó enfrentar a ${rival}.`;
  }
  agregarNoticia(club, textoSorteo, "copa");
}

function avanzarRondaCopa(club){
  const faseQueTermina = club.copa.fase;
  const premio = PREMIOS_COPA[faseQueTermina] || 0;
  club.presupuesto += premio;

  const idx = FASES_COPA.indexOf(faseQueTermina);
  if(idx === FASES_COPA.length - 1){
    club.copa.campeon = club.nombre;
    club.copa.activa = false;
    club.copa.pendiente = null;
    club.estadisticas.copas = (club.estadisticas.copas || 0) + 1;
    mostrarAviso("🏆🏆 ¡¡SALISTE CAMPEÓN DE LA COPA NACIONAL!! 🏆🏆");
    return premio;
  }
  const siguienteFase = FASES_COPA[idx + 1];
  let equiposQueEntran = club.copa.cruces.map(c => c.ganador);
  if(club.copa.fase === "previa"){
    equiposQueEntran = equiposQueEntran.concat(club.copa.byesPendientes || []);
  }
  generarRondaCopa(club, siguienteFase, equiposQueEntran);
  return premio;
}

function resolverTrasCompletarCruce(club){
  const cruce = club.copa.miCruce;
  const calA = calidadDe(club, cruce.equipoA);
  const calB = calidadDe(club, cruce.equipoB);
  let ganador = null;

  if(cruce.esFinal){
    let ga = cruce.golesIdaA, gb = cruce.golesIdaB;
    if(ga === gb){
      const [pa, pb] = jugarProrroga(calA, calB);
      ga += pa; gb += pb; cruce.prorroga = true;
      cruce.golesIdaA = ga; cruce.golesIdaB = gb;
      if(ga === gb){ cruce.penales = true; ganador = jugarPenales() === "A" ? cruce.equipoA : cruce.equipoB; }
    }
    if(!ganador) ganador = ga > gb ? cruce.equipoA : cruce.equipoB;
  } else {
    let agA = cruce.golesIdaA + cruce.golesVueltaA;
    let agB = cruce.golesIdaB + cruce.golesVueltaB;
    if(agA === agB){
      const [pa, pb] = jugarProrroga(calA, calB);
      agA += pa; agB += pb; cruce.prorroga = true;
      if(agA === agB){ cruce.penales = true; ganador = jugarPenales() === "A" ? cruce.equipoA : cruce.equipoB; }
    }
    if(!ganador) ganador = agA > agB ? cruce.equipoA : cruce.equipoB;
  }
  cruce.ganador = ganador;
  return ganador;
}


function jugarPartido(){
  const club = usuario().club;
  const tipo = tipoProximoPartido(club);
  if(tipo === "supercopa") jugarPartidoSupercopa();
  else if(tipo === "copa") jugarPartidoCopa();
  else jugarPartidoLiga();
}

function jugarPartidoLiga(){
  const club = usuario().club;
  if(!alineacionCompleta(club)){
    mostrarAviso("Completá tu alineación antes de jugar ❌");
    irAPantalla2("alineacion");
    return;
  }

  bajarContadorLesiones(club);

  const nombreRival = proximoRival(club);
  const rival = club.rivales.find(r => r.nombre === nombreRival);
  const nivelMio = nivelPromedioTitulares(club);
  const nivelRival = rival.calidad + numeroAleatorio(-5, 5);
  const golesMios = calcularGoles(nivelMio, nivelRival);
  const golesRival = calcularGoles(nivelRival, nivelMio);

  const { eventos, estadisticas, titularesIniciales } = jugarEventosDePartido(club, golesMios, golesRival, nombreRival, nivelMio, nivelRival);

  actualizarFilaTabla(club, club.nombre, golesMios, golesRival);
  actualizarFilaTabla(club, nombreRival, golesRival, golesMios);
  club.rivales.forEach(r => {
    if(r.nombre === nombreRival) return;
    actualizarFilaTabla(club, r.nombre, numeroAleatorio(0, 3), numeroAleatorio(0, 3));
  });

  club.estadisticas.pj++; club.estadisticas.gf += golesMios; club.estadisticas.gc += golesRival;
  club.golesTemporadaActual = (club.golesTemporadaActual || 0) + golesMios;
  let resultado = "E";
  if(golesMios > golesRival){ club.estadisticas.pg++; resultado = "G"; }
  else if(golesMios < golesRival){ club.estadisticas.pp++; resultado = "P"; }
  else { club.estadisticas.pe++; }

  club.resultados.unshift({ fecha: club.fecha, rival: nombreRival, golesPropios: golesMios, golesRival, resultado, tipo: "liga" });
  club.resultados = club.resultados.slice(0, 15);

  club.fecha++;
  if(club.copa.esperandoLiga) club.copa.esperandoLiga = false;

  if(!club.copa.activa && !club.copa.eliminado && !club.copa.campeon && club.fecha === 3){
    const todosLosEquipos = [club.nombre, ...club.rivales.map(r => r.nombre)];
    generarRondaCopa(club, "previa", todosLosEquipos);
  }

  if(club.fecha > club.calendario.length){
    guardarHistorialTemporada(club);
    club.fecha = 1;
    club.temporada++;
    club.golesTemporadaActual = 0;
    Object.keys(club.tabla).forEach(n => club.tabla[n] = filaVacia());
    club.calendario = club.rivales.map(r => r.nombre).sort(() => Math.random() - 0.5);
    procesarCierreDeTemporada(club);
    club.copa = copaVacia();
    prepararSupercopa(club);
    generarObjetivosTemporada(club);
  }

  resolverNegociacionesPendientes(club);
  resolverOfertasSalientesPendientes(club);
  generarOfertaRecibidaAlAzar(club);
  guardarBaseDeDatos();
  actualizarEncabezado();

  iniciarSimulacionEnVivo({
    tipo: "liga", rivalNombre: nombreRival, golesMios, golesRival, eventos, estadisticas, titularesIniciales,
    etiquetaFecha: "LIGA · FECHA " + club.resultados[0].fecha
  });
}

function jugarPartidoCopa(){
  const club = usuario().club;
  if(!alineacionCompleta(club)){
    mostrarAviso("Completá tu alineación antes de jugar ❌");
    irAPantalla2("alineacion");
    return;
  }

  bajarContadorLesiones(club);

  const cruce = club.copa.miCruce;
  const soyA = cruce.equipoA === club.nombre;
  const rivalNombre = soyA ? cruce.equipoB : cruce.equipoA;
  const esVuelta = club.copa.pendiente === "vuelta";
  const calMia = nivelPromedioTitulares(club);
  const calRival = calidadDe(club, rivalNombre);

  let soyLocal;
  if(cruce.esFinal || !esVuelta) soyLocal = soyA;
  else soyLocal = !soyA;

  const nivelLocal = soyLocal ? calMia : calRival;
  const nivelVisita = soyLocal ? calRival : calMia;
  const golesLocal = calcularGoles(nivelLocal, nivelVisita);
  const golesVisita = calcularGoles(nivelVisita, nivelLocal);
  const golesMios = soyLocal ? golesLocal : golesVisita;
  const golesRival = soyLocal ? golesVisita : golesLocal;

  if(cruce.esFinal || !esVuelta){
    if(soyA){ cruce.golesIdaA = golesMios; cruce.golesIdaB = golesRival; }
    else { cruce.golesIdaA = golesRival; cruce.golesIdaB = golesMios; }
  } else {
    if(soyA){ cruce.golesVueltaA = golesMios; cruce.golesVueltaB = golesRival; }
    else { cruce.golesVueltaA = golesRival; cruce.golesVueltaB = golesMios; }
  }

  const { eventos, estadisticas, titularesIniciales } = jugarEventosDePartido(club, golesMios, golesRival, rivalNombre, calMia, calRival);

  let resultadoCopa = "E";
  if(golesMios > golesRival) resultadoCopa = "G";
  else if(golesMios < golesRival) resultadoCopa = "P";

  club.golesTemporadaActual = (club.golesTemporadaActual || 0) + golesMios;
  club.estadisticas.pjCopa = (club.estadisticas.pjCopa || 0) + 1;
  if(resultadoCopa === "G") club.estadisticas.pgCopa = (club.estadisticas.pgCopa || 0) + 1;
  else if(resultadoCopa === "P") club.estadisticas.ppCopa = (club.estadisticas.ppCopa || 0) + 1;
  else club.estadisticas.peCopa = (club.estadisticas.peCopa || 0) + 1;

  const detalleCopa = (cruce.esFinal ? "Final" : (esVuelta ? "Vuelta" : "Ida")) + " · " + NOMBRE_FASE[club.copa.fase];
  club.resultados.unshift({
    fecha: null, rival: rivalNombre, golesPropios: golesMios, golesRival,
    resultado: resultadoCopa, tipo: "copa", detalleCopa: detalleCopa
  });
  club.resultados = club.resultados.slice(0, 15);

  let etiqueta = cruce.esFinal ? "COPA · FINAL" : "COPA · " + (esVuelta ? "VUELTA" : "IDA") + " · " + NOMBRE_FASE[club.copa.fase];
  let mensajeExtra = "";
  let detalleParaHistorial = etiqueta;

  if(cruce.esFinal || esVuelta){
    const ganador = resolverTrasCompletarCruce(club);
    club.copa.esperandoLiga = true;
    if(cruce.prorroga) mensajeExtra = cruce.penales ? " (prórroga y penales)" : " (prórroga)";

    if(ganador === club.nombre){
      const premio = avanzarRondaCopa(club);
      mensajeExtra += premio ? ` +${formatearPlata(premio)}` : "";
      if(club.copa.campeon === club.nombre){
        mensajeExtra += " — 🏆 ¡CAMPEÓN!";
      } else {
        mensajeExtra += " — Avanzaste de ronda";
      }
    } else {
      club.copa.eliminado = true;
      club.copa.activa = false;
      club.copa.pendiente = null;
      mensajeExtra += " — Quedaste eliminado de la Copa";
    }
  } else {
    club.copa.pendiente = "vuelta";
    club.copa.esperandoLiga = true;
  }

  resolverNegociacionesPendientes(club);
  resolverOfertasSalientesPendientes(club);
  generarOfertaRecibidaAlAzar(club);
  guardarBaseDeDatos();
  actualizarEncabezado();

  iniciarSimulacionEnVivo({
    tipo: "copa", rivalNombre, golesMios, golesRival, eventos, estadisticas, titularesIniciales,
    etiquetaFecha: etiqueta, mensajeExtra
  });
}

function jugarPartidoSupercopa(){
  const club = usuario().club;
  if(!alineacionCompleta(club)){
    mostrarAviso("Completá tu alineación antes de jugar ❌");
    irAPantalla2("alineacion");
    return;
  }

  bajarContadorLesiones(club);

  const rivalNombre = club.supercopa.rival;
  const nivelMio = nivelPromedioTitulares(club);
  const nivelRival = calidadDe(club, rivalNombre);
  const golesMios = calcularGoles(nivelMio, nivelRival);
  const golesRival = calcularGoles(nivelRival, nivelMio);

  const { eventos, estadisticas, titularesIniciales } = jugarEventosDePartido(club, golesMios, golesRival, rivalNombre, nivelMio, nivelRival);

  let golesFinalesMios = golesMios, golesFinalesRival = golesRival;
  let prorroga = false, penales = false;
  if(golesFinalesMios === golesFinalesRival){
    const [pa, pb] = jugarProrroga(nivelMio, nivelRival);
    golesFinalesMios += pa; golesFinalesRival += pb;
    prorroga = true;
    if(golesFinalesMios === golesFinalesRival){
      penales = true;
      const ganoYo = jugarPenales() === "A";
      golesFinalesMios += ganoYo ? 1 : 0;
      golesFinalesRival += ganoYo ? 0 : 1;
    }
  }
  const gane = golesFinalesMios > golesFinalesRival;

  club.golesTemporadaActual = (club.golesTemporadaActual || 0) + golesMios;
  club.estadisticas.pjCopa = (club.estadisticas.pjCopa || 0) + 1;
  if(gane) club.estadisticas.pgCopa = (club.estadisticas.pgCopa || 0) + 1;
  else club.estadisticas.ppCopa = (club.estadisticas.ppCopa || 0) + 1;

  club.resultados.unshift({
    fecha: null, rival: rivalNombre, golesPropios: golesMios, golesRival,
    resultado: gane ? "G" : "P", tipo: "copa", detalleCopa: "Supercopa"
  });
  club.resultados = club.resultados.slice(0, 15);

  club.supercopa = null;

  let mensajeExtra = prorroga ? (penales ? " (prórroga y penales)" : " (prórroga)") : "";
  if(gane){
    club.presupuesto += PREMIO_SUPERCOPA;
    mensajeExtra += ` +${formatearPlata(PREMIO_SUPERCOPA)} — 🏆 ¡GANASTE LA SUPERCOPA!`;
    mostrarAviso("🏆 ¡Ganaste la Supercopa!");
  } else {
    mensajeExtra += " — Perdiste la Supercopa";
  }

  resolverNegociacionesPendientes(club);
  resolverOfertasSalientesPendientes(club);
  generarOfertaRecibidaAlAzar(club);
  guardarBaseDeDatos();
  actualizarEncabezado();

  iniciarSimulacionEnVivo({
    tipo: "supercopa", rivalNombre, golesMios, golesRival, eventos, estadisticas, titularesIniciales,
    etiquetaFecha: "SUPERCOPA", mensajeExtra
  });
}

function actualizarFilaTabla(club, nombreEquipo, golesFavor, golesContra){
  const fila = club.tabla[nombreEquipo];
  if(!fila) return;
  fila.pj++;
  fila.gf += golesFavor;
  fila.gc += golesContra;
  if(golesFavor > golesContra){ fila.pg++; fila.pts += 3; }
  else if(golesFavor < golesContra){ fila.pp++; }
  else { fila.pe++; fila.pts += 1; }
}


function obtenerTablaOrdenada(club){
  return Object.keys(club.tabla)
    .map(nombre => ({ nombre: nombre, ...club.tabla[nombre] }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));
}

function mostrarTablaLiga(){
  const club = usuario().club;
  const tabla = obtenerTablaOrdenada(club);
  const cuerpo = document.getElementById("tabla-liga-cuerpo");
  cuerpo.innerHTML = tabla.map((fila, i) => {
    const dg = fila.gf - fila.gc;
    const dgTexto = (dg > 0 ? "+" : "") + dg;
    return `
    <tr class="${fila.nombre === club.nombre ? 'fila-mia' : ''}">
      <td>${i + 1}</td>
      <td class="celda-equipo">${escudoEquipoHTML(fila.nombre, "chico", club)}${fila.nombre}</td>
      <td>${fila.pj}</td>
      <td>${fila.pg}</td>
      <td>${fila.pe}</td>
      <td>${fila.pp}</td>
      <td>${fila.gf}</td>
      <td>${fila.gc}</td>
      <td>${dgTexto}</td>
      <td>${fila.pts}</td>
    </tr>`;
  }).join("");
}


function mostrarCalendario(){
  const club = usuario().club;
  const contenedor = document.getElementById("lista-calendario");
  const items = [];


  items.push({
    clase: "calendario-destacado",
    izquierda: etiquetaProximoPartido(club) + " vs " + (obtenerProximoRivalGenerico(club) || "—"),
    derecha: null
  });

  
  for(let i = 1; i <= 5; i++){
    const indice = (club.fecha - 1 + i) % club.calendario.length;
    items.push({
      clase: "",
      izquierda: "LIGA · Fecha " + (club.fecha + i) + " vs " + club.calendario[indice],
      derecha: null
    });
  }

  
  (club.resultados || []).slice(0, 8).forEach(r => {
    let clase = "empato", texto = "EMPATÓ";
    if(r.resultado === "G"){ clase = "gano"; texto = "GANÓ"; }
    if(r.resultado === "P"){ clase = "perdio"; texto = "PERDIÓ"; }
    const etiquetaTipo = r.tipo === "copa" ? ("COPA · " + r.detalleCopa) : ("LIGA · Fecha " + r.fecha);
    items.push({
      clase: "",
      izquierda: etiquetaTipo + " vs " + r.rival,
      derecha: { clase: clase, texto: texto + " " + r.golesPropios + "-" + r.golesRival }
    });
  });

  contenedor.innerHTML = items.map(it => `
    <li class="${it.clase}">
      <span>${it.izquierda}</span>
      ${it.derecha ? `<span class="etiqueta ${it.derecha.clase}">${it.derecha.texto}</span>` : ""}
    </li>
  `).join("");

  const infoCopa = document.getElementById("calendario-copa-info");
  if(club.copa.campeon === club.nombre){
    infoCopa.textContent = "🏆 ¡Sos el campeón de la Copa Nacional de esta temporada!";
  } else if(club.copa.eliminado){
    infoCopa.textContent = "Quedaste eliminado de la Copa Nacional esta temporada.";
  } else if(club.copa.activa){
    infoCopa.textContent = "🏆 Copa Nacional en curso — fase actual: " + NOMBRE_FASE[club.copa.fase];
  } else {
    infoCopa.textContent = "La Copa Nacional todavía no arrancó esta temporada.";
  }
}


function calcularRachaActual(club){
  if(!club.resultados.length) return "—";
  const primero = club.resultados[0].resultado;
  let contador = 0;
  for(const r of club.resultados){
    if(r.resultado === primero) contador++;
    else break;
  }
  const emoji = primero === "G" ? "🔥" : primero === "P" ? "❄️" : "➖";
  const palabra = primero === "G" ? (contador === 1 ? "victoria" : "victorias")
    : primero === "P" ? (contador === 1 ? "derrota" : "derrotas")
    : (contador === 1 ? "empate" : "empates");
  return `${emoji} ${contador} ${palabra}`;
}

function calcularValorPlantel(club){
  return club.plantel.reduce((suma, j) => suma + j.valor, 0);
}

function mostrarStats(){
  const club = usuario().club;
  document.getElementById("stat-pj").textContent = club.estadisticas.pj;
  document.getElementById("stat-pg").textContent = club.estadisticas.pg;
  document.getElementById("stat-gf").textContent = club.estadisticas.gf;
  document.getElementById("stat-gc").textContent = club.estadisticas.gc;
  document.getElementById("stat-copas").textContent = club.estadisticas.copas || 0;

  const efectividad = club.estadisticas.pj ? Math.round((club.estadisticas.pg / club.estadisticas.pj) * 100) : 0;
  document.getElementById("stat-efectividad").textContent = efectividad + "%";
  document.getElementById("stat-racha").textContent = calcularRachaActual(club);
  document.getElementById("stat-valor-plantel").textContent = formatearPlata(calcularValorPlantel(club));

  const lista = Object.values(club.goleadores).sort((a, b) => b.goles - a.goles).slice(0, 10);
  const contenedor = document.getElementById("lista-goleadores");
  contenedor.innerHTML = lista.length
    ? lista.map((g, i) => `<li><span class="pos-goleador">${i + 1}</span><span style="flex:1">${g.nombre}</span><span>${g.goles} ⚽</span></li>`).join("")
    : '<p class="vacio">Todavía nadie hizo goles.</p>';
}


function mostrarResumenTemporadaSiCorresponde(){
  const datosUsuario = usuario();
  if(!datosUsuario || !datosUsuario.club) return;
  const club = datosUsuario.club;
  const r = club.resumenTemporadaPendiente;
  if(!r) return;

  document.getElementById("resumen-temporada-numero").textContent = r.temporada;

  let copaTexto;
  if(r.campeonCopa === club.nombre) copaTexto = "🏆 ¡Campeón de la Copa Nacional!";
  else if(r.eliminadoCopa) copaTexto = "Quedaste eliminado de la Copa Nacional.";
  else copaTexto = "No llegaste a disputar la Copa Nacional.";

  let objetivosHTML = "";
  if(r.objetivos){
    objetivosHTML = `<p class="resumen-objetivos-titulo">🎯 Objetivos cumplidos: ${r.objetivos.cumplidos}/${r.objetivos.total}</p>` +
      r.objetivos.items.map(it =>
        `<p class="resumen-objetivo-item ${it.cumplido ? "cumplido" : "nocumplido"}">${it.cumplido ? "✅" : "❌"} ${it.texto}</p>`
      ).join("");
  }

  document.getElementById("resumen-temporada-datos").innerHTML = `
    <p>Terminaste <strong>${r.posicion}°</strong> con <strong>${r.puntos} puntos</strong></p>
    <p>Goles: ${r.golesFavor} a favor · ${r.golesContra} en contra</p>
    <p>🏆 Campeón de Liga: ${r.campeonLiga}</p>
    <p>${copaTexto}</p>
    <p class="resumen-premio">💰 Ingresos de la temporada: ${formatearPlata(r.premio)}</p>
    ${objetivosHTML}
  `;

  document.getElementById("overlay-resumen-temporada").classList.add("mostrar");
}

function cerrarResumenTemporada(){
  const club = usuario().club;
  club.resumenTemporadaPendiente = null;
  guardarBaseDeDatos();
  document.getElementById("overlay-resumen-temporada").classList.remove("mostrar");
}


function verPerfilPropio(){
  perfilVistoEmail = null;
  perfilOrigen = "stats";
  irAPantalla2("perfil");
}

async function verPerfilDesdeRanking(usuario_id){

  const { data: fila } = await supa
    .from("ranking")
    .select("nombre")
    .eq("usuario_id", usuario_id)
    .maybeSingle();

  const { data: partida, error } = await supa
    .from("partidas")
    .select("datos")
    .eq("usuario_id", usuario_id)
    .maybeSingle();

  if(error || !partida){
    console.log("Error al cargar el perfil:", error);
    return;
  }

  // Usamos un email "de mentira" solo para reutilizar baseDeDatos y mostrarPerfil()
  const claveFicticia = (fila?.nombre || "jugador") + "@ranking";

  perfilVistoEmail = claveFicticia;

  baseDeDatos[claveFicticia] = {
    id: usuario_id,
    club: partida.datos
  };

  perfilOrigen = "ranking";

  irAPantalla2("perfil");
}

function volverDesdePerfil(){
  const destino = perfilOrigen;
  perfilVistoEmail = null;
  perfilOrigen = "stats";
  irAPantalla2(destino);
}

function mostrarPerfil(){
  const emailAMostrar = perfilVistoEmail || emailActual;
  const cuenta = baseDeDatos[emailAMostrar];
  if(!cuenta || !cuenta.club) return;
  const club = cuenta.club;
  club.trofeos = club.trofeos || { ligas: 0 };

  const esElMio = emailAMostrar === emailActual;
  const nombreDT = emailAMostrar.split("@")[0];
  const partidosTotales = club.estadisticas.pj + (club.estadisticas.pjCopa || 0);
  const victoriasTotales = club.estadisticas.pg + (club.estadisticas.pgCopa || 0);
  const empatesTotales = club.estadisticas.pe + (club.estadisticas.peCopa || 0);
  const derrotasTotales = club.estadisticas.pp + (club.estadisticas.ppCopa || 0);

  document.getElementById("perfil-nombre").textContent = "👤 " + nombreDT.toUpperCase() + (esElMio ? "" : " (rival)");
  document.getElementById("perfil-club").textContent = club.nombre + " · " + club.liga;
  document.getElementById("perfil-temporadas").textContent = club.temporada;
  document.getElementById("perfil-partidos").textContent = partidosTotales;
  document.getElementById("perfil-victorias").textContent = victoriasTotales;
  document.getElementById("perfil-empates").textContent = empatesTotales;
  document.getElementById("perfil-derrotas").textContent = derrotasTotales;
  document.getElementById("perfil-ligas").textContent = "🏆 Liga ×" + (club.trofeos.ligas || 0);
  document.getElementById("perfil-copas").textContent = "🏆 Copa ×" + (club.estadisticas.copas || 0);
  document.getElementById("perfil-fichajes").textContent = "💰 Fichajes: " + formatearPlata(club.totalGastadoFichajes || 0);

  const palmares = (club.historial || []).filter(h => h.campeonLiga === club.nombre || h.campeonCopa === club.nombre);
  const contenedor = document.getElementById("lista-palmares");
  contenedor.innerHTML = palmares.length
    ? palmares.map(h => {
        const trofeos = [];
        if(h.campeonLiga === club.nombre) trofeos.push("🏆 Liga");
        if(h.campeonCopa === club.nombre) trofeos.push("🏆 Copa");
        return `<div class="palmares-item"><span>Temporada ${h.temporada}</span><span>${trofeos.join(" · ")}</span></div>`;
      }).join("")
    : '<p class="vacio">Todavía no ganó ningún título con este club.</p>';
}


function pintarHistorial(){
  const club = usuario().club;
  const historial = club.historial || [];
  const contenedor = document.getElementById("lista-historial");
  contenedor.innerHTML = historial.length
    ? historial.map(h => `
        <div class="historial-item">
          <p class="historial-temporada">Temporada ${h.temporada}</p>
          <p class="historial-detalle">Terminaste ${h.posicion}° con ${h.puntos} puntos</p>
          <p class="historial-detalle">🏆 Campeón de Liga: ${h.campeonLiga}</p>
          ${h.campeonCopa ? `<p class="historial-detalle">🏆 Campeón de Copa: ${h.campeonCopa}</p>` : ""}
          <p class="historial-detalle">💰 Ingresos: ${formatearPlata(h.premio || 0)}</p>
        </div>
      `).join("")
    : '<p class="vacio">Todavía no completaste ninguna temporada.</p>';
}


async function sincronizarRankingOnline(){
  const club = usuario()?.club;

  if(!club || !emailActual) return;

  const tabla = obtenerTablaOrdenada(club);
  const miFila = tabla.find(f => f.nombre === club.nombre);

  const { error } = await supa
    .from("ranking")
    .upsert({
      usuario_id: baseDeDatos[emailActual].id,
      nombre: emailActual.split("@")[0],
      club: club.nombre,
      temporada: club.temporada,
      puntos: miFila ? miFila.pts : 0,
      copas: club.estadisticas.copas || 0,
      presupuesto: club.presupuesto
    });

  if(error){
    console.log("Error al guardar el ranking:", error);
    return;
  }

  console.log("Ranking guardado en Supabase");
}


async function pintarRanking(){
  const contenedor = document.getElementById("lista-ranking");

  contenedor.innerHTML = '<p class="vacio">Cargando ranking…</p>';

  const { data: lista, error } = await supa
    .from("ranking")
    .select("*")
    .order("copas", { ascending: false })
    .order("puntos", { ascending: false })
    .order("presupuesto", { ascending: false });

  if(error){
    console.log("Error al cargar el ranking:", error);
    contenedor.innerHTML =
      '<p class="vacio">No se pudo cargar el ranking.</p>';
    return;
  }

  {
    if(!lista.length){
      contenedor.innerHTML =
        '<p class="vacio">Todavía no hay directores técnicos para rankear.</p>';
      return;
    }

    contenedor.innerHTML = lista.map((r, i) => {

      const soyYo = r.usuario_id === baseDeDatos[emailActual]?.id;

      return `
        <div class="ranking-item ${soyYo ? "ranking-yo" : ""}"
        onclick="verPerfilDesdeRanking(${r.usuario_id})">
          
          <span class="ranking-pos">${i + 1}°</span>

          <div class="ranking-info">
            <p class="ranking-nombre">
              ${r.nombre}${soyYo ? " (vos)" : ""}
            </p>

            <p class="ranking-detalle">
              ${r.club} · Temporada ${r.temporada}
            </p>
          </div>

          <div class="ranking-datos">
            <p class="ranking-copas">🏆 ${r.copas}</p>
            <p class="ranking-puntos">${r.puntos} pts</p>
          </div>

        </div>
      `;

    }).join("");
  }
}

cargarDatosDelJuego().then(() => {
  mostrarTab("login");
}).catch(() => {
  alert("No se pudo conectar con Supabase. Revisá SUPABASE_URL y SUPABASE_ANON_KEY en index.html.");
});