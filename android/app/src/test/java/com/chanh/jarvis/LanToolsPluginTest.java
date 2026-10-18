package com.chanh.jarvis;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class LanToolsPluginTest {
    @Test
    public void onlyHomeNetworkAddressesPass() {
        assertTrue(LanToolsPlugin.isPrivate("192.168.1.20"));
        assertTrue(LanToolsPlugin.isPrivate("10.0.0.5"));
        assertTrue(LanToolsPlugin.isPrivate("172.20.1.1"));
        assertFalse(LanToolsPlugin.isPrivate("8.8.8.8"));
        assertFalse(LanToolsPlugin.isPrivate("172.32.0.1"));
        assertFalse(LanToolsPlugin.isPrivate("192.168.1.300"));
        assertFalse(LanToolsPlugin.isPrivate("example.com"));
    }

    @Test
    public void channelsFromFrequency() {
        assertEquals(1, LanToolsPlugin.channelOf(2412));
        assertEquals(6, LanToolsPlugin.channelOf(2437));
        assertEquals(11, LanToolsPlugin.channelOf(2462));
        assertEquals(14, LanToolsPlugin.channelOf(2484));
        assertEquals(36, LanToolsPlugin.channelOf(5180));
        assertEquals(149, LanToolsPlugin.channelOf(5745));
        assertEquals(1, LanToolsPlugin.channelOf(5955));
    }
}
