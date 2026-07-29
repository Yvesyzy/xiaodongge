package com.yves.musicarchive;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "NowPlaying")
public class NowPlayingPlugin extends Plugin {
    private static final int MAX_RESPONSE_BYTES = 1_000_000;

    @PluginMethod
    public void getCurrentTrack(PluginCall call) {
        JSObject response = new JSObject();
        boolean accessEnabled = NotificationManagerCompat.getEnabledListenerPackages(getContext())
            .contains(getContext().getPackageName());
        response.put("accessEnabled", accessEnabled);
        if (!accessEnabled) {
            call.resolve(response);
            return;
        }

        try {
            MediaSessionManager manager = (MediaSessionManager) getContext()
                .getSystemService(Context.MEDIA_SESSION_SERVICE);
            ComponentName listener = new ComponentName(getContext(), NowPlayingNotificationService.class);
            List<MediaController> controllers = manager.getActiveSessions(listener);
            for (MediaController controller : controllers) {
                PlaybackState playbackState = controller.getPlaybackState();
                if (playbackState == null || playbackState.getState() != PlaybackState.STATE_PLAYING) continue;
                MediaMetadata metadata = controller.getMetadata();
                if (metadata == null) continue;
                String title = firstNotBlank(
                    metadata.getString(MediaMetadata.METADATA_KEY_TITLE),
                    metadata.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
                );
                if (title == null) continue;
                response.put("title", title);
                putIfNotBlank(response, "artistName", metadata.getString(MediaMetadata.METADATA_KEY_ARTIST));
                putIfNotBlank(response, "albumName", metadata.getString(MediaMetadata.METADATA_KEY_ALBUM));
                response.put("musicMetadata", readMusicMetadata(controller, metadata));
                break;
            }
            call.resolve(response);
        } catch (SecurityException error) {
            call.reject("无法读取媒体会话，请重新授予通知使用权", error);
        }
    }

