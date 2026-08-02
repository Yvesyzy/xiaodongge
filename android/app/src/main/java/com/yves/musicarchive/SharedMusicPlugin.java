package com.yves.musicarchive;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.UUID;

@CapacitorPlugin(name = "SharedMusic")
public class SharedMusicPlugin extends Plugin {
    private static final int MAX_TEXT_LENGTH = 10_000;
    private JSObject pendingShare;

    @Override
    public void load() {
        super.load();
        pendingShare = readShare(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        JSObject share = readShare(intent);
        if (share == null) return;
        pendingShare = share;
        notifyListeners("shareReceived", share);
    }

    @PluginMethod
    public void consumePendingShare(PluginCall call) {
        if (pendingShare == null) {
            JSObject result = new JSObject();
            result.put("hasShare", false);
            call.resolve(result);
            return;
        }
        JSObject result = pendingShare;
        pendingShare = null;
        call.resolve(result);
    }

    private JSObject readShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return null;
        String text = clean(intent.getCharSequenceExtra(Intent.EXTRA_TEXT));
        if (text == null) return null;
        String subject = clean(intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT));
        JSObject result = new JSObject();
        result.put("id", UUID.randomUUID().toString());
        result.put("text", text);
        if (subject != null) result.put("subject", subject);
        return result;
    }

    private String clean(CharSequence value) {
        if (value == null) return null;
        String result = value.toString().trim();
        if (result.isEmpty()) return null;
        return result.length() <= MAX_TEXT_LENGTH ? result : result.substring(0, MAX_TEXT_LENGTH);
    }
}
