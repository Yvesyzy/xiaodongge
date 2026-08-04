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
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeExport")
public class NativeExportPlugin extends Plugin {
    private static final String EXPORT_DIRECTORY = "exports";

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

        String content = call.getString("content");
        if (content == null) {
            call.reject("缺少导出内容");
            return;
        }
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
            if (output == null) throw new IOException("系统无法打开文件输出流");
            output.write(content.getBytes(StandardCharsets.UTF_8));
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
        String content = call.getString("content");

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
            output.write(content.getBytes(StandardCharsets.UTF_8));
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
