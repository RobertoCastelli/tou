import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import "./App.css";

function App() {
  const [frase, setFrase] = useState(null);

  const lastSentByReactRef = useRef(false);
  const clientRef = useRef(null);
  const hasPendingTouRef = useRef(false);
  const pendingTouStartedAt = useRef(null);

  const wss =
    "wss://ddbf357d636f42e79161fbac7afd5a74.s1.eu.hivemq.cloud:8884/mqtt";

  useEffect(() => {
    const client = mqtt.connect(wss, {
      username: "Shaco",
      password: "Hive77!!!",
    });

    clientRef.current = client;

    // React riceve SOLO i TOU destinati a lui
    client.on("connect", () => {
      client.subscribe("tou/to-react");
    });

    // Ricezione = memorizzazione (NON decisione)
    client.on("message", (topic) => {
      if (topic === "tou/to-react") {
        if (lastSentByReactRef.current) {
          // INCROCIO: ESP32 è il secondo
          const diff = Date.now() - pendingTouStartedAt.current;
          setFrase(calcolaFrase(diff));
          lastSentByReactRef.current = false;
          pendingTouStartedAt.current = null;
        } else {
          // ESP32 ha inviato per primo
          pendingTouStartedAt.current = Date.now();
          hasPendingTouRef.current = true;
          lastSentByReactRef.current = false;
        }
      }
    });

    return () => client.end();
  }, []);

  function calcolaFrase(diffMs) {
    const t = diffMs / 1000;
    if (t < 3) return "ti pensavo proprio ora";
    if (t < 6) return "i nostri pensieri si sono sfiorati";
    if (t < 9) return "ti avevo in mente";
    if (t < 12) return "È da un po’ che ti penso";
    if (t < 15) return "il pensiero resta";
    return "il pensiero ha trovato il suo sempre";
  }

  // PREMO = DECIDO
  function handleSend() {
    if (hasPendingTouRef.current) {
      // INCROCIO → frase
      const diff = Date.now() - pendingTouStartedAt.current;
      setFrase(calcolaFrase(diff));

      hasPendingTouRef.current = false;
      pendingTouStartedAt.current = null;
    } else {
      // INVIO → ESP32
      clientRef.current.publish("tou/to-esp32", "tou");
      pendingTouStartedAt.current = Date.now();
      lastSentByReactRef.current = true;
      setFrase(null);
    }
  }

  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <h1>TOU</h1>

      <button onClick={handleSend} style={{ fontSize: 30 }}>
        🚨
      </button>

      {frase && <div style={{ marginTop: 20, fontSize: 20 }}>{frase}</div>}
    </div>
  );
}

export default App;

/* 
React	tou/to-esp32	tou/to-react
ESP32	tou/to-react	tou/to-esp32 
*/

/* 
Arrivo pensiero on("message")
Salvo timestamp	pendingTouStartedAt
Premo bottone	  handleSend()
Calcolo tempo	  Date.now() - pendingTouStartedAt
Scelgo frase	  calcolaSintonia()
Mostro frase	  setSintonia() 
*/
