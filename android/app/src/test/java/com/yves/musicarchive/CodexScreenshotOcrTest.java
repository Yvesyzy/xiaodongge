package com.yves.musicarchive;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class CodexScreenshotOcrTest {
    @Test public void byteBoundary() {
        int limit = ScreenshotOcrPlugin.MAX_IMAGE_BYTES;
        assertTrue(ScreenshotOcrPlugin.withinByteBudget(limit - 1));
        assertTrue(ScreenshotOcrPlugin.withinByteBudget(limit));
        assertFalse(ScreenshotOcrPlugin.withinByteBudget(limit + 1));
    }

    @Test public void pixelBoundaryAndLargeDimensions() {
        assertEquals(1, ScreenshotOcrPlugin.sampleSize(2999, 2000));
        assertEquals(1, ScreenshotOcrPlugin.sampleSize(3000, 2000));
        assertEquals(2, ScreenshotOcrPlugin.sampleSize(3001, 2000));
        assertEquals(1, ScreenshotOcrPlugin.sampleSize(1080, 2400));
        assertEquals(2, ScreenshotOcrPlugin.sampleSize(1080, 8000));
        assertEquals(2, ScreenshotOcrPlugin.sampleSize(4000, 6000));
        assertEquals(64, ScreenshotOcrPlugin.sampleSize(100000, 100000));
        assertTrue(ScreenshotOcrPlugin.sampleSize(Integer.MAX_VALUE, Integer.MAX_VALUE) > 0);
    }
}
