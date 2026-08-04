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
        super.onCreate(savedInstanceState);
    }
}
