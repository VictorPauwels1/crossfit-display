import { useState }      from "react";
import { useSocket }     from "../shared/useSocket";
import { C }             from "../shared/colors";
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

function localWeekRange() {
  const d   = new Date();
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const mon = new Date(d); mon.setDate(d.getDate() - dow);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  return [fmt(mon), fmt(sun)];
}

// ─── Design tokens responsifs ─────────────────────────────────────────────────
const R = {
  pad:      "clamp(12px, 4vw, 24px)",
  padSm:    "clamp(8px,  3vw, 16px)",
  fs:       { // font-sizes
    xs:     "clamp(0.65rem, 2vw,  0.75rem)",
    sm:     "clamp(0.75rem, 2.5vw,0.9rem)",
    md:     "clamp(0.9rem,  3vw,  1.05rem)",
    lg:     "clamp(1rem,    3.5vw,1.3rem)",
    xl:     "clamp(1.2rem,  4vw,  1.6rem)",
    timer:  "clamp(2.2rem,  9vw,  4rem)",
  },
  btn:      { minHeight: "clamp(44px, 12vw, 56px)" },
  radius:   8,
  gap:      "clamp(8px, 3vw, 14px)",
};

// ─── Composants UI ───────────────────────────────────────────────────────────
function Btn({ children, onPress, color = C.green, disabled, small }) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      style={{
        background:    disabled ? "none" : color + "18",
        border:        `2px solid ${disabled ? C.border : color}`,
        color:         disabled ? C.muted : color,
        fontFamily:    F.bebas,
        fontSize:      small ? R.fs.sm : R.fs.md,
        letterSpacing: 3,
        padding:       "0 8px",
        minHeight:     R.btn.minHeight,
        borderRadius:  R.radius,
        cursor:        disabled ? "default" : "pointer",
        width:         "100%",
        display:       "flex",
        alignItems:    "center",
        justifyContent:"center",
      }}
    >{children}</button>
  );
}

