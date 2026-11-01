/**
 * nexus-scout: passive Wi-Fi + BLE scanner, reported over one BLE GATT characteristic as small
 * JSON chunks (read by src/lib/nexusScout.ts in the Neo Hub app via NexusScoutPanel.tsx).
 *
 * WATCH ONLY. This firmware calls WiFi.scanNetworks() and BLEScan, both passive listening calls
 * built into the Arduino ESP32 core. It never calls esp_wifi_80211_tx, never builds a deauth or
 * beacon frame, never joins a network that isn't its own fallback AP, and never stores what it
 * sees anywhere but RAM for the current scan cycle. See AGENTS.md rule 5.
 *
 * GATT service a0a00001-a0a0-4a0a-8a0a-a0a0a0a0a001, notify characteristic a0a00002-...-a001.
 * Chunk shapes (one JSON object per BLE notification, kept under ~180 bytes to fit a few packets):
 *   {"t":"wifi","items":[{"ssid":"...","bssid":"aa:bb:..","ch":6,"rssi":-55,"auth":"wpa2","wps":false}, ...]}
 *   {"t":"ble","items":[{"id":"aa:bb:..","name":"...", "rssi":-70,"kind":"other"}, ...]}
 *   {"t":"end","at":<millis since boot>}
 *
 * Same chunks are also written to USB serial (115200), one JSON object per line, whenever the host
 * has sent a "ping" line within the last SERIAL_ACTIVE_MS (the Neo Hub's s3Kit/Nexus page does this
 * every ~10s). On boot, and in reply to each ping, it prints the marker line
 *   NEXUS-SCOUT v<version> board=<esp32-s3|esp32> ready
 * which the hub uses to recognise this firmware (vs RuView). Serial is receive-only apart from
 * "ping" and the hot/cold finder ("hunt wifi <mac> <ch>" / "hunt ble <mac>" / "hunt off", which makes the
 * board only listen for that one device and print {"t":"hunt","rssi":-60} about once a second). No other
 * command is accepted. BLE items also carry optional "co" (manufacturer company id), "ty" (first payload
 * byte) and "su" (16-bit service uuid) so the app can spot AirTag / Tile / SmartTag trackers.
 *
 * If no phone connects within NO_CLIENT_TIMEOUT_MS of boot, it falls back to its own
 * "NexusScout-xxxx" access point with a tiny read-only status page (no scan control from there --
 * Web Bluetooth from the Nexus page is the only way to drive a scan).
 */
#include <Arduino.h>
#include <WiFi.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <ArduinoJson.h>
#include <WebServer.h>

#define SERVICE_UUID "a0a00001-a0a0-4a0a-8a0a-a0a0a0a0a001"
#define CHAR_UUID    "a0a00002-a0a0-4a0a-8a0a-a0a0a0a0a001"

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

static const uint32_t SCAN_INTERVAL_MS = 10000;   // one Wi-Fi + BLE scan cycle every 10s
static const uint32_t NO_CLIENT_TIMEOUT_MS = 60000; // fall back to AP mode after 60s with no BLE client
static const uint32_t SERIAL_ACTIVE_MS = 30000;   // host must ping within this window to keep USB streaming
static const uint8_t MAX_ITEMS_PER_CHUNK = 4;      // keep each BLE notification small

BLECharacteristic *gChar = nullptr;
bool gClientConnected = false;
bool gApFallback = false;
WebServer gHttp(80);
uint32_t gLastScan = 0;
uint32_t gBootMs = 0;
uint32_t gLastPing = 0;
bool gEverPinged = false;
String gSerialBuf;
// Hot/cold finder: when set, the board only listens for this one device (no full scans) and reports its signal.
enum HuntMode { HUNT_OFF, HUNT_WIFI, HUNT_BLE };
HuntMode gHunt = HUNT_OFF;
String gHuntMac;       // lowercase aa:bb:cc:dd:ee:ff
int gHuntChannel = 1;
uint32_t gLastHunt = 0;
static const uint32_t HUNT_INTERVAL_MS = 1000;

static bool serialActive() { return gEverPinged && millis() - gLastPing < SERIAL_ACTIVE_MS; }

static void printBanner() {
  Serial.println("NEXUS-SCOUT v" NEXUS_SCOUT_VERSION " board=" NEXUS_SCOUT_BOARD " ready");
}

static bool validMac(const String &m) {
  if (m.length() != 17) return false;
  for (int i = 0; i < 17; i++) {
    char c = m[i];
    if (i % 3 == 2) { if (c != ':') return false; }
    else if (!isxdigit((unsigned char)c)) return false;
  }
  return true;
}

