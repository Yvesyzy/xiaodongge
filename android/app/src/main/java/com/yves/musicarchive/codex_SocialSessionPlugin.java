package com.yves.musicarchive;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.InvalidKeyException;
import java.security.Key;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Android-only encrypted storage for the social service session.
 *
 * <p>The browser implementation keeps its session in memory. On Android the
 * only persisted value is a small AES/GCM envelope in the app's no-backup
 * directory; the AES key is generated and retained by AndroidKeyStore and is
 * never exportable. This plugin never connects to the social service.</p>
 */
@CapacitorPlugin(name = "CodexSocialSession")
public class codex_SocialSessionPlugin extends Plugin {
    static final String KEY_ALIAS = "codex_social_session_key_v1";
    static final String SESSION_FILE_NAME = "codex_social_session.bin";

    static final int MAX_PLAINTEXT_BYTES = 4096;
    static final int MAX_ENVELOPE_BYTES = 8192;
    static final int GCM_IV_BYTES = 12;
    static final int GCM_TAG_BITS = 128;
    private static final int GCM_TAG_BYTES = GCM_TAG_BITS / 8;
    private static final byte[] ENVELOPE_HEADER = new byte[] {'C', 'D', 'S', 'S', 1};
    private static final Object STORE_LOCK = new Object();

    private static final String ERROR_INVALID = "社交会话格式无效，请重新登录。";
    private static final String ERROR_KEY = "社交会话密钥不可用，请重新登录。";
    private static final String ERROR_CORRUPT = "社交会话已损坏，请重新登录。";
    private static final String ERROR_READ = "读取社交会话失败，请重新登录。";
    private static final String ERROR_WRITE = "社交会话写入失败，请重试。";
    private static final String ERROR_CLEAR = "社交会话清除失败，请重试。";
    private static final String ERROR_CONSENT = "请先同意隐私政策后使用此功能。";

    @PluginMethod
    public void readSession(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject(ERROR_READ);
            return;
        }
        if (!codex_PrivacyPlugin.requireConsent(context, call)) return;