function Input({ value, onChange, type = "text", placeholder, style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        background:   "#1A1A1A",
        border:       `1px solid ${C.border}`,
        borderRadius: R.radius,
        color:        C.white,
        padding:      R.padSm,
        fontFamily:   F.sans,
        fontSize:     R.fs.md,
        width:        "100%",
        minHeight:    "clamp(40px, 10vw, 50px)",
        boxSizing:    "border-box",
        ...style,
      }}
    />
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      border:       `1px solid ${C.border}`,
      borderRadius: R.radius,
      padding:      R.pad,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Label({ children, style = {} }) {
  return (
    <div style={{
      color:         C.muted,
      fontFamily:    F.sans,
      fontSize:      R.fs.xs,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom:  4,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Écran sélection ─────────────────────────────────────────────────────────
function SelectScreen({ onSelect }) {
  const [wods,    setWods]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [range,   setRange]   = useState(localWeekRange());

  async function load() {
    setLoading(true); setError(null);
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
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  return (
    <div style={{ padding: R.pad, display: "flex", flexDirection: "column", gap: R.gap }}>
      <div style={{ color: C.green, fontFamily: F.bebas, fontSize: R.fs.xl, letterSpacing: 6 }}>
        SÉLECTIONNER UN WOD
      </div>

      {/* Plage de dates */}
      <div style={{ display: "flex", gap: R.gap, alignItems: "center" }}>
        <Input type="date" value={range[0]} onChange={(e) => setRange([e.target.value, range[1]])} style={{ flex: 1 }} />
        <span style={{ color: C.muted, flexShrink: 0 }}>→</span>
        <Input type="date" value={range[1]} onChange={(e) => setRange([range[0], e.target.value])} style={{ flex: 1 }} />
      </div>

      <Btn onPress={load} disabled={loading}>{loading ? "CHARGEMENT..." : "CHERCHER"}</Btn>

      {error && <div style={{ color: C.red, fontFamily: F.sans, fontSize: R.fs.xs }}>{error}</div>}

      {!loading && wods.length === 0 && (
        <div style={{ color: C.muted, fontFamily: F.sans, fontSize: R.fs.sm, textAlign: "center", padding: "16px 0" }}>
          Aucun WOD trouvé sur cette période
        </div>
      )}

      {wods.map((w) => {
        const sections = w.sections || [];
        return (
          <button key={w.date} onClick={() => onSelect(w)} style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: R.radius,
            padding: R.pad, cursor: "pointer", textAlign: "left", width: "100%",
          }}>
            <div style={{ color: C.green, fontFamily: F.bebas, fontSize: R.fs.xs, letterSpacing: 4 }}>{w.date}</div>
            <div style={{ color: C.white, fontFamily: F.bebas, fontSize: R.fs.lg, letterSpacing: 2, margin: "4px 0" }}>
              {w.title || "WOD"}
            </div>
            {w.coach && (
              <div style={{ color: C.muted, fontFamily: F.sans, fontSize: R.fs.xs }}>Coach : {w.coach}</div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {sections.map((s) => (
                <div key={s.id} style={{
                  border: `1px solid ${C.border}`, borderRadius: 4,
                  padding: "3px 8px", color: C.muted, fontFamily: F.bebas,
                  fontSize: R.fs.xs, letterSpacing: 2,
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

// ─── StaggerSelector ─────────────────────────────────────────────────────────
function StaggerSelector({ section, state, send }) {
  const exercises   = section.exercises || [];
  const current     = state.exerciseIndex ?? 0;
  const pending     = state.pendingExerciseIndex ?? null;
  const isRunning   = state.timer?.status === "running";
  const intervalSec = state.timer?.intervalSecs || 60;

  if (exercises.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: R.gap }}>
      <Label>Groupes</Label>
      {exercises.map((ex, i) => {
        const isCurrent = i === current;
        const isPending = i === pending;
        const color     = isCurrent ? C.green : isPending ? C.orange : C.border;

        return (
          <div key={ex.id} style={{
            border:      `2px solid ${color}`,
            borderRadius: R.radius,
            padding:     R.padSm,
            background:  isCurrent ? C.green + "12" : isPending ? C.orange + "10" : "none",
            display:     "flex", alignItems: "center", gap: 12,
          }}>
            {/* Badge */}
            <div style={{
              width: "clamp(32px,8vw,40px)", height: "clamp(32px,8vw,40px)",
              borderRadius: "50%", flexShrink: 0,
              background: isCurrent ? C.green : isPending ? C.orange : C.border,
              color:      isCurrent || isPending ? "#000" : C.muted,
              display:    "flex", alignItems: "center", justifyContent: "center",
              fontFamily: F.bebas, fontSize: R.fs.md,
            }}>
              {i + 1}
            </div>

            {/* Nom */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: isCurrent ? C.green : isPending ? C.orange : C.white, fontFamily: F.bebas, fontSize: R.fs.md, letterSpacing: 2 }}>
                {ex.name || `Exercice ${i + 1}`}
              </div>
              {(ex.reps || ex.weight) && (
                <div style={{ color: C.muted, fontFamily: F.sans, fontSize: R.fs.xs, marginTop: 2 }}>
                  {[ex.reps, ex.weight].filter(Boolean).join(" · ")}
                </div>
              )}
              {isPending && (
                <div style={{ color: C.orange, fontFamily: F.sans, fontSize: R.fs.xs, marginTop: 2 }}>
                  → à la prochaine minute
                </div>
              )}
            </div>

            {/* Actions */}
            {!isCurrent && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => send({ type: "SET_EXERCISE", index: i })}
                  style={{
                    background: C.green + "22", border: `1px solid ${C.green}`,
                    color: C.green, fontFamily: F.bebas, fontSize: R.fs.xs,
                    letterSpacing: 2, padding: "6px 10px", borderRadius: 5,
                    cursor: "pointer", whiteSpace: "nowrap",
                    minHeight: "clamp(32px,8vw,38px)",
                  }}
                >MAINTENANT</button>
                {isRunning && (
                  <button
                    onClick={() => send({ type: "QUEUE_EXERCISE", index: isPending ? null : i })}
                    style={{
                      background: isPending ? C.orange + "30" : C.orange + "15",
                      border: `1px solid ${C.orange}`,
                      color: C.orange, fontFamily: F.bebas, fontSize: R.fs.xs,
                      letterSpacing: 2, padding: "6px 10px", borderRadius: 5,
                      cursor: "pointer", whiteSpace: "nowrap",
                      minHeight: "clamp(32px,8vw,38px)",
                    }}
                  >
                    {isPending ? "ANNULER" : `+${fmtTime(intervalSec)}`}
                  </button>
                )}
              </div>
            )}
          </div>
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
  const isStaggered = ["emom", "each_nmin"].includes(format);
  const sectionLabel = section ? (section.customName || PRESET_LABELS[section.preset] || section.preset) : "";

  return (
    <div style={{ padding: R.pad, display: "flex", flexDirection: "column", gap: R.gap, paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>

      {/* WOD sélectionné */}
      <Card>
        <Label>WOD SÉLECTIONNÉ</Label>
        <div style={{ color: C.green, fontFamily: F.bebas, fontSize: R.fs.lg, letterSpacing: 3, marginTop: 2 }}>
          {wod?.date} — {wod?.title || "WOD"}
        </div>
        {wod?.coach && (
          <div style={{ color: C.muted, fontFamily: F.sans, fontSize: R.fs.xs, marginTop: 2 }}>Coach : {wod.coach}</div>
        )}
      </Card>

      {/* Écran courant */}
      <div style={{ color: C.white, fontFamily: F.bebas, fontSize: R.fs.lg, letterSpacing: 4, textAlign: "center" }}>
        {screen === "recap"    && "VUE RÉCAP"}
        {screen === "section"  && `${sectionLabel}${format && format !== "notimed" ? ` · ${FORMAT_LABELS[format]}` : ""}`}
        {screen === "finished" && "TERMINÉ"}
      </div>

      {/* Progression sections */}
      {sections.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          {sections.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 5, borderRadius: 3,
              background: i <= sectionIndex && screen !== "recap" ? C.green : C.border,
              opacity:    screen === "recap" ? 0.3 : i === sectionIndex ? 1 : i < sectionIndex ? 0.5 : 0.2,
            }} />
          ))}
        </div>
      )}

      {/* Timer */}
      {screen === "section" && hasTimer && timer && timer.status !== "idle" && (
        <div style={{ textAlign: "center", padding: "4px 0" }}>
          <div style={{ color: accentColor, fontFamily: F.bebas, fontSize: R.fs.timer, letterSpacing: 4, lineHeight: 1 }}>
            {timer.status === "delay"
              ? fmtTime(timer.delayRemaining)
              : (isForTime && timer.totalDuration === 0)
                ? fmtTime(timer.elapsed)
                : fmtTime(timer.remaining)}
          </div>
          <div style={{ color: C.muted, fontFamily: F.sans, fontSize: R.fs.xs, marginTop: 4 }}>
            {timer.status === "delay"   ? "DÉPART DANS..."
              : timer.status === "paused"  ? "EN PAUSE"
              : timer.status === "finished"? "TERMINÉ"
              : "EN COURS"}
          </div>
        </div>
      )}

      {/* Stagger selector */}
      {screen === "section" && isStaggered && (
        <StaggerSelector section={section} state={state} send={send} />
      )}

      {/* Navigation sections */}
      {(screen === "recap" || screen === "section") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: R.gap }}>
          <Btn onPress={() => send({ type: "PREV_SECTION" })} color={C.muted} disabled={screen === "recap"}>
            ← RETOUR
          </Btn>
          <Btn onPress={() => send({ type: screen === "recap" ? "START_SECTION" : "NEXT_SECTION" })}>
            {screen === "recap" ? "DÉMARRER →" : sectionIndex >= sections.length - 1 ? "TERMINER →" : "SUIVANT →"}
          </Btn>
        </div>
      )}

      {/* Timer controls */}
      {screen === "section" && hasTimer && (
        <>
          {timerIdle && (
            <div style={{ display: "flex", gap: R.gap }}>
              <Input
                type="number"
                placeholder="Délai départ (sec)"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => send({ type: "START_TIMER", delaySeconds: parseInt(delay) || 0 })}
                style={{
                  background:   C.green + "22",
                  border:       `2px solid ${C.green}`,
                  color:        C.green,
                  fontFamily:   F.bebas,
                  fontSize:     R.fs.lg,
                  letterSpacing: 3,
                  padding:      "0 clamp(14px, 5vw, 24px)",
                  borderRadius: R.radius,
                  cursor:       "pointer",
                  minHeight:    R.btn.minHeight,
                  flexShrink:   0,
                }}
              >GO</button>
            </div>
          )}

          {timerActive && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: R.gap }}>
              <Btn onPress={() => send({ type: "PAUSE_TIMER" })} color={C.orange}>
                {timer?.status === "paused" ? "▶ REPRENDRE" : "⏸ PAUSE"}
              </Btn>
              <Btn onPress={() => send({ type: "RESET_TIMER" })} color={C.red}>↺ RESET</Btn>
            </div>
          )}
        </>
      )}

      {/* Reset complet */}
      <div style={{ marginTop: 4 }}>
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
    <div style={{
      background: C.bg,
      minHeight:  "100dvh",
      color:      C.white,
      // Centre le contenu sur tablette/desktop, reste full width sur mobile
      maxWidth:   520,
      margin:     "0 auto",
    }}>
      {/* Barre connexion — sticky */}
      <div style={{
        position:     "sticky", top: 0, zIndex: 10,
        padding:      `clamp(6px,2vw,10px) ${R.pad}`,
        background:   connected ? C.green + "18" : C.red + "18",
        borderBottom: `1px solid ${connected ? C.green : C.red}`,
        display:      "flex", alignItems: "center", gap: 8,
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? C.green : C.red, flexShrink: 0 }} />
        <span style={{ color: connected ? C.green : C.red, fontFamily: F.sans, fontSize: R.fs.xs }}>
          {connected ? "Connecté à l'écran" : "Reconnexion..."}
        </span>
      </div>

      {(!state || state.screen === "idle") && <SelectScreen onSelect={selectWod} />}
      {state && state.screen !== "idle"   && <ControlScreen state={state} send={send} />}
    </div>
  );
}
