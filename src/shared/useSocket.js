import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = `ws://${window.location.host}`;

export function useSocket() {
  const [state,     setState]     = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen    = () => setConnected(true);
      ws.onclose   = () => { setConnected(false); setTimeout(connect, 2000); };
      ws.onerror   = () => ws.close();
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "STATE") setState(msg.state);
      };
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  return { state, connected, send };
}
