package com.yves.musicarchive;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenshotOcrPlugin.class);
        registerPlugin(NowPlayingPlugin.class);
        registerPlugin(SharedMusicPlugin.class);
        registerPlugin(NativeExportPlugin.class);
        registerPlugin(codex_NavigationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