/**
 * Reads host lines. Commands: "ping" (keeps USB streaming on, re-prints the banner) and the hot/cold
 * finder: "hunt wifi <mac> <channel>", "hunt ble <mac>", "hunt off". The finder only LISTENS for one
 * device and reports its signal strength; it never transmits.
 */
static void pollSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (gSerialBuf == "ping") {
        gLastPing = millis();
        gEverPinged = true;
        printBanner();
      } else if (gSerialBuf == "hunt off") {
        gHunt = HUNT_OFF;
      } else if (gSerialBuf.startsWith("hunt wifi ") && gSerialBuf.length() >= 29) {
        String mac = gSerialBuf.substring(10, 27);
        int ch = gSerialBuf.substring(28).toInt();
        mac.toLowerCase();
        if (validMac(mac) && ch >= 1 && ch <= 14) {
          gHuntMac = mac; gHuntChannel = ch; gHunt = HUNT_WIFI;
          gLastPing = millis(); gEverPinged = true;
        }
      } else if (gSerialBuf.startsWith("hunt ble ") && gSerialBuf.length() == 26) {
        String mac = gSerialBuf.substring(9);
        mac.toLowerCase();
        if (validMac(mac)) {
          gHuntMac = mac; gHunt = HUNT_BLE;
          gLastPing = millis(); gEverPinged = true;
        }
      }
      gSerialBuf = "";
    } else if (gSerialBuf.length() < 64) {
      gSerialBuf += c;
    }
  }
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    gClientConnected = true;
    digitalWrite(LED_BUILTIN, HIGH);
  }
  void onDisconnect(BLEServer *server) override {
    gClientConnected = false;
    digitalWrite(LED_BUILTIN, LOW);
    server->startAdvertising();
  }
};

static void notifyJson(const JsonDocument &doc) {
  String out;
  serializeJson(doc, out);
  if (serialActive()) Serial.println(out);
  if (!gChar || !gClientConnected) return;
  gChar->setValue(out.c_str());
  gChar->notify();
  delay(20); // give the BLE stack time between notifications on slower phones
}

static const char *authName(wifi_auth_mode_t m) {
  switch (m) {
    case WIFI_AUTH_OPEN: return "open";
    case WIFI_AUTH_WEP: return "wep";
    case WIFI_AUTH_WPA_PSK: return "wpa";
    case WIFI_AUTH_WPA2_PSK:
    case WIFI_AUTH_WPA_WPA2_PSK: return "wpa2";
    default: return "wpa3";
  }
}

/** Passive Wi-Fi scan (no probe-request flood, no join). Reports in small batches over BLE. */
static void scanWifi() {
  int n = WiFi.scanNetworks(false /*async*/, false /*hidden*/, true /*passive*/);
  for (int i = 0; i < n; i += MAX_ITEMS_PER_CHUNK) {
    JsonDocument doc;
    doc["t"] = "wifi";
    JsonArray items = doc["items"].to<JsonArray>();
    for (int j = i; j < n && j < i + MAX_ITEMS_PER_CHUNK; j++) {
      JsonObject it = items.add<JsonObject>();
      it["ssid"] = WiFi.SSID(j);
      it["bssid"] = WiFi.BSSIDstr(j);
      it["ch"] = WiFi.channel(j);
      it["rssi"] = WiFi.RSSI(j);
      it["auth"] = authName(WiFi.encryptionType(j));
      it["wps"] = false; // the Arduino core does not expose the WPS IE; left for a future firmware rev
    }
    notifyJson(doc);
  }
  WiFi.scanDelete();
}

