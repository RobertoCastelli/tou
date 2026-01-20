import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import "./App.css";

function App() {
  const [frase, setFrase] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [feedback, setFeedback] = useState(null);

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
          // 1° React --> 2° ESP32
          setRecipient("esp32");
          setFeedback("i pensieri si sono incontrati...");
          lastSentByReactRef.current = false;
          hasPendingTouRef.current = false;
        } else {
          // 1° ESP32 --> 2° React
          pendingTouStartedAt.current = Date.now();
          hasPendingTouRef.current = true;
          lastSentByReactRef.current = false;
          setRecipient("react");
        }
      }
    });

    return () => client.end();
  }, []);

  
  // Bottone Ract = invio o ricezione TOU
  function handleSend() {
    if (hasPendingTouRef.current) {
      // React riceve TOU da ESP32
      const diff = Date.now() - pendingTouStartedAt.current;
      setFrase(calcolaFrase(diff));
      setFeedback(null);
      hasPendingTouRef.current = false;
      pendingTouStartedAt.current = null;
    } else {
      // React invia TOU a ESP32
      clientRef.current.publish("tou/to-esp32", "tou");
      pendingTouStartedAt.current = Date.now();
      lastSentByReactRef.current = true;
      setFrase(null);
      setRecipient("esp32");
    }
  }

  function calcolaFrase(diffMs) {
    const t = diffMs / 1000;
    if (t < 3) return "ti pensavo proprio ora";
    if (t < 6) return "i nostri pensieri si sono sfiorati";
    if (t < 9) return "ti avevo in mente";
    if (t < 12) return "È da oggi che ti penso";
    if (t < 15) return "il pensiero resta";
    return "il pensiero ha trovato il suo sempre";
  }
  
  return (
    <div>
      <h1>TOU</h1>
      <button onClick={handleSend} style={{ fontSize: 30 }}>
        🚨
      </button>
      {recipient === "react" && frase && <div>{frase}</div>}
      {feedback && <div>{feedback}</div>}
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
