import { useState }     from "react";
import { useSocket }    from "../shared/useSocket";
import { C }            from "../shared/colors";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, query,
  where, orderBy, getDocs,
} from "firebase/firestore";

// ─── Firebase ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAguihb683SD38zV-FjctQ8RqjHA0iK21w",
  authDomain:        "wod-crossfit-598e2.firebaseapp.com",
  projectId:         "wod-crossfit-598e2",
  storageBucket:     "wod-crossfit-598e2.firebasestorage.app",
  messagingSenderId: "56789658332",
  appId:             "1:56789658332:web:71e2cc99c08ba3e0f32219",
};
const fbApp = initializeApp(firebaseConfig, "remote");
const db    = getFirestore(fbApp);

const F = { bebas: '"Bebas Neue", sans-serif', sans: "sans-serif" };

const PRESET_LABELS = { warmup: "WARMUP", force: "FORCE", skills: "SKILLS", wod: "WOD" };
const FORMAT_LABELS = {
  amrap: "AMRAP", fortime: "FOR TIME", emom: "EMOM", each_nmin: "EVERY N MIN", notimed: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n) { return String(Math.floor(Math.abs(n))).padStart(2, "0"); }
function fmtTime(s) { s = Math.max(0, s); return `${pad(s / 60)}:${pad(s % 60)}`; }

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function localWeekRange() {
  const d   = new Date();
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const mon = new Date(d); mon.setDate(d.getDate() - dow);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  return [fmt(mon), fmt(sun)];
}

// ─── Composants UI ───────────────────────────────────────────────────────────
function Btn({ children, onPress, color = C.green, disabled, wide = true, small }) {
  return (
    <button onClick={onPress} disabled={disabled} style={{
      background:    disabled ? "none" : color + "18",
      border:        `2px solid ${disabled ? C.border : color}`,
      color:         disabled ? C.muted : color,
      fontFamily:    F.bebas,
      fontSize:      small ? "0.85rem" : "1rem",
      letterSpacing: 3,
      padding:       small ? "8px 0" : "13px 0",
      borderRadius:  8,
      cursor:        disabled ? "default" : "pointer",
      width:         wide ? "100%" : "auto",
      minWidth:      wide ? undefined : 80,
    }}>{children}</button>
  );
}

function inputStyle(extra = {}) {
  return {
    background: "#1A1A1A", border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.white, padding: "10px 14px", fontFamily: F.sans, fontSize: "0.9rem",
    width: "100%", ...extra,
  };
}

