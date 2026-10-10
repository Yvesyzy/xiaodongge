package com.yves.musicarchive;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import org.junit.Test;

public class CodexNowPlayingArtworkTest {
    @Test public void readsAtByteLimit() throws Exception {
        byte[] bytes = new byte[CodexNowPlayingArtwork.MAX_INPUT_BYTES];
        assertEquals(bytes.length, CodexNowPlayingArtwork.readBounded(new ByteArrayInputStream(bytes),
            System.nanoTime() + 10_000_000_000L).length);
    }
    @Test public void rejectsOversizedImageStream() {
        assertThrows(IOException.class, () -> CodexNowPlayingArtwork.readBounded(
            new ByteArrayInputStream(new byte[CodexNowPlayingArtwork.MAX_INPUT_BYTES + 1]), System.nanoTime() + 10_000_000_000L));
    }
    @Test public void rejectsExpiredRead() {
        assertThrows(IOException.class, () -> CodexNowPlayingArtwork.readBounded(new ByteArrayInputStream(new byte[1]), 0));
    }
    @Test public void rejectsMissingStream() {
        assertThrows(IOException.class, () -> CodexNowPlayingArtwork.readBounded(null, Long.MAX_VALUE));
    }
}
