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

    // Ricezione messaggio TOU (decide chi è il 1° e chi il 2°)
    client.on("message", (topic) => {
      if (topic === "tou/to-react") {
        if (lastSentByReactRef.current) {
          // React invia --> ESP32 riceve
          setRecipient("esp32");
          const rispostaAt = Date.now() - pendingTouStartedAt.current; //calcolo tempo dall'invio alla ricezione
          const fraseTou = generaFraseInRisposta(rispostaAt); // scelgo frase in base al tempo
          clientRef.current.publish("tou/to-esp32", "FRASE:" + fraseTou); // invio frase a ESP32
          lastSentByReactRef.current = false; // resetto React: non è più il 1°
          hasPendingTouRef.current = false; // resetto pending: React non ha nulla in sospeso
          setFeedback("i pensieri si sono incontrati..."); // feedback di avvenuta ricezione
        } else {
          // ESP32 invia --> React riceve
          setRecipient("react");
          pendingTouStartedAt.current = Date.now(); // memorizzo timestamp di inizio TOU
          hasPendingTouRef.current = true; // React ha un TOU in sospeso
          lastSentByReactRef.current = false; // React non è il 1°
        }
      }
    });
    return () => client.end(); // Cleanup on unmount
  }, []);

  // Gestione bottone TOU
  function handleSend() {
    // React ha un TOU in sospeso
    if (hasPendingTouRef.current) {
      // React riceve TOU da ESP32
      setFeedback(null); // resetto feedback precedente
      const rispostaAt = Date.now() - pendingTouStartedAt.current; // calcolo tempo dalla ricezione all'invio
      setFrase(generaFraseInRisposta(rispostaAt)); // crea frase per React
      setTimeout(() => setFrase(null), 5000); // resetto frase dopo 5s
      clientRef.current.publish(
        "tou/to-esp32",
        "FEEDBACK:i pensieri si sono incontrati",
      ); // invio feedback a ESP32
      hasPendingTouRef.current = false; // chiudo il ciclo TOU
      pendingTouStartedAt.current = null;
      lastSentByReactRef.current = false;
    } else {
      // React invia TOU a ESP32
      setRecipient("esp32");
      setFrase(null); // resetto frase precedente
      clientRef.current.publish("tou/to-esp32", "tou"); // invio il "gesto" TOU
      pendingTouStartedAt.current = Date.now(); // memorizzo timestamp di inizio TOU
      lastSentByReactRef.current = true; // React è stato il 1°
    }
  }

  function generaFraseInRisposta(diffMs) {
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
      <button onClick={handleSend}>🚨</button>
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
