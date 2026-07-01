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
    @PluginMethod
    public void recognize(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("缺少图片数据");
            return;
        }

        Bitmap bitmap;
        try {
            int commaIndex = dataUrl.indexOf(',');
            String base64 = commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : dataUrl;
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException error) {
            call.reject("图片数据无效");
            return;
        }

        if (bitmap == null) {
            call.reject("图片读取失败");
            return;
        }

        InputImage image = InputImage.fromBitmap(bitmap, 0);
        TextRecognizer recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
        recognizer.process(image)
            .addOnSuccessListener(result -> {
                recognizer.close();
                JSObject response = new JSObject();
                response.put("text", result.getText());
                response.put("width", bitmap.getWidth());
                response.put("height", bitmap.getHeight());
                response.put("lines", readLines(result));
                call.resolve(response);
            })
            .addOnFailureListener(error -> {
                recognizer.close();
                call.reject("截图识别失败：" + error.getMessage());
            });
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
