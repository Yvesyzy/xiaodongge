package com.yves.musicarchive;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertThrows;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import org.junit.Test;

public class CodexNowPlayingArtworkTest {
    @Test public void readsAtByteLimit() throws Exception {
        byte[] bytes = new byte[CodexNowPlayingArtwork.MAX_INPUT_BYTES];
        assertEquals(bytes.length, CodexNowPlayingArtwork.readBounded(new ByteArrayInputStream(bytes),
            System.nanoTime() + 60_000_000_000L).length);
    }

    @Test public void rejectsOversizedImageStreamBeforeReturningBytes() {
        assertThrows(IOException.class, () -> CodexNowPlayingArtwork.readBounded(
            new ByteArrayInputStream(new byte[CodexNowPlayingArtwork.MAX_INPUT_BYTES + 1]),
            System.nanoTime() + 60_000_000_000L));
    }

    @Test public void rejectsExpiredRead() {
        assertThrows(IOException.class, () -> CodexNowPlayingArtwork.readBounded(
            new ByteArrayInputStream(new byte[1]), 0));
    }

    @Test public void rejectsMissingStream() {
        assertThrows(IOException.class, () -> CodexNowPlayingArtwork.readBounded(null, Long.MAX_VALUE));
    }

    @Test public void boundedOutputStopsBeforeWritingPastLimit() throws Exception {
        CodexNowPlayingArtwork.BoundedOutputStream output = new CodexNowPlayingArtwork.BoundedOutputStream(8);
        output.write(new byte[8]);
        assertEquals(8, output.size());
        assertThrows(IOException.class, () -> output.write(1));
        assertEquals(8, output.size());
        assertTrue(output.isOverflowed());
    }

    @Test public void rankingUsesLargestAreaEvenWhenItAppearsLater() {
        CodexNowPlayingArtwork.ArtworkCandidate small = candidate(32, 32, false, 0);
        CodexNowPlayingArtwork.ArtworkCandidate large = candidate(1200, 600, false, 1);
        assertSame(large, CodexNowPlayingArtwork.chooseBetter(small, large));
        assertSame(large, CodexNowPlayingArtwork.chooseBetter(large, small));
    }

    @Test public void rankingPrefersOriginalBytesWhenDimensionsMatch() {
        CodexNowPlayingArtwork.ArtworkCandidate bitmap = candidate(1200, 600, false, 0);
        CodexNowPlayingArtwork.ArtworkCandidate original = candidate(1200, 600, true, 1);
        assertSame(original, CodexNowPlayingArtwork.chooseBetter(bitmap, original));
    }

    @Test public void rankingKeepsMetadataOrderForDifferentShapesWithSameArea() {
        CodexNowPlayingArtwork.ArtworkCandidate first = candidate(1200, 600, false, 0);
        CodexNowPlayingArtwork.ArtworkCandidate differentShape = candidate(900, 800, true, 1);
        assertSame(first, CodexNowPlayingArtwork.chooseBetter(first, differentShape));
    }

    @Test public void rankingPreservesOriginalWhenOrientationSwapsDimensions() {
        assertSameOriginal(1200, 600, 600, 1200);
    }

    private static void assertSameOriginal(int bitmapWidth, int bitmapHeight, int fileWidth, int fileHeight) {
        CodexNowPlayingArtwork.ArtworkCandidate original = candidate(fileWidth, fileHeight, true, 1);
        assertSame(original, CodexNowPlayingArtwork.chooseBetter(candidate(bitmapWidth, bitmapHeight, false, 0), original));
    }

    @Test public void rankingKeepsEarlierCandidateWhenAllTie() {
        CodexNowPlayingArtwork.ArtworkCandidate first = candidate(1200, 600, true, 0);
        CodexNowPlayingArtwork.ArtworkCandidate later = candidate(1200, 600, true, 1);
        assertSame(first, CodexNowPlayingArtwork.chooseBetter(first, later));
    }

    @Test public void rankingIgnoresNullCandidates() {
        CodexNowPlayingArtwork.ArtworkCandidate candidate = candidate(1, 1, false, 0);
        assertSame(candidate, CodexNowPlayingArtwork.chooseBetter(null, candidate));
        assertSame(candidate, CodexNowPlayingArtwork.chooseBetter(candidate, null));
    }

    private static CodexNowPlayingArtwork.ArtworkCandidate candidate(
            int width, int height, boolean originalBytes, int sourceOrder) {
        return new CodexNowPlayingArtwork.ArtworkCandidate(width, height, originalBytes,
            originalBytes ? "image/png" : "image/png", originalBytes ? new byte[] { 1 } : null,
            originalBytes ? null : "data:image/png;base64,AA==", sourceOrder);
    }
}
