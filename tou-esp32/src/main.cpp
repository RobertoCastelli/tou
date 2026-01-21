#include <Arduino.h>

#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>


#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// ---------- OLED ----------
Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  -1   // reset pin (non usato su I2C)
);

String oledMessage = "";
bool oledMessageDisappear = false;
unsigned long oledClearAt = 0;

// ---------- PIN ----------
const int LED_PIN = 25;
const int BUTTON_PIN = 33;
const int BUZZER_PIN = 27;

// ---------- PWM ----------
const int LED_CHANNEL = 0;
const int BUZZER_CHANNEL = 1;
const int LED_FREQ = 5000;
const int BUZZER_FREQ = 1000;
const int PWM_RES = 8;

// ---------- LED BRIGHTNESS ----------
const int BRIGHT_MIN = 0;
const int BRIGHT_LUB = 220;
const int BRIGHT_DUB = 120;

// ---------- BUZZER TONES ----------
const int TONE_LUB = 1400;
const int TONE_DUB = 900;

// ---------- WIFI / MQTT ----------
const char* WIFI_SSID = "iliadbox-2C2EA5";
const char* WIFI_PASS = "4z2m2qf57nq6nh3xqszsk3";
const char* MQTT_HOST = "ddbf357d636f42e79161fbac7afd5a74.s1.eu.hivemq.cloud";
const int   MQTT_PORT = 8883;
const char* MQTT_CLUS = "ddbf357d636f42e79161fbac7afd5a74";
const char* MQTT_USER = "Shaco";
const char* MQTT_PASS = "Hive77!!!";

// ---------- MQTT ----------
WiFiClientSecure tlsClient;
PubSubClient MQTTClient(tlsClient);

// ---------- ECG STATE ----------
bool heartActive = false;
int heartState = 0;
int beatsLeft = 0;
unsigned long lastBeatTime = 0;

int currentBrightness = BRIGHT_MIN;
int targetBrightness  = BRIGHT_MIN;

// ---------- START HEART ----------
void startHeartbeat(int cycles) {
  beatsLeft = cycles;
  heartActive = true;
  heartState = 1;
  lastBeatTime = millis();
}

// ---------- OLED MESSAGE ----------
void showText(String text, bool disappear = true, unsigned long durationMs = 2000) {
  oledMessage = text;
  oledMessageDisappear = disappear;
  oledClearAt = millis() + durationMs;

  display.clearDisplay();
  display.setCursor(0, 20);
  display.println(oledMessage);
  display.display();
}

// ---------- MQTT CALLBACK ----------
void onMessage(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, "tou/to-esp32") == 0) {
    String msg;
    for (unsigned int i = 0; i < length; i++) {
      msg += (char)payload[i];
    } 
    // Controlla se il messaggio è un feedback
    if (msg.startsWith("FEEDBACK:")) {
      String text = msg.substring(9);
      showText(text, false);
      startHeartbeat(4);
    } else if (msg.startsWith("FRASE:")) {
      String text = msg.substring(6);
      showText(text, true, 5000);
      startHeartbeat(4);
    }
  }
}

// ---------- SETUP ----------
void setup() {
  Serial.begin(115200);

  // OLED
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 20);
  
  showText("TOU ESP32 READY", true, 5000);


  // LED PWM
  ledcSetup(LED_CHANNEL, LED_FREQ, PWM_RES);
  ledcAttachPin(LED_PIN, LED_CHANNEL);
  ledcWrite(LED_CHANNEL, BRIGHT_MIN);

  // BUZZER PWM
  ledcSetup(BUZZER_CHANNEL, BUZZER_FREQ, PWM_RES);
  ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
  ledcWriteTone(BUZZER_CHANNEL, 0);

  // BUTTON
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // WIFI
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
  }

  // MQTT
  tlsClient.setInsecure();
  MQTTClient.setServer(MQTT_HOST, MQTT_PORT);
  MQTTClient.setCallback(onMessage);

  while (!MQTTClient.connected()) {
    MQTTClient.connect(MQTT_CLUS, MQTT_USER, MQTT_PASS);
    delay(500);
  }

  MQTTClient.subscribe("tou/to-esp32");
}

// ---------- LOOP ----------
void loop() {
  MQTTClient.loop();
  
  // --------- OLED MESSAGE CLEAR ----------
  if(oledMessageDisappear && millis() > oledClearAt) {
    display.clearDisplay();
    display.display();
  }

  // --------- BUTTON ----------
  static int lastButtonState = HIGH;
  int currentButtonState = digitalRead(BUTTON_PIN);

  if (lastButtonState == HIGH && currentButtonState == LOW) {
    // ESP32 invia TOU a React
    MQTTClient.publish("tou/to-react", "tou");
  }

  lastButtonState = currentButtonState;

  // --------- ECG ----------
  static int lastHeartState = -1;

  if (!heartActive) {
    ledcWriteTone(BUZZER_CHANNEL, 0);
    return;
  }

  unsigned long now = millis();

  // --- BUZZER ---
  if (heartState != lastHeartState) {
    switch (heartState) {
      case 1:
        ledcWriteTone(BUZZER_CHANNEL, TONE_LUB);
        break;
      case 3:
        ledcWriteTone(BUZZER_CHANNEL, TONE_DUB);
        break;
      default:
        ledcWriteTone(BUZZER_CHANNEL, 0);
        break;
    }
    lastHeartState = heartState;
  }

  // --- LED ---
  switch (heartState) {
    case 1:
      targetBrightness = BRIGHT_LUB;
      if (now - lastBeatTime > 150) {
        heartState = 2;
        lastBeatTime = now;
      }
      break;

    case 2:
      targetBrightness = BRIGHT_MIN;
      if (now - lastBeatTime > 150) {
        heartState = 3;
        lastBeatTime = now;
      }
      break;

    case 3:
      targetBrightness = BRIGHT_DUB;
      if (now - lastBeatTime > 150) {
        heartState = 4;
        lastBeatTime = now;
      }
      break;

    case 4:
      targetBrightness = BRIGHT_MIN;
      if (now - lastBeatTime > 900) {
        beatsLeft--;
        if (beatsLeft > 0) {
          heartState = 1;
          lastBeatTime = now;
        } else {
          heartActive = false;
          lastHeartState = -1;
        }
      }
      break;
  }

  // --- SOFT DIM ---
  if (currentBrightness < targetBrightness) currentBrightness++;
  if (currentBrightness > targetBrightness) currentBrightness--;

  ledcWrite(LED_CHANNEL, currentBrightness);
}
