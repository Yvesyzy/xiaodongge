package com.yves.musicarchive;

import static org.junit.Assert.*;

import android.app.Instrumentation;
import android.content.ComponentName;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.FileInputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real Android MediaSession -> Capacitor bridge -> React form, in a disposable emulator only. */
@RunWith(AndroidJUnit4.class)
public class codex_NowPlayingInstrumentedTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private WebView webView;

    @Test
    public void readsMusicAndVideoAcrossPermissionChanges() throws Exception {
        assertEquals("Never run this permission-changing test on a personal device", "ranchu", Build.HARDWARE);
        String listener = new ComponentName(instrumentation.getTargetContext(), NowPlayingNotificationService.class).flattenToString();
        MainActivity activity = (MainActivity) instrumentation.startActivitySync(
            new Intent(instrumentation.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        long deadline = SystemClock.uptimeMillis() + 20000;
        while (webView == null && SystemClock.uptimeMillis() < deadline) {
            instrumentation.runOnMainSync(() -> {
                if (activity.getBridge() != null) webView = activity.getBridge().getWebView();
            });
            SystemClock.sleep(100);
        }
        assertNotNull(webView);
        await("document.querySelector('.app-shell') !== null");
        MediaSession music = new MediaSession(instrumentation.getTargetContext(), "codex_music_playback");
        MediaSession paused = new MediaSession(instrumentation.getTargetContext(), "codex_paused_playback");
        try {
            music.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, "codex系统歌曲")
                .putString(MediaMetadata.METADATA_KEY_ARTIST, "codex系统艺人")
                .putString(MediaMetadata.METADATA_KEY_ALBUM, "codex系统专辑").build());
            music.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING, 1000, 1).build());
            music.setActive(true);
            paused.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, "codex已暂停内容").build());
            paused.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_PAUSED, 1000, 0).build());
            paused.setActive(true);

            shell("cmd notification disallow_listener " + listener);
            awaitTrackAccess(false);
            shell("cmd notification allow_listener " + listener);
            JSONObject track = awaitTrackAccess(true);
            assertEquals("codex系统歌曲", track.getString("title"));
            assertEquals("codex系统艺人", track.getString("artistName"));
            assertEquals("codex系统专辑", track.getString("albumName"));
            assertEquals(instrumentation.getTargetContext().getPackageName(), track.getJSONObject("musicMetadata").getString("sourcePackage"));

            evaluate("(location.hash = '/new', true)");
            await("document.querySelector('input[name=\"albumName\"]')?.value === 'codex系统专辑'");
            assertEquals("codex系统艺人", evaluate("document.querySelector('input[name=\"artistName\"]').value"));
            assertEquals("codex系统专辑", evaluate("document.querySelector('input[name=\"title\"]').value"));

            // Exercise the real bridge with video-style display title and no album/artist.
            music.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, "codex视频标题")
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, "codex视频作者").build());
            track = readTrack();
            assertEquals("codex视频标题", track.getString("title"));
            assertFalse(track.has("albumName"));
            music.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_PAUSED, 1000, 0).build());
            track = readTrack();
            assertTrue(track.getBoolean("accessEnabled"));
            assertFalse("Paused sessions must not be read as current playback", track.has("title"));
            music.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING, 1000, 1).build());
            assertEquals("codex视频标题", readTrack().getString("title"));

            shell("cmd notification disallow_listener " + listener);
            assertFalse(awaitTrackAccess(false).has("title"));
            shell("cmd notification allow_listener " + listener);
            assertEquals("codex视频标题", awaitTrackAccess(true).getString("title"));

            music.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_PAUSED, 1000, 0).build());
            evaluate("(location.hash = '/', true)");
            await("document.querySelector('form.writing-form') === null");
            evaluate("(location.hash = '/new', true)");
            await("document.querySelector('.assist-panel [role=status]')?.textContent.includes('没有读到正在播放')");
            evaluate("(document.querySelector('.writing-extras').open = true, true)");
            music.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING, 1000, 1).build());
            evaluate("(document.querySelector('.assist-panel button').click(), true)");
            await("document.querySelector('input[name=title]')?.value === 'codex视频标题'");
            shell("cmd notification disallow_listener " + listener);
            awaitTrackAccess(false);
            evaluate("(document.querySelector('.assist-panel button').click(), true)");
            await("document.querySelector('.assist-panel button')?.textContent === '打开系统设置'");
            assertTrue(evaluate("document.querySelector('.assist-panel [role=status]').textContent").contains("请先授予通知使用权"));
        } finally {
            music.release();
            paused.release();
            shell("cmd notification disallow_listener " + listener);
            instrumentation.runOnMainSync(activity::finish);
        }
    }

    private JSONObject awaitTrackAccess(boolean enabled) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 15000;
        JSONObject track;
        do {
            track = readTrack();
            if (track.optBoolean("accessEnabled") == enabled) return track;
            SystemClock.sleep(100);
        } while (SystemClock.uptimeMillis() < deadline);
        throw new AssertionError("Notification access did not become " + enabled + ": " + track);
    }

    private JSONObject readTrack() throws Exception {
        evaluate("(() => { window.codexPlaybackResult = null; window.Capacitor.nativePromise('NowPlaying', 'getCurrentTrack', {}).then(value => window.codexPlaybackResult = {value}, error => window.codexPlaybackResult = {error: error.message}); return true; })()");
        await("window.codexPlaybackResult !== null");
        JSONObject response = new JSONObject(evaluate("JSON.stringify(window.codexPlaybackResult)"));
        assertFalse(response.toString(), response.has("error"));
        return response.getJSONObject("value");
    }

    private void await(String expression) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 30000;
        do {
            if ("true".equals(evaluate("Boolean(" + expression + ")"))) return;
            SystemClock.sleep(100);
        } while (SystemClock.uptimeMillis() < deadline);
        throw new AssertionError("Timed out: " + expression + "; page=" + evaluate("document.body.innerText"));
    }

    private String evaluate(String expression) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> webView.evaluateJavascript(
            "String(" + expression + ")",
            value -> { result.set(value); done.countDown(); }));
        assertTrue("WebView callback timed out", done.await(10, TimeUnit.SECONDS));
        return String.valueOf(new JSONTokener(result.get()).nextValue());
    }

    private void shell(String command) throws Exception {
        try (ParcelFileDescriptor descriptor = instrumentation.getUiAutomation().executeShellCommand(command);
             FileInputStream input = new FileInputStream(descriptor.getFileDescriptor())) {
            byte[] buffer = new byte[1024];
            while (input.read(buffer) != -1) { /* Drain until the permission command completes. */ }
        }
    }
}
