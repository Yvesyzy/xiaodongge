package com.yves.musicarchive;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.graphics.Rect;
import android.os.Build;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;
import android.util.DisplayMetrics;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Release WebView regression coverage for the native back path.
 *
 * The test launches the real MainActivity, sends Android input through the
 * instrumentation layer, and observes the rendered React route. It never
 * clears the app database; the main flow creates one uniquely named record.
 */
@RunWith(AndroidJUnit4.class)
public class codex_NavigationInstrumentedTest {
    private static final long WAIT_MS = 8000L;
    private static final long SHORT_WAIT_MS = 2500L;
    private static final String BACK_NOTICE = "再返回一次即可退出小懂哥";
    private static final String ORIGINAL_SET_ITEM = "__codexOriginalSetItem";
    private static final String TEST_TITLE = "codex原生返回回归_" + System.currentTimeMillis();
    private static final Pattern ENTRY_ROUTE = Pattern.compile("#/entries/([^?/#]+)");

    private Instrumentation instrumentation;
    private MainActivity activity;
    private WebView webView;

    @After
    public void restoreStorage() {
        if (webView != null) restoreStorageSetItem();
    }

    @Test
    public void seedBeforeUpgrade() {
        navigateHash("/new");
        waitForSelector("form.writing-form");
        setValue("input[name=\"title\"]", "codex覆盖安装保留记录");
        setValue("input[name=\"artistName\"]", "codex测试艺术家");
        setValue("input[name=\"albumName\"]", "codex覆盖安装专辑");
        setValue("textarea.note-editor", "从2.7.0覆盖安装测试版后应保留此记录。");
        clickText("button", "保存正式乐评");
        waitForSelector(".codex-reader");
        waitForText("codex覆盖安装保留记录");
    }

    @Test
    public void verifyAfterUpgrade() {
        navigateHash("/timeline");
        waitForText("codex覆盖安装保留记录");
    }

    @Test
    public void nativeImagePickerCancellationKeepsTimeline() {
        navigateHash("/timeline");
        waitForSelector(".codex-cover-pick");
        String previous = evaluate("document.querySelector('.codex-cover-pick img')?.src || ''");
        tapSelector(".codex-cover-pick");
        assertTrue("System image picker must open", waitUntil("picker opened", () -> !hasWindowFocus()));
        pressNativeBack();
        waitForWindowFocus();
        assertEquals("#/timeline", currentHash());
        assertEquals(previous, evaluate("document.querySelector('.codex-cover-pick img')?.src || ''"));
    }

