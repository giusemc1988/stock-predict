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
static const uint8_t MAX_ITEMS_PER_CHUNK = 4;      // keep each BLE notification small

BLECharacteristic *gChar = nullptr;
bool gClientConnected = false;
bool gApFallback = false;
WebServer gHttp(80);
uint32_t gLastScan = 0;
uint32_t gBootMs = 0;

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
  if (!gChar || !gClientConnected) return;
  String out;
  serializeJson(doc, out);
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
    }
    notifyJson(doc);
  }
  scan->clearResults();
}

static void runScanCycle() {
  if (!gClientConnected) return;
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
  if (!gApFallback && !gClientConnected && millis() - gBootMs > NO_CLIENT_TIMEOUT_MS) {
    startApFallback();
  }
  if (gApFallback) {
    gHttp.handleClient();
  }
  if (gClientConnected && millis() - gLastScan > SCAN_INTERVAL_MS) {
    gLastScan = millis();
    runScanCycle();
  }
  delay(50);
}
