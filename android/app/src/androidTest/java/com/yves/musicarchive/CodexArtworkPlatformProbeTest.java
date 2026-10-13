package com.yves.musicarchive;

import static org.junit.Assert.*;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ColorSpace;
import android.os.Build;
import android.util.Log;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.ByteArrayOutputStream;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Measures the platform PNG encoder; does not claim every HDR Bitmap can be reproduced. */
@RunWith(AndroidJUnit4.class)
public class CodexArtworkPlatformProbeTest {
    @Test public void measuresF16PngPrecisionWithoutConfigConversion() throws Exception {
        if (Build.VERSION.SDK_INT < 26) return;
        ColorSpace colorSpace = ColorSpace.get(ColorSpace.Named.DISPLAY_P3);
        Bitmap source = Bitmap.createBitmap(32, 16, Bitmap.Config.RGBA_F16, true, colorSpace);
        Bitmap decoded = null;
        try {
            source.eraseColor(Color.pack(0.812345f, 0.12345f, 0.54321f, 0.75f, colorSpace));
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            assertTrue(source.compress(Bitmap.CompressFormat.PNG, 100, output));
            byte[] bytes = output.toByteArray();
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inPreferredConfig = Bitmap.Config.RGBA_F16;
            decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            assertNotNull(decoded);
            assertEquals(source.getWidth(), decoded.getWidth());
            assertEquals(source.getHeight(), decoded.getHeight());
            float[] before = source.getColor(0, 0).getComponents();
            float[] after = decoded.getColor(0, 0).getComponents();
            double maximumError = 0;
            for (int index = 0; index < before.length; index++) {
                maximumError = Math.max(maximumError, Math.abs(before[index] - after[index]));
            }
            JSONObject result = new JSONObject();
            result.put("api", Build.VERSION.SDK_INT);
            result.put("sourceConfig", source.getConfig().name());
            result.put("decodedConfig", decoded.getConfig().name());
            result.put("sourceColorSpace", source.getColorSpace().getName());
            result.put("decodedColorSpace", decoded.getColorSpace().getName());
            result.put("pngBitDepth", bytes[24] & 255);
            result.put("maximumComponentError", maximumError);
            result.put("bytes", bytes.length);
            Log.i("CodexArtworkProbe", result.toString());
        } finally {
            if (decoded != null) decoded.recycle();
            source.recycle();
        }
    }
}
