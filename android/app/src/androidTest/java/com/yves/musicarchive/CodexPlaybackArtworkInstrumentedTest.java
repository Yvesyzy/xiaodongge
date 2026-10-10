package com.yves.musicarchive;

import static org.junit.Assert.*;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.util.Base64;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Image-only tests: no user files, application records, media sessions or permissions are changed. */
@RunWith(AndroidJUnit4.class)
public class CodexPlaybackArtworkInstrumentedTest {
    @Test public void resizesWithoutCroppingOrRecyclingSource() {
        Bitmap source = Bitmap.createBitmap(1200, 600, Bitmap.Config.ARGB_8888);
        source.eraseColor(0xff12634d);
        try {
            String encoded = CodexNowPlayingArtwork.encode(source);
            assertNotNull(encoded);
            byte[] bytes = Base64.decode(encoded.substring(encoded.indexOf(',') + 1), Base64.DEFAULT);
            Bitmap image = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            try {
                assertEquals(512, image.getWidth());
                assertEquals(256, image.getHeight());
                assertEquals(0xff12634d, image.getPixel(0, 0));
                assertFalse(source.isRecycled());
            } finally { image.recycle(); }
        } finally { source.recycle(); }
    }

    @Test public void readsEachMetadataBitmapKey() {
        for (String key : new String[] { MediaMetadata.METADATA_KEY_ALBUM_ART,
                MediaMetadata.METADATA_KEY_ART, MediaMetadata.METADATA_KEY_DISPLAY_ICON }) {
            Bitmap source = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888);
            try {
                MediaMetadata metadata = new MediaMetadata.Builder().putBitmap(key, source).build();
                String result = CodexNowPlayingArtwork.read(InstrumentationRegistry.getInstrumentation().getTargetContext(), metadata);
                assertNotNull(key, result);
                assertTrue(result.startsWith("data:image/png;base64,"));
                assertFalse(source.isRecycled());
            } finally { source.recycle(); }
        }
    }
}
