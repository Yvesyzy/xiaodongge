package com.yves.musicarchive;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.media.MediaMetadata;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Comparator;
import java.util.IdentityHashMap;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Only reads artwork published by the selected media session; never opens file paths. */
final class CodexNowPlayingArtwork {
    static final int MAX_INPUT_BYTES = 4 * 1024 * 1024;
    /** Keep generated PNG data URLs within the same byte budget accepted by the WebView. */
    static final int MAX_OUTPUT_BYTES = MAX_INPUT_BYTES;
    static final long MAX_PIXELS = 20_000_000L;
    private static final long MAX_BITMAP_ALLOCATION_BYTES = MAX_PIXELS * 4L;
    private static final int MAX_URI_LENGTH = 8192;
    private static final long WORK_DEADLINE_NANOS = 4_000_000_000L;
    private static final long READ_TIMEOUT_MILLIS = 4_500L;
    private static final String MIME_PNG = "image/png";
    private static final String MIME_JPEG = "image/jpeg";
    private static final String MIME_WEBP = "image/webp";
    private static final String MIME_GIF = "image/gif";
    private static final String MIME_BMP = "image/bmp";
    private static final String[] BITMAP_KEYS = {
        MediaMetadata.METADATA_KEY_ALBUM_ART,
        MediaMetadata.METADATA_KEY_ART,
        MediaMetadata.METADATA_KEY_DISPLAY_ICON
    };
    private static final String[] URI_KEYS = {
        MediaMetadata.METADATA_KEY_ALBUM_ART_URI,
        MediaMetadata.METADATA_KEY_ART_URI,
        MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI
    };
    private static final ThreadPoolExecutor READER = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
        // One waiting task covers the gap between Future completion and worker handoff.
        // Providers still use one thread and cannot accumulate an unbounded queue.
        new ArrayBlockingQueue<>(1), task -> {
            Thread thread = new Thread(task, "codex-playback-artwork");
            thread.setDaemon(true);
            return thread;
        });

    static String read(Context context, MediaMetadata metadata) {
        AtomicReference<String> bitmapFallback = new AtomicReference<>();
        AtomicBoolean uriPhaseStarted = new AtomicBoolean(false);
        AtomicBoolean privacyRevoked = new AtomicBoolean(false);
        Future<String> pending = null;
        String result = null;
        try {
            pending = READER.submit(() -> readArtwork(context, metadata, bitmapFallback,
                uriPhaseStarted, privacyRevoked));
            result = pending.get(READ_TIMEOUT_MILLIS, TimeUnit.MILLISECONDS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        } catch (TimeoutException | RejectedExecutionException ignored) {
            // A blocked provider or an already busy reader cannot hold the bridge or spawn another reader.
        } catch (Exception ignored) {
            // Optional artwork must not prevent the selected track metadata from resolving.
        } finally {
            if (pending != null && !pending.isDone()) {
                pending.cancel(true);
                // A provider that ignores interruption must not leave a cancelled job occupying the queue.
                READER.purge();
            }
        }
        if (privacyRevoked.get()) return null;
        // If a provider ignored interruption, do not return a stale same-call fallback after consent was revoked.
        if (uriPhaseStarted.get() && !codex_PrivacyPlugin.isAccepted(context)) return null;
        return result != null ? result : bitmapFallback.get();
    }

    private static String readArtwork(Context context, MediaMetadata metadata,
            AtomicReference<String> bitmapFallback, AtomicBoolean uriPhaseStarted,
            AtomicBoolean privacyRevoked) {
        if (metadata == null) return null;
        long deadline = System.nanoTime() + WORK_DEADLINE_NANOS;
        ArtworkCandidate best = null;
        Bitmap[] bitmaps = new Bitmap[BITMAP_KEYS.length];
        Integer[] bitmapOrder = new Integer[BITMAP_KEYS.length];
        for (int index = 0; index < BITMAP_KEYS.length; index++) {
            bitmapOrder[index] = index;
            try { bitmaps[index] = metadata.getBitmap(BITMAP_KEYS[index]); }
            catch (RuntimeException | OutOfMemoryError ignored) { /* Try the other image keys. */ }
        }
        Arrays.sort(bitmapOrder, Comparator.<Integer>comparingLong(index -> bitmapArea(bitmaps[index])).reversed()
            .thenComparingInt(index -> index));
        IdentityHashMap<Bitmap, Boolean> attempted = new IdentityHashMap<>();
        // Encode the largest usable Bitmap first. Do not spend time/heap encoding smaller copies once
        // a fallback exists; URI files can still improve it without re-encoding their original bytes.
        for (int index : bitmapOrder) {
            if (Thread.currentThread().isInterrupted() || System.nanoTime() >= deadline) break;
            try {
                Bitmap image = bitmaps[index];
                if (image == null || attempted.put(image, Boolean.TRUE) != null) continue;
                ArtworkCandidate candidate = bitmapCandidate(image, index);
                if (candidate == null) continue;
                best = candidate;
                bitmapFallback.set(candidate.dataUrl);
                break;
            } catch (RuntimeException | OutOfMemoryError ignored) {
                // A bad provider Bitmap must not discard track text or the other artwork candidates.
            }
        }

        int sourceOrder = BITMAP_KEYS.length;
        for (String key : URI_KEYS) {
            if (Thread.currentThread().isInterrupted() || System.nanoTime() >= deadline) break;
            String value;
            try {
                value = metadata.getString(key);
            } catch (RuntimeException | OutOfMemoryError ignored) {
                sourceOrder++;
                continue;
            }
            if (value == null || value.length() == 0 || value.length() > MAX_URI_LENGTH) {
                sourceOrder++;
                continue;
            }
            Uri uri;
            try {
                uri = Uri.parse(value);
            } catch (RuntimeException ignored) {
                sourceOrder++;
                continue;
            }
            String scheme = uri.getScheme();
            if (!"content".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                sourceOrder++;
                continue;
            }
            uriPhaseStarted.set(true);
            if (!codex_PrivacyPlugin.isAccepted(context)) {
                privacyRevoked.set(true);
                return null;
            }
            try {
                byte[] bytes;
                if ("content".equalsIgnoreCase(scheme) && uri.getAuthority() != null) {
                    try (InputStream input = context.getContentResolver().openInputStream(uri)) {
                        bytes = readBounded(input, deadline);
                    }
                } else if ("https".equalsIgnoreCase(scheme)) {
                    bytes = download(context, new URL(value), deadline);
                } else {
                    sourceOrder++;
                    continue;
                }
                if (!codex_PrivacyPlugin.isAccepted(context)) {
                    privacyRevoked.set(true);
                    return null;
                }
                ArtworkCandidate candidate = originalCandidate(bytes, sourceOrder++);
                if (isBetterCandidate(best, candidate)) best = candidate;
            } catch (IOException | RuntimeException | OutOfMemoryError ignored) {
                sourceOrder++;
                // Missing grants, malformed images, and blocked URLs are optional artwork.
            }
        }

        if (best == null) return null;
        if (uriPhaseStarted.get() && !codex_PrivacyPlugin.isAccepted(context)) {
            privacyRevoked.set(true);
            return null;
        }
        return dataUrl(best);
    }

    private static ArtworkCandidate bitmapCandidate(Bitmap image, int sourceOrder) {
        if (image == null || image.isRecycled()) return null;
        int width = image.getWidth();
        int height = image.getHeight();
        if (!isSafeDimensions(width, height)) return null;
        String encoded = encode(image);
        return encoded == null ? null : new ArtworkCandidate(width, height, false, MIME_PNG,
            null, encoded, sourceOrder);
    }

    private static long bitmapArea(Bitmap image) {
        try {
            return image != null && !image.isRecycled() && isSafeDimensions(image.getWidth(), image.getHeight())
                ? (long) image.getWidth() * image.getHeight() : 0;
        } catch (RuntimeException ignored) { return 0; }
    }

    /** Encodes an Android Bitmap at its received dimensions using lossless PNG. */
    static String encode(Bitmap image) {
        if (image == null || image.isRecycled() || !isSafeDimensions(image.getWidth(), image.getHeight())) return null;
        Bitmap owned = null;
        try {
            if (image.getAllocationByteCount() > MAX_BITMAP_ALLOCATION_BYTES) return null;
            // Preserve F16/wide-gamut configuration instead of proactively reducing it to eight bits.
            if (image.getConfig() == Bitmap.Config.ALPHA_8) {
                // PNG needs explicit alpha pixels; this copy expands, rather than reduces, alpha precision.
                owned = image.copy(Bitmap.Config.ARGB_8888, false);
                return owned == null ? null : encodePng(owned);
            }
            String direct = encodePng(image);
            if (direct != null) return direct;
            if (Build.VERSION.SDK_INT >= 26 && image.getConfig() == Bitmap.Config.HARDWARE
                    && (long) image.getWidth() * image.getHeight() * 8 <= MAX_BITMAP_ALLOCATION_BYTES) {
                owned = image.copy(Bitmap.Config.RGBA_F16, false);
                return owned == null ? null : encodePng(owned);
            }
            return null;
        } catch (Exception | OutOfMemoryError ignored) {
            return null;
        } finally {
            if (owned != null && !owned.isRecycled()) owned.recycle();
        }
    }

    private static String encodePng(Bitmap source) {
        try {
            BoundedOutputStream output = new BoundedOutputStream(MAX_OUTPUT_BYTES);
            if (!source.compress(Bitmap.CompressFormat.PNG, 100, output) || output.isOverflowed()) return null;
            return "data:" + MIME_PNG + ";base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        } catch (Exception | OutOfMemoryError ignored) { return null; }
    }

    /**
     * Validates the source with bounded decoding and returns its original bytes unchanged.
     * This is package-visible for the Android image tests; URI callers use the same path below.
     */
    static String encodeOriginal(byte[] bytes) {
        ArtworkCandidate candidate = originalCandidate(bytes, 0);
        return candidate == null ? null : dataUrl(candidate);
    }

    private static ArtworkCandidate originalCandidate(byte[] bytes, int sourceOrder) {
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_INPUT_BYTES) return null;
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try {
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        } catch (RuntimeException | OutOfMemoryError ignored) {
            return null;
        }
        if (!isBrowserImageMime(bounds.outMimeType) || !isSafeDimensions(bounds.outWidth, bounds.outHeight)) return null;
        Bitmap validation = null;
        try {
            BitmapFactory.Options probe = new BitmapFactory.Options();
            probe.inPreferredConfig = Bitmap.Config.ARGB_8888;
            probe.inScaled = false;
            probe.inSampleSize = 1;
            while (Math.max(bounds.outWidth, bounds.outHeight) / probe.inSampleSize > 1024) probe.inSampleSize *= 2;
            // This temporary sample only checks decodability. Stored/output bytes remain the full source.
            if (Build.VERSION.SDK_INT >= 28) {
                validation = Api28Validation.decode(bytes, probe.inSampleSize);
            } else {
                if (!hasLegacyImageEnd(bytes, bounds.outMimeType)) return null;
                validation = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, probe);
            }
            if (validation == null) return null;
        } catch (Exception | OutOfMemoryError ignored) { return null; }
        finally { if (validation != null) validation.recycle(); }
        return new ArtworkCandidate(bounds.outWidth, bounds.outHeight, true, bounds.outMimeType,
            bytes, null, sourceOrder);
    }

    private static boolean isBrowserImageMime(String mimeType) {
        return MIME_PNG.equals(mimeType) || MIME_JPEG.equals(mimeType) || MIME_WEBP.equals(mimeType)
            || MIME_GIF.equals(mimeType) || MIME_BMP.equals(mimeType);
    }

    private static boolean hasLegacyImageEnd(byte[] bytes, String mimeType) {
        // BitmapFactory can return a partial bitmap. Older Android lacks ImageDecoder's strict
        // partial-image callback, so also require the common PNG/JPEG/GIF end markers.
        int length = bytes.length;
        if (MIME_PNG.equals(mimeType)) {
            return length >= 12 && bytes[length - 12] == 0 && bytes[length - 11] == 0
                && bytes[length - 10] == 0 && bytes[length - 9] == 0
                && bytes[length - 8] == 'I' && bytes[length - 7] == 'E'
                && bytes[length - 6] == 'N' && bytes[length - 5] == 'D';
        }
        if (MIME_JPEG.equals(mimeType)) return length >= 2 && (bytes[length - 2] & 255) == 255 && (bytes[length - 1] & 255) == 217;
        if (MIME_GIF.equals(mimeType)) return length >= 1 && (bytes[length - 1] & 255) == 59;
        return true;
    }

    @android.annotation.TargetApi(28)
    private static final class Api28Validation {
        static Bitmap decode(byte[] bytes, int sampleSize) throws IOException {
            return ImageDecoder.decodeBitmap(ImageDecoder.createSource(ByteBuffer.wrap(bytes)), (decoder, info, source) -> {
                decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                decoder.setTargetSampleSize(sampleSize);
                decoder.setOnPartialImageListener(error -> false);
            });
        }
    }

    private static boolean isSafeDimensions(int width, int height) {
        return width > 0 && height > 0 && (long) width * height <= MAX_PIXELS;
    }

    private static String dataUrl(ArtworkCandidate candidate) {
        if (candidate == null) return null;
        try {
            if (candidate.dataUrl != null) return candidate.dataUrl;
            if (candidate.bytes == null || candidate.mimeType == null) return null;
            return "data:" + candidate.mimeType + ";base64," + Base64.encodeToString(candidate.bytes, Base64.NO_WRAP);
        } catch (OutOfMemoryError ignored) {
            return null;
        }
    }

    /** Selects the largest usable candidate; equal areas prefer original source bytes, then metadata order. */
    static ArtworkCandidate chooseBetter(ArtworkCandidate current, ArtworkCandidate candidate) {
        if (candidate == null) return current;
        if (current == null) return candidate;
        long candidateArea = (long) candidate.width * candidate.height;
        long currentArea = (long) current.width * current.height;
        if (candidateArea != currentArea) return candidateArea > currentArea ? candidate : current;
        if (((candidate.width == current.width && candidate.height == current.height)
                || (candidate.width == current.height && candidate.height == current.width))
                && candidate.originalBytes != current.originalBytes) {
            return candidate.originalBytes ? candidate : current;
        }
        return candidate.sourceOrder < current.sourceOrder ? candidate : current;
    }

    private static boolean isBetterCandidate(ArtworkCandidate current, ArtworkCandidate candidate) {
        return candidate != null && chooseBetter(current, candidate) == candidate;
    }

    static byte[] readBounded(InputStream input, long deadline) throws IOException {
        if (input == null) throw new IOException("Artwork unavailable");
        BoundedOutputStream output = new BoundedOutputStream(MAX_INPUT_BYTES);
        byte[] buffer = new byte[8192];
        while (true) {
            if (Thread.currentThread().isInterrupted() || System.nanoTime() >= deadline) {
                throw new IOException("Artwork read expired");
            }
            int count = input.read(buffer);
            if (count < 0) break;
            if (count == 0) continue;
            output.write(buffer, 0, count);
        }
        if (Thread.currentThread().isInterrupted() || System.nanoTime() >= deadline) {
            throw new IOException("Artwork read expired");
        }
        return output.toByteArray();
    }

    private static byte[] download(Context context, URL url, long deadline) throws IOException {
        for (int redirects = 0; redirects <= 2; redirects++) {
            if (Thread.currentThread().isInterrupted() || !codex_PrivacyPlugin.isAccepted(context)
                    || System.nanoTime() >= deadline) {
                throw new IOException("Artwork cancelled");
            }
            if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo() != null
                    || (url.getPort() != -1 && url.getPort() != 443)) throw new IOException("Unsupported artwork URL");
            for (InetAddress address : InetAddress.getAllByName(url.getHost())) {
                if (Thread.currentThread().isInterrupted() || System.nanoTime() >= deadline) {
                    throw new IOException("Artwork cancelled");
                }
                byte[] raw = address.getAddress();
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress()
                        || (raw.length == 16 && (raw[0] & 0xfe) == 0xfc)) throw new IOException("Non-public artwork URL");
            }
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            int remaining = (int) Math.max(1, Math.min(Integer.MAX_VALUE,
                (deadline - System.nanoTime()) / 1_000_000L));
            connection.setConnectTimeout(Math.min(1500, remaining));
            connection.setReadTimeout(Math.min(1500, remaining));
            connection.setRequestProperty("Accept", "image/*");
            try {
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new IOException("Artwork redirect missing");
                    url = new URL(url, location);
                    continue;
                }
                if (status != HttpURLConnection.HTTP_OK || connection.getContentLengthLong() > MAX_INPUT_BYTES) {
                    throw new IOException("Artwork response rejected");
                }
                try (InputStream input = connection.getInputStream()) { return readBounded(input, deadline); }
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("Artwork redirects exceeded");
    }

    /** Testable output guard that fails before a write can exceed its exact byte budget. */
    static final class BoundedOutputStream extends OutputStream {
        private final int limit;
        private byte[] buffer;
        private int count;
        private boolean overflowed;

        BoundedOutputStream(int limit) {
            if (limit < 0) throw new IllegalArgumentException("Negative output limit");
            this.limit = limit;
            this.buffer = new byte[Math.min(8192, limit)];
        }

        @Override public void write(int value) throws IOException {
            ensureCapacity(1);
            buffer[count++] = (byte) value;
        }

        @Override public void write(byte[] source, int offset, int length) throws IOException {
            if (source == null) throw new NullPointerException("source");
            if ((offset | length) < 0 || offset > source.length || source.length - offset < length) {
                throw new IndexOutOfBoundsException();
            }
            ensureCapacity(length);
            System.arraycopy(source, offset, buffer, count, length);
            count += length;
        }

        private void ensureCapacity(int additional) throws IOException {
            if (additional > limit - count) {
                overflowed = true;
                throw new IOException("Artwork output limit exceeded");
            }
            int required = count + additional;
            if (required <= buffer.length) return;
            int doubled = buffer.length == 0 ? 1 : buffer.length * 2;
            int next = Math.min(limit, Math.max(required, doubled));
            buffer = Arrays.copyOf(buffer, next);
        }

        boolean isOverflowed() { return overflowed; }
        int size() { return count; }
        byte[] toByteArray() { return Arrays.copyOf(buffer, count); }
    }

    /** Package-visible only so pure tests can exercise ranking without decoding Android image bytes. */
    static final class ArtworkCandidate {
        final int width;
        final int height;
        final boolean originalBytes;
        final String mimeType;
        final byte[] bytes;
        final String dataUrl;
        final int sourceOrder;

        ArtworkCandidate(int width, int height, boolean originalBytes, String mimeType,
                byte[] bytes, String dataUrl, int sourceOrder) {
            this.width = width;
            this.height = height;
            this.originalBytes = originalBytes;
            this.mimeType = mimeType;
            this.bytes = bytes;
            this.dataUrl = dataUrl;
            this.sourceOrder = sourceOrder;
        }
    }

    private CodexNowPlayingArtwork() {}
}
