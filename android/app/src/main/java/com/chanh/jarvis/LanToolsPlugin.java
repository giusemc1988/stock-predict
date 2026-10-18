package com.chanh.jarvis;

import android.Manifest;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.RouteInfo;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedReader;
import java.io.FileReader;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Network tools for the Wi-Fi the phone is on, for the Jarvis Wi-Fi page.
 * Only private (home/shop) addresses are scanned or probed. Nothing is captured, nothing is attacked.
 */
@CapacitorPlugin(
    name = "LanTools",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION })
    }
)
public class LanToolsPlugin extends Plugin {

    private static final int[] PORTS = { 21, 22, 23, 53, 80, 443, 445, 554, 1883, 3389, 5000, 5353, 8000, 8008, 8009, 8080, 8443, 9100 };
    /** Ports tried when a device does not answer ping (phones and PCs often block it). */
    private static final int[] PROBE = { 80, 443, 445, 62078, 8080 };

    private WifiManager wifi() {
        return (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    }

    private LinkProperties link() {
        ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        Network n = cm.getActiveNetwork();
        return n == null ? null : cm.getLinkProperties(n);
    }

    static boolean isPrivate(String ip) {
        String[] p = ip.split("\\.");
        if (p.length != 4) return false;
        int a, b;
        try {
            for (String x : p) { int v = Integer.parseInt(x); if (v < 0 || v > 255) return false; }
            a = Integer.parseInt(p[0]);
            b = Integer.parseInt(p[1]);
        } catch (NumberFormatException e) {
            return false;
        }
        return a == 10 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168);
    }

    static int channelOf(int mhz) {
        if (mhz == 2484) return 14;
        if (mhz >= 2412 && mhz <= 2472) return (mhz - 2407) / 5;
        if (mhz >= 5000 && mhz <= 5900) return (mhz - 5000) / 5;
        if (mhz >= 5955 && mhz <= 7115) return (mhz - 5950) / 5;
        return 0;
    }

    private String myIp() {
        LinkProperties lp = link();
        if (lp == null) return null;
        for (LinkAddress la : lp.getLinkAddresses()) {
            if (la.getAddress() instanceof Inet4Address && isPrivate(la.getAddress().getHostAddress())) return la.getAddress().getHostAddress();
        }
        return null;
    }

    private String gateway() {
        LinkProperties lp = link();
        if (lp == null) return null;
        for (RouteInfo r : lp.getRoutes()) {
            if (r.isDefaultRoute() && r.getGateway() instanceof Inet4Address) return r.getGateway().getHostAddress();
        }
        return null;
    }

