package com.yves.musicarchive;

import java.net.URI;
import java.net.URISyntaxException;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure-Java trust-boundary checks for the Android social session contract.
 *
 * <p>This class deliberately does not depend on Android or Capacitor. The
 * encrypted store calls it for both bridge input and decrypted data so a
 * damaged plaintext cannot be returned as a session.</p>
 */
final class codex_SocialSessionValidation {
    static final int MAX_ENDPOINT_CHARS = 2048;
    static final int MAX_EXPIRES_AT_CHARS = 64;
    static final int TOKEN_LENGTH = 43;

    private static final Pattern ISO_8601 = Pattern.compile(
        "^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,9}))?(Z|[+-]\\d{2}:\\d{2})$"
    );

    private codex_SocialSessionValidation() {
    }

    /**
     * Returns the first invalid field name, or {@code null} when all fields
     * satisfy the storage contract.
     */
    static String invalidField(String endpoint, String token, String expiresAt) {
        if (!isValidEndpoint(endpoint)) return "endpoint";
        if (!isValidToken(token)) return "token";
        if (!isValidExpiresAt(expiresAt)) return "expiresAt";
        return null;
    }

    static boolean isValidSession(String endpoint, String token, String expiresAt) {
        return invalidField(endpoint, token, expiresAt) == null;
    }

    /**
     * Accept only an HTTPS origin. A path, query, fragment, user-info, or
     * opaque URI would allow a caller to silently change the service target.
     */
    static boolean isValidEndpoint(String value) {
        if (value == null || value.length() == 0 || value.length() > MAX_ENDPOINT_CHARS) return false;
        if (!value.equals(value.trim())) return false;
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            if (Character.isISOControl(character) || Character.isWhitespace(character)) return false;
        }

        try {
            URI uri = new URI(value);
            if (uri.isOpaque() || !"https".equalsIgnoreCase(uri.getScheme())) return false;
            if (uri.getRawAuthority() == null || uri.getRawAuthority().length() == 0) return false;
            if (uri.getHost() == null || uri.getHost().length() == 0) return false;
            if (uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) return false;
            String path = uri.getRawPath();
            if (path != null && path.length() != 0) return false;
            if (uri.getPort() < -1 || uri.getPort() > 65535) return false;
            // URI permits an empty explicit port in some runtimes; it is not an origin.
            if (uri.getRawAuthority().endsWith(":")) return false;
            return true;
        } catch (URISyntaxException | IllegalArgumentException error) {
            return false;
        }
    }

    /**
     * The service issues 32 random bytes encoded as unpadded base64url. A
     * 32-byte value has exactly 43 characters and the final character's low
     * two bits must be zero; checking that bit also rejects non-canonical
     * encodings without relying on an Android-only decoder.
     */
    static boolean isValidToken(String value) {
        if (value == null || value.length() != TOKEN_LENGTH) return false;
        for (int i = 0; i < value.length(); i++) {
            if (base64UrlValue(value.charAt(i)) < 0) return false;
        }
        return (base64UrlValue(value.charAt(value.length() - 1)) & 0x03) == 0;
    }

    /**
     * Accept the ISO-8601/RFC-3339 forms emitted by the service: second
     * precision or one to nine fractional digits, followed by Z or a
     * numeric offset. Date and time ranges are checked strictly. Android's
     * legacy parser validates milliseconds, so extra fractional precision is
     * truncated only for validation; the original string is stored unchanged.
     */
    static boolean isValidExpiresAt(String value) {
        if (value == null || value.length() == 0 || value.length() > MAX_EXPIRES_AT_CHARS) return false;
        Matcher matcher = ISO_8601.matcher(value);
        if (!matcher.matches()) return false;

        int year = parseDecimal(matcher.group(1));
        int month = parseDecimal(matcher.group(2));
        int day = parseDecimal(matcher.group(3));
        int hour = parseDecimal(matcher.group(4));
        int minute = parseDecimal(matcher.group(5));
        int second = parseDecimal(matcher.group(6));
        String fraction = matcher.group(7);
        String zone = matcher.group(8);

        if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31
            || hour > 23 || minute > 59 || second > 59) return false;
        if (!"Z".equals(zone)) {
            int offsetHour = parseDecimal(zone.substring(1, 3));
            int offsetMinute = parseDecimal(zone.substring(4, 6));
            if (offsetHour > 23 || offsetMinute > 59) return false;
        }

        String normalizedFraction;
        if (fraction == null) {
            normalizedFraction = null;
        } else if (fraction.length() > 3) {
            normalizedFraction = fraction.substring(0, 3);
        } else {
            normalizedFraction = fraction + "000".substring(fraction.length());
        }
        String parseValue = matcher.group(1) + "-" + matcher.group(2) + "-" + matcher.group(3)
            + "T" + matcher.group(4) + ":" + matcher.group(5) + ":" + matcher.group(6)
            + (normalizedFraction == null ? "" : "." + normalizedFraction) + zone;
        String pattern = normalizedFraction == null
            ? "yyyy-MM-dd'T'HH:mm:ssXXX"
            : "yyyy-MM-dd'T'HH:mm:ss.SSSXXX";
        SimpleDateFormat parser = new SimpleDateFormat(pattern, Locale.US);
        parser.setLenient(false);
        ParsePosition position = new ParsePosition(0);
        return parser.parse(parseValue, position) != null && position.getIndex() == parseValue.length();
    }

    private static int parseDecimal(String value) {
        int result = 0;
        for (int i = 0; i < value.length(); i++) {
            result = result * 10 + value.charAt(i) - '0';
        }
        return result;
    }

    private static int base64UrlValue(char value) {
        if (value >= 'A' && value <= 'Z') return value - 'A';
        if (value >= 'a' && value <= 'z') return value - 'a' + 26;
        if (value >= '0' && value <= '9') return value - '0' + 52;
        if (value == '-') return 62;
        if (value == '_') return 63;
        return -1;
    }
}
