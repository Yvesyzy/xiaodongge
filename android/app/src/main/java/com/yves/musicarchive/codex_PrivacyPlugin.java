package com.yves.musicarchive;

import android.app.Activity;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

@CapacitorPlugin(name = "CodexPrivacy")
public class codex_PrivacyPlugin extends Plugin {
    static final String POLICY_VERSION = "2026-10-10";
    static final String STATUS_PENDING = "pending";
    static final String STATUS_ACCEPTED = "accepted";
    static final String STATUS_DECLINED = "declined";

    private static final String PREFERENCES_NAME = "codex_privacy_state";
    private static final String POLICY_VERSION_KEY = "policyVersion";
    private static final String STATUS_KEY = "status";
    private static final String JOB_SERVICE_CLASS =
        "com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService";
    private static final String ALARM_RECEIVER_CLASS =
        "com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver";
    private static final String[] CONSENT_COMPONENTS = {
        JOB_SERVICE_CLASS, ALARM_RECEIVER_CLASS, NowPlayingNotificationService.class.getName()
    };
    private static final Object STATE_LOCK = new Object();
    private static boolean runtimeStateSynchronized;
    private static boolean runtimeStateAccepted;
    private static boolean sessionWasAccepted;

    @PluginMethod
    public void getState(PluginCall call) {
        Context context = getContext();
        synchronized (STATE_LOCK) {
            String status = readStatus(context);
            if (!synchronizeRuntimeState(context, status)) status = STATUS_PENDING;
            call.resolve(state(status));
        }
    }

    @PluginMethod
    public void setConsent(PluginCall call) {
        Boolean accepted = call.getBoolean("accepted");
        if (accepted == null) {
            call.reject("accepted 必须是布尔值");
            return;
        }

        Context context = getContext();
        boolean shouldTerminate = false;
        JSObject response;
        synchronized (STATE_LOCK) {
            String previous = readStatus(context);
            boolean nextAccepted = accepted.booleanValue();
            if (!saveStatus(context, nextAccepted)) {
                synchronizeRuntimeState(context, STATUS_PENDING);
                call.reject("隐私选择保存失败，请重试。");
                return;
            }
            String nextStatus = nextAccepted ? STATUS_ACCEPTED : STATUS_DECLINED;
            if (!synchronizeRuntimeState(context, nextStatus)) {
                call.reject("隐私功能状态切换失败，请重试。");
                if (shouldStopSession(nextAccepted, previous, sessionWasAccepted)) terminateProcessAfterResponse();
                return;
            }
            response = state(nextStatus);
            shouldTerminate = shouldStopSession(nextAccepted, previous, sessionWasAccepted);
        }

        call.resolve(response);
        if (shouldTerminate) terminateProcessAfterResponse();
    }

    public static boolean isAccepted(Context context) {
        synchronized (STATE_LOCK) {
            String status = readStatus(context);
            return STATUS_ACCEPTED.equals(status) && runtimeStateSynchronized && runtimeStateAccepted;
        }
    }

    public static boolean requireConsent(Context context, PluginCall call) {
        if (isAccepted(context)) return true;
        call.reject("请先同意隐私政策后使用此功能。");
        return false;
    }

    public static boolean syncRuntimeState(Context context) {
        synchronized (STATE_LOCK) {
            String status = readStatus(context);
            return synchronizeRuntimeState(context, status);
        }
    }

    private static boolean synchronizeRuntimeState(Context context, String status) {
        boolean accepted = STATUS_ACCEPTED.equals(status);
        boolean ready = applyRuntimeState(context, accepted);
        runtimeStateSynchronized = ready;
        runtimeStateAccepted = ready && accepted;
        if (runtimeStateAccepted) sessionWasAccepted = true;
        return ready;
    }

    static boolean shouldStopSession(boolean accepted, String previous, boolean sessionAccepted) {
        return !accepted && (sessionAccepted || STATUS_ACCEPTED.equals(previous));
    }

    static String normalizeStatus(String version, String status) {
        if (!POLICY_VERSION.equals(version)) return STATUS_PENDING;
        if (STATUS_ACCEPTED.equals(status) || STATUS_DECLINED.equals(status)) return status;
        return STATUS_PENDING;
    }

    private static String readStatus(Context context) {
        try {
            SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
            return normalizeStatus(
                preferences.getString(POLICY_VERSION_KEY, null),
                preferences.getString(STATUS_KEY, null)
            );
        } catch (RuntimeException error) {
            return STATUS_PENDING;
        }
    }

    private static boolean saveStatus(Context context, boolean accepted) {
        try {
            SharedPreferences.Editor editor = context
                .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                .edit();
            editor.putString(POLICY_VERSION_KEY, POLICY_VERSION);
            editor.putString(STATUS_KEY, accepted ? STATUS_ACCEPTED : STATUS_DECLINED);
            return editor.commit();
        } catch (RuntimeException error) {
            return false;
        }
    }

    private static JSObject state(String status) {
        JSObject response = new JSObject();
        response.put("status", status);
        response.put("policyVersion", POLICY_VERSION);
        return response;
    }

    private static boolean applyRuntimeState(Context context, boolean accepted) {
        if (context == null) return false;
        Context app = applicationContext(context);
        try {
            int state = accepted
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            PackageManager packageManager = app.getPackageManager();
            for (String component : CONSENT_COMPONENTS) {
                ComponentName name = new ComponentName(app, component);
                if (packageManager.getComponentEnabledSetting(name) != state) {
                    packageManager.setComponentEnabledSetting(name, state, PackageManager.DONT_KILL_APP);
                }
            }
            if (!accepted) cancelDataTransportJobs(app);
            return true;
        } catch (RuntimeException error) {
            disableAndCancel(app);
            return false;
        }
    }

    private static boolean disableAndCancel(Context context) {
        if (context == null) return false;
        boolean success = true;
        for (String component : CONSENT_COMPONENTS) {
            try {
                context.getPackageManager().setComponentEnabledSetting(
                    new ComponentName(context, component), PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
            } catch (RuntimeException error) {
                success = false;
            }
        }
        try {
            cancelDataTransportJobs(context);
        } catch (RuntimeException error) {
            success = false;
        }
        return success;
    }

    private static void cancelDataTransportJobs(Context context) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler == null) return;
        List<JobInfo> jobs = scheduler.getAllPendingJobs();
        if (jobs == null) return;
        for (JobInfo job : jobs) {
            ComponentName service = job.getService();
            if (service != null
                && context.getPackageName().equals(service.getPackageName())
                && JOB_SERVICE_CLASS.equals(service.getClassName())) {
                scheduler.cancel(job.getId());
            }
        }
    }

    private static Context applicationContext(Context context) {
        Context app = context.getApplicationContext();
        return app == null ? context : app;
    }

    private void terminateProcessAfterResponse() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                Activity activity = getActivity();
                if (activity != null) activity.finishAndRemoveTask();
            } finally {
                Process.killProcess(Process.myPid());
            }
        });
    }
}