    @PluginMethod
    public void searchCatalog(PluginCall call) {
        String title = clean(call.getString("title"));
        String artistName = clean(call.getString("artistName"));
        String albumName = clean(call.getString("albumName"));
        String country = call.getString("country", "CN");
        if (title == null || artistName == null) {
            call.reject("联网补全需要歌曲名和歌手");
            return;
        }
        if (!"CN".equals(country) && !"US".equals(country)) {
            call.reject("音乐目录国家代码无效");
            return;
        }

        try {
            String term = title + " " + artistName + (albumName == null ? "" : " " + albumName);
            String url = "https://itunes.apple.com/search?term="
                + URLEncoder.encode(term, StandardCharsets.UTF_8.name())
                + "&country=" + country + "&media=music&entity=song&limit=10";
            JSONArray results = fetchCatalog(url);
            JSObject response = new JSObject();
            response.put("country", country);
            response.put("results", results);
            call.resolve(response);
        } catch (SocketTimeoutException error) {
            call.reject("联网补全超时", error);
        } catch (IOException | JSONException error) {
            call.reject("音乐目录请求失败", error);
        }
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private JSObject readMusicMetadata(MediaController controller, MediaMetadata source) {
        JSObject target = new JSObject();
        putIfNotBlank(target, "albumArtistName", source.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST));
        putIfNotBlank(target, "authorName", source.getString(MediaMetadata.METADATA_KEY_AUTHOR));
        putIfNotBlank(target, "writerName", source.getString(MediaMetadata.METADATA_KEY_WRITER));
        putIfNotBlank(target, "composerName", source.getString(MediaMetadata.METADATA_KEY_COMPOSER));
        putIfNotBlank(target, "compilation", source.getString(MediaMetadata.METADATA_KEY_COMPILATION));
        putIfNotBlank(target, "releaseDate", source.getString(MediaMetadata.METADATA_KEY_DATE));
        putLongIfPresent(target, "releaseYear", source, MediaMetadata.METADATA_KEY_YEAR);
        putIfNotBlank(target, "genre", source.getString(MediaMetadata.METADATA_KEY_GENRE));
        putLongIfPresent(target, "durationMs", source, MediaMetadata.METADATA_KEY_DURATION);
        putLongIfPresent(target, "trackNumber", source, MediaMetadata.METADATA_KEY_TRACK_NUMBER);
        putLongIfPresent(target, "trackCount", source, MediaMetadata.METADATA_KEY_NUM_TRACKS);
        putLongIfPresent(target, "discNumber", source, MediaMetadata.METADATA_KEY_DISC_NUMBER);
        putIfNotBlank(target, "mediaId", source.getString(MediaMetadata.METADATA_KEY_MEDIA_ID));
        putIfNotBlank(target, "mediaUri", source.getString(MediaMetadata.METADATA_KEY_MEDIA_URI));
        putIfNotBlank(target, "artworkUri", firstNotBlank(
            source.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI),
            source.getString(MediaMetadata.METADATA_KEY_ART_URI),
            source.getString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI)
        ));
        putIfNotBlank(target, "displayTitle", source.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE));
        putIfNotBlank(target, "displaySubtitle", source.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE));
        putIfNotBlank(target, "displayDescription", source.getString(MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION));
        putIfNotBlank(target, "sourcePackage", controller.getPackageName());
        return target;
    }

    private JSONArray fetchCatalog(String urlValue) throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlValue).openConnection();
        connection.setConnectTimeout(5_000);
        connection.setReadTimeout(8_000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "XiaoDongGe Android");
        try {
            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + status);
            JSONObject body = new JSONObject(readBody(connection.getInputStream()));
            JSONArray rawResults = body.optJSONArray("results");
            if (rawResults == null) throw new JSONException("results missing");
            JSONArray results = new JSONArray();
            for (int index = 0; index < rawResults.length(); index++) {
                JSONObject raw = rawResults.optJSONObject(index);
                if (raw == null || !"song".equals(raw.optString("kind"))) continue;
                String trackName = clean(raw.optString("trackName", null));
                String artistName = clean(raw.optString("artistName", null));
                if (trackName == null || artistName == null) continue;
                JSONObject item = new JSONObject();
                item.put("trackName", trackName);
                item.put("artistName", artistName);
                copyString(raw, item, "collectionName");
                copyString(raw, item, "releaseDate");
                copyString(raw, item, "primaryGenreName");
                copyNonNegativeInt(raw, item, "trackTimeMillis");
                copyNonNegativeInt(raw, item, "trackNumber");
                copyNonNegativeInt(raw, item, "trackCount");
                copyNonNegativeInt(raw, item, "discNumber");
                copyNonNegativeInt(raw, item, "discCount");
                copyExplicitness(raw, item);
                copyId(raw, item, "trackId");
                copyId(raw, item, "collectionId");
                copyId(raw, item, "artistId");
                results.put(item);
            }
            return results;
        } finally {
            connection.disconnect();
        }
    }

    private String readBody(InputStream input) throws IOException {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8_192];
            int total = 0;
            int read;
            while ((read = stream.read(buffer)) != -1) {
                total += read;
                if (total > MAX_RESPONSE_BYTES) throw new IOException("response too large");
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void copyString(JSONObject source, JSONObject target, String key) throws JSONException {
        String value = clean(source.optString(key, null));
        if (value != null) target.put(key, value);
    }

    private void copyNonNegativeInt(JSONObject source, JSONObject target, String key) throws JSONException {
        if (!source.has(key) || source.isNull(key)) return;
        long value = source.optLong(key, -1);
        if (value >= 0 && value <= Integer.MAX_VALUE) target.put(key, value);
    }

    private void copyExplicitness(JSONObject source, JSONObject target) throws JSONException {
        String value = source.optString("trackExplicitness", null);
        if ("explicit".equals(value) || "cleaned".equals(value) || "notExplicit".equals(value)) {
            target.put("trackExplicitness", value);
        }
    }

    private void copyId(JSONObject source, JSONObject target, String key) throws JSONException {
        if (!source.has(key) || source.isNull(key)) return;
        Object value = source.get(key);
        if (value instanceof Number || value instanceof String) target.put(key, String.valueOf(value));
    }

    private void putLongIfPresent(JSObject target, String key, MediaMetadata source, String sourceKey) {
        if (!source.containsKey(sourceKey)) return;
        long value = source.getLong(sourceKey);
        if (value >= 0 && value <= Integer.MAX_VALUE) target.put(key, value);
    }

    private void putIfNotBlank(JSONObject target, String key, String value) {
        String clean = clean(value);
        if (clean == null) return;
        try {
            target.put(key, clean);
        } catch (JSONException ignored) {
            // JSONObject only rejects non-finite numbers; this branch receives strings.
        }
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            String clean = clean(value);
            if (clean != null) return clean;
        }
        return null;
    }

    private String clean(String value) {
        if (value == null) return null;
        String clean = value.trim();
        return clean.isEmpty() ? null : clean;
    }
}
