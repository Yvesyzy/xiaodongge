package com.yves.musicarchive;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ColorSpace;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;
import android.media.MediaMetadata;
import android.os.Build;
import android.os.SystemClock;
import android.system.Os;
import android.system.OsConstants;
import android.util.Base64;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.core.content.FileProvider;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.util.Arrays;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Synthetic image tests for the isolated AVD; no user files, records or media sessions are read. */
@RunWith(AndroidJUnit4.class)
public class CodexPlaybackArtworkInstrumentedTest {
    @Test public void preservesBitmapDimensionsPixelsAlphaAndSource() {
        Bitmap source = Bitmap.createBitmap(1200, 600, Bitmap.Config.ARGB_8888);
        source.eraseColor(0x0012634d);
        source.setPixel(0, 0, 0xff12634d);
        source.setPixel(1199, 599, 0x80123456);
        try {
            String encoded = CodexNowPlayingArtwork.encode(source);
            assertNotNull(encoded);
            assertTrue(encoded.startsWith("data:image/png;base64,"));
            Bitmap image = decode(encoded);
            try {
                assertEquals(1200, image.getWidth());
                assertEquals(600, image.getHeight());
                assertEquals(source.getPixel(0, 0), image.getPixel(0, 0));
                assertEquals(source.getPixel(1199, 599), image.getPixel(1199, 599));
                assertFalse(source.isRecycled());
            } finally {
                image.recycle();
            }
        } finally {
            source.recycle();
        }
    }

