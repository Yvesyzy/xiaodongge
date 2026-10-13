package com.yves.musicarchive;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.Test;

public class CodexPublicationNativeValidationTest {
    @Test
    public void clipboardPayloadAcceptsModelMarkupAndRejectsActiveOrImageMarkup() {
        String html = "<section style=\"font-weight: normal\"><div style=\"margin: 0 0 12px; line-height: 1.8; color: #333; font-size: 14px; font-weight: 700; white-space: pre-wrap\"><h2>标题</h2><p><strong>重点</strong> 与 <span style='color:#555'>正文</span><br /></p></div></section>";
        assertTrue(NativeExportValidation.isValidClipboardPayload("标题\n重点 与 正文", html));
        assertFalse(NativeExportValidation.isValidClipboardPayload("", html));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<p onclick =\"alert(1)\">正文</p>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<p><script>alert(1)</script></p>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<p><span style=\"background:url(java\nscript:alert(1))\">正文</span></p>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<div style=\"margin: url(/resource)\">正文</div>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<div style=\"margin: url(&#x2f;resource)\">正文</div>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<div style=\"margin: url(\\2f resource)\">正文</div>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<div class=\"unsafe\">正文</div>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<div style>正文</div>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<div style=\"background: #fff\">正文</div>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<p><a href=\"https://example.test\">正文</a></p>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<p><img src=\"cover.png\" /></p>"));
        assertFalse(NativeExportValidation.isValidClipboardPayload("正文", "<p style=\"color:red>未闭合"));
        assertTrue(NativeExportValidation.isValidClipboardPayload("用户写了 <script> 和 <img onerror=...>", "<p>用户写了 &lt;script&gt; 和 &lt;img onerror=...&gt;</p>"));
        assertTrue(NativeExportValidation.isValidClipboardPayload("正文 https://example.test", "<p>正文 https://example.test</p>"));
    }

    @Test
    public void clipboardPayloadUsesCombinedUtf8Limit() {
        String largeText = "界".repeat(NativeExportValidation.MAX_CLIPBOARD_UTF8_BYTES / 3);
        assertFalse(NativeExportValidation.isValidClipboardPayload(largeText, "<p>x</p>"));
    }

    @Test
    public void strictBase64UsesCanonicalPaddingAndRejectsWhitespace() {
        assertTrue(NativeExportValidation.isStrictBase64(Base64.getEncoder().encodeToString("内容".getBytes(StandardCharsets.UTF_8))));
        assertTrue(NativeExportValidation.isStrictBase64("Zm9v"));
        assertTrue(NativeExportValidation.isStrictBase64("Zg=="));
        assertTrue(NativeExportValidation.isStrictBase64("Zm8="));
        assertFalse(NativeExportValidation.isStrictBase64("AB=="));
        assertFalse(NativeExportValidation.isStrictBase64("AAB="));
        assertFalse(NativeExportValidation.isStrictBase64(" Zm9v"));
        assertFalse(NativeExportValidation.isStrictBase64("Zm9v\n"));
        assertFalse(NativeExportValidation.isStrictBase64("Zm=v"));
    }

    @Test
    public void zipValidatorAcceptsStandardZipAndRejectsUnboundedStructure() throws Exception {
        byte[] valid = zip("publication.txt", "标题\n正文");
        assertTrue(NativeExportValidation.isValidZipArchive(valid));
        assertFalse(NativeExportValidation.isValidZipArchive(Arrays.copyOf(valid, valid.length - 1)));

        byte[] badCrc = Arrays.copyOf(valid, valid.length);
        int local = findSignature(badCrc, 0x04034b50);
        int localNameLength = unsignedShort(badCrc, local + 26);
        int localExtraLength = unsignedShort(badCrc, local + 28);
        badCrc[local + 30 + localNameLength + localExtraLength] ^= 1;
        assertFalse(NativeExportValidation.isValidZipArchive(badCrc));

        byte[] badCentralSignature = Arrays.copyOf(valid, valid.length);
        int central = findSignature(badCentralSignature, 0x02014b50);
        badCentralSignature[central] = 0;
        assertFalse(NativeExportValidation.isValidZipArchive(badCentralSignature));

        byte[] badCentralBounds = Arrays.copyOf(valid, valid.length);
        badCentralBounds[central + 28] = (byte) 0xff;
        badCentralBounds[central + 29] = (byte) 0xff;
        assertFalse(NativeExportValidation.isValidZipArchive(badCentralBounds));

        byte[] badEocdOffset = Arrays.copyOf(valid, valid.length);
        int eocd = findSignature(badEocdOffset, 0x06054b50);
        badEocdOffset[eocd + 16] = 0;
        badEocdOffset[eocd + 17] = 0;
        badEocdOffset[eocd + 18] = 0;
        badEocdOffset[eocd + 19] = 0;
        assertFalse(NativeExportValidation.isValidZipArchive(badEocdOffset));

        assertFalse(NativeExportValidation.isValidZipArchive(deflatedZip("publication.txt", "标题\n正文")));
    }

    @Test
    public void emptyStandardZipIsAcceptedButLocalOnlyPayloadIsRejected() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            zip.finish();
        }
        assertTrue(NativeExportValidation.isValidZipArchive(output.toByteArray()));
        assertFalse(NativeExportValidation.isValidZipArchive(new byte[] {0x50, 0x4b, 0x03, 0x04}));
    }

    private static byte[] zip(String name, String content) throws IOException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        CRC32 crc = new CRC32();
        crc.update(bytes);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            ZipEntry entry = new ZipEntry(name);
            entry.setMethod(ZipEntry.STORED);
            entry.setSize(bytes.length);
            entry.setCompressedSize(bytes.length);
            entry.setCrc(crc.getValue());
            zip.putNextEntry(entry);
            zip.write(bytes);
            zip.closeEntry();
        }
        return output.toByteArray();
    }

    private static byte[] deflatedZip(String name, String content) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            zip.putNextEntry(new ZipEntry(name));
            zip.write(content.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return output.toByteArray();
    }

    private static int unsignedShort(byte[] value, int offset) {
        return (value[offset] & 0xff) | ((value[offset + 1] & 0xff) << 8);
    }

    private static int findSignature(byte[] value, int signature) {
        for (int index = 0; index <= value.length - 4; index++) {
            if (((value[index] & 0xff) | ((value[index + 1] & 0xff) << 8)
                | ((value[index + 2] & 0xff) << 16) | ((value[index + 3] & 0xff) << 24)) == signature) {
                return index;
            }
        }
        throw new AssertionError("signature missing");
    }
}