/** One BLE advertisement scan window; only ever listens (BLEScan::start does not transmit connect requests). */
static void scanBle() {
  BLEScan *scan = BLEDevice::getScan();
  scan->setActiveScan(false); // passive: no scan-request frames sent to advertisers
  BLEScanResults *results = scan->start(3 /*seconds*/, false);
  int n = results->getCount();
  for (int i = 0; i < n; i += MAX_ITEMS_PER_CHUNK) {
    JsonDocument doc;
    doc["t"] = "ble";
    JsonArray items = doc["items"].to<JsonArray>();
    for (int j = i; j < n && j < i + MAX_ITEMS_PER_CHUNK; j++) {
      BLEAdvertisedDevice d = results->getDevice(j);
      JsonObject it = items.add<JsonObject>();
      it["id"] = d.getAddress().toString();
      it["name"] = d.haveName() ? d.getName() : "";
      it["rssi"] = d.getRSSI();
      it["kind"] = d.haveManufacturerData() ? "ibeacon" : "other";
      // Hints for the tracker detector (Apple Find My / Tile / SmartTag announce themselves in their ads).
      if (d.haveManufacturerData()) {
        auto md = d.getManufacturerData();
        if (md.length() >= 2) {
          it["co"] = (uint8_t)md[0] | ((uint8_t)md[1] << 8); // company id, little endian
          if (md.length() >= 3) it["ty"] = (uint8_t)md[2];   // first payload byte (0x12 = Apple Find My)
        }
      }
      if (d.haveServiceUUID()) {
        BLEUUID u = d.getServiceUUID();
        String us = String(u.toString().c_str());               // "0000feed-0000-1000-8000-00805f9b34fb" or short form
        us.toLowerCase();
        if (us.length() == 36) us = us.substring(4, 8);
        if (us.length() <= 8) it["su"] = us;
      }
    }
    notifyJson(doc);
  }
  scan->clearResults();
}

/** One finder reading: listen briefly for the chosen device and report its RSSI (or none). Passive only. */
static void runHuntStep() {
  int rssi = 0;
  bool seen = false;
  if (gHunt == HUNT_WIFI) {
    int n = WiFi.scanNetworks(false, false, true, 120, gHuntChannel);
    for (int i = 0; i < n; i++) {
      String b = WiFi.BSSIDstr(i);
      b.toLowerCase();
      if (b == gHuntMac) { rssi = WiFi.RSSI(i); seen = true; break; }
    }
    WiFi.scanDelete();
  } else {
    BLEScan *scan = BLEDevice::getScan();
    scan->setActiveScan(false);
    BLEScanResults *results = scan->start(1, false);
    int n = results->getCount();
    for (int i = 0; i < n; i++) {
      BLEAdvertisedDevice d = results->getDevice(i);
      String a = d.getAddress().toString().c_str();
      a.toLowerCase();
      if (a == gHuntMac) { rssi = d.getRSSI(); seen = true; break; }
    }
    scan->clearResults();
  }
  JsonDocument doc;
  doc["t"] = "hunt";
  if (seen) doc["rssi"] = rssi; else doc["rssi"] = nullptr;
  notifyJson(doc);
}

static void runScanCycle() {
  if (!gClientConnected && !serialActive()) return;
  scanWifi();
  scanBle();
  JsonDocument end;
  end["t"] = "end";
  end["at"] = millis() - gBootMs;
  notifyJson(end);
}

static void startApFallback() {
  gApFallback = true;
  char ssid[32];
  snprintf(ssid, sizeof(ssid), "NexusScout-%04X", (uint16_t)(ESP.getEfuseMac() & 0xFFFF));
  WiFi.softAP(ssid); // its own AP only -- never joins or impersonates another network
  gHttp.on("/", []() {
    String page = "<html><body><h3>Nexus Scout</h3><p>Watch-only Wi-Fi/BLE scanner.</p>"
                  "<p>Open the Nexus page in Neo Hub and tap \"Connect to Nexus Scout\" to read a live scan over Bluetooth.</p>"
                  "<p>Board: " NEXUS_SCOUT_BOARD " &middot; firmware " NEXUS_SCOUT_VERSION "</p></body></html>";
    gHttp.send(200, "text/html", page);
  });
  gHttp.begin();
}

void setup() {
  gBootMs = millis();
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  printBanner();

  BLEDevice::init("NexusScout");
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService *service = server->createService(SERVICE_UUID);
  gChar = service->createCharacteristic(CHAR_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  gChar->addDescriptor(new BLE2902());
  service->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); // station mode for scanning only -- never associates
}

void loop() {
  pollSerial();
  if (!gApFallback && !gClientConnected && !serialActive() && millis() - gBootMs > NO_CLIENT_TIMEOUT_MS) {
    startApFallback();
  }
  if (gApFallback) {
    gHttp.handleClient();
  }
  if (gHunt != HUNT_OFF && serialActive()) {
    if (millis() - gLastHunt > HUNT_INTERVAL_MS) {
      gLastHunt = millis();
      runHuntStep();
    }
  } else if ((gClientConnected || serialActive()) && millis() - gLastScan > SCAN_INTERVAL_MS) {
    gLastScan = millis();
    runScanCycle();
  }
  delay(50);
}
