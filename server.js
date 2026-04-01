import express    from "express";
import { WebSocketServer } from "ws";
import { createServer }    from "http";
import { fileURLToPath }   from "url";
import { dirname, join }   from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT      = 3000;

// ─── État global ─────────────────────────────────────────────────────────────
let state = {
  screen:         "idle",   // idle | recap | section | finished
  wod:            null,
  sectionIndex:   0,        // index dans wod.sections[]
  exerciseIndex:  0,        // pour les formats avec rotation (amrap/emom/each_nmin)
  timer: {
    status:        "idle",  // idle | delay | running | paused | finished
    delayRemaining: 0,
    remaining:     0,       // secondes restantes (countdown)
    elapsed:       0,       // secondes écoulées (stopwatch For Time)
    totalDuration: 0,
    intervalSecs:  0,       // durée d'un intervalle (pour rotation)
  },
};

let timerInterval = null;

function currentSection() {
  return state.wod?.sections?.[state.sectionIndex] ?? null;
}

function isRotating(section) {
  return ["amrap", "emom", "each_nmin"].includes(section?.format);
}

function isForTime(section) {
  return section?.format === "fortime";
}

function getIntervalSecs(section) {
  if (!section) return 0;
  if (section.format === "each_nmin") return parseInt(section.interval) || 60;
  if (section.format === "emom")      return 60;
  if (section.format === "amrap") {
    // Pour AMRAP : durée totale / nombre d'exercices
    const total = parseInt(section.duration) * 60 || 0;
    const count = section.exercises?.length || 1;
    return Math.floor(total / count);
  }
  return 0;
}

function getSectionTimer(section) {
  if (!section) return { remaining: 0, elapsed: 0, totalDuration: 0, intervalSecs: 0 };
  const format = section.format;

  if (format === "notimed") {
    // Durée indicative → countdown si renseignée
    const duration = parseInt(section.duration) * 60 || 0;
    return { remaining: duration, elapsed: 0, totalDuration: duration, intervalSecs: 0 };
  }
  if (format === "fortime") {
    // Countdown depuis le timecap, ou stopwatch libre si pas de timecap
    const timecap = parseInt(section.timecap) * 60 || 0;
    return { remaining: timecap, elapsed: 0, totalDuration: timecap, intervalSecs: 0 };
  }
  if (format === "each_nmin") {
    const interval = parseInt(section.interval) || 60;
    const rounds   = parseInt(section.rounds)   || 1;
    const total    = interval * rounds;
    return { remaining: total, elapsed: 0, totalDuration: total, intervalSecs: interval };
  }
  if (format === "emom") {
    const total = parseInt(section.duration) * 60 || 0;
    return { remaining: total, elapsed: 0, totalDuration: total, intervalSecs: 60 };
  }
  if (format === "amrap") {
    const total    = parseInt(section.duration) * 60 || 0;
    const count    = section.exercises?.length || 1;
    const interval = count > 0 ? Math.floor(total / count) : total;
    return { remaining: total, elapsed: 0, totalDuration: total, intervalSecs: interval };
  }

  return { remaining: 0, elapsed: 0, totalDuration: 0, intervalSecs: 0 };
}

function broadcast(wss, data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(msg); });
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function startTimerLoop(wss) {
  stopTimer();
  timerInterval = setInterval(() => {
    const t       = state.timer;
    const section = currentSection();

    if (t.status === "delay") {
      t.delayRemaining -= 1;
      if (t.delayRemaining <= 0) {
        t.delayRemaining = 0;
        t.status = "running";
      }

    } else if (t.status === "running") {

      if (isForTime(section)) {
        // Countdown depuis timecap (ou stopwatch si pas de timecap)
        if (t.totalDuration > 0) {
          t.remaining -= 1;
          if (t.remaining <= 0) {
            t.remaining = 0;
            t.status    = "finished";
            stopTimer();
          }
        } else {
          // Pas de timecap → stopwatch
          t.elapsed += 1;
        }

      } else if (isRotating(section)) {
        // Countdown global + rotation d'exercices
        t.remaining -= 1;
        if (t.intervalSecs > 0) {
          const elapsed = t.totalDuration - t.remaining;
          const newIdx  = Math.floor(elapsed / t.intervalSecs) % (section.exercises?.length || 1);
          state.exerciseIndex = newIdx;
        }
        if (t.remaining <= 0) {
          t.remaining = 0;
          t.status    = "finished";
          stopTimer();
        }

      } else {
        // Countdown simple (warmup, notimed avec durée)
        t.remaining -= 1;
        if (t.remaining <= 0) {
          t.remaining = 0;
          t.status    = "finished";
          stopTimer();
        }
      }
    }

    broadcast(wss, { type: "STATE", state });
  }, 1000);
}

