import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import "./App.css";

function App() {
  const [frase, setFrase] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const reactWasFirstRef = useRef(false);
  const clientRef = useRef(null);
  const hasPendingRef = useRef(false);
  const pendingStartedAt = useRef(null);

  const MSG_TOU = "TOU";
  const INCIPIT_FRASE = "FRASE:";
  const INCIPIT_FEEDBACK = "FEEDBACK:";

  const wss =
    "wss://ddbf357d636f42e79161fbac7afd5a74.s1.eu.hivemq.cloud:8884/mqtt";

  function openReactCycleAsFirst() {
    pendingStartedAt.current = Date.now();
    reactWasFirstRef.current = true;
  }

  function markReactCycleAsSecond() {
    pendingStartedAt.current = Date.now();
    hasPendingRef.current = true;
    reactWasFirstRef.current = false;
  }

  function closeCycle() {
    hasPendingRef.current = false;
    pendingStartedAt.current = null;
    reactWasFirstRef.current = false;
  }

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

    // React 1° --> ESP32 2°
    client.on("message", (topic) => {
      if (topic === "tou/to-react") {
        if (reactWasFirstRef.current) {
          const rispostaAt = Date.now() - pendingStartedAt.current; //calcolo tempo dall'invio alla ricezione
          const frasePerEsp = fraseInBaseAlTempoDiRisposta(rispostaAt);
          clientRef.current.publish(
            "tou/to-esp32",
            INCIPIT_FRASE + frasePerEsp,
          );
          reactWasFirstRef.current = false;
          hasPendingRef.current = false;
          setFeedback("i nostri pensieri si sono incontrati..."); // feedback di avvenuta ricezione
        } else {
          // ESP32 1° --> React 2°
          setRecipient("react");
          markReactCycleAsSecond();
        }
      }
    });
    return () => client.end(); // Cleanup on unmount
  }, []);

  // Gestione bottone TOU
  function handleSend() {
    if (hasPendingRef.current) {
      // React riceve TOU da ESP32
      setFeedback(null);
      const rispostaAt = Date.now() - pendingStartedAt.current; // calcolo tempo dalla ricezione all'invio
      setFrase(fraseInBaseAlTempoDiRisposta(rispostaAt));
      setTimeout(() => setFrase(null), 5000);
      clientRef.current.publish(
        "tou/to-esp32",
        INCIPIT_FEEDBACK + "i nostri pensieri si sono incontrati",
      );
      closeCycle();
    } else {
      // React invia TOU a ESP32
      setFrase(null);
      clientRef.current.publish("tou/to-esp32", MSG_TOU); // invio il "gesto" TOU
      openReactCycleAsFirst();
    }
  }

  function fraseInBaseAlTempoDiRisposta(diffMs) {
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
