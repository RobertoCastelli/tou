import { useEffect, useRef } from "react";
import mqtt from "mqtt";
import "./App.css";

function App() {
  const clientRef = useRef(null);
  const wss =
    "wss://ddbf357d636f42e79161fbac7afd5a74.s1.eu.hivemq.cloud:8884/mqtt";

  useEffect(() => {
    const client = mqtt.connect(wss, {
      username: "Shaco",
      password: "Hive77!!!",
    });

    clientRef.current = client;

    client.on("connect", () => client.subscribe("tou/#"));
    client.on("message", (topic, payload) => {
      if (topic === "tou/f") {
        console.log(payload.toString());
      }
    });

    return () => {
      client.end();
    };
  }, []);

  function handleSend() {
    clientRef.current.publish("tou/f", "💥");
  }

  return (
    <>
      <h1>TOU</h1>
      <button onClick={handleSend}>send</button>
    </>
  );
}

export default App;