// ─── Serveur HTTP + WebSocket ─────────────────────────────────────────────────
const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });

app.use(express.static(join(__dirname, "dist")));
app.get("/display", (_, res) => res.sendFile(join(__dirname, "dist", "display.html")));
app.get("/remote",  (_, res) => res.sendFile(join(__dirname, "dist", "remote.html")));

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "STATE", state }));

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case "SELECT_WOD":
        stopTimer();
        state = {
          screen: "idle", wod: msg.wod, sectionIndex: 0, exerciseIndex: 0,
          timer: { status: "idle", delayRemaining: 0, remaining: 0, elapsed: 0, totalDuration: 0, intervalSecs: 0 },
        };
        break;

      case "LAUNCH":
        state.screen       = "recap";
        state.sectionIndex = 0;
        state.exerciseIndex = 0;
        stopTimer();
        state.timer = { status: "idle", delayRemaining: 0, remaining: 0, elapsed: 0, totalDuration: 0, intervalSecs: 0 };
        break;

      case "START_SECTION":
        state.screen        = "section";
        state.sectionIndex  = 0;
        state.exerciseIndex = 0;
        { const t = getSectionTimer(currentSection()); state.timer = { status: "idle", delayRemaining: 0, ...t }; }
        break;

      case "NEXT_SECTION": {
        const sections  = state.wod?.sections || [];
        const nextIndex = state.sectionIndex + 1;
        stopTimer();
        if (nextIndex >= sections.length) {
          state.screen = "finished";
          state.timer.status = "idle";
        } else {
          state.screen        = "section";
          state.sectionIndex  = nextIndex;
          state.exerciseIndex = 0;
          const t = getSectionTimer(sections[nextIndex]);
          state.timer = { status: "idle", delayRemaining: 0, ...t };
        }
        break;
      }

      case "PREV_SECTION": {
        stopTimer();
        if (state.screen === "recap") break;
        const prevIndex = state.sectionIndex - 1;
        if (prevIndex < 0) {
          state.screen = "recap";
          state.timer.status = "idle";
        } else {
          state.screen        = "section";
          state.sectionIndex  = prevIndex;
          state.exerciseIndex = 0;
          const t = getSectionTimer(state.wod?.sections?.[prevIndex]);
          state.timer = { status: "idle", delayRemaining: 0, ...t };
        }
        break;
      }

      case "START_TIMER": {
        const delay = parseInt(msg.delaySeconds) || 0;
        state.timer.status = delay > 0 ? "delay" : "running";
        state.timer.delayRemaining = delay;
        startTimerLoop(wss);
        break;
      }

      case "PAUSE_TIMER":
        if (state.timer.status === "running") {
          state.timer.status = "paused"; stopTimer();
        } else if (state.timer.status === "paused") {
          state.timer.status = "running"; startTimerLoop(wss);
        }
        break;

      case "RESET_TIMER": {
        stopTimer();
        const t = getSectionTimer(currentSection());
        state.exerciseIndex = 0;
        state.timer = { status: "idle", delayRemaining: 0, ...t };
        break;
      }

      case "RESET":
        stopTimer();
        state = {
          screen: "idle", wod: null, sectionIndex: 0, exerciseIndex: 0,
          timer: { status: "idle", delayRemaining: 0, remaining: 0, elapsed: 0, totalDuration: 0, intervalSecs: 0 },
        };
        break;
    }

    broadcast(wss, { type: "STATE", state });
  });
});

server.listen(PORT, () => {
  console.log(`CrossFit Display → http://localhost:${PORT}`);
  console.log(`  Display : http://localhost:${PORT}/display`);
  console.log(`  Remote  : http://localhost:${PORT}/remote`);
});