// ─── Écran sélection ─────────────────────────────────────────────────────────
function SelectScreen({ onSelect }) {
  const [wods,    setWods]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [range,   setRange]   = useState(localWeekRange());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      let docs;
      try {
        const q    = query(collection(db, "wods"), where("date", ">=", range[0]), where("date", "<=", range[1]), orderBy("date", "asc"));
        const snap = await getDocs(q);
        docs = snap.docs.map((d) => d.data());
      } catch {
        const q2   = query(collection(db, "wods"), where("date", ">=", range[0]), where("date", "<=", range[1]));
        const snap = await getDocs(q2);
        docs = snap.docs.map((d) => d.data()).sort((a, b) => a.date.localeCompare(b.date));
      }
      setWods(docs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ color: C.green, fontFamily: F.bebas, fontSize: "1.5rem", letterSpacing: 6 }}>
        SÉLECTIONNER UN WOD
      </div>

      {/* Plage de dates */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="date" value={range[0]} onChange={(e) => setRange([e.target.value, range[1]])} style={inputStyle({ flex: 1 })} />
        <span style={{ color: C.muted }}>→</span>
        <input type="date" value={range[1]} onChange={(e) => setRange([range[0], e.target.value])} style={inputStyle({ flex: 1 })} />
      </div>
      <Btn onPress={load} disabled={loading}>{loading ? "CHARGEMENT..." : "CHERCHER"}</Btn>

      {error && <div style={{ color: C.red, fontFamily: F.sans, fontSize: "0.8rem" }}>{error}</div>}

      {!loading && wods.length === 0 && (
        <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "0.85rem", textAlign: "center" }}>
          Aucun WOD trouvé sur cette période
        </div>
      )}

      {wods.map((w) => {
        const sections = w.sections || [];
        return (
          <button key={w.date} onClick={() => onSelect(w)} style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "14px 16px", cursor: "pointer", textAlign: "left",
          }}>
            <div style={{ color: C.green, fontFamily: F.bebas, fontSize: "0.85rem", letterSpacing: 4 }}>{w.date}</div>
            <div style={{ color: C.white, fontFamily: F.bebas, fontSize: "1.2rem", letterSpacing: 2, margin: "2px 0" }}>
              {w.title || "WOD"}
            </div>
            {w.coach && (
              <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "0.75rem" }}>Coach : {w.coach}</div>
            )}
            {/* Résumé des sections */}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {sections.map((s) => (
                <div key={s.id} style={{
                  border: `1px solid ${C.border}`, borderRadius: 4,
                  padding: "2px 8px", color: C.muted, fontFamily: F.bebas,
                  fontSize: "0.75rem", letterSpacing: 2,
                }}>
                  {s.customName || PRESET_LABELS[s.preset] || s.preset}
                  {s.format && s.format !== "notimed" ? ` · ${FORMAT_LABELS[s.format]}` : ""}
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Écran contrôle ───────────────────────────────────────────────────────────
function ControlScreen({ state, send }) {
  const [delay, setDelay] = useState("");
  const { screen, wod, sectionIndex, timer } = state;
  const sections    = wod?.sections || [];
  const section     = sections[sectionIndex];
  const format      = section?.format;
  const hasTimer    = format !== "notimed" || Boolean(section?.duration);
  const timerIdle   = !timer || timer.status === "idle" || timer.status === "finished";
  const timerActive = timer?.status === "running" || timer?.status === "paused" || timer?.status === "delay";
  const accentColor = timer?.status === "delay" ? C.orange : C.green;
  const isForTime   = format === "fortime";

  const sectionLabel = section ? (section.customName || PRESET_LABELS[section.preset] || section.preset) : "";

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, paddingBottom: 40 }}>

      {/* WOD sélectionné */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
        <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "0.7rem", letterSpacing: 2 }}>WOD SÉLECTIONNÉ</div>
        <div style={{ color: C.green, fontFamily: F.bebas, fontSize: "1rem", letterSpacing: 3, marginTop: 2 }}>
          {wod?.date} — {wod?.title || "WOD"}
        </div>
        {wod?.coach && (
          <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "0.75rem" }}>Coach : {wod.coach}</div>
        )}
      </div>

      {/* Écran courant */}
      <div style={{ color: C.white, fontFamily: F.bebas, fontSize: "1.1rem", letterSpacing: 4, textAlign: "center" }}>
        {screen === "recap"    && "VUE RÉCAP"}
        {screen === "section"  && `${sectionLabel}${format && format !== "notimed" ? ` · ${FORMAT_LABELS[format]}` : ""}`}
        {screen === "finished" && "TERMINÉ"}
      </div>

      {/* Progression sections */}
      {sections.length > 0 && screen !== "idle" && (
        <div style={{ display: "flex", gap: 6 }}>
          {sections.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: screen === "recap"
                ? C.border
                : i < sectionIndex ? C.green
                : i === sectionIndex ? C.green
                : C.border,
              opacity: screen === "recap" ? 0.4 : i === sectionIndex ? 1 : i < sectionIndex ? 0.5 : 0.2,
            }} />
          ))}
        </div>
      )}

      {/* Timer affiché */}
      {screen === "section" && hasTimer && timer && timer.status !== "idle" && (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ color: accentColor, fontFamily: F.bebas, fontSize: "3rem", letterSpacing: 4 }}>
            {timer.status === "delay"
            ? fmtTime(timer.delayRemaining)
            : (isForTime && timer.totalDuration === 0)
              ? fmtTime(timer.elapsed)
              : fmtTime(timer.remaining)}
          </div>
          <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "0.75rem" }}>
            {timer.status === "delay" ? "DÉPART DANS..."
              : timer.status === "paused" ? "EN PAUSE"
              : timer.status === "finished" ? "TERMINÉ"
              : "EN COURS"}
          </div>
        </div>
      )}

      {/* Navigation sections */}
      {(screen === "recap" || screen === "section") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Btn
            onPress={() => send({ type: "PREV_SECTION" })}
            color={C.muted}
            disabled={screen === "recap"}
          >← RETOUR</Btn>
          <Btn onPress={() => send({ type: screen === "recap" ? "START_SECTION" : "NEXT_SECTION" })}>
            {screen === "recap" ? "DÉMARRER →" : sectionIndex >= sections.length - 1 ? "TERMINER →" : "SUIVANT →"}
          </Btn>
        </div>
      )}

      {/* Timer controls */}
      {screen === "section" && hasTimer && (
        <>
          {timerIdle && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                min="0"
                placeholder="Délai départ (sec)"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                style={{ ...inputStyle(), flex: 1 }}
              />
              <button
                onClick={() => send({ type: "START_TIMER", delaySeconds: parseInt(delay) || 0 })}
                style={{
                  background: C.green + "22", border: `2px solid ${C.green}`,
                  color: C.green, fontFamily: F.bebas, fontSize: "1.1rem",
                  letterSpacing: 3, padding: "0 20px", borderRadius: 8, cursor: "pointer",
                }}
              >GO</button>
            </div>
          )}

          {timerActive && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Btn onPress={() => send({ type: "PAUSE_TIMER" })} color={C.orange}>
                {timer?.status === "paused" ? "▶ REPRENDRE" : "⏸ PAUSE"}
              </Btn>
              <Btn onPress={() => send({ type: "RESET_TIMER" })} color={C.red}>↺ RESET</Btn>
            </div>
          )}
        </>
      )}

      {/* Reset complet */}
      <div style={{ marginTop: 8 }}>
        <Btn onPress={() => send({ type: "RESET" })} color={C.red}>✕ CHANGER DE WOD</Btn>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { state, connected, send } = useSocket();

  function selectWod(wod) {
    send({ type: "SELECT_WOD", wod });
    send({ type: "LAUNCH" });
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.white }}>
      {/* Barre connexion */}
      <div style={{
        padding: "8px 20px",
        background: connected ? C.green + "18" : C.red + "18",
        borderBottom: `1px solid ${connected ? C.green : C.red}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? C.green : C.red }} />
        <span style={{ color: connected ? C.green : C.red, fontFamily: F.sans, fontSize: "0.8rem" }}>
          {connected ? "Connecté à l'écran" : "Reconnexion..."}
        </span>
      </div>

      {(!state || state.screen === "idle") && <SelectScreen onSelect={selectWod} />}
      {state && state.screen !== "idle"   && <ControlScreen state={state} send={send} />}
    </div>
  );
}
