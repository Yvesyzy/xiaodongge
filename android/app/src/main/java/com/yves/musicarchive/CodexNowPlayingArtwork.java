package com.yves.musicarchive;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.net.Uri;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.util.concurrent.Future;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Only reads artwork published by the selected media session; never opens file paths. */
final class CodexNowPlayingArtwork {
    static final int MAX_INPUT_BYTES = 4 * 1024 * 1024;
    static final int MAX_OUTPUT_BYTES = 1_000_000;
    static final int MAX_EDGE = 512;
    private static final long MAX_PIXELS = 20_000_000L;
    private static final ThreadPoolExecutor READER = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
        new SynchronousQueue<>(), task -> {
            Thread thread = new Thread(task, "codex-playback-artwork");
            thread.setDaemon(true);
            return thread;
        });

    static String read(Context context, MediaMetadata metadata) {
        Future<String> pending = null;
        try {
            pending = READER.submit(() -> readArtwork(context, metadata));
            return pending.get(4500, TimeUnit.MILLISECONDS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception ignored) {
            // A blocked provider or DNS resolver cannot indefinitely hold the bridge or spawn more readers.
            return null;
        } finally { if (pending != null && !pending.isDone()) pending.cancel(true); }
    }

    private static String readArtwork(Context context, MediaMetadata metadata) {
        for (String key : new String[] { MediaMetadata.METADATA_KEY_ALBUM_ART,
                MediaMetadata.METADATA_KEY_ART, MediaMetadata.METADATA_KEY_DISPLAY_ICON }) {
            try {
                String result = encode(metadata.getBitmap(key));
                if (result != null) return result;
            } catch (RuntimeException ignored) { /* A bad image must not discard track text. */ }
        }
        long deadline = System.nanoTime() + 4_000_000_000L;
        for (String key : new String[] { MediaMetadata.METADATA_KEY_ALBUM_ART_URI,
                MediaMetadata.METADATA_KEY_ART_URI, MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI }) {
            if (Thread.currentThread().isInterrupted() || !codex_PrivacyPlugin.isAccepted(context) || System.nanoTime() >= deadline) break;
            try {
                String value = metadata.getString(key);
                if (value == null || value.length() > 8192) continue;
                Uri uri = Uri.parse(value);
                byte[] bytes;
                if ("content".equals(uri.getScheme()) && uri.getAuthority() != null) {
                    try (InputStream input = context.getContentResolver().openInputStream(uri)) {
                        bytes = readBounded(input, deadline);
                    }
                } else if ("https".equals(uri.getScheme())) {
                    bytes = download(context, new URL(value), deadline);
                } else continue;
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0
                        || (long) bounds.outWidth * bounds.outHeight > MAX_PIXELS) continue;
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 1;
                while (Math.max(bounds.outWidth, bounds.outHeight) / options.inSampleSize > MAX_EDGE * 2) {
                    options.inSampleSize *= 2;
                }
                Bitmap image = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                try {
                    String result = encode(image);
                    if (result != null) return result;
                } finally { if (image != null) image.recycle(); }
            } catch (IOException | RuntimeException ignored) { /* Missing grants/URLs are optional artwork. */ }
        }
        return null;
    }

    static String encode(Bitmap image) {
        if (image == null || image.isRecycled() || image.getWidth() <= 0 || image.getHeight() <= 0) return null;
        double scale = Math.min(1.0, (double) MAX_EDGE / Math.max(image.getWidth(), image.getHeight()));
        Bitmap resized = scale < 1.0 ? Bitmap.createScaledBitmap(image,
            Math.max(1, (int) Math.round(image.getWidth() * scale)),
            Math.max(1, (int) Math.round(image.getHeight() * scale)), true) : image;
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            boolean alpha = resized.hasAlpha();
            if (!resized.compress(alpha ? Bitmap.CompressFormat.PNG : Bitmap.CompressFormat.JPEG, 90, output)
                    || output.size() > MAX_OUTPUT_BYTES) return null;
            return "data:image/" + (alpha ? "png" : "jpeg") + ";base64,"
                + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        } finally { if (resized != image) resized.recycle(); }
    }

    static byte[] readBounded(InputStream input, long deadline) throws IOException {
        if (input == null) throw new IOException("Artwork unavailable");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (Thread.currentThread().isInterrupted() || System.nanoTime() >= deadline || output.size() + count > MAX_INPUT_BYTES) {
                throw new IOException("Artwork limit exceeded");
            }
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    private static byte[] download(Context context, URL url, long deadline) throws IOException {
        for (int redirects = 0; redirects <= 2; redirects++) {
            if (!codex_PrivacyPlugin.isAccepted(context) || System.nanoTime() >= deadline) {
                throw new IOException("Artwork cancelled");
            }
            if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null
                    || (url.getPort() != -1 && url.getPort() != 443)) throw new IOException("Unsupported artwork URL");
            for (InetAddress address : InetAddress.getAllByName(url.getHost())) {
                byte[] raw = address.getAddress();
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress()
                        || (raw.length == 16 && (raw[0] & 0xfe) == 0xfc)) throw new IOException("Non-public artwork URL");
            }
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            int remaining = (int) Math.max(1, (deadline - System.nanoTime()) / 1_000_000L);
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
            } finally { connection.disconnect(); }
        }
        throw new IOException("Artwork redirects exceeded");
    }

    private CodexNowPlayingArtwork() {}
}
