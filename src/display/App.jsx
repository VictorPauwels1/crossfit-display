import { useSocket }         from "../shared/useSocket";
import { C }                  from "../shared/colors";
import { useEffect, useState } from "react";

const F = { bebas: '"Bebas Neue", sans-serif', sans: "sans-serif" };

const PRESET_LABELS = {
  warmup: "WARMUP",
  force:  "FORCE",
  skills: "SKILLS",
  wod:    "WOD",
};
const FORMAT_LABELS = {
  amrap:     "AMRAP",
  fortime:   "FOR TIME",
  emom:      "EMOM",
  each_nmin: "EVERY N MIN",
  notimed:   "",
};

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function pad(n) { return String(Math.floor(Math.abs(n))).padStart(2, "0"); }
function fmtTime(secs) {
  const s = Math.max(0, secs);
  return `${pad(s / 60)}:${pad(s % 60)}`;
}

// ─── Logo coin (tous les écrans sauf idle) ────────────────────────────────────
function LogoCorner() {
  return (
    <img
      src="/logo.svg"
      alt="CrossFit Soignies"
      style={{
        position: "fixed", bottom: "2vw", right: "2vw",
        width: "8vw", opacity: 0.18, pointerEvents: "none",
        filter: "invert(1)",
      }}
    />
  );
}

// ─── Écran IDLE ───────────────────────────────────────────────────────────────
function Idle() {
  return (
    <>
      <style>{`
        @keyframes cf-pulse {
          0%   { opacity: 0.15; }
          50%  { opacity: 1;    }
          100% { opacity: 0.15; }
        }
      `}</style>
      <Center>
        {/* Logo en arrière-plan — vert kawasaki, fixe */}
        <img
          src="/logo.svg"
          alt="CrossFit Soignies"
          style={{
            position:      "fixed", inset: 0, margin: "auto",
            width:         "60vw", opacity: 0.20,
            pointerEvents: "none",
            filter:        "brightness(0) saturate(100%) invert(55%) sepia(100%) saturate(3000%) hue-rotate(75deg) brightness(1.4)",
          }}
        />
        {/* Texte blanc en fade continu */}
        <div style={{
          color:         "#FFFFFF",
          fontFamily:    F.bebas,
          fontSize:      "2.8vw",
          letterSpacing: 10,
          position:      "relative",
          animation:     "cf-pulse 3s ease-in-out infinite",
        }}>
          EN ATTENTE DU WOD
        </div>
      </Center>
    </>
  );
}

// ─── Écran RÉCAP ─────────────────────────────────────────────────────────────
function Recap({ wod }) {
  const sections = wod.sections || [];
  const cols     = sections.length <= 2 ? sections.length : 2;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "2.5vw" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2vw" }}>
        <div style={{ color: C.green, fontFamily: F.bebas, fontSize: "3.5vw", letterSpacing: 6 }}>
          {wod.title || "WOD DU JOUR"}
        </div>
        <div style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.8vw", letterSpacing: 4 }}>
          {wod.date}{wod.coach ? ` · ${wod.coach}` : ""}
        </div>
      </div>

      {/* Sections */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "1.5vw",
      }}>
        {sections.map((s) => <SectionCard key={s.id} section={s} />)}
      </div>
    </div>
  );
}

