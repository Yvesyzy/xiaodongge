package com.yves.musicarchive;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.CRC32;

/** Pure validation helpers for publication clipboard and ZIP export payloads. */
final class NativeExportValidation {
    static final int MAX_BINARY_BYTES = 8 * 1024 * 1024;
    static final int MAX_CLIPBOARD_UTF8_BYTES = 512 * 1024;

    private static final int EOCD_LENGTH = 22;
    private static final int ZIP64_SENTINEL_16 = 0xffff;
    private static final long ZIP64_SENTINEL_32 = 0xffffffffL;

    private NativeExportValidation() {
    }

    static boolean isValidClipboardPayload(String text, String html) {
        if (text == null || text.isEmpty() || html == null || html.isEmpty()) return false;
        long totalBytes = (long) utf8Length(text) + utf8Length(html);
        return totalBytes <= MAX_CLIPBOARD_UTF8_BYTES && isSafeClipboardHtml(html);
    }

    private static int utf8Length(String value) {
        return value.getBytes(StandardCharsets.UTF_8).length;
    }

    /**
     * The publication model supplies a text-only fragment with inline style attributes. Keep
     * this check deliberately structural: reject executable elements, handlers, images, and URL
     * loads while allowing the model's section/div/p/h2/strong/span/br markup and ordinary text.
     */
    static boolean isSafeClipboardHtml(String html) {
        if (html == null || html.isEmpty()) return false;
        int index = 0;
        while (index < html.length()) {
            int tagStart = html.indexOf('<', index);
            if (tagStart < 0) return true;
            int tagEnd = findTagEnd(html, tagStart + 1);
            if (tagEnd < 0) return false;
            String body = html.substring(tagStart + 1, tagEnd);
            if (!validateTag(body)) return false;
            index = tagEnd + 1;
        }
        return true;
    }

    private static int findTagEnd(String value, int start) {
        char quote = 0;
        for (int index = start; index < value.length(); index++) {
            char character = value.charAt(index);
            if (quote != 0) {
                if (character == quote) quote = 0;
            } else if (character == '\'' || character == '"') {
                quote = character;
            } else if (character == '>') {
                return index;
            }
        }
        return -1;
    }

    private static boolean validateTag(String rawBody) {
        int length = rawBody.length();
        int index = skipWhitespace(rawBody, 0);
        if (index >= length) return false;

        if (rawBody.startsWith("!--", index)) {
            // Comments do not execute in a clipboard fragment, but do not accept an unterminated
            // comment as a tag body because the browser's interpretation would be ambiguous.
            return rawBody.endsWith("--");
        }
        if (rawBody.charAt(index) == '!' || rawBody.charAt(index) == '?') return false;

        boolean closing = false;
        if (rawBody.charAt(index) == '/') {
            closing = true;
            index = skipWhitespace(rawBody, index + 1);
        }
        int nameStart = index;
        while (index < length && isNameCharacter(rawBody.charAt(index))) index++;
        if (nameStart == index) return false;
        String name = rawBody.substring(nameStart, index).toLowerCase(Locale.ROOT);
        if (!isAllowedElement(name)) return false;

        if (closing) {
            return skipWhitespace(rawBody, index) == length;
        }

        while (index < length) {
            index = skipWhitespace(rawBody, index);
            if (index >= length) return true;
            if (rawBody.charAt(index) == '/') {
                index = skipWhitespace(rawBody, index + 1);
                if (index >= length) return true;
            }

            int attributeStart = index;
            while (index < length && isAttributeCharacter(rawBody.charAt(index))) index++;
            if (attributeStart == index) return false;
            String attribute = rawBody.substring(attributeStart, index).toLowerCase(Locale.ROOT);
            if (attribute.startsWith("on") && attribute.length() > 2) return false;
            if (!"style".equals(attribute)) return false;

            index = skipWhitespace(rawBody, index);
            if (index >= length || rawBody.charAt(index) != '=') return false;
            index = skipWhitespace(rawBody, index + 1);
            if (index >= length) return false;

            int valueStart = index;
            char quote = rawBody.charAt(index);
            if (quote == '\'' || quote == '"') {
                index++;
                valueStart = index;
                while (index < length && rawBody.charAt(index) != quote) index++;
                if (index >= length) return false;
            } else {
                while (index < length && !isWhitespace(rawBody.charAt(index))) index++;
            }
            String value = rawBody.substring(valueStart, index);
            if (!isSafeInlineStyle(value)) return false;
            if (quote == '\'' || quote == '"') index++;
        }
        return true;
    }

    private static boolean isAllowedElement(String name) {
        return "section".equals(name)
            || "div".equals(name)
            || "p".equals(name)
            || "h2".equals(name)
            || "strong".equals(name)
            || "span".equals(name)
            || "br".equals(name);
    }

