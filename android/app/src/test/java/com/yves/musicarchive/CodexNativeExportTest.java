package com.yves.musicarchive;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;

import org.junit.Test;

public class CodexNativeExportTest {
    @Test
    public void closeFailureIsPropagatedBeforeSavedResultCanBeProduced() {
        boolean saved = false;
        try {
            NativeExportPlugin.writeAndClose(new CloseFailingOutputStream(), new byte[] {1, 2, 3});
            saved = true;
        } catch (IOException expected) {
            // A provider close failure must prevent the caller from producing "saved".
        }
        assertFalse("a close failure must not produce a saved result", saved);
    }

    @Test
    public void successfulWriteClosesStreamBeforeReturning() throws Exception {
        TrackingOutputStream output = new TrackingOutputStream();
        byte[] payload = new byte[] {4, 5, 6};

        NativeExportPlugin.writeAndClose(output, payload);

        assertTrue("the output stream must be closed before the save result", output.closed);
        assertArrayEquals(payload, output.toByteArray());
    }

    @Test
    public void nullOutputIsRejected() {
        boolean rejected = false;
        try {
            NativeExportPlugin.writeAndClose(null, new byte[] {7});
        } catch (IOException expected) {
            rejected = true;
        }
        assertTrue("a missing output stream must be rejected", rejected);
    }

    @Test
    public void writeFailureIsPropagatedAndStreamIsClosed() {
        WriteFailingOutputStream output = new WriteFailingOutputStream();
        boolean rejected = false;
        try {
            NativeExportPlugin.writeAndClose(output, new byte[] {8});
        } catch (IOException expected) {
            rejected = true;
        }
        assertTrue("a write failure must be propagated", rejected);
        assertTrue("a write failure must still close the stream", output.closed);
    }

    @Test
    public void flushFailureIsPropagatedAndStreamIsClosed() {
        FlushFailingOutputStream output = new FlushFailingOutputStream();
        boolean rejected = false;
        try {
            NativeExportPlugin.writeAndClose(output, new byte[] {9});
        } catch (IOException expected) {
            rejected = true;
        }
        assertTrue("a flush failure must be propagated", rejected);
        assertTrue("a flush failure must still close the stream", output.closed);
    }

    private static final class TrackingOutputStream extends ByteArrayOutputStream {
        private boolean closed;

        @Override
        public void close() throws IOException {
            closed = true;
            super.close();
        }
    }

    private static final class CloseFailingOutputStream extends OutputStream {
        @Override
        public void write(int value) {
        }

        @Override
        public void close() throws IOException {
            throw new IOException("simulated close failure");
        }
    }

    private static final class WriteFailingOutputStream extends OutputStream {
        private boolean closed;

        @Override
        public void write(int value) throws IOException {
            throw new IOException("simulated write failure");
        }

        @Override
        public void close() {
            closed = true;
        }
    }

    private static final class FlushFailingOutputStream extends ByteArrayOutputStream {
        private boolean closed;

        @Override
        public void flush() throws IOException {
            throw new IOException("simulated flush failure");
        }

        @Override
        public void close() throws IOException {
            closed = true;
            super.close();
        }
    }
}