function SectionCard({ section }) {
  const label  = section.customName || PRESET_LABELS[section.preset] || section.preset;
  const format = FORMAT_LABELS[section.format];

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "1.5vw", overflow: "hidden" }}>
      {/* Titre section */}
      <div style={{ display: "flex", gap: "1vw", alignItems: "baseline", marginBottom: "1vw" }}>
        <div style={{ color: C.green, fontFamily: F.bebas, fontSize: "2vw", letterSpacing: 5 }}>{label}</div>
        {format && <div style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.4vw", letterSpacing: 3 }}>{format}</div>}
        {section.duration && <Tag>{section.duration} min</Tag>}
        {section.rounds   && <Tag>{section.rounds} rounds</Tag>}
        {section.timecap  && <Tag>Timecap {section.timecap} min</Tag>}
      </div>

      {/* Exercices */}
      {section.exercises?.map((ex) => (
        <div key={ex.id} style={{ display: "flex", gap: "0.8vw", marginBottom: "0.5vw", alignItems: "baseline" }}>
          <div style={{ color: C.white, fontFamily: F.bebas, fontSize: "1.5vw", flex: 1 }}>{ex.name}</div>
          {ex.reps   && <div style={{ color: C.green, fontFamily: F.bebas, fontSize: "1.3vw" }}>{ex.reps}</div>}
          {ex.weight && <div style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.3vw" }}>{ex.weight}</div>}
        </div>
      ))}

      {/* Notes */}
      {section.notes && (
        <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "1.1vw", marginTop: "0.8vw" }}>
          {section.notes}
        </div>
      )}
    </div>
  );
}