    private boolean located() {
        return getPermissionState("location") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void currentWifi(PluginCall call) {
        if (!located()) { requestPermissionForAlias("location", call, "afterPermission"); return; }
        call.resolve(wifiInfo());
    }

    @PluginMethod
    public void wifiScan(PluginCall call) {
        if (!located()) { requestPermissionForAlias("location", call, "afterPermission"); return; }
        doScan(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (!located()) { call.reject("Location permission is needed to read Wi-Fi names"); return; }
        if ("wifiScan".equals(call.getMethodName())) doScan(call);
        else call.resolve(wifiInfo());
    }

    @SuppressWarnings("deprecation")
    private JSObject wifiInfo() {
        WifiInfo info = wifi().getConnectionInfo();
        JSObject o = new JSObject();
        String ssid = info == null ? null : info.getSSID();
        if (ssid != null) ssid = ssid.replaceAll("^\"|\"$", "");
        o.put("ssid", ssid == null || ssid.equals("<unknown ssid>") ? null : ssid);
        o.put("bssid", info == null ? null : info.getBSSID());
        o.put("signal", info == null ? null : WifiManager.calculateSignalLevel(info.getRssi(), 101));
        o.put("channel", info == null ? null : channelOf(info.getFrequency()));
        o.put("ip", myIp());
        o.put("gateway", gateway());
        return o;
    }

    @SuppressWarnings("deprecation")
    private void doScan(PluginCall call) {
        new Thread(() -> {
            // Android allows about 4 fresh scans per 2 minutes; otherwise the last results come back
            wifi().startScan();
            try { Thread.sleep(2500); } catch (InterruptedException ignored) {}
            JSArray list = new JSArray();
            for (ScanResult r : wifi().getScanResults()) {
                JSObject n = new JSObject();
                n.put("ssid", r.SSID == null || r.SSID.isEmpty() ? "(hidden)" : r.SSID);
                n.put("bssid", r.BSSID);
                n.put("signal", WifiManager.calculateSignalLevel(r.level, 101));
                n.put("channel", channelOf(r.frequency));
                String cap = r.capabilities == null ? "" : r.capabilities;
                n.put("auth", cap.contains("WPA3") || cap.contains("SAE") ? "WPA3" : cap.contains("WPA2") ? "WPA2" : cap.contains("WPA") ? "WPA" : cap.contains("WEP") ? "WEP" : "Open");
                list.put(n);
            }
            JSObject o = wifiInfo();
            o.put("networks", list);
            call.resolve(o);
        }).start();
    }

    private static boolean tcp(String ip, int port, int ms) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(ip, port), ms);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** MAC addresses from the ARP table where Android still allows it (blocked on Android 10+). */
    private static Map<String, String> arp() {
        Map<String, String> m = new HashMap<>();
        try (BufferedReader br = new BufferedReader(new FileReader("/proc/net/arp"))) {
            String line;
            br.readLine();
            while ((line = br.readLine()) != null) {
                String[] f = line.trim().split("\\s+");
                if (f.length >= 4 && !f[3].equals("00:00:00:00:00:00")) m.put(f[0], f[3].toLowerCase());
            }
        } catch (Exception ignored) {}
        return m;
    }

    @PluginMethod
    public void devices(PluginCall call) {
        String me = myIp();
        if (me == null) { call.reject("Not on a home or shop Wi-Fi (no private address)"); return; }
        String base = me.substring(0, me.lastIndexOf('.') + 1);
        new Thread(() -> {
            ExecutorService pool = Executors.newFixedThreadPool(48);
            List<Future<JSObject>> jobs = new ArrayList<>();
            for (int h = 1; h < 255; h++) {
                final String ip = base + h;
                jobs.add(pool.submit(() -> {
                    long t = System.nanoTime();
                    boolean up = ip.equals(me);
                    try { if (!up) up = InetAddress.getByName(ip).isReachable(350); } catch (Exception ignored) {}
                    if (!up) for (int p : PROBE) if (tcp(ip, p, 200)) { up = true; break; }
                    if (!up) return null;
                    JSObject d = new JSObject();
                    d.put("ip", ip);
                    d.put("ms", Math.round((System.nanoTime() - t) / 1e6));
                    String name = null;
                    try {
                        String n = InetAddress.getByName(ip).getCanonicalHostName();
                        if (n != null && !n.equals(ip)) name = n.replaceAll("\\.(local|lan|home)$", "");
                    } catch (Exception ignored) {}
                    d.put("name", name);
                    return d;
                }));
            }
            JSArray out = new JSArray();
            Map<String, String> macs = arp();
            for (Future<JSObject> f : jobs) {
                try {
                    JSObject d = f.get(20, TimeUnit.SECONDS);
                    if (d != null) { d.put("mac", macs.get(d.getString("ip"))); out.put(d); }
                } catch (Exception ignored) {}
            }
            pool.shutdownNow();
            JSObject o = new JSObject();
            o.put("devices", out);
            o.put("me", me);
            o.put("gateway", gateway());
            call.resolve(o);
        }).start();
    }

    @PluginMethod
    public void ping(PluginCall call) {
        String ip = call.getString("ip", "");
        if (!isPrivate(ip)) { call.reject("only addresses on your own network are allowed"); return; }
        new Thread(() -> {
            List<Long> times = new ArrayList<>();
            for (int i = 0; i < 4; i++) {
                long t = System.nanoTime();
                boolean ok = false;
                try { ok = InetAddress.getByName(ip).isReachable(1000); } catch (Exception ignored) {}
                if (ok) times.add(Math.round((System.nanoTime() - t) / 1e6));
            }
            JSObject o = new JSObject();
            o.put("host", ip);
            o.put("sent", 4);
            o.put("received", times.size());
            if (times.isEmpty()) o.put("avgMs", (Object) null);
            else { long s = 0; for (long x : times) s += x; o.put("avgMs", s / times.size()); }
            call.resolve(o);
        }).start();
    }

    @PluginMethod
    public void ports(PluginCall call) {
        String ip = call.getString("ip", "");
        if (!isPrivate(ip)) { call.reject("only addresses on your own network are allowed"); return; }
        new Thread(() -> {
            ExecutorService pool = Executors.newFixedThreadPool(PORTS.length);
            List<Future<Integer>> jobs = new ArrayList<>();
            for (int p : PORTS) jobs.add(pool.submit(() -> tcp(ip, p, 700) ? p : -1));
            List<Integer> open = new ArrayList<>();
            for (Future<Integer> f : jobs) {
                try { int p = f.get(3, TimeUnit.SECONDS); if (p > 0) open.add(p); } catch (Exception ignored) {}
            }
            pool.shutdownNow();
            Collections.sort(open);
            JSObject o = new JSObject();
            o.put("ip", ip);
            o.put("open", new JSArray(open));
            call.resolve(o);
        }).start();
    }

    @PluginMethod
    public void wol(PluginCall call) {
        String mac = call.getString("mac", "").replaceAll("[^0-9A-Fa-f]", "");
        String me = myIp();
        if (mac.length() != 12) { call.reject("MAC address should look like aa:bb:cc:dd:ee:ff"); return; }
        if (me == null) { call.reject("Not on a home or shop Wi-Fi"); return; }
        new Thread(() -> {
            try (DatagramSocket s = new DatagramSocket()) {
                byte[] m = new byte[6];
                for (int i = 0; i < 6; i++) m[i] = (byte) Integer.parseInt(mac.substring(i * 2, i * 2 + 2), 16);
                byte[] pkt = new byte[102];
                for (int i = 0; i < 6; i++) pkt[i] = (byte) 0xff;
                for (int i = 6; i < 102; i++) pkt[i] = m[(i - 6) % 6];
                s.setBroadcast(true);
                InetAddress bc = InetAddress.getByName(me.substring(0, me.lastIndexOf('.') + 1) + "255");
                s.send(new DatagramPacket(pkt, pkt.length, bc, 9));
                JSObject o = new JSObject();
                o.put("ok", true);
                call.resolve(o);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        }).start();
    }
}
