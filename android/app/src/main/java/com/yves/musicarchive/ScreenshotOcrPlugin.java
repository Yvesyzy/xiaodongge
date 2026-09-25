package com.yves.musicarchive;

import android.graphics.Rect;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

@CapacitorPlugin(name = "ScreenshotOcr")
public class ScreenshotOcrPlugin extends Plugin {
    // ponytail: Android36 AVD peaked at 430 MiB PSS for a 24 MP image; remeasure low-memory devices before raising either bound.
    static final int MAX_IMAGE_BYTES = 12 * 1024 * 1024;
    static final long MAX_DECODED_PIXELS = 6_000_000L;

    static boolean withinByteBudget(int length) {
        return length >= 0 && length <= MAX_IMAGE_BYTES;
    }

    static int sampleSize(int width, int height) {
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("Invalid image dimensions");
        int sample = 1;
        while (((((long) width + sample - 1) / sample) * (((long) height + sample - 1) / sample)) > MAX_DECODED_PIXELS) {
            sample *= 2;
        }
        return sample;
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("缺少图片数据");
            return;
        }

        Bitmap decoded;
        try {
            int commaIndex = dataUrl.indexOf(',');
            int payloadLength = dataUrl.length() - (commaIndex >= 0 ? commaIndex + 1 : 0);
            if (payloadLength > ((MAX_IMAGE_BYTES + 2L) / 3L) * 4L) {
                call.reject("图片过大，请裁剪或更换图片");
                return;
            }
            String base64 = commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : dataUrl;
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            if (!withinByteBudget(bytes.length)) {
                call.reject("图片过大，请裁剪或更换图片");
                return;
            }
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (options.outWidth <= 0 || options.outHeight <= 0) {
                call.reject("图片读取失败");
                return;
            }
            options.inJustDecodeBounds = false;
            options.inSampleSize = sampleSize(options.outWidth, options.outHeight);
            options.inScaled = false;
            decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        } catch (IllegalArgumentException error) {
            call.reject("图片数据无效");
            return;
        } catch (OutOfMemoryError error) {
            call.reject("图片占用内存过大，请裁剪或更换图片");
            return;
        }

        if (decoded == null) {
            call.reject("图片读取失败");
            return;
        }
        final Bitmap bitmap = decoded;
        if ((long) bitmap.getWidth() * bitmap.getHeight() > MAX_DECODED_PIXELS) {
            bitmap.recycle();
            call.reject("图片尺寸过大，请裁剪或更换图片");
            return;
        }

        TextRecognizer recognizer = null;
        try {
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
            final TextRecognizer worker = recognizer;
            worker.process(image).addOnCompleteListener(task -> {
                try {
                    if (!task.isSuccessful()) {
                        Exception error = task.getException();
                        call.reject("截图识别失败：" + (error == null ? "未知错误" : error.getMessage()));
                        return;
                    }
                    Text result = task.getResult();
                    JSObject response = new JSObject();
                    response.put("text", result.getText());
                    response.put("width", bitmap.getWidth());
                    response.put("height", bitmap.getHeight());
                    response.put("lines", readLines(result));
                    call.resolve(response);
                } catch (RuntimeException error) {
                    call.reject("截图识别失败：" + error.getMessage());
                } catch (OutOfMemoryError error) {
                    call.reject("图片占用内存过大，请裁剪或更换图片");
                } finally {
                    try { worker.close(); } finally { bitmap.recycle(); }
                }
            });
        } catch (RuntimeException error) {
            try { if (recognizer != null) recognizer.close(); } finally { bitmap.recycle(); }
            call.reject("截图识别失败：" + error.getMessage());
        } catch (OutOfMemoryError error) {
            try { if (recognizer != null) recognizer.close(); } finally { bitmap.recycle(); }
            call.reject("图片占用内存过大，请裁剪或更换图片");
        }
    }

    private JSArray readLines(Text text) {
        JSArray lines = new JSArray();
        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                JSObject item = new JSObject();
                Rect box = line.getBoundingBox();
                item.put("text", line.getText());
                item.put("left", box == null ? 0 : box.left);
                item.put("top", box == null ? 0 : box.top);
                item.put("right", box == null ? 0 : box.right);
                item.put("bottom", box == null ? 0 : box.bottom);
                lines.put(item);
            }
        }
        return lines;
    }
}