    @Test public void choosesLargestBitmapAfterEarlierThumbnail() {
        Bitmap thumbnail = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888);
        Bitmap original = Bitmap.createBitmap(1200, 600, Bitmap.Config.ARGB_8888);
        thumbnail.eraseColor(0xff321000);
        original.eraseColor(0xff12634d);
        try {
            MediaMetadata metadata = new MediaMetadata.Builder()
                .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, thumbnail)
                .putBitmap(MediaMetadata.METADATA_KEY_ART, original)
                .build();
            String result = CodexNowPlayingArtwork.read(
                InstrumentationRegistry.getInstrumentation().getTargetContext(), metadata);
            assertNotNull(result);
            Bitmap image = decode(result);
            try {
                assertEquals(1200, image.getWidth());
                assertEquals(600, image.getHeight());
                assertEquals(0xff12634d, image.getPixel(0, 0));
                assertFalse(thumbnail.isRecycled());
                assertFalse(original.isRecycled());
            } finally {
                image.recycle();
            }
        } finally {
            thumbnail.recycle();
            original.recycle();
        }
    }

    @Test public void preservesOriginalPngBytesAndDimensions() {
        Bitmap source = Bitmap.createBitmap(960, 640, Bitmap.Config.ARGB_8888);
        source.eraseColor(0xff5d2a7d);
        source.setPixel(13, 17, 0x8040c0ff);
        byte[] original = null;
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            assertTrue(source.compress(Bitmap.CompressFormat.PNG, 100, output));
            original = output.toByteArray();
            String encoded = CodexNowPlayingArtwork.encodeOriginal(original);
            assertNotNull(encoded);
            assertTrue(encoded.startsWith("data:image/png;base64,"));
            byte[] returned = Base64.decode(encoded.substring(encoded.indexOf(',') + 1), Base64.DEFAULT);
            assertArrayEquals(original, returned);
            Bitmap image = decode(encoded);
            try {
                assertEquals(960, image.getWidth());
                assertEquals(640, image.getHeight());
                assertEquals(source.getPixel(13, 17), image.getPixel(13, 17));
                assertFalse(source.isRecycled());
            } finally {
                image.recycle();
            }
        } finally {
            source.recycle();
        }
    }

    @Test public void rejectsMalformedAndOversizedOriginalBytes() {
        assertNull(CodexNowPlayingArtwork.encodeOriginal(new byte[] { 1, 2, 3, 4 }));
        assertNull(CodexNowPlayingArtwork.encodeOriginal(new byte[CodexNowPlayingArtwork.MAX_INPUT_BYTES + 1]));
    }

    @Test public void preservesOriginalJpegAndWebpBytes() {
        Bitmap source = Bitmap.createBitmap(960, 640, Bitmap.Config.ARGB_8888);
        source.eraseColor(0xff12634d);
        try {
            for (Bitmap.CompressFormat format : new Bitmap.CompressFormat[] {
                    Bitmap.CompressFormat.JPEG, Bitmap.CompressFormat.WEBP }) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                assertTrue(source.compress(format, 100, output));
                byte[] original = output.toByteArray();
                String encoded = CodexNowPlayingArtwork.encodeOriginal(original);
                assertNotNull(format.name(), encoded);
                assertArrayEquals(original, Base64.decode(encoded.substring(encoded.indexOf(',') + 1), Base64.DEFAULT));
                assertFalse(source.isRecycled());
            }
        } finally { source.recycle(); }
    }

    @Test public void rejectsTruncatedOriginalWithReadableImageHeader() {
        Bitmap source = Bitmap.createBitmap(960, 640, Bitmap.Config.ARGB_8888);
        source.eraseColor(0xff12634d);
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            assertTrue(source.compress(Bitmap.CompressFormat.PNG, 100, output));
            byte[] original = output.toByteArray();
            assertNull(CodexNowPlayingArtwork.encodeOriginal(Arrays.copyOf(original, 33)));
            assertNull(CodexNowPlayingArtwork.encodeOriginal(Arrays.copyOf(original, original.length / 2)));
        } finally { source.recycle(); }
    }

    @Test public void preservesRgb565AndAlphaOnlyPixels() {
        for (Bitmap.Config config : new Bitmap.Config[] { Bitmap.Config.RGB_565, Bitmap.Config.ALPHA_8 }) {
            Bitmap source = Bitmap.createBitmap(640, 320, config);
            source.eraseColor(0x80123456);
            try {
                String encoded = CodexNowPlayingArtwork.encode(source);
                assertNotNull(config.name(), encoded);
                Bitmap decoded = decode(encoded);
                try {
                    assertEquals(640, decoded.getWidth());
                    assertEquals(320, decoded.getHeight());
                    assertEquals(config.name(), source.getPixel(0, 0), decoded.getPixel(0, 0));
                    assertFalse(source.isRecycled());
                } finally { decoded.recycle(); }
            } finally { source.recycle(); }
        }
    }

    @Test public void doesNotReduceF16P3ToEightBitPng() {
        if (Build.VERSION.SDK_INT < 26) return;
        ColorSpace space = ColorSpace.get(ColorSpace.Named.DISPLAY_P3);
        Bitmap source = Bitmap.createBitmap(64, 32, Bitmap.Config.RGBA_F16, true, space);
        source.eraseColor(Color.pack(0.812345f, 0.12345f, 0.54321f, 0.75f, space));
        try {
            String encoded = CodexNowPlayingArtwork.encode(source);
            assertNotNull(encoded);
            byte[] bytes = Base64.decode(encoded.substring(encoded.indexOf(',') + 1), Base64.DEFAULT);
            assertEquals(16, bytes[24] & 255);
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inPreferredConfig = Bitmap.Config.RGBA_F16;
            Bitmap decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            assertNotNull(decoded);
            try {
                assertEquals(Bitmap.Config.RGBA_F16, decoded.getConfig());
                assertEquals(space.getName(), decoded.getColorSpace().getName());
                float[] before = source.getColor(0, 0).getComponents();
                float[] after = decoded.getColor(0, 0).getComponents();
                for (int index = 0; index < before.length; index++) assertEquals(before[index], after[index], 0.001f);
                assertFalse(source.isRecycled());
            } finally { decoded.recycle(); }
        } finally { source.recycle(); }
    }

    @Test public void canReadHardwareBitmapWithoutRecyclingIt() {
        if (Build.VERSION.SDK_INT < 26) return;
        Bitmap source = Bitmap.createBitmap(640, 320, Bitmap.Config.ARGB_8888);
        source.eraseColor(0xff12634d);
        Bitmap hardware = source.copy(Bitmap.Config.HARDWARE, false);
        assertNotNull(hardware);
        try {
            String encoded = CodexNowPlayingArtwork.encode(hardware);
            assertNotNull(encoded);
            Bitmap decoded = decode(encoded);
            try {
                assertEquals(source.getWidth(), decoded.getWidth());
                assertEquals(source.getHeight(), decoded.getHeight());
                assertEquals(source.getPixel(0, 0), decoded.getPixel(0, 0));
                assertFalse(hardware.isRecycled());
            } finally { decoded.recycle(); }
        } finally { hardware.recycle(); source.recycle(); }
    }

    @Test public void checksArtworkIdentityAfterImageWait() {
        MediaMetadata before = new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, "A")
            .putString(MediaMetadata.METADATA_KEY_ARTIST, "artist").putString(MediaMetadata.METADATA_KEY_ALBUM, "album")
            .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, "id-a").build();
        assertTrue(NowPlayingPlugin.sameArtworkIdentity(before, before));
        MediaMetadata after = new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, "B")
            .putString(MediaMetadata.METADATA_KEY_ARTIST, "artist").putString(MediaMetadata.METADATA_KEY_ALBUM, "album")
            .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, "id-b").build();
        assertFalse(NowPlayingPlugin.sameArtworkIdentity(before, after));
        assertFalse(NowPlayingPlugin.sameArtworkIdentity(before, null));
    }

    @Test public void contentUriSelectsLargerOriginalAndPreservesItsBytes() throws Exception {
        Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferences fixture = fixtureConsent(target);
        Context context = consentContext(target, fixture);
        Bitmap bitmap = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888);
        bitmap.eraseColor(0xff12634d);
        try {
            for (int edge : new int[] { 64, 128, 960 }) {
                Bitmap fileImage = Bitmap.createBitmap(edge, edge, Bitmap.Config.ARGB_8888);
                fileImage.eraseColor(0xff5d2a7d);
                File file = File.createTempFile("codex_artwork_", ".png", target.getCacheDir());
                try {
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    assertTrue(fileImage.compress(Bitmap.CompressFormat.PNG, 100, bytes));
                    byte[] original = bytes.toByteArray();
                    try (FileOutputStream output = new FileOutputStream(file)) { output.write(original); }
                    MediaMetadata metadata = new MediaMetadata.Builder()
                        .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, bitmap)
                        .putString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI,
                            FileProvider.getUriForFile(target, target.getPackageName() + ".fileprovider", file).toString()).build();
                    String result = CodexNowPlayingArtwork.read(context, metadata);
                    assertNotNull("edge=" + edge + ", consent=" + codex_PrivacyPlugin.isAccepted(context)
                        + ", reader=" + readerState(), result);
                    if (edge >= 128) {
                        assertArrayEquals(original, Base64.decode(result.substring(result.indexOf(',') + 1), Base64.DEFAULT));
                    } else {
                        Bitmap decoded = decode(result);
                        try { assertEquals(128, decoded.getWidth()); assertEquals(bitmap.getPixel(0, 0), decoded.getPixel(0, 0)); }
                        finally { decoded.recycle(); }
                    }
                    assertFalse(bitmap.isRecycled());
                } finally { fileImage.recycle(); assertTrue(file.delete()); }
            }
        } finally { bitmap.recycle(); fixture.edit().clear().commit(); codex_PrivacyPlugin.syncRuntimeState(target); }
    }

    @Test public void blockedContentProviderRetainsSameCallBitmapAndDoesNotLeakIt() throws Exception {
        Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferences fixture = fixtureConsent(target);
        Context context = consentContext(target, fixture);
        File pipe = File.createTempFile("codex_artwork_pipe_", ".png", target.getCacheDir());
        assertTrue(pipe.delete());
        Os.mkfifo(pipe.getAbsolutePath(), 0600);
        Bitmap first = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888);
        Bitmap next = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888);
        first.eraseColor(0xff12634d); next.eraseColor(0xff5d2a7d);
        try {
          try {
            MediaMetadata blocked = new MediaMetadata.Builder().putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, first)
                .putString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI,
                    FileProvider.getUriForFile(target, target.getPackageName() + ".fileprovider", pipe).toString()).build();
            long started = SystemClock.elapsedRealtime();
            String result = CodexNowPlayingArtwork.read(context, blocked);
            long elapsed = SystemClock.elapsedRealtime() - started;
            assertNotNull(result);
            assertTrue("fixture must actually block the provider: " + elapsed, elapsed >= 4000);
            assertTrue("bridge timeout must stay bounded: " + elapsed, elapsed < 7000);
            Bitmap decoded = decode(result);
            try { assertEquals(first.getPixel(0, 0), decoded.getPixel(0, 0)); } finally { decoded.recycle(); }
            MediaMetadata waiting = new MediaMetadata.Builder().putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, next).build();
            long queuedAt = SystemClock.elapsedRealtime();
            assertNull("a queued request must not inherit another call's fallback", CodexNowPlayingArtwork.read(context, waiting));
            long queuedElapsed = SystemClock.elapsedRealtime() - queuedAt;
            assertTrue("queued request must actually reach its timeout: " + queuedElapsed, queuedElapsed >= 4000);
            assertTrue("queued timeout must stay bounded: " + queuedElapsed, queuedElapsed < 7000);
          } finally {
            // Release this test's FIFO opener even when the assertion fails; do not poison the single reader.
            try { FileDescriptor writer = Os.open(pipe.getAbsolutePath(), OsConstants.O_WRONLY | OsConstants.O_NONBLOCK, 0); Os.close(writer); }
            catch (Exception ignored) { /* The interrupted reader may already have left. */ }
            assertTrue(pipe.delete());
          }
            MediaMetadata following = new MediaMetadata.Builder().putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, next).build();
            String result = null;
            long deadline = SystemClock.elapsedRealtime() + 2000;
            do { result = CodexNowPlayingArtwork.read(context, following); if (result == null) SystemClock.sleep(10); }
            while (result == null && SystemClock.elapsedRealtime() < deadline);
            assertNotNull(result);
            Bitmap decoded = decode(result);
            try { assertEquals(next.getPixel(0, 0), decoded.getPixel(0, 0)); } finally { decoded.recycle(); }
        } finally { first.recycle(); next.recycle(); fixture.edit().clear().commit(); codex_PrivacyPlugin.syncRuntimeState(target); }
    }

    @Test public void oversizedLosslessOutputIsSkippedInsteadOfShrinking() {
        int width = 1536, height = 1024;
        int[] pixels = new int[width * height];
        int state = 123456789;
        for (int index = 0; index < pixels.length; index++) {
            state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
            pixels[index] = 0xff000000 | (state & 0x00ffffff);
        }
        Bitmap source = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888);
        try {
            assertNull(CodexNowPlayingArtwork.encode(source));
            assertFalse(source.isRecycled());
            assertEquals(width, source.getWidth());
            assertEquals(height, source.getHeight());
        } finally { source.recycle(); }
    }

    private static SharedPreferences fixtureConsent(Context target) {
        SharedPreferences fixture = target.getSharedPreferences("codex_artwork_fixture_consent", Context.MODE_PRIVATE);
        assertTrue(fixture.edit().putString("policyVersion", codex_PrivacyPlugin.POLICY_VERSION).putString("status", "accepted").commit());
        return fixture;
    }

    private static Context consentContext(Context target, SharedPreferences fixture) {
        Context context = new ContextWrapper(target) {
            @Override public SharedPreferences getSharedPreferences(String name, int mode) {
                return name.equals("codex_privacy_state") ? fixture : super.getSharedPreferences(name, mode);
            }
        };
        assertTrue(codex_PrivacyPlugin.syncRuntimeState(context));
        assertTrue(codex_PrivacyPlugin.isAccepted(context));
        return context;
    }

    @Test public void rejectsSlowProviderAfterDeadline() {
        InputStream slow = new InputStream() {
            @Override public int read() { return -1; }
            @Override public int read(byte[] buffer, int offset, int length) {
                SystemClock.sleep(50);
                return -1;
            }
        };
        assertThrows(IOException.class, () -> CodexNowPlayingArtwork.readBounded(slow, System.nanoTime() + 1_000_000L));
    }

    @Test public void readsEachMetadataBitmapKeyWithoutRecyclingSource() {
        for (String key : new String[] { MediaMetadata.METADATA_KEY_ALBUM_ART,
                MediaMetadata.METADATA_KEY_ART, MediaMetadata.METADATA_KEY_DISPLAY_ICON }) {
            Bitmap source = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888);
            try {
                source.eraseColor(0xff12634d);
                MediaMetadata metadata = new MediaMetadata.Builder().putBitmap(key, source).build();
                for (int attempt = 0; attempt < 32; attempt++) {
                    String result = CodexNowPlayingArtwork.read(
                        InstrumentationRegistry.getInstrumentation().getTargetContext(), metadata);
                    assertNotNull(key + " attempt=" + attempt + ", reader=" + readerState(), result);
                    assertTrue(result.startsWith("data:image/png;base64,"));
                    assertFalse(key, source.isRecycled());
                }
            } finally {
                source.recycle();
            }
        }
    }

    private static String readerState() {
        try {
            java.lang.reflect.Field field = CodexNowPlayingArtwork.class.getDeclaredField("READER");
            field.setAccessible(true);
            return String.valueOf(field.get(null));
        } catch (ReflectiveOperationException error) { return error.toString(); }
    }

    private static Bitmap decode(String dataUrl) {
        byte[] bytes = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
        Bitmap image = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        assertNotNull(image);
        return image;
    }
}
