import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ————— Paletas: "Banquete" (clara) y "Luxury" (oscura, estilo dnypartydecoration.com) —————
const PALETA_CLARA = {
  bg: "#F7F3EC",
  card: "#FFFFFF",
  ink: "#2B1B22",
  wine: "#5C1F2E",
  wineSoft: "#7A3242",
  gold: "#B8892E",
  goldSoft: "#E7D3A8",
  line: "#E7DFD3",
  free: "#3E7A55",
  muted: "#8C7F72",
  softGold: "#FBF3E2",
  cardSoft: "#FDFBF7",
  inputBg: "#FDFCFA",
  okBg: "#EFF6F0",
  okBorder: "#C9E0CE",
  danger: "#A33",
  dangerBg: "#FBEFEF",
  dangerBorder: "#E5C5C5",
  botonTexto: "#FFFFFF",
};

const PALETA_OSCURA = {
  bg: "#0A0A0A",          // negro de la web
  card: "#14120F",         // carbón cálido
  ink: "#F2EDE3",          // marfil
  wine: "#D9B876",         // en oscuro el acento principal es el dorado champán (como los botones de la web)
  wineSoft: "#C9B183",     // dorado suave para subtítulos
  gold: "#D9B876",         // dorado champán
  goldSoft: "#4A3D22",     // dorado profundo para bordes
  line: "#29251F",
  free: "#8FC7A3",
  muted: "#A39882",
  softGold: "#241E12",
  cardSoft: "#1A1713",
  inputBg: "#100E0C",
  okBg: "#142419",
  okBorder: "#2E4A38",
  danger: "#E08A8A",
  dangerBg: "#2A1515",
  dangerBorder: "#55302F",
  botonTexto: "#14100A",   // texto oscuro sobre botones dorados (como "COTIZA POR WHATSAPP")
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const TIPOS = ["Decoración", "Catering", "Decoración + Catering"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function App() {
  const hoy = new Date();

  // ————— Tema claro / oscuro (se guarda en el dispositivo) —————
  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem("dny-tema") || "claro"; } catch { return "claro"; }
  });
  const C = tema === "oscuro" ? PALETA_OSCURA : PALETA_CLARA;
  const alternarTema = () => {
    const nuevo = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    try { localStorage.setItem("dny-tema", nuevo); } catch {}
  };
  const [vista, setVista] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [eventos, setEventos] = useState({}); // { "2026-07-04": [evento, ...] }
  const [diaSel, setDiaSel] = useState(keyOf(hoy));
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [gcalSugerido, setGcalSugerido] = useState(null); // {fecha, ev} tras registrar
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eventoUrl, setEventoUrl] = useState(() => new URLSearchParams(window.location.search).get("evento"));

  // ————— Sesión (inicio de sesión requerido) —————
  const [sesion, setSesion] = useState(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setSesionLista(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const iniciarSesion = async () => {
    setEntrando(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPass });
    if (error) setLoginError("Correo o contraseña incorrectos.");
    setEntrando(false);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setEventos({});
  };

  const configurado = SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;

  // ————— Cargar datos desde Supabase —————
  const cargarEventos = async () => {
    if (!configurado) { setCargando(false); return; }
    try {
      const { data, error } = await supabase.from("eventos").select("*").order("hora", { ascending: true });
      if (error) throw error;
      const agrupados = {};
      for (const ev of data || []) {
        if (!agrupados[ev.fecha]) agrupados[ev.fecha] = [];
        agrupados[ev.fecha].push(ev);
      }
      setEventos(agrupados);
      setErrorMsg("");
    } catch (e) {
      console.error(e);
      setErrorMsg("No se pudieron cargar los eventos. Revisa tu conexión o la configuración de Supabase.");
    }
    setCargando(false);
  };

  useEffect(() => {
    if (!sesion) { setCargando(false); return; }
    setCargando(true);
    cargarEventos();
    if (!configurado) return;
    // Sincronización en tiempo real: si alguien más registra/edita, se actualiza solo
    const canal = supabase
      .channel("eventos-cambios")
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, () => cargarEventos())
      .subscribe();
    const alVolver = () => { if (document.visibilityState === "visible") cargarEventos(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      supabase.removeChannel(canal);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [sesion]);

  // ————— Abrir evento llegado por enlace (?evento=ID) —————
  useEffect(() => {
    if (!eventoUrl) return;
    if (!sesion || cargando) return; // esperar a que haya sesión y eventos cargados
    if (Object.keys(eventos).length === 0) return; // aún no llegan los datos
    for (const [k, list] of Object.entries(eventos)) {
      const ev = list.find((e) => String(e.id) === String(eventoUrl));
      if (ev) {
        setDiaSel(k);
        setConfirmando(false);
        setConfirmandoEliminar(false);
        setForm({ ...ev });
        const [y, m] = k.split("-").map(Number);
        setVista(new Date(y, m - 1, 1));
        break;
      }
    }
    setEventoUrl(null);
    window.history.replaceState({}, "", window.location.pathname);
  }, [eventos, cargando, eventoUrl, sesion]);

  // ————— Calendario —————
  const celdas = useMemo(() => {
    const y = vista.getFullYear(), m = vista.getMonth();
    const primero = new Date(y, m, 1);
    const offset = (primero.getDay() + 6) % 7; // Lunes = 0
    const diasMes = new Date(y, m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= diasMes; d++) arr.push(new Date(y, m, d));
    return arr;
  }, [vista]);

  const evsDia = eventos[diaSel] || [];

  const proximos = useMemo(() => {
    const hoyK = keyOf(new Date());
    return Object.entries(eventos)
      .filter(([k, list]) => k >= hoyK && list.length)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 5);
  }, [eventos]);

  // ————— Semana (lunes a domingo) —————
  const diasSemana = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const lunes = new Date(base);
    lunes.setDate(base.getDate() - ((base.getDay() + 6) % 7) + semanaOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return d;
    });
  }, [semanaOffset]);

  const totalSemana = useMemo(
    () => diasSemana.reduce((acc, d) => acc + (eventos[keyOf(d)] || []).length, 0),
    [diasSemana, eventos]
  );

  // ————— Búsqueda por cliente —————
  const normalizar = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return [];
    const out = [];
    for (const [k, list] of Object.entries(eventos)) {
      for (const ev of list) {
        if (normalizar(ev.cliente || "").includes(q)) out.push({ fecha: k, ev });
      }
    }
    out.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return out;
  }, [busqueda, eventos]);

  // ————— Acciones —————
  const abrirNuevo = () => { setConfirmando(false); setConfirmandoEliminar(false); setForm({ id: null, cliente: "", evento: "", tipo: TIPOS[2], hora: "", lugar: "", invitados: "", notas: "", estado: "Pendiente" }); };
  const abrirEditar = (ev) => { setConfirmando(false); setConfirmandoEliminar(false); setForm({ ...ev }); };

  const intentarGuardar = () => {
    if (!form.cliente.trim()) return;
    const existentes = eventos[diaSel] || [];
    if (!form.id && existentes.length > 0) {
      setConfirmando(true);
    } else {
      guardarEvento();
    }
  };

  const guardarEvento = async () => {
    if (!form.cliente.trim()) return;
    setConfirmando(false);
    setGuardando(true);
    try {
      const registro = {
        fecha: diaSel,
        cliente: form.cliente.trim(),
        evento: form.evento ? form.evento.trim() : null,
        tipo: form.tipo,
        hora: form.hora || null,
        lugar: form.lugar || null,
        invitados: form.invitados ? Number(form.invitados) : null,
        notas: form.notas || null,
        estado: form.estado,
      };
      let error;
      if (form.id) {
        registro.modificado_por = sesion.user?.email || null;
        registro.modificado_en = new Date().toISOString();
        ({ error } = await supabase.from("eventos").update(registro).eq("id", form.id));
      } else {
        registro.creado_por = sesion.user?.email || null;
        const res = await supabase.from("eventos").insert(registro).select().single();
        error = res.error;
        if (!error && res.data) setGcalSugerido({ fecha: diaSel, ev: res.data });
      }
      if (error) throw error;
      await cargarEventos();
      setForm(null);
      setErrorMsg("");
    } catch (e) {
      console.error(e);
      setErrorMsg("No se pudo guardar el evento. Intenta de nuevo.");
    }
    setGuardando(false);
  };

  const eliminarEvento = async (id) => {
    setGuardando(true);
    try {
      const { error } = await supabase.from("eventos").delete().eq("id", id);
      if (error) throw error;
      await cargarEventos();
      setForm(null);
      setErrorMsg("");
    } catch (e) {
      console.error(e);
      setErrorMsg("No se pudo eliminar el evento. Intenta de nuevo.");
    }
    setGuardando(false);
  };

  const cambiarMes = (delta) => setVista(new Date(vista.getFullYear(), vista.getMonth() + delta, 1));

  const irADia = (k) => {
    setDiaSel(k);
    setForm(null);
    setConfirmando(false);
    const [y, m] = k.split("-").map(Number);
    setVista(new Date(y, m - 1, 1));
  };

  const abrirResultado = (k, ev) => {
    setDiaSel(k);
    setConfirmando(false);
    setForm({ ...ev });
    const [y, m] = k.split("-").map(Number);
    setVista(new Date(y, m - 1, 1));
    setBusqueda("");
  };

  const fmtFecha = (k) => {
    const [y, m, d] = k.split("-").map(Number);
    const f = new Date(y, m - 1, d);
    return `${DIAS[(f.getDay() + 6) % 7]} ${d} de ${MESES[m - 1]}`;
  };

  // Mostrar horas en formato 12h (se guardan en 24h para mantener el orden)
  const fmt12 = (h) => {
    if (!h) return "";
    const [H, M] = h.split(":").map(Number);
    const ap = H >= 12 ? "PM" : "AM";
    const h12 = H % 12 === 0 ? 12 : H % 12;
    return `${h12}:${String(M).padStart(2, "0")} ${ap}`;
  };

  const fmtFechaHora = (iso) => {
    if (!iso) return "";
    const f = new Date(iso);
    return `${f.getDate()} de ${MESES[f.getMonth()]} ${f.getFullYear()}, ${pad(f.getHours())}:${pad(f.getMinutes())}`;
  };

  // ————— Enlace a Google Calendar con los datos pre-llenados —————
  const linkGoogleCalendar = (fecha, ev) => {
    const [y, m, d] = fecha.split("-").map(Number);
    const titulo = `${ev.evento ? ev.evento + " — " : ""}${ev.cliente} (DNY)`;
    let dates;
    if (ev.hora) {
      const [hh, mm] = ev.hora.split(":").map(Number);
      const ini = new Date(y, m - 1, d, hh, mm);
      const fin = new Date(ini.getTime() + 2 * 60 * 60 * 1000); // 2 horas por defecto
      const f = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
      dates = `${f(ini)}/${f(fin)}`;
    } else {
      const dia = `${y}${pad(m)}${pad(d)}`;
      const sig = new Date(y, m - 1, d + 1);
      dates = `${dia}/${sig.getFullYear()}${pad(sig.getMonth() + 1)}${pad(sig.getDate())}`; // todo el día
    }
    const detalles = [
      ev.tipo ? `Servicio: ${ev.tipo}` : "",
      ev.invitados ? `Invitados: ${ev.invitados}` : "",
      ev.estado ? `Estado: ${ev.estado}` : "",
      ev.notas ? `Notas: ${ev.notas}` : "",
    ].filter(Boolean).join("\n");
    const params = new URLSearchParams({ action: "TEMPLATE", text: titulo, dates, details: detalles });
    if (ev.lugar) params.set("location", ev.lugar);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Marcar / desmarcar que el evento ya fue agregado a Google Calendar
  const marcarGcal = async (id) => {
    try {
      const { error } = await supabase.from("eventos").update({
        gcal_por: sesion.user?.email || null,
        gcal_en: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      await cargarEventos();
      if (form && form.id === id) setForm({ ...form, gcal_por: sesion.user?.email || null, gcal_en: new Date().toISOString() });
    } catch (e) { console.error(e); }
  };

  const desmarcarGcal = async (id) => {
    try {
      const { error } = await supabase.from("eventos").update({ gcal_por: null, gcal_en: null }).eq("id", id);
      if (error) throw error;
      await cargarEventos();
      if (form && form.id === id) setForm({ ...form, gcal_por: null, gcal_en: null });
    } catch (e) { console.error(e); }
  };

  // ————— Estilos base —————
  const s = {
    input: { width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 15, fontFamily: "inherit", color: C.ink, background: C.inputBg, boxSizing: "border-box", outline: "none" },
    label: { fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 4, display: "block", fontWeight: 600 },
    btnPrim: { background: C.wine, color: C.botonTexto, border: "none", padding: "12px 20px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
    btnGhost: { background: "transparent", color: C.wine, border: `1px solid ${C.line}`, padding: "12px 20px", borderRadius: 8, fontSize: 15, cursor: "pointer", fontFamily: "inherit" },
  };

  const ocupacion = (n) => (n === 0 ? { txt: "Día libre", col: C.free } : n === 1 ? { txt: "1 evento", col: C.gold } : { txt: `${n} eventos`, col: C.wine });

  // ————— Pantalla de configuración pendiente —————
  if (!configurado) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Karla', sans-serif", color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, maxWidth: 520 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: C.wine, fontSize: 26, marginTop: 0 }}>Falta configurar Supabase</h1>
          <p>Abre el archivo <code style={{ background: C.softGold, padding: "2px 6px", borderRadius: 4 }}>src/config.js</code> y pega tu <strong>Project URL</strong> y tu <strong>anon key</strong> de Supabase (los encuentras en Settings → API de tu proyecto).</p>
          <p style={{ color: C.muted, fontSize: 14 }}>Después vuelve a hacer deploy y la app quedará conectada.</p>
        </div>
      </div>
    );
  }

  // ————— Pantalla de inicio de sesión —————
  if (!sesionLista) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Karla', sans-serif", color: C.muted }}>Cargando…</div>;
  }

  if (!sesion) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Karla', sans-serif", color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "32px 28px", maxWidth: 400, width: "100%", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative" }}>
          <button onClick={alternarTema} title="Cambiar tema"
            style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 10px", fontSize: 14, cursor: "pointer" }}>
            {tema === "oscuro" ? "☀️" : "🌙"}
          </button>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: 0, fontWeight: 700, color: C.ink, textAlign: "center" }}>
            DNY Party Decoration
          </h1>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: C.wineSoft, marginTop: 4, textAlign: "center", borderBottom: `2px solid ${C.wine}`, paddingBottom: 16 }}>Agenda de eventos</div>

          <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
            <div>
              <label style={s.label}>Correo</label>
              <input style={s.input} type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="username" />
            </div>
            <div>
              <label style={s.label}>Contraseña</label>
              <input style={s.input} type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="········" autoComplete="current-password"
                onKeyDown={(e) => { if (e.key === "Enter") iniciarSesion(); }} />
            </div>
            {loginError && <div style={{ color: C.danger, fontSize: 14, fontWeight: 600 }}>{loginError}</div>}
            <button style={{ ...s.btnPrim, opacity: entrando || !loginEmail || !loginPass ? 0.6 : 1 }} onClick={iniciarSesion} disabled={entrando || !loginEmail || !loginPass}>
              {entrando ? "Entrando…" : "Iniciar sesión"}
            </button>
            <p style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: 0 }}>Acceso solo para el equipo de DNY. Si necesitas una cuenta, pídesela al administrador.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Karla', sans-serif", color: C.ink }}>
      {/* ————— Hoja imprimible: eventos de la semana ————— */}
      <style>{`
        html, body { height: 100%; overflow: hidden; position: fixed; inset: 0; width: 100%; }
        #root { height: 100dvh; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; width: 100vw; }
        * { min-width: 0; }
        .solo-impresion { display: none; }
        @media print {
          body * { visibility: hidden; }
          .solo-impresion, .solo-impresion * { visibility: visible; }
          .solo-impresion { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 14mm; }
        }
      `}</style>
      <div className="solo-impresion" style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#000" }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>DNY Party Decoration</div>
          <div style={{ fontSize: 14 }}>Eventos de la semana · Del {diasSemana[0].getDate()} de {MESES[diasSemana[0].getMonth()]} al {diasSemana[6].getDate()} de {MESES[diasSemana[6].getMonth()]} de {diasSemana[6].getFullYear()}</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>Total: {totalSemana} {totalSemana === 1 ? "evento" : "eventos"} · Impreso el {new Date().getDate()} de {MESES[new Date().getMonth()]} de {new Date().getFullYear()}</div>
        </div>
        {diasSemana.map((d, i) => {
          const k = keyOf(d);
          const list = eventos[k] || [];
          return (
            <div key={k} style={{ borderBottom: "1px solid #999", padding: "8px 0", breakInside: "avoid" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {DIAS[i]} {d.getDate()} de {MESES[d.getMonth()]}
                {list.length === 0 ? <span style={{ fontWeight: 400 }}> — Libre</span> : <span style={{ fontWeight: 400 }}> — {list.length} {list.length === 1 ? "evento" : "eventos"}</span>}
              </div>
              {list.map((ev) => (
                <div key={ev.id} style={{ fontSize: 12, margin: "6px 0 6px 14px", lineHeight: 1.5 }}>
                  <div><strong>{ev.cliente}</strong>{ev.evento ? ` — ${ev.evento}` : ""} · {ev.tipo} · <strong>{ev.estado}</strong></div>
                  <div>
                    {ev.hora ? `Hora: ${fmt12(ev.hora)}` : "Hora: por definir"}
                    {ev.invitados ? ` · Invitados: ${ev.invitados}` : ""}
                    {ev.lugar ? ` · Lugar: ${ev.lugar}` : ""}
                  </div>
                  {ev.notas && <div>Notas: {ev.notas}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 64px" }}>

        {/* Cabecera */}
        <header style={{ marginBottom: 24, borderBottom: `2px solid ${C.wine}`, paddingBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 5vw, 40px)", margin: 0, fontWeight: 700, color: C.ink }}>
              DNY Party Decoration
            </h1>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: C.wineSoft, marginTop: 6 }}>Agenda de eventos</div>
            {guardando && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Guardando…</div>}
            {errorMsg && <div style={{ fontSize: 13, color: C.danger, marginTop: 6, fontWeight: 600 }}>{errorMsg}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{sesion.user?.email}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={alternarTema} title={tema === "oscuro" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                style={{ ...s.btnGhost, padding: "6px 12px", fontSize: 15 }}>
                {tema === "oscuro" ? "☀️" : "🌙"}
              </button>
              <button onClick={cerrarSesion} style={{ ...s.btnGhost, padding: "6px 14px", fontSize: 13 }}>Cerrar sesión</button>
            </div>
          </div>
        </header>

        {/* ————— Buscador de clientes ————— */}
        <section style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: 16, marginBottom: 24, boxShadow: "0 2px 10px rgba(92,31,46,0.06)" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 16 }}>🔍</span>
            <input
              style={{ ...s.input, paddingLeft: 38, paddingRight: busqueda ? 70 : 12 }}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente… (ej. María)"
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                Limpiar
              </button>
            )}
          </div>

          {busqueda.trim() && (
            <div style={{ marginTop: 12 }}>
              {resultados.length === 0 ? (
                <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>No se encontró ningún cliente con "{busqueda.trim()}".</p>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.gold, marginBottom: 8 }}>
                    {resultados.length} {resultados.length === 1 ? "resultado" : "resultados"}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {resultados.map(({ fecha, ev }) => (
                      <button key={ev.id + fecha} onClick={() => abrirResultado(fecha, ev)}
                        style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: C.cardSoft, border: `1px solid ${C.line}`, borderLeft: `4px solid ${ev.estado === "Confirmado" ? C.wine : C.gold}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                        <div>
                          <strong style={{ fontSize: 15, color: C.ink }}>{ev.cliente}</strong>
                          <div style={{ fontSize: 13, color: C.wineSoft }}>{ev.evento ? `${ev.evento} · ` : ""}{ev.tipo}{ev.hora ? ` · ${fmt12(ev.hora)}` : ""}{ev.lugar ? ` · ${ev.lugar}` : ""}</div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: C.wine }}>{fmtFecha(fecha)} {fecha.slice(0, 4)}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: ev.estado === "Confirmado" ? C.free : C.gold }}>{ev.estado}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
          <style>{`@media(min-width:760px){ .grid2 { display:grid; grid-template-columns: 1.2fr 1fr; gap:24px; } .grid2 section+section { margin-top:0 !important; } }`}</style>
          <div className="grid2">

            {/* ————— Calendario ————— */}
            <section style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: 18, boxShadow: "0 2px 10px rgba(92,31,46,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button onClick={() => cambiarMes(-1)} aria-label="Mes anterior" style={{ ...s.btnGhost, padding: "6px 14px", fontSize: 18 }}>‹</button>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>
                  {MESES[vista.getMonth()]} {vista.getFullYear()}
                </div>
                <button onClick={() => cambiarMes(1)} aria-label="Mes siguiente" style={{ ...s.btnGhost, padding: "6px 14px", fontSize: 18 }}>›</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                {DIAS.map((d) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 0" }}>{d}</div>
                ))}
                {celdas.map((f, i) => {
                  if (!f) return <div key={"x" + i} />;
                  const k = keyOf(f);
                  const n = (eventos[k] || []).length;
                  const esHoy = k === keyOf(hoy);
                  const sel = k === diaSel;
                  return (
                    <button
                      key={k}
                      onClick={() => { setDiaSel(k); setForm(null); setConfirmando(false); }}
                      style={{
                        aspectRatio: "1", border: sel ? `2px solid ${C.wine}` : `1px solid ${n ? C.goldSoft : C.line}`,
                        borderRadius: 10, background: n ? (n >= 2 ? C.wine : C.softGold) : C.card,
                        color: n >= 2 ? C.botonTexto : C.ink, cursor: "pointer", position: "relative",
                        fontFamily: "inherit", fontSize: 15, fontWeight: esHoy ? 700 : 500,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                      }}
                    >
                      <span style={{ textDecoration: esHoy ? "underline" : "none", textUnderlineOffset: 3 }}>{f.getDate()}</span>
                      {n > 0 && (
                        <span style={{ display: "flex", gap: 2 }}>
                          {Array.from({ length: Math.min(n, 3) }).map((_, j) => (
                            <span key={j} style={{ width: 5, height: 5, borderRadius: "50%", background: n >= 2 ? C.goldSoft : C.gold }} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 12, color: C.muted, flexWrap: "wrap" }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.softGold, border: `1px solid ${C.goldSoft}`, marginRight: 5, verticalAlign: "middle" }} />1 evento</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C.wine, marginRight: 5, verticalAlign: "middle" }} />2 o más</span>
              </div>
            </section>

            {/* ————— Panel del día ————— */}
            <section style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: 18, marginTop: 24, boxShadow: "0 2px 10px rgba(92,31,46,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>{fmtFecha(diaSel)}</h2>
                <span style={{ fontSize: 13, fontWeight: 700, color: ocupacion(evsDia.length).col }}>{ocupacion(evsDia.length).txt}</span>
              </div>

              {cargando ? (
                <p style={{ color: C.muted }}>Cargando…</p>
              ) : form ? (
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <label style={s.label}>Cliente *</label>
                    <input style={s.input} value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Nombre del cliente" />
                  </div>
                  <div>
                    <label style={s.label}>Evento</label>
                    <input style={s.input} value={form.evento || ""} onChange={(e) => setForm({ ...form, evento: e.target.value })} placeholder="Boda, Cumpleaños, Baby shower…" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={s.label}>Tipo</label>
                      <select style={s.input} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                        {TIPOS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Hora</label>
                      <input type="time" style={s.input} value={form.hora || ""} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Lugar</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input style={{ ...s.input, flex: 1 }} value={form.lugar || ""} onChange={(e) => setForm({ ...form, lugar: e.target.value })} placeholder="Salón, dirección…" />
                      {form.lugar && form.lugar.trim() && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.lugar.trim())}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ ...s.btnGhost, padding: "10px 16px", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontWeight: 700 }}>
                          📍 Ir
                        </a>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={s.label}>Invitados</label>
                      <input type="number" style={s.input} value={form.invitados || ""} onChange={(e) => setForm({ ...form, invitados: e.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <label style={s.label}>Estado</label>
                      <select style={s.input} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                        <option>Pendiente</option>
                        <option>Confirmado</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Notas</label>
                    <textarea style={{ ...s.input, minHeight: 60, resize: "vertical" }} value={form.notas || ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Menú, colores, detalles…" />
                  </div>
                  {form.id && (form.creado_por || form.modificado_por || form.created_at) && (
                    <div style={{ fontSize: 12, color: C.muted, background: C.cardSoft, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px" }}>
                      {(form.creado_por || form.created_at) && <div>Registrado{form.creado_por ? <> por <strong>{form.creado_por}</strong></> : ""}{form.created_at ? ` el ${fmtFechaHora(form.created_at)}` : ""}</div>}
                      {form.modificado_por && <div>Última modificación por <strong>{form.modificado_por}</strong>{form.modificado_en ? ` el ${fmtFechaHora(form.modificado_en)}` : ""}</div>}
                    </div>
                  )}
                  {form.id && !form.gcal_por && (
                    <a href={linkGoogleCalendar(diaSel, form)} target="_blank" rel="noopener noreferrer"
                      onClick={() => marcarGcal(form.id)}
                      style={{ ...s.btnGhost, textAlign: "center", textDecoration: "none", display: "block", borderColor: C.goldSoft, color: C.gold, fontWeight: 700 }}>
                      📅 Agregar a Google Calendar
                    </a>
                  )}
                  {form.id && form.gcal_por && (
                    <div style={{ background: C.okBg, border: `1px solid ${C.okBorder}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: C.ink }}>
                      <div style={{ color: C.free, fontWeight: 700, marginBottom: 4 }}>✓ Agregado a Google Calendar</div>
                      <div style={{ color: C.muted, fontSize: 12 }}>Por {form.gcal_por}{form.gcal_en ? ` el ${fmtFechaHora(form.gcal_en)}` : ""}</div>
                      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <a href={linkGoogleCalendar(diaSel, form)} target="_blank" rel="noopener noreferrer" style={{ color: C.wine, fontSize: 13, fontWeight: 600 }}>Volver a abrir</a>
                        <button onClick={() => desmarcarGcal(form.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>Desmarcar</button>
                      </div>
                    </div>
                  )}
                  {confirmando ? (
                    <div style={{ background: C.softGold, border: `1px solid ${C.goldSoft}`, borderLeft: `4px solid ${C.gold}`, borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, color: C.wine, fontSize: 15, marginBottom: 6 }}>
                        ⚠ Este día ya tiene {evsDia.length} {evsDia.length === 1 ? "evento registrado" : "eventos registrados"}
                      </div>
                      <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                        {evsDia.map((ev) => (
                          <div key={ev.id} style={{ fontSize: 14, color: C.ink }}>
                            • <strong>{ev.cliente}</strong> — {ev.evento ? `${ev.evento}, ` : ""}{ev.tipo}{ev.hora ? `, ${fmt12(ev.hora)}` : ""}{ev.lugar ? `, ${ev.lugar}` : ""} <span style={{ color: ev.estado === "Confirmado" ? C.free : C.gold, fontWeight: 700, fontSize: 12 }}>({ev.estado})</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 14, color: C.wineSoft, marginBottom: 12 }}>¿Seguro que quieres registrar también a <strong>{form.cliente}</strong> este día?</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button style={s.btnPrim} onClick={guardarEvento}>Sí, registrar de todas formas</button>
                        <button style={s.btnGhost} onClick={() => setConfirmando(false)}>No, volver</button>
                      </div>
                    </div>
                  ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={{ ...s.btnPrim, opacity: form.cliente.trim() ? 1 : 0.5 }} onClick={intentarGuardar} disabled={!form.cliente.trim()}>
                      {form.id ? "Guardar cambios" : "Registrar evento"}
                    </button>
                    <button style={s.btnGhost} onClick={() => { setForm(null); setConfirmando(false); }}>Cancelar</button>
                    {form.id && (
                      <button style={{ ...s.btnGhost, color: C.danger, borderColor: C.dangerBorder, marginLeft: "auto" }} onClick={() => setConfirmandoEliminar(true)}>Eliminar</button>
                    )}
                  </div>
                  )}
                  {confirmandoEliminar && form.id && (
                    <div style={{ background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, borderLeft: `4px solid ${C.danger}`, borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, color: C.danger, fontSize: 15, marginBottom: 6 }}>
                        ⚠ ¿Eliminar este evento?
                      </div>
                      <div style={{ fontSize: 14, color: C.ink, marginBottom: 12 }}>
                        Se borrará <strong>{form.cliente}</strong>{form.evento ? ` — ${form.evento}` : ""} del {fmtFecha(diaSel)}. Esta acción no se puede deshacer.
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button style={{ ...s.btnPrim, background: C.danger }} onClick={() => { setConfirmandoEliminar(false); eliminarEvento(form.id); }}>Sí, eliminar</button>
                        <button style={s.btnGhost} onClick={() => setConfirmandoEliminar(false)}>No, conservar</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {gcalSugerido && gcalSugerido.fecha === diaSel && (
                    <div style={{ background: C.okBg, border: `1px solid ${C.okBorder}`, borderLeft: `4px solid ${C.free}`, borderRadius: 10, padding: "12px 14px", margin: "14px 0 0" }}>
                      <div style={{ fontWeight: 700, color: C.free, fontSize: 14, marginBottom: 8 }}>✓ Evento registrado</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <a href={linkGoogleCalendar(gcalSugerido.fecha, gcalSugerido.ev)} target="_blank" rel="noopener noreferrer"
                          onClick={() => { if (gcalSugerido.ev.id) marcarGcal(gcalSugerido.ev.id); setGcalSugerido(null); }}
                          style={{ ...s.btnPrim, textDecoration: "none", background: C.free, padding: "8px 14px", fontSize: 14 }}>
                          📅 Agregar a Google Calendar
                        </a>
                        <button onClick={() => setGcalSugerido(null)} style={{ ...s.btnGhost, padding: "8px 14px", fontSize: 14 }}>Omitir</button>
                      </div>
                    </div>
                  )}
                  {evsDia.length === 0 ? (
                    <p style={{ color: C.muted, margin: "14px 0" }}>No hay eventos registrados este día. Puedes tomar nuevos compromisos.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 10, margin: "14px 0" }}>
                      {evsDia.map((ev) => (
                        <button key={ev.id} onClick={() => abrirEditar(ev)} style={{ textAlign: "left", background: C.cardSoft, border: `1px solid ${C.line}`, borderLeft: `4px solid ${ev.estado === "Confirmado" ? C.wine : C.gold}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 15, color: C.ink }}>{ev.cliente}</strong>
                            <span style={{ fontSize: 13, color: C.muted }}>{ev.hora ? fmt12(ev.hora) : "sin hora"}</span>
                          </div>
                          <div style={{ fontSize: 13, color: C.wineSoft, marginTop: 2 }}>{ev.evento ? `${ev.evento} · ` : ""}{ev.tipo}{ev.invitados ? ` · ${ev.invitados} invitados` : ""}</div>
                          {ev.lugar && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{ev.lugar}</div>}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: ev.estado === "Confirmado" ? C.free : C.gold }}>{ev.estado}{ev.gcal_por ? " · 📅✓" : ""}</span>
                            {ev.creado_por && <span style={{ fontSize: 11, color: C.muted }}>Registrado por {ev.creado_por}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button style={{ ...s.btnPrim, width: "100%" }} onClick={abrirNuevo}>+ Registrar evento este día</button>
                </>
              )}
            </section>
          </div>

          {/* ————— Vista semanal ————— */}
          <section style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: 18, boxShadow: "0 2px 10px rgba(92,31,46,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Mi semana</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => window.print()} style={{ ...s.btnGhost, padding: "4px 12px", fontSize: 13, fontWeight: 700 }}>🖨 Imprimir</button>
                <button onClick={() => setSemanaOffset(semanaOffset - 1)} aria-label="Semana anterior" style={{ ...s.btnGhost, padding: "4px 12px", fontSize: 16 }}>‹</button>
                {semanaOffset !== 0 && (
                  <button onClick={() => setSemanaOffset(0)} style={{ ...s.btnGhost, padding: "4px 12px", fontSize: 13 }}>Hoy</button>
                )}
                <button onClick={() => setSemanaOffset(semanaOffset + 1)} aria-label="Semana siguiente" style={{ ...s.btnGhost, padding: "4px 12px", fontSize: 16 }}>›</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
              Del {diasSemana[0].getDate()} de {MESES[diasSemana[0].getMonth()]} al {diasSemana[6].getDate()} de {MESES[diasSemana[6].getMonth()]}
              {" · "}
              <strong style={{ color: totalSemana ? C.wine : C.free }}>{totalSemana === 0 ? "semana libre" : `${totalSemana} ${totalSemana === 1 ? "evento" : "eventos"}`}</strong>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              {diasSemana.map((d, i) => {
                const k = keyOf(d);
                const list = eventos[k] || [];
                const esHoy = k === keyOf(new Date());
                return (
                  <button key={k} onClick={() => irADia(k)}
                    style={{
                      display: "flex", gap: 14, alignItems: "flex-start", textAlign: "left",
                      background: esHoy ? C.softGold : "transparent",
                      border: "none", borderBottom: i < 6 ? `1px solid ${C.line}` : "none",
                      borderRadius: esHoy ? 10 : 0, padding: "10px 8px", cursor: "pointer", fontFamily: "inherit",
                    }}>
                    <div style={{ minWidth: 52, textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: esHoy ? C.wine : C.muted }}>{DIAS[i]}</div>
                      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: list.length ? C.wine : C.ink }}>{d.getDate()}</div>
                    </div>
                    <div style={{ flex: 1, paddingTop: 2 }}>
                      {list.length === 0 ? (
                        <span style={{ fontSize: 13, color: C.free }}>Libre</span>
                      ) : (
                        <div style={{ display: "grid", gap: 4 }}>
                          {list.map((ev) => (
                            <div key={ev.id} style={{ fontSize: 14, color: C.ink }}>
                              <strong>{ev.cliente}</strong>
                              <span style={{ color: C.muted }}>{ev.evento ? ` · ${ev.evento}` : ""}{ev.hora ? ` · ${fmt12(ev.hora)}` : ""} · {ev.tipo}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: ev.estado === "Confirmado" ? C.free : C.gold }}> {ev.estado}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ————— Próximos eventos ————— */}
          <section style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.line}`, padding: 18 }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: "0 0 12px" }}>Próximos eventos</h2>
            {proximos.length === 0 ? (
              <p style={{ color: C.muted, margin: 0 }}>Sin eventos próximos registrados.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {proximos.map(([k, list]) => (
                  <button key={k} onClick={() => { irADia(k); const r = document.getElementById("root"); if (r) r.scrollTo({ top: 0, behavior: "smooth" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`, padding: "10px 2px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{fmtFecha(k)}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>{list.map((e) => e.cliente).join(" · ")}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: list.length >= 2 ? C.wine : C.gold, whiteSpace: "nowrap" }}>{list.length} {list.length === 1 ? "evento" : "eventos"}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
