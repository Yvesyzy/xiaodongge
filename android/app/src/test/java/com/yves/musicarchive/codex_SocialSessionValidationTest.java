package com.yves.musicarchive;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class codex_SocialSessionValidationTest {
    private static final String VALID_TOKEN = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    private static final String VALID_EXPIRY = "2026-10-10T12:34:56.789Z";

    @Test
    public void acceptsOnlyHttpsOriginsWithoutRoutingComponents() {
        assertTrue(codex_SocialSessionValidation.isValidEndpoint("https://social.example.com"));
        assertTrue(codex_SocialSessionValidation.isValidEndpoint("https://social.example.com:443"));
        assertTrue(codex_SocialSessionValidation.isValidEndpoint("HTTPS://localhost"));

        assertFalse(codex_SocialSessionValidation.isValidEndpoint("http://social.example.com"));
        assertFalse(codex_SocialSessionValidation.isValidEndpoint("https://social.example.com/"));
        assertFalse(codex_SocialSessionValidation.isValidEndpoint("https://social.example.com/v1"));
        assertFalse(codex_SocialSessionValidation.isValidEndpoint("https://social.example.com?x=1"));
        assertFalse(codex_SocialSessionValidation.isValidEndpoint("https://social.example.com#fragment"));
        assertFalse(codex_SocialSessionValidation.isValidEndpoint("https://user:password@social.example.com"));
        assertFalse(codex_SocialSessionValidation.isValidEndpoint("https://"));
        assertFalse(codex_SocialSessionValidation.isValidEndpoint("https://social.example.com:"));
        assertFalse(codex_SocialSessionValidation.isValidEndpoint(" https://social.example.com"));
    }

    @Test
    public void acceptsCanonicalUnpaddedBase64UrlFor32Bytes() {
        assertTrue(codex_SocialSessionValidation.isValidToken(VALID_TOKEN));
        assertFalse(codex_SocialSessionValidation.isValidToken(VALID_TOKEN.substring(0, 42)));
        assertFalse(codex_SocialSessionValidation.isValidToken(VALID_TOKEN + "A"));
        assertFalse(codex_SocialSessionValidation.isValidToken(VALID_TOKEN.substring(0, 42) + "_"));
        assertFalse(codex_SocialSessionValidation.isValidToken("=" + VALID_TOKEN.substring(1)));
        assertFalse(codex_SocialSessionValidation.isValidToken("A".repeat(42) + "="));
    }

    @Test
    public void acceptsStrictIso8601ExpiryAndRejectsInvalidDates() {
        assertTrue(codex_SocialSessionValidation.isValidExpiresAt(VALID_EXPIRY));
        assertTrue(codex_SocialSessionValidation.isValidExpiresAt("2026-10-10T12:34:56Z"));
        assertTrue(codex_SocialSessionValidation.isValidExpiresAt("2026-10-10T12:34:56+08:00"));
        assertTrue(codex_SocialSessionValidation.isValidExpiresAt("2026-10-10T12:34:56.7-05:30"));
        assertTrue(codex_SocialSessionValidation.isValidExpiresAt("2026-10-10T12:34:56.123456789Z"));

        assertFalse(codex_SocialSessionValidation.isValidExpiresAt("2026-02-30T12:34:56.789Z"));
        assertFalse(codex_SocialSessionValidation.isValidExpiresAt("2026-10-10T24:00:00.000Z"));
        assertFalse(codex_SocialSessionValidation.isValidExpiresAt("2026-10-10T12:34:56.1234567890Z"));
        assertFalse(codex_SocialSessionValidation.isValidExpiresAt("2026-10-10T12:34:56"));
        assertFalse(codex_SocialSessionValidation.isValidExpiresAt("2026-10-10T12:34:56+24:00"));
    }

    @Test
    public void identifiesTheFirstInvalidSessionField() {
        assertNull(codex_SocialSessionValidation.invalidField(
            "https://social.example.com", VALID_TOKEN, VALID_EXPIRY
        ));
        assertTrue("endpoint".equals(codex_SocialSessionValidation.invalidField(
            "http://social.example.com", VALID_TOKEN, VALID_EXPIRY
        )));
        assertTrue("token".equals(codex_SocialSessionValidation.invalidField(
            "https://social.example.com", "bad", VALID_EXPIRY
        )));
        assertTrue("expiresAt".equals(codex_SocialSessionValidation.invalidField(
            "https://social.example.com", VALID_TOKEN, "tomorrow"
        )));
    }
}
