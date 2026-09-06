package com.yves.musicarchive;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeExport")
public class NativeExportPlugin extends Plugin {
    private static final String EXPORT_DIRECTORY = "exports";
    private static final String BASE64_ENCODING = "base64";
    private static final String PNG_MIME_TYPE = "image/png";
    private static final int MAX_BINARY_BYTES = 8 * 1024 * 1024;
    private static final int MAX_BASE64_CHARACTERS = ((MAX_BINARY_BYTES + 2) / 3) * 4;
    private static final byte[] PNG_SIGNATURE = new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};

    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = requiredString(call, "fileName", "缺少导出文件名");
        String mimeType = requiredString(call, "mimeType", "缺少导出文件类型");
        if (fileName == null || mimeType == null || !hasContent(call)) return;

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject response = new JSObject();
            response.put("status", "cancelled");
            call.resolve(response);
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.reject("系统没有返回可写入的文件位置");
            return;
        }

        String mimeType = call.getString("mimeType");
        if (mimeType == null || mimeType.trim().isEmpty()) {
            call.reject("缺少导出文件类型");
            return;
        }
        byte[] payload;
        try {
            payload = exportBytes(call, mimeType);
        } catch (IOException error) {
            call.reject("读取导出内容失败：" + safeMessage(error), error);
            return;
        }
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
            if (output == null) throw new IOException("系统无法打开文件输出流");
            output.write(payload);
            output.flush();
            JSObject response = new JSObject();
            response.put("status", "saved");
            response.put("uri", uri.toString());
            call.resolve(response);
        } catch (IOException | SecurityException error) {
            call.reject("写入导出文件失败：" + safeMessage(error), error);
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String fileName = requiredString(call, "fileName", "缺少导出文件名");
        String mimeType = requiredString(call, "mimeType", "缺少导出文件类型");
        if (fileName == null || mimeType == null || !hasContent(call)) return;
        byte[] payload;
        try {
            payload = exportBytes(call, mimeType);
        } catch (IOException error) {
            call.reject("准备分享文件失败：" + safeMessage(error), error);
            return;
        }

        File exportDirectory = new File(getContext().getCacheDir(), EXPORT_DIRECTORY);
        if (!exportDirectory.exists() && !exportDirectory.mkdirs()) {
            call.reject("无法创建导出缓存目录");
            return;
        }
        String safeFileName = new File(fileName).getName();
        if (safeFileName.trim().isEmpty()) {
            call.reject("导出文件名无效");
            return;
        }
        File exportFile = new File(exportDirectory, safeFileName);
        try (FileOutputStream output = new FileOutputStream(exportFile, false)) {
            output.write(payload);
            output.flush();
        } catch (IOException | SecurityException error) {
            call.reject("准备分享文件失败：" + safeMessage(error), error);
            return;
        }

        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                exportFile
            );
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, fileName);
            shareIntent.setClipData(ClipData.newRawUri(fileName, uri));
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(shareIntent, "分享导出文件"));
            JSObject response = new JSObject();
            response.put("status", "opened");
            call.resolve(response);
        } catch (IllegalArgumentException | SecurityException error) {
            call.reject("打开系统分享失败：" + safeMessage(error), error);
        }
    }

    @PluginMethod
    public void copyText(PluginCall call) {
        String text = call.getString("text");
        if (text == null) {
            call.reject("缺少复制内容");
            return;
        }
        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(android.content.Context.CLIPBOARD_SERVICE);
        if (clipboard == null) {
            call.reject("系统剪贴板不可用");
            return;
        }
        clipboard.setPrimaryClip(ClipData.newPlainText("小懂哥导出内容", text));
        call.resolve();
    }

    private boolean hasContent(PluginCall call) {
        if (call.getString("content") != null) return true;
        call.reject("缺少导出内容");
        return false;
    }

    private byte[] exportBytes(PluginCall call, String mimeType) throws IOException {
        String content = call.getString("content");
        if (content == null) throw new IOException("缺少导出内容");
        String encoding = call.getString("encoding");
        if (encoding == null || encoding.trim().isEmpty()) return content.getBytes(StandardCharsets.UTF_8);
        if (!BASE64_ENCODING.equals(encoding)) throw new IOException("不支持的导出编码");
        if (!PNG_MIME_TYPE.equals(mimeType)) throw new IOException("Base64 导出仅支持 image/png");
        if (content.isEmpty() || content.length() > MAX_BASE64_CHARACTERS || content.length() % 4 != 0 || !isStrictBase64(content)) {
            throw new IOException("PNG Base64 内容无效");
        }
        final byte[] decoded;
        try {
            decoded = Base64.decode(content, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            throw new IOException("PNG Base64 内容无效", error);
        }
        if (decoded.length == 0 || decoded.length > MAX_BINARY_BYTES || !hasPngSignature(decoded)) {
            throw new IOException("PNG 图片大小或格式无效");
        }
        return decoded;
    }

    private boolean isStrictBase64(String value) {
        for (int index = 0; index < value.length(); index += 4) {
            char first = value.charAt(index);
            char second = value.charAt(index + 1);
            char third = value.charAt(index + 2);
            char fourth = value.charAt(index + 3);
            if (!isBase64Letter(first) || !isBase64Letter(second)) return false;
            if (third == '=') return index + 4 == value.length() && fourth == '=';
            if (!isBase64Letter(third)) return false;
            if (fourth == '=') return index + 4 == value.length();
            if (!isBase64Letter(fourth)) return false;
        }
        return true;
    }

    private boolean isBase64Letter(char value) {
        return value >= 'A' && value <= 'Z'
            || value >= 'a' && value <= 'z'
            || value >= '0' && value <= '9'
            || value == '+'
            || value == '/';
    }

    private boolean hasPngSignature(byte[] value) {
        if (value.length < PNG_SIGNATURE.length) return false;
        for (int index = 0; index < PNG_SIGNATURE.length; index++) {
            if (value[index] != PNG_SIGNATURE[index]) return false;
        }
        return true;
    }

    private String requiredString(PluginCall call, String key, String errorMessage) {
        String value = call.getString(key);
        if (value != null && !value.trim().isEmpty()) return value;
        call.reject(errorMessage);
        return null;
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? error.getClass().getSimpleName() : message;
    }
}