// ─── Écran SECTION ────────────────────────────────────────────────────────────
function SectionScreen({ wod, sectionIndex, exerciseIndex, timer }) {
  const section   = wod.sections?.[sectionIndex];
  if (!section) return <Idle />;

  const label     = section.customName || PRESET_LABELS[section.preset] || section.preset;
  const format    = section.format;
  const rotating  = ["amrap", "emom", "each_nmin"].includes(format);
  const forTime   = format === "fortime";
  const hasTimer  = format !== "notimed" || Boolean(section.duration);
  const exercises = section.exercises || [];

  const accentColor = timer?.status === "delay" ? C.orange : C.green;
  const currentEx   = rotating ? exercises[exerciseIndex % exercises.length] : null;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "3vw" }}>

      {/* En-tête */}
      <div style={{ display: "flex", gap: "1.5vw", alignItems: "baseline", marginBottom: "1.5vw" }}>
        <div style={{ color: accentColor, fontFamily: F.bebas, fontSize: "3vw", letterSpacing: 8 }}>
          {label}
        </div>
        {format && format !== "notimed" && (
          <div style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.8vw", letterSpacing: 4 }}>
            {FORMAT_LABELS[format]}
          </div>
        )}
        {section.duration && !rotating && (
          <div style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.6vw" }}>{section.duration} min</div>
        )}
      </div>

      {/* Timer */}
      {hasTimer && timer && timer.status !== "idle" && (
        <TimerBlock timer={timer} forTime={forTime} accentColor={accentColor} />
      )}

      {/* Vue rotation (AMRAP / EMOM / Each N min) */}
      {rotating && currentEx && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "2vw" }}>
          <div style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.8vw", letterSpacing: 6 }}>
            EXERCICE {(exerciseIndex % exercises.length) + 1} / {exercises.length}
          </div>
          <div style={{ color: C.white, fontFamily: F.bebas, fontSize: "8vw", letterSpacing: 2, textAlign: "center", lineHeight: 1 }}>
            {currentEx.name}
          </div>
          <div style={{ display: "flex", gap: "4vw" }}>
            {currentEx.reps   && <BigStat label="REPS"   value={currentEx.reps}   color={accentColor} />}
            {currentEx.weight && <BigStat label="CHARGE" value={currentEx.weight} color={accentColor} />}
          </div>
          {currentEx.notes && (
            <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "1.5vw" }}>{currentEx.notes}</div>
          )}

          {/* Toutes les variantes sous l'exercice courant */}
          {currentEx.variants?.length > 0 && (
            <div style={{ display: "flex", gap: "2vw", flexWrap: "wrap", justifyContent: "center" }}>
              {currentEx.variants.map((v) => (
                <div key={v.id} style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.6vw" }}>
                  {v.name} {v.reps} {v.weight}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vue liste (For Time / notimed) */}
      {!rotating && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.2vw" }}>
          {section.rounds && (
            <div style={{ color: C.muted, fontFamily: F.bebas, fontSize: "2vw", letterSpacing: 4, marginBottom: "0.5vw" }}>
              {section.rounds} ROUNDS
            </div>
          )}
          {exercises.map((ex) => (
            <div key={ex.id}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "2vw" }}>
                <div style={{ color: C.white, fontFamily: F.bebas, fontSize: "3.5vw", flex: 1, lineHeight: 1.1 }}>{ex.name}</div>
                {ex.reps   && <div style={{ color: accentColor, fontFamily: F.bebas, fontSize: "3vw" }}>{ex.reps}</div>}
                {ex.weight && <div style={{ color: C.muted,     fontFamily: F.bebas, fontSize: "2.8vw" }}>{ex.weight}</div>}
              </div>
              {ex.notes && (
                <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "1.2vw", paddingLeft: "0.5vw" }}>{ex.notes}</div>
              )}
              {ex.variants?.length > 0 && (
                <div style={{ paddingLeft: "1vw", marginTop: "0.3vw", display: "flex", gap: "2vw", flexWrap: "wrap" }}>
                  {ex.variants.map((v) => (
                    <div key={v.id} style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.8vw" }}>
                      ↳ {v.name} {v.reps} {v.weight}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {section.notes && (
            <div style={{ color: C.muted, fontFamily: F.sans, fontSize: "1.4vw", marginTop: "1vw" }}>
              {section.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimerBlock({ timer, forTime, accentColor }) {
  // For Time : countdown depuis timecap si timecap défini, sinon stopwatch
  const hasTimecap = timer.totalDuration > 0;
  const display = timer.status === "delay"
    ? fmtTime(timer.delayRemaining)
    : (forTime && !hasTimecap)
      ? fmtTime(timer.elapsed)
      : fmtTime(timer.remaining);

  const label = timer.status === "delay" ? "DÉPART DANS"
    : forTime && !hasTimecap ? "TEMPS ÉCOULÉ"
    : "TEMPS RESTANT";

  return (
    <div style={{ textAlign: "center", marginBottom: "1.5vw" }}>
      <div style={{ color: C.muted, fontFamily: F.bebas, fontSize: "1.4vw", letterSpacing: 6 }}>{label}</div>
      <div style={{ color: accentColor, fontFamily: F.bebas, fontSize: "11vw", lineHeight: 1, letterSpacing: 4 }}>
        {display}
      </div>
    </div>
  );
}

// ─── Écran FINISHED ───────────────────────────────────────────────────────────
function Finished() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 600);
    return () => clearInterval(id);
  }, []);
  return (
    <Center>
      <div style={{
        color: C.green, fontFamily: F.bebas, fontSize: "10vw", letterSpacing: 10,
        opacity: visible ? 1 : 0.15, transition: "opacity 0.3s",
      }}>
        TIME'S UP !
      </div>
      <div style={{ color: C.white, fontFamily: F.bebas, fontSize: "3.5vw", letterSpacing: 6, marginTop: "2vw" }}>
        BEAU BOULOT
      </div>
    </Center>
  );
}

// ─── Composants réutilisables ─────────────────────────────────────────────────
function Center({ children }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {children}
    </div>
  );
}

function Tag({ children }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 8px",
      color: C.muted, fontFamily: F.bebas, fontSize: "1.2vw", letterSpacing: 2,
    }}>
      {children}
    </div>
  );
}

function BigStat({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color: C.muted,  fontFamily: F.bebas, fontSize: "1.5vw", letterSpacing: 5 }}>{label}</div>
      <div style={{ color, fontFamily: F.bebas, fontSize: "5vw", letterSpacing: 2 }}>{value}</div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { state } = useSocket();
  if (!state || state.screen === "idle") return <Idle />;
  return (
    <>
      <LogoCorner />
      {state.screen === "recap"    && <Recap wod={state.wod} />}
      {state.screen === "finished" && <Finished />}
      {state.screen === "section"  && (
        <SectionScreen
          wod={state.wod}
          sectionIndex={state.sectionIndex}
          exerciseIndex={state.exerciseIndex}
          timer={state.timer}
        />
      )}
    </>
  );
}