        try {
            SessionData session;
            synchronized (STORE_LOCK) {
                byte[] envelope = readStoredEnvelope(context);
                if (envelope == null) {
                    session = null;
                } else {
                    SecretKey key = loadKey(false);
                    if (key == null) throw new KeyUnavailableException();
                    session = parseSession(decrypt(key, envelope));
                }
            }
            if (session == null) {
                JSObject response = new JSObject();
                response.put("session", JSONObject.NULL);
                call.resolve(response);
                return;
            }
            // Consent can be withdrawn after the initial gate. Recheck only
            // after releasing STORE_LOCK so privacy STATE_LOCK and STORE_LOCK
            // can never be acquired in the opposite order.
            if (!codex_PrivacyPlugin.isAccepted(context)) {
                try {
                    clearStoredSession(context);
                } catch (IOException | RuntimeException error) {
                    call.reject(ERROR_CLEAR);
                    return;
                }
                call.reject(ERROR_CONSENT);
                return;
            }
            JSObject response = new JSObject();
            JSObject value = new JSObject();
            value.put("endpoint", session.endpoint);
            value.put("token", session.token);
            value.put("expiresAt", session.expiresAt);
            response.put("session", value);
            call.resolve(response);
        } catch (KeyUnavailableException error) {
            call.reject(ERROR_KEY);
        } catch (CorruptSessionException error) {
            call.reject(ERROR_CORRUPT);
        } catch (IOException | RuntimeException error) {
            call.reject(ERROR_READ);
        }
    }

    @PluginMethod
    public void writeSession(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject(ERROR_WRITE);
            return;
        }
        if (!codex_PrivacyPlugin.requireConsent(context, call)) return;

        String endpoint = call.getString("endpoint");
        String token = call.getString("token");
        String expiresAt = call.getString("expiresAt");
        String invalidField = codex_SocialSessionValidation.invalidField(endpoint, token, expiresAt);
        if (invalidField != null) {
            call.reject(ERROR_INVALID + " 字段: " + invalidField);
            return;
        }

        try {
            byte[] plaintext = serializeSession(endpoint, token, expiresAt);
            synchronized (STORE_LOCK) {
                SecretKey key = loadKey(true);
                if (key == null) throw new KeyUnavailableException();
                byte[] envelope = encrypt(key, plaintext);
                writeStoredEnvelope(context, envelope);
            }
            // The privacy gate above may race a withdrawal. Recheck after
            // releasing STORE_LOCK; never call the privacy helper while this
            // lock is held because withdrawal takes STATE_LOCK first.
            if (!codex_PrivacyPlugin.isAccepted(context)) {
                try {
                    clearStoredSession(context);
                } catch (IOException | RuntimeException error) {
                    call.reject(ERROR_CLEAR);
                    return;
                }
                call.reject(ERROR_CONSENT);
                return;
            }
            JSObject response = new JSObject();
            response.put("ok", true);
            call.resolve(response);
        } catch (KeyUnavailableException error) {
            call.reject(ERROR_KEY);
        } catch (IOException | JSONException | GeneralSecurityException | RuntimeException error) {
            call.reject(ERROR_WRITE);
        }
    }

    /**
     * Clear local social credentials without requiring privacy consent. The
     * privacy withdrawal path calls this before it terminates the process.
     */
    @PluginMethod
    public void clearSession(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject(ERROR_CLEAR);
            return;
        }
        try {
            clearStoredSession(context);
            JSObject response = new JSObject();
            response.put("ok", true);
            call.resolve(response);
        } catch (IOException | RuntimeException error) {
            call.reject(ERROR_CLEAR);
        }
    }

    /**
     * Clears the encrypted session file for an app context. This is public so
     * the existing privacy withdrawal flow can remove native credentials
     * before stopping the app. It intentionally leaves the empty Keystore key
     * available for a later login; the key alone contains no session data.
     */
    public static void clearStoredSession(Context context) throws IOException {
        synchronized (STORE_LOCK) {
            File target = storageFile(context);
            File[] envelopePaths = envelopePaths(target);
            verifyEnvelopePaths(envelopePaths);
            try {
                new AtomicFile(target).delete();
                // Framework AtomicFile historically used .bak; newer
                // implementations can leave a .new sidecar after a failed
                // write, so remove and verify both paths explicitly.
                for (int i = 1; i < envelopePaths.length; i++) {
                    envelopePaths[i].delete();
                }
            } catch (RuntimeException error) {
                throw new IOException("session delete failed", error);
            }
            for (File envelopePath : envelopePaths) {
                if (envelopePath.exists()) {
                    throw new IOException("session delete was not confirmed");
                }
            }
        }
    }

    private static byte[] serializeSession(String endpoint, String token, String expiresAt)
        throws JSONException, IOException {
        JSONObject object = new JSONObject();
        object.put("endpoint", endpoint);
        object.put("token", token);
        object.put("expiresAt", expiresAt);
        byte[] plaintext = object.toString().getBytes(StandardCharsets.UTF_8);
        if (plaintext.length == 0 || plaintext.length > MAX_PLAINTEXT_BYTES) {
            throw new IOException("session plaintext exceeds bound");
        }
        return plaintext;
    }

    private static SessionData parseSession(byte[] plaintext) throws CorruptSessionException {
        if (plaintext == null || plaintext.length == 0 || plaintext.length > MAX_PLAINTEXT_BYTES) {
            throw new CorruptSessionException();
        }
        final String json;
        try {
            json = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(plaintext))
                .toString();
        } catch (CharacterCodingException error) {
            throw new CorruptSessionException();
        }

        try {
            JSONObject object = new JSONObject(json);
            if (object.length() != 3
                || !object.has("endpoint")
                || !object.has("token")
                || !object.has("expiresAt")) {
                throw new CorruptSessionException();
            }
            Object endpoint = object.get("endpoint");
            Object token = object.get("token");
            Object expiresAt = object.get("expiresAt");
            if (!(endpoint instanceof String) || !(token instanceof String) || !(expiresAt instanceof String)) {
                throw new CorruptSessionException();
            }
            String invalidField = codex_SocialSessionValidation.invalidField(
                (String) endpoint, (String) token, (String) expiresAt
            );
            if (invalidField != null) throw new CorruptSessionException();
            return new SessionData((String) endpoint, (String) token, (String) expiresAt);
        } catch (JSONException error) {
            throw new CorruptSessionException();
        }
    }

    private static byte[] encrypt(SecretKey key, byte[] plaintext)
        throws GeneralSecurityException, IOException {
        if (plaintext == null || plaintext.length == 0 || plaintext.length > MAX_PLAINTEXT_BYTES) {
            throw new IOException("session plaintext exceeds bound");
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        // AndroidKeyStore rejects caller-supplied IVs when randomized
        // encryption is required. Let the provider generate a fresh IV for
        // every encryption operation, then persist that IV with the envelope.
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] iv = cipher.getIV();
        if (iv == null || iv.length != GCM_IV_BYTES) {
            throw new IOException("keystore generated an invalid IV");
        }
        cipher.updateAAD(ENVELOPE_HEADER);
        byte[] ciphertext = cipher.doFinal(plaintext);
        int envelopeLength = ENVELOPE_HEADER.length + iv.length + ciphertext.length;
        if (ciphertext.length < GCM_TAG_BYTES || envelopeLength > MAX_ENVELOPE_BYTES) {
            throw new IOException("session ciphertext exceeds bound");
        }
        byte[] envelope = new byte[envelopeLength];
        System.arraycopy(ENVELOPE_HEADER, 0, envelope, 0, ENVELOPE_HEADER.length);
        System.arraycopy(iv, 0, envelope, ENVELOPE_HEADER.length, iv.length);
        System.arraycopy(ciphertext, 0, envelope, ENVELOPE_HEADER.length + iv.length, ciphertext.length);
        return envelope;
    }

    private static byte[] decrypt(SecretKey key, byte[] envelope)
        throws CorruptSessionException, KeyUnavailableException {
        if (envelope == null || envelope.length < ENVELOPE_HEADER.length + GCM_IV_BYTES + GCM_TAG_BYTES
            || envelope.length > MAX_ENVELOPE_BYTES || !hasEnvelopeHeader(envelope)) {
            throw new CorruptSessionException();
        }
        byte[] iv = Arrays.copyOfRange(envelope, ENVELOPE_HEADER.length, ENVELOPE_HEADER.length + GCM_IV_BYTES);
        byte[] ciphertext = Arrays.copyOfRange(envelope, ENVELOPE_HEADER.length + GCM_IV_BYTES, envelope.length);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(ENVELOPE_HEADER);
            return cipher.doFinal(ciphertext);
        } catch (BadPaddingException | IllegalBlockSizeException error) {
            throw new CorruptSessionException();
        } catch (InvalidKeyException error) {
            throw new KeyUnavailableException();
        } catch (GeneralSecurityException error) {
            throw new KeyUnavailableException();
        }
    }

    private static boolean hasEnvelopeHeader(byte[] envelope) {
        for (int i = 0; i < ENVELOPE_HEADER.length; i++) {
            if (envelope[i] != ENVELOPE_HEADER[i]) return false;
        }
        return true;
    }

    private static byte[] readStoredEnvelope(Context context)
        throws IOException, CorruptSessionException {
        File target = storageFile(context);
        File[] envelopePaths = envelopePaths(target);
        verifyEnvelopePaths(envelopePaths);
        File backup = envelopePaths[1];
        File modernSidecar = envelopePaths[2];
        if (modernSidecar.exists()) throw new CorruptSessionException();
        if (!target.exists() && !backup.exists()) return null;

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (FileInputStream input = new AtomicFile(target).openRead()) {
            byte[] buffer = new byte[1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                if (bytes.size() + read > MAX_ENVELOPE_BYTES) throw new CorruptSessionException();
                bytes.write(buffer, 0, read);
            }
        } catch (CorruptSessionException error) {
            throw error;
        } catch (IOException | RuntimeException error) {
            throw new IOException("session read failed", error);
        }
        byte[] envelope = bytes.toByteArray();
        if (envelope.length < ENVELOPE_HEADER.length + GCM_IV_BYTES + GCM_TAG_BYTES
            || envelope.length > MAX_ENVELOPE_BYTES) {
            throw new CorruptSessionException();
        }
        return envelope;
    }

    private static File[] envelopePaths(File target) {
        return new File[] {
            target,
            new File(target.getPath() + ".bak"),
            new File(target.getPath() + ".new")
        };
    }

    private static void verifyEnvelopePaths(File[] paths) throws IOException {
        for (File path : paths) {
            if (path.exists() && !path.isFile()) {
                throw new IOException("session envelope path is not a regular file");
            }
        }
    }

    private static void writeStoredEnvelope(Context context, byte[] envelope) throws IOException {
        if (envelope == null || envelope.length == 0 || envelope.length > MAX_ENVELOPE_BYTES) {
            throw new IOException("session envelope exceeds bound");
        }
        File target = storageFile(context);
        AtomicFile atomicFile = new AtomicFile(target);
        FileOutputStream output = null;
        boolean committed = false;
        try {
            output = atomicFile.startWrite();
            output.write(envelope);
            output.flush();
            output.getFD().sync();
            atomicFile.finishWrite(output);
            committed = true;
        } catch (IOException | RuntimeException error) {
            if (output != null && !committed) {
                try {
                    atomicFile.failWrite(output);
                } catch (RuntimeException ignored) {
                    // Preserve the original write failure and never report success.
                }
            }
            throw new IOException("session write failed", error);
        }

        try {
            byte[] committedEnvelope = readStoredEnvelope(context);
            if (!Arrays.equals(envelope, committedEnvelope)) {
                throw new IOException("session commit check failed");
            }
        } catch (CorruptSessionException error) {
            throw new IOException("session commit check failed", error);
        }
    }

    private static SecretKey loadKey(boolean create) throws KeyUnavailableException {
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                Key key = keyStore.getKey(KEY_ALIAS, null);
                if (!(key instanceof SecretKey)) throw new KeyUnavailableException();
                return (SecretKey) key;
            }
            if (!create) return null;

            KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
            );
            KeyGenParameterSpec specification = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build();
            generator.init(specification);
            SecretKey generated = generator.generateKey();
            if (generated == null) throw new KeyUnavailableException();
            return generated;
        } catch (KeyUnavailableException error) {
            throw error;
        } catch (GeneralSecurityException | IOException | RuntimeException error) {
            throw new KeyUnavailableException();
        }
    }

    private static File storageFile(Context context) throws IOException {
        if (context == null) throw new IOException("missing context");
        Context application = context.getApplicationContext();
        if (application == null) application = context;
        File directory;
        try {
            directory = application.getNoBackupFilesDir();
        } catch (RuntimeException error) {
            throw new IOException("no-backup storage unavailable", error);
        }
        if (directory == null) throw new IOException("no-backup storage unavailable");
        if (!directory.exists() && !directory.mkdirs() && !directory.isDirectory()) {
            throw new IOException("no-backup storage unavailable");
        }
        if (!directory.isDirectory()) throw new IOException("no-backup storage is not a directory");
        File target = new File(directory, SESSION_FILE_NAME);
        if (target.exists() && !target.isFile()) throw new IOException("session path is not a file");
        return target;
    }

    private static final class SessionData {
        private final String endpoint;
        private final String token;
        private final String expiresAt;

        private SessionData(String endpoint, String token, String expiresAt) {
            this.endpoint = endpoint;
            this.token = token;
            this.expiresAt = expiresAt;
        }
    }

    private static final class KeyUnavailableException extends Exception {
    }

    private static final class CorruptSessionException extends Exception {
    }
}