    private static boolean isSafeInlineStyle(String style) {
        if (style.isEmpty() || style.indexOf('&') >= 0 || style.indexOf('\\') >= 0
            || style.indexOf('(') >= 0 || style.indexOf(')') >= 0 || style.indexOf('@') >= 0) return false;
        String[] declarations = style.split(";", -1);
        boolean found = false;
        for (String declaration : declarations) {
            String trimmed = declaration.trim();
            if (trimmed.isEmpty()) continue;
            int separator = trimmed.indexOf(':');
            if (separator <= 0 || separator != trimmed.lastIndexOf(':')) return false;
            String property = trimmed.substring(0, separator).trim().toLowerCase(Locale.ROOT);
            String value = trimmed.substring(separator + 1).trim();
            if (!isAllowedStyleProperty(property) || value.isEmpty() || !isSimpleStyleValue(value)) return false;
            found = true;
        }
        return found;
    }

    private static boolean isAllowedStyleProperty(String property) {
        return "margin".equals(property)
            || "line-height".equals(property)
            || "color".equals(property)
            || "font-size".equals(property)
            || "font-weight".equals(property)
            || "white-space".equals(property);
    }

    private static boolean isSimpleStyleValue(String value) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (isWhitespace(character) || character >= '0' && character <= '9'
                || character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z'
                || character == '#' || character == '.' || character == '%' || character == ','
                || character == '-' || character == '+') continue;
            return false;
        }
        return true;
    }

    private static boolean isNameCharacter(char character) {
        return character >= 'a' && character <= 'z'
            || character >= 'A' && character <= 'Z'
            || character >= '0' && character <= '9'
            || character == ':'
            || character == '-';
    }

    private static boolean isAttributeCharacter(char character) {
        return isNameCharacter(character) || character == '_';
    }

    private static boolean isWhitespace(char character) {
        return character == ' ' || character == '\t' || character == '\r' || character == '\n' || character == '\f';
    }

    private static int skipWhitespace(String value, int index) {
        while (index < value.length() && isWhitespace(value.charAt(index))) index++;
        return index;
    }

    static boolean isStrictBase64(String value) {
        if (value == null || value.isEmpty() || value.length() % 4 != 0) return false;
        for (int index = 0; index < value.length(); index += 4) {
            int first = base64Value(value.charAt(index));
            int second = base64Value(value.charAt(index + 1));
            char thirdCharacter = value.charAt(index + 2);
            char fourthCharacter = value.charAt(index + 3);
            if (first < 0 || second < 0) return false;
            if (thirdCharacter == '=') {
                if (fourthCharacter != '=' || index + 4 != value.length() || (second & 0x0f) != 0) return false;
                continue;
            }
            int third = base64Value(thirdCharacter);
            if (third < 0) return false;
            if (fourthCharacter == '=') {
                if (index + 4 != value.length() || (third & 0x03) != 0) return false;
                continue;
            }
            if (base64Value(fourthCharacter) < 0) return false;
        }
        return true;
    }

    private static int base64Value(char value) {
        if (value >= 'A' && value <= 'Z') return value - 'A';
        if (value >= 'a' && value <= 'z') return value - 'a' + 26;
        if (value >= '0' && value <= '9') return value - '0' + 52;
        if (value == '+') return 62;
        if (value == '/') return 63;
        return -1;
    }

    static boolean isValidZipArchive(byte[] value) {
        if (value == null || value.length < EOCD_LENGTH || value.length > MAX_BINARY_BYTES) return false;
        int firstEocd = Math.max(0, value.length - EOCD_LENGTH - 0xffff);
        for (int eocd = value.length - EOCD_LENGTH; eocd >= firstEocd; eocd--) {
            if (!hasSignature(value, eocd, 0x06054b50)) continue;
            int commentLength = readUnsignedShort(value, eocd + 20);
            if ((long) eocd + EOCD_LENGTH + commentLength != value.length) continue;
            if (isValidZipAtEocd(value, eocd)) return true;
        }
        return false;
    }

    private static boolean isValidZipAtEocd(byte[] value, int eocd) {
        int diskNumber = readUnsignedShort(value, eocd + 4);
        int centralDisk = readUnsignedShort(value, eocd + 6);
        int entriesOnDisk = readUnsignedShort(value, eocd + 8);
        int totalEntries = readUnsignedShort(value, eocd + 10);
        long centralSize = readUnsignedInt(value, eocd + 12);
        long centralOffset = readUnsignedInt(value, eocd + 16);
        if (diskNumber != 0 || centralDisk != 0 || entriesOnDisk != totalEntries
            || entriesOnDisk == ZIP64_SENTINEL_16 || totalEntries == ZIP64_SENTINEL_16
            || centralSize == ZIP64_SENTINEL_32 || centralOffset == ZIP64_SENTINEL_32) return false;
        if (centralOffset + centralSize != eocd || centralOffset > eocd || centralSize > eocd) return false;
        if (totalEntries == 0) return centralOffset == 0 && centralSize == 0 && eocd == 0;
        if (centralSize < (long) totalEntries * 46L) return false;

        int centralStart = (int) centralOffset;
        int centralEnd = eocd;
        int cursor = centralStart;
        for (int entry = 0; entry < totalEntries; entry++) {
            if (cursor < centralStart || cursor + 46 > centralEnd || !hasSignature(value, cursor, 0x02014b50)) return false;
            int flags = readUnsignedShort(value, cursor + 8);
            int method = readUnsignedShort(value, cursor + 10);
            long crc = readUnsignedInt(value, cursor + 16);
            long compressedSize = readUnsignedInt(value, cursor + 20);
            long uncompressedSize = readUnsignedInt(value, cursor + 24);
            int nameLength = readUnsignedShort(value, cursor + 28);
            int extraLength = readUnsignedShort(value, cursor + 30);
            int commentLength = readUnsignedShort(value, cursor + 32);
            long localOffset = readUnsignedInt(value, cursor + 42);
            if (compressedSize == ZIP64_SENTINEL_32 || uncompressedSize == ZIP64_SENTINEL_32
                || localOffset == ZIP64_SENTINEL_32 || method != 0 || (flags & 0x0001) != 0) return false;
            long next = (long) cursor + 46L + nameLength + extraLength + commentLength;
            if (next > centralEnd || localOffset >= centralOffset) return false;
            if (!isValidLocalEntry(value, (int) localOffset, centralStart, flags, method, crc,
                compressedSize, uncompressedSize, value, cursor + 46, nameLength)) return false;
            cursor = (int) next;
        }
        return cursor == centralEnd;
    }

    private static boolean isValidLocalEntry(byte[] value, int localOffset, int centralStart,
        int centralFlags, int centralMethod, long centralCrc, long centralCompressedSize,
        long centralUncompressedSize, byte[] centralValue, int centralNameOffset, int centralNameLength) {
        if (localOffset < 0 || localOffset + 30 > centralStart || !hasSignature(value, localOffset, 0x04034b50)) return false;
        int localFlags = readUnsignedShort(value, localOffset + 6);
        int localMethod = readUnsignedShort(value, localOffset + 8);
        long localCrc = readUnsignedInt(value, localOffset + 14);
        long localCompressedSize = readUnsignedInt(value, localOffset + 18);
        long localUncompressedSize = readUnsignedInt(value, localOffset + 22);
        int localNameLength = readUnsignedShort(value, localOffset + 26);
        int localExtraLength = readUnsignedShort(value, localOffset + 28);
        long dataStart = (long) localOffset + 30L + localNameLength + localExtraLength;
        if (dataStart > centralStart || localFlags != centralFlags || localMethod != centralMethod
            || localCompressedSize == ZIP64_SENTINEL_32 || localUncompressedSize == ZIP64_SENTINEL_32
            || localNameLength != centralNameLength || !sameBytes(value, localOffset + 30, centralValue,
                centralNameOffset, localNameLength)) return false;
        boolean dataDescriptor = (centralFlags & 0x0008) != 0;
        if (!dataDescriptor && (localCrc != centralCrc || localCompressedSize != centralCompressedSize
            || localUncompressedSize != centralUncompressedSize)) return false;
        long dataEnd = dataStart + centralCompressedSize;
        if (dataEnd > centralStart || dataEnd > Integer.MAX_VALUE) return false;
        CRC32 crc = new CRC32();
        crc.update(value, (int) dataStart, (int) centralCompressedSize);
        return crc.getValue() == centralCrc && centralCompressedSize == centralUncompressedSize;
    }

    private static boolean sameBytes(byte[] first, int firstOffset, byte[] second, int secondOffset, int length) {
        if (firstOffset < 0 || secondOffset < 0 || (long) firstOffset + length > first.length
            || (long) secondOffset + length > second.length) return false;
        for (int index = 0; index < length; index++) {
            if (first[firstOffset + index] != second[secondOffset + index]) return false;
        }
        return true;
    }

    private static boolean hasSignature(byte[] value, int offset, int signature) {
        if (offset < 0 || offset + 4 > value.length) return false;
        return ((value[offset] & 0xff)
            | ((value[offset + 1] & 0xff) << 8)
            | ((value[offset + 2] & 0xff) << 16)
            | ((value[offset + 3] & 0xff) << 24)) == signature;
    }

    private static int readUnsignedShort(byte[] value, int offset) {
        return (value[offset] & 0xff) | ((value[offset + 1] & 0xff) << 8);
    }

    private static long readUnsignedInt(byte[] value, int offset) {
        return (value[offset] & 0xffL)
            | ((value[offset + 1] & 0xffL) << 8)
            | ((value[offset + 2] & 0xffL) << 16)
            | ((value[offset + 3] & 0xffL) << 24);
    }
}
