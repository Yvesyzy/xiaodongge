package com.yves.musicarchive;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class codex_PrivacyPluginTest {
    @Test public void retryWithdrawalStillStopsPreviouslyAcceptedSession() {
        assertTrue(codex_PrivacyPlugin.shouldStopSession(false, "accepted", false));
        assertTrue(codex_PrivacyPlugin.shouldStopSession(false, "declined", true));
        assertFalse(codex_PrivacyPlugin.shouldStopSession(false, "pending", false));
        assertFalse(codex_PrivacyPlugin.shouldStopSession(true, "declined", true));
    }
    @Test public void invalidOrOldStateFailsClosed() {
        assertEquals(codex_PrivacyPlugin.STATUS_PENDING,
            codex_PrivacyPlugin.normalizeStatus("2026-10-07", codex_PrivacyPlugin.STATUS_ACCEPTED));
        assertEquals(codex_PrivacyPlugin.STATUS_PENDING,
            codex_PrivacyPlugin.normalizeStatus(codex_PrivacyPlugin.POLICY_VERSION, "unexpected"));
        assertEquals(codex_PrivacyPlugin.STATUS_ACCEPTED,
            codex_PrivacyPlugin.normalizeStatus(codex_PrivacyPlugin.POLICY_VERSION, codex_PrivacyPlugin.STATUS_ACCEPTED));
        assertEquals(codex_PrivacyPlugin.STATUS_DECLINED,
            codex_PrivacyPlugin.normalizeStatus(codex_PrivacyPlugin.POLICY_VERSION, codex_PrivacyPlugin.STATUS_DECLINED));
    }
}
