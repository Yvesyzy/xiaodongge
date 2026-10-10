package com.yves.musicarchive;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.webkit.WebView;
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
    public void getDiagnostics(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject response = new JSObject();
            response.put("versionName", info.versionName);
            response.put("versionCode", Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
            response.put("notificationAccessEnabled", false);
            response.put("notificationAccessKnown", false);
            try {
                response.put("notificationAccessEnabled", NotificationManagerCompat.getEnabledListenerPackages(getContext())
                    .contains(getContext().getPackageName()));
                response.put("notificationAccessKnown", true);
            } catch (RuntimeException ignored) { /* Keep a distinct unknown state for unavailable system queries. */ }
            response.put("androidApi", Build.VERSION.SDK_INT);
            response.put("manufacturer", Build.MANUFACTURER);
            response.put("model", Build.MODEL);
            try { response.put("mediaAvailable", getContext().getSystemService(Context.MEDIA_SESSION_SERVICE) != null); }
            catch (RuntimeException ignored) { /* Unknown capability stays absent. */ }
            try { response.put("clipboardAvailable", getContext().getSystemService(Context.CLIPBOARD_SERVICE) != null); }
            catch (RuntimeException ignored) { /* Unknown capability stays absent. */ }
            response.put("webViewPackage", "未知");
            response.put("webViewVersion", "未知");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    PackageInfo webView = WebView.getCurrentWebViewPackage();
                    if (webView != null) {
                        response.put("webViewPackage", webView.packageName);
                        if (webView.versionName != null) response.put("webViewVersion", webView.versionName);
                    }
                } catch (RuntimeException ignored) {
                    // Version/permission diagnostics remain available if the provider cannot be queried.
                }
            }
            call.resolve(response);
        } catch (PackageManager.NameNotFoundException | RuntimeException error) {
            call.reject("安装包信息读取失败", error);
        }
    }

    @PluginMethod
    public void getCurrentTrack(PluginCall call) {
        if (!codex_PrivacyPlugin.requireConsent(getContext(), call)) return;
        JSObject response = new JSObject();
        try {
            boolean accessEnabled = NotificationManagerCompat.getEnabledListenerPackages(getContext())
                .contains(getContext().getPackageName());
            response.put("accessEnabled", accessEnabled);
            if (!accessEnabled) { call.resolve(response); return; }
            MediaSessionManager manager = (MediaSessionManager) getContext()
                .getSystemService(Context.MEDIA_SESSION_SERVICE);
            if (manager == null) { call.reject("当前环境暂不支持读取正在播放的音乐，可粘贴音乐信息、识别截图或手动记录。"); return; }
            ComponentName listener = new ComponentName(getContext(), NowPlayingNotificationService.class);
            List<MediaController> controllers = manager.getActiveSessions(listener);
            if (controllers == null) { call.resolve(response); return; }
            for (MediaController controller : controllers) {
                if (controller == null) continue;
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
                if (Boolean.TRUE.equals(call.getBoolean("includeArtwork", false))) {
                    String cover = CodexNowPlayingArtwork.read(getContext(), metadata);
                    if (!codex_PrivacyPlugin.requireConsent(getContext(), call)) return;
                    // Re-check the system permission after potentially waiting for an image provider.
                    manager.getActiveSessions(listener);
                    if (cover != null) response.put("coverDataUrl", cover);
                }
                break;
            }
            call.resolve(response);
        } catch (SecurityException error) {
            // Permission can be revoked after the cached package check above.
            JSObject denied = new JSObject();
            denied.put("accessEnabled", false);
            call.resolve(denied);
        } catch (RuntimeException error) {
            call.reject("当前环境无法读取播放信息，可改用粘贴、截图识别或手动记录。", error);
        }
    }

    @PluginMethod
    public void searchCatalog(PluginCall call) {
        if (!codex_PrivacyPlugin.requireConsent(getContext(), call)) return;
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
        if (!codex_PrivacyPlugin.requireConsent(getContext(), call)) return;
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(intent); call.resolve(); }
        catch (RuntimeException error) { call.reject("当前环境无法打开通知使用权设置，可先粘贴音乐信息、识别截图或手动记录。", error); }
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