    @Before
    public void launchApplication() {
        instrumentation = InstrumentationRegistry.getInstrumentation();
        Intent intent = new Intent(instrumentation.getTargetContext(), MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        activity = (MainActivity) instrumentation.startActivitySync(intent);
        waitForWebView();
        waitForJavaScript("document.readyState === 'complete' && document.querySelector('.app-shell') !== null", "React shell");
        waitForWindowFocus();
        navigateHash("/");
    }

    @Test
    public void nativeBackNavigationAndExitProtection() {
        String home = currentHash();
        assertEquals("#/", home);

        pressNativeBack();
        waitForText(BACK_NOTICE);
        assertEquals(home, currentHash());
        assertFalse(activity.isFinishing());

        android.util.Log.i("codex_NavigationTest", "First notice observed, sending second back");
        pressNativeBack();
        assertTrue(waitUntil("activity moved to background", () -> !hasWindowFocus() && !isFinishing()));
        assertFalse(isFinishing());

        bringApplicationToForeground();
        assertEquals("#/", currentHash());
        waitForNoText(BACK_NOTICE);

        pressNativeBack();
        waitForText(BACK_NOTICE);
        assertTrue(hasWindowFocus());
        SystemClock.sleep(2200L);
        waitForNoText(BACK_NOTICE);
        pressNativeBack();
        waitForText(BACK_NOTICE);
        assertTrue(hasWindowFocus());

        navigateHash("/timeline");
        pressNativeBack();
        waitForHash("#/");
        waitForNoText(BACK_NOTICE);
        assertTrue(hasWindowFocus());
        pressNativeBack();
        waitForText(BACK_NOTICE);
        assertTrue(hasWindowFocus());

        navigateHash("/timeline");
        pressNativeBack();
        waitForHash("#/");
        clickSelector("[aria-label=\"新建记录\"]");
        waitForSelector("[role=\"dialog\"]");
        String sheetHash = currentHash();
        pressNativeBack();
        waitForNoSelector("[role=\"dialog\"]");
        assertEquals(sheetHash, currentHash());

        clickSelector("[aria-label=\"新建记录\"]");
        waitForSelector("[role=\"dialog\"]");
        clickSelector(".create-choice-card[href=\"#/new\"]");
        waitForHash("#/new");
        waitForSelector("form.writing-form");

        setValue("input[name=\"title\"]", TEST_TITLE);
        setValue("input[name=\"artistName\"]", "codex测试艺术家");
        setValue("input[name=\"albumName\"]", TEST_TITLE + "_专辑");
        setValue("input[name=\"songName\"]", TEST_TITLE + "_曲目");
        setValue("input[name=\"year\"]", "2026");
        setValue("input[name=\"month\"]", "9");
        setValue("textarea.note-editor", "第一段草稿：验证原生返回时保存输入。\n第二段保留在本地草稿中。");
        waitForText("草稿已自动保存");

        clickText("button", "保存草稿");
        waitForHash("#/drafts");
        waitForText(TEST_TITLE);

        clickTextContaining(".draft-card-main", TEST_TITLE);
        waitForHash("#/new?draft=");
        waitForSelector("form.writing-form");
        assertEquals(TEST_TITLE, valueOf("input[name=\"title\"]"));
        assertEquals("第一段草稿：验证原生返回时保存输入。\n第二段保留在本地草稿中。", valueOf("textarea.note-editor"));

        setValue("textarea.note-editor", "离开编辑页前的草稿必须继续保存。");
        waitForText("草稿已自动保存");
        pressNativeBack();
        waitForHash("#/drafts");
        waitForText(TEST_TITLE);

        clickTextContaining(".draft-card-main", TEST_TITLE);
        waitForHash("#/new?draft=");
        clickText("button", "保存正式乐评");
        waitForSelector(".codex-reader");
        String detailHash = currentHash();
        Matcher entryMatcher = ENTRY_ROUTE.matcher(detailHash);
        assertTrue("formal save must open an entry route", entryMatcher.find());
        String entryId = entryMatcher.group(1);
        assertNotNull(entryId);

        clickSelector("details.codex-reader-menu > summary");
        waitForSelector("details.codex-reader-menu[open]");
        pressNativeBack();
        waitForNoSelector("details.codex-reader-menu[open]");
        assertEquals(detailHash, currentHash());

        clickSelector("details.codex-reader-menu > summary");
        waitForSelector("details.codex-reader-menu[open]");
        clickTextContaining(".codex-reader-menu-actions a", "编辑乐评");
        waitForHash("#/entries/" + entryId + "/edit");
        waitForSelector("form.writing-form");
        waitForJavaScript("Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === '保存草稿' && !button.disabled)", "draft storage ready");

        installFailingStorageSetItem();
        setValue("textarea.note-editor", "这次修改用于验证草稿保存失败时不能离开编辑页。");
        waitForText("本地存储已满");
        String editHash = currentHash();
        pressNativeBack();
        waitForHash(editHash);
        waitForText("本地存储已满");
        restoreStorageSetItem();
        pressNativeBack();
        waitForHash("#/entries/" + entryId);
        waitForSelector(".codex-reader");
    }

    @Test
    public void nativeBackClosesKeyboardBeforeReactNavigation() {
        navigateHash("/new");
        waitForSelector("form.writing-form");
        String formHash = currentHash();
        assertTrue("Configure emulator with a visible soft keyboard", showKeyboard());
        pressNativeBack();
        waitForIme(false);
        assertEquals(formHash, currentHash());
        assertTrue(hasWindowFocus());
    }

    @Test
    public void gesturalEdgeBackUsesTheSameNavigationPath() {
        navigateHash("/timeline");
        waitForSelector(".page");
        injectEdgeGesture(true, true);
        assertEquals("#/timeline", currentHash());

        assertTrue("Left edge gesture must return home", injectEdgeGestureAndWaitForHash(true, "#/"));

        navigateHash("/timeline");
        assertTrue(injectEdgeGestureAndWaitForHash(false, "#/"));
    }

    private void waitForWebView() {
        final AtomicReference<WebView> found = new AtomicReference<>();
        waitUntil("BridgeActivity WebView", () -> {
            instrumentation.runOnMainSync(() -> {
                if (activity != null && activity.getBridge() != null) {
                    found.set(activity.getBridge().getWebView());
                }
            });
            webView = found.get();
            return webView != null;
        });
    }

    private void bringApplicationToForeground() {
        Intent intent = new Intent(instrumentation.getTargetContext(), MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        instrumentation.runOnMainSync(() -> activity.startActivity(intent));
        waitForWindowFocus();
        waitForJavaScript("document.querySelector('.app-shell') !== null", "React shell after foreground");
    }

    private void pressNativeBack() {
        long started = SystemClock.uptimeMillis();
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
        android.util.Log.i("codex_NavigationTest", "KEYCODE_BACK injection elapsed ms=" + (SystemClock.uptimeMillis()-started));
    }

    private String currentHash() {
        return evaluate("location.hash");
    }

    private String valueOf(String selector) {
        return evaluate("document.querySelector(" + quote(selector) + ")?.value || ''");
    }

    private void navigateHash(String path) {
        String normalized = path.startsWith("/") ? path : "/" + path;
        evaluate("(() => { window.location.hash = " + quote("#" + normalized) + "; return true; })()");
        waitForHash("#" + normalized);
    }

    private void waitForHash(String expected) {
        String condition = expected.endsWith("=") ? "location.hash.startsWith(" + quote(expected) + ")"
                : "location.hash === " + quote(expected) + " || location.hash.startsWith(" + quote(expected + "?") + ")";
        waitForJavaScript(condition, "route " + expected);
        evaluate("(() => { window.__codexRoutePaint = false; requestAnimationFrame(() => requestAnimationFrame(() => {window.__codexRoutePaint = true;})); return true; })()");
        waitForJavaScript("window.__codexRoutePaint", "route rendered");
    }

    private void waitForText(String text) {
        waitForJavaScript("document.body?.innerText.includes(" + quote(text) + ")", "text " + text);
    }

    private void waitForNoText(String text) {
        waitForJavaScript("!document.body?.innerText.includes(" + quote(text) + ")", "text removed " + text);
    }

    private void waitForSelector(String selector) {
        waitForJavaScript("document.querySelector(" + quote(selector) + ") !== null", "selector " + selector);
    }

    private void waitForNoSelector(String selector) {
        waitForJavaScript("document.querySelector(" + quote(selector) + ") === null", "selector removed " + selector);
    }

    private void clickSelector(String selector) {
        String clicked = evaluate("(() => { const element = document.querySelector(" + quote(selector) + "); if (!element) return false; element.click(); return true; })()");
        assertEquals("true", clicked);
    }

    private void clickText(String selector, String text) {
        String clicked = evaluate("(() => { const element = Array.from(document.querySelectorAll(" + quote(selector) + ")).find(item => item.textContent.trim() === " + quote(text) + "); if (!element) return false; element.click(); return true; })()");
        assertEquals("true", clicked);
    }

    private void clickTextContaining(String selector, String text) {
        String clicked = evaluate("(() => { const element = Array.from(document.querySelectorAll(" + quote(selector) + ")).find(item => item.textContent.includes(" + quote(text) + ")); if (!element) return false; element.click(); return true; })()");
        assertEquals("true", clicked);
    }

    private void setValue(String selector, String value) {
        String changed = evaluate("(() => { const element = document.querySelector(" + quote(selector) + "); if (!element) return false; const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value'); if (descriptor?.set) descriptor.set.call(element, " + quote(value) + "); else element.value = " + quote(value) + "; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); return true; })()");
        assertEquals("true", changed);
    }

    private void installFailingStorageSetItem() {
        evaluate("(() => { window." + ORIGINAL_SET_ITEM + " = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; return true; })()");
    }

    private void restoreStorageSetItem() {
        evaluate("(() => { if (window." + ORIGINAL_SET_ITEM + ") Storage.prototype.setItem = window." + ORIGINAL_SET_ITEM + "; delete window." + ORIGINAL_SET_ITEM + "; return true; })()");
    }

    private boolean showKeyboard() {
        tapSelector("input[name=\"title\"]");
        return waitForImeValue(true, SHORT_WAIT_MS);
    }

    private void tapSelector(String selector) {
        evaluate("document.querySelector(" + quote(selector) + ").scrollIntoView({block:'center',behavior:'instant'})");
        String position = evaluate("JSON.stringify((() => {const r=document.querySelector(" + quote(selector) + ").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth};})())");
        try {
            JSONObject point = new JSONObject(position);
            int[] offset = new int[2];
            final AtomicReference<Integer> width = new AtomicReference<>(0);
            instrumentation.runOnMainSync(() -> {webView.getLocationOnScreen(offset);width.set(webView.getWidth());});
            float scale = width.get() / (float) point.getDouble("width");
            float x = offset[0] + (float) point.getDouble("x") * scale;
            float y = offset[1] + (float) point.getDouble("y") * scale;
            long now = SystemClock.uptimeMillis();
            assertTrue(injectMotion(MotionEvent.ACTION_DOWN, x, y, now, 0));
            SystemClock.sleep(80);
            assertTrue(injectMotion(MotionEvent.ACTION_UP, x, y, now, 0));
        } catch (JSONException error) { throw new AssertionError(error); }
    }

    private void waitForIme(boolean visible) {
        assertTrue("IME visibility did not become " + visible, waitForImeValue(visible, WAIT_MS));
    }

    private boolean waitForImeValue(boolean visible, long timeoutMs) {
        return waitUntil("IME visibility " + visible, timeoutMs, () -> isImeVisible() == visible);
    }

    private boolean isImeVisible() {
        final AtomicReference<Boolean> result = new AtomicReference<>(false);
        instrumentation.runOnMainSync(() -> {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(webView);
            result.set(insets != null && insets.isVisible(WindowInsetsCompat.Type.ime()));
        });
        return result.get();
    }

    private boolean injectEdgeGestureAndWaitForHash(boolean fromLeft, String expectedHash) {
        if (!injectEdgeGesture(fromLeft, false)) return false;
        return waitUntil("edge gesture route " + expectedHash, SHORT_WAIT_MS, () -> currentHash().equals(expectedHash));
    }

    private boolean injectEdgeGesture(boolean fromLeft, boolean cancel) {
        final DisplayMetrics metrics = new DisplayMetrics();
        final int displayId;
        final Rect visibleFrame = new Rect();
        final AtomicReference<Boolean> injected = new AtomicReference<>(true);
        instrumentation.runOnMainSync(() -> {
            activity.getWindowManager().getDefaultDisplay().getRealMetrics(metrics);
            activity.getWindow().getDecorView().getWindowVisibleDisplayFrame(visibleFrame);
        });
        displayId = activity.getDisplay() == null ? 0 : activity.getDisplay().getDisplayId();
        float y = Math.max(visibleFrame.top + 80f, metrics.heightPixels * 0.45f);
        float startX = fromLeft ? 1f : metrics.widthPixels - 2f;
        long downTime = SystemClock.uptimeMillis();
        injected.set(injectMotion(MotionEvent.ACTION_DOWN, startX, y, downTime, displayId));
        if (cancel) {
            injectMotion(MotionEvent.ACTION_MOVE, startX + (fromLeft ? 24f : -24f), y, downTime, displayId);
            injectMotion(MotionEvent.ACTION_CANCEL, startX + (fromLeft ? 24f : -24f), y, downTime, displayId);
            return injected.get();
        }
        float endX = fromLeft ? metrics.widthPixels * 0.68f : metrics.widthPixels * 0.32f;
        for (int step = 1; step <= 12; step++) {
            float progress = step / 12f;
            if (!injectMotion(MotionEvent.ACTION_MOVE, startX + (endX - startX) * progress, y, downTime, SystemClock.uptimeMillis(), displayId)) {
                injected.set(false);
            }
            SystemClock.sleep(16L);
        }
        if (!injectMotion(MotionEvent.ACTION_UP, endX, y, downTime, SystemClock.uptimeMillis(), displayId)) {
            injected.set(false);
        }
        return injected.get();
    }

    private boolean injectMotion(int action, float x, float y, long downTime, int displayId) {
        return injectMotion(action, x, y, downTime, SystemClock.uptimeMillis(), displayId);
    }

    private boolean injectMotion(int action, float x, float y, long downTime, long eventTime, int displayId) {
        MotionEvent event = MotionEvent.obtain(downTime, eventTime, action, x, y, 0);
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            return instrumentation.getUiAutomation().injectInputEvent(event, true);
        } finally {
            event.recycle();
        }
    }

    private boolean hasWindowFocus() {
        final AtomicReference<Boolean> result = new AtomicReference<>(false);
        instrumentation.runOnMainSync(() -> result.set(activity != null && activity.hasWindowFocus()));
        return result.get();
    }

    private boolean isFinishing() {
        final AtomicReference<Boolean> result = new AtomicReference<>(false);
        instrumentation.runOnMainSync(() -> result.set(activity != null && activity.isFinishing()));
        return result.get();
    }

    private void waitForWindowFocus() {
        assertTrue("activity did not regain window focus", waitUntil("window focus", WAIT_MS, this::hasWindowFocus));
    }

    private void waitForJavaScript(String expression, String description) {
        boolean result = waitUntil(description, WAIT_MS, () -> "true".equals(evaluate("Boolean(" + expression + ")")));
        if (!result) android.util.Log.e("codex_NavigationTest", "Failed " + description + "; route=" + currentHash() + "; body=" + evaluate("document.body.innerText"));
        assertTrue(description, result);
    }

    private boolean waitUntil(String description, Condition condition) {
        return waitUntil(description, WAIT_MS, condition);
    }

    private boolean waitUntil(String description, long timeoutMs, Condition condition) {
        long deadline = SystemClock.uptimeMillis() + timeoutMs;
        Throwable lastError = null;
        while (SystemClock.uptimeMillis() < deadline) {
            try {
                if (condition.check()) return true;
            } catch (Throwable error) {
                lastError = error;
            }
            SystemClock.sleep(100L);
        }
        if (lastError != null) {
            android.util.Log.w("codex_NavigationTest", description + " last error: " + lastError);
        }
        return false;
    }

    private String evaluate(String expression) {
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicReference<String> raw = new AtomicReference<>();
        final AtomicReference<Throwable> error = new AtomicReference<>();
        String script = "(function(){try{return String(" + expression + ");}catch(e){return '__codex_eval_error__' + (e && (e.stack || e.message) || e);}})()";
        try {
            instrumentation.runOnMainSync(() -> {
                if (webView == null) {
                    error.set(new IllegalStateException("WebView is not ready"));
                    latch.countDown();
                    return;
                }
                webView.evaluateJavascript(script, value -> {
                    raw.set(value);
                    latch.countDown();
                });
            });
            if (!latch.await(WAIT_MS, TimeUnit.MILLISECONDS)) throw new AssertionError("Timed out evaluating JavaScript: " + expression);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted evaluating JavaScript", interrupted);
        }
        if (error.get() != null) throw new AssertionError("Could not evaluate JavaScript", error.get());
        String decoded = decodeJavascriptString(raw.get());
        if (decoded.startsWith("__codex_eval_error__")) throw new AssertionError(decoded);
        return decoded;
    }

    private static String decodeJavascriptString(String raw) {
        if (raw == null || "null".equals(raw)) return "";
        try {
            Object value = new JSONTokener(raw).nextValue();
            return value == null ? "" : String.valueOf(value);
        } catch (JSONException error) {
            throw new AssertionError("Invalid evaluateJavascript result: " + raw, error);
        }
    }

    private static String quote(String value) {
        return JSONObject.quote(value);
    }

    @FunctionalInterface
    private interface Condition {
        boolean check() throws Exception;
    }
}
