package com.yves.musicarchive;

import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CodexNavigation")
public class codex_NavigationPlugin extends Plugin {
    @Override
    public void load() {
        getActivity().runOnUiThread(() -> getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getBridge().getWebView());
                if (insets != null && insets.isVisible(WindowInsetsCompat.Type.ime())) {
                    new WindowInsetsControllerCompat(getActivity().getWindow(), getBridge().getWebView()).hide(WindowInsetsCompat.Type.ime());
                    return;
                }
                if (hasListeners("backRequested")) notifyListeners("backRequested", new JSObject());
                else Toast.makeText(getContext(), "应用正在载入，请稍候", Toast.LENGTH_SHORT).show();
            }
        }));
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().moveTaskToBack(true);
            call.resolve();
        });
    }
}
