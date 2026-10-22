import os, glob, json, math, wave, struct
from PIL import Image, ImageDraw

R = 'android/app/src/main/res/'
APP_ID = json.load(open('capacitor.config.json'))['appId']
JAVA_DIR = 'android/app/src/main/java/' + APP_ID.replace('.', '/') + '/'

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

# ---- light splash + plum launcher background ----
for f in glob.glob(R + '**/splash.png', recursive=True): os.remove(f)
write(R + 'drawable/splash.xml', '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android"><solid android:color="#041B4A"/></shape>\n')
write(R + 'values/ic_launcher_background.xml', '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#06235C</color>\n</resources>\n')

# ---- theme: navy status & navigation bars (the app recolours them to match the chosen theme) ----
p = R + 'values/styles.xml'; s = open(p).read()
s = s.replace('<item name="android:background">@null</item>', '<item name="android:background">@null</item>\n        <item name="android:statusBarColor">#112653</item>\n        <item name="android:navigationBarColor">#020F2B</item>\n        <item name="android:windowBackground">#041B4A</item>\n        <item name="android:windowLightStatusBar">false</item>')
open(p, 'w').write(s)

# ---- manifest: permissions + home-screen widgets ----
p = 'android/app/src/main/AndroidManifest.xml'; s = open(p).read()
s = s.replace('<uses-permission android:name="android.permission.INTERNET" />', '''<uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />''')

# let the alarm wake the screen and show the app over the lock screen
assert '<activity' in s
s = s.replace('<activity', '<activity android:showWhenLocked="true" android:turnScreenOn="true"', 1)

def receiver(cls, label, info):
    return f'''
        <receiver android:name="{APP_ID}.{cls}" android:exported="true" android:label="@string/{label}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/{info}" />
        </receiver>
'''
alarm_xml = f'''
        <service android:name="{APP_ID}.AlarmService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <receiver android:name="{APP_ID}.AlarmReceiver" android:exported="false" />
        <receiver android:name="{APP_ID}.BootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
'''
widgets_xml = alarm_xml + receiver('AnalogWidget', 'widget_analog_name', 'widget_analog_info') \
            + receiver('DigitalWidget', 'widget_digital_name', 'widget_digital_info')
assert '</application>' in s
s = s.replace('</application>', widgets_xml + '    </application>', 1)
open(p, 'w').write(s)

# ---- launcher icons from the PWA icon ----
src = Image.open('www/icons/icon-512.png').convert('RGB')
fg = Image.open('www/icons/maskable-512.png').convert('RGB')
for d, legacy, adaptive in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
    a = src.resize((legacy, legacy), Image.LANCZOS)
    a.save(f'{R}mipmap-{d}/ic_launcher.png')
    m = Image.new('L', (legacy, legacy), 0); ImageDraw.Draw(m).ellipse([0,0,legacy-1,legacy-1], fill=255)
    r = a.copy(); r.putalpha(m); r.save(f'{R}mipmap-{d}/ic_launcher_round.png')
    fg.resize((adaptive, adaptive), Image.LANCZOS).save(f'{R}mipmap-{d}/ic_launcher_foreground.png')

# ---- alarm ringtone (60 s of repeating two-tone beeps, played by the alarm notification channel) ----
RATE = 16000
def tone(freq, dur):
    n = int(RATE * dur); out = []
    for i in range(n):
        env = min(1.0, i / (RATE * 0.008), (n - i) / (RATE * 0.02))
        out.append(0.8 * env * math.sin(2 * math.pi * freq * i / RATE))
    return out
def silence(dur): return [0.0] * int(RATE * dur)
unit = []
for _ in range(2):                       # beep-beep ... beep-beep
    unit += tone(1046.5, 0.14) + silence(0.07) + tone(1396.9, 0.14) + silence(0.07)
unit += silence(0.45)
samples = []
while len(samples) < RATE * 60: samples += unit
samples = samples[:RATE * 60]
os.makedirs(R + 'raw', exist_ok=True)
with wave.open(R + 'raw/alarm_sound.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 30000)) for v in samples))

# ---- small notification icon ----
write(R + 'drawable/ic_stat_alarm.xml', '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M11.99,2C6.47,2 2,6.48 2,12s4.47,10 9.99,10C17.52,22 22,17.52 22,12S17.52,2 11.99,2zM12,20c-4.42,0 -8,-3.58 -8,-8s3.58,-8 8,-8 8,3.58 8,8 -3.58,8 -8,8zM12.5,7H11v6l5.25,3.15 0.75,-1.23 -4.5,-2.67z"/>
</vector>
''')

# ================= HOME-SCREEN WIDGETS (long-press the app icon -> Widgets) =================
write(R + 'values/widget_strings.xml', '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_analog_name">Analog Clock</string>
    <string name="widget_digital_name">Digital Clock</string>
    <string name="widget_analog_desc">Resizable analog clock</string>
    <string name="widget_digital_desc">Resizable digital clock with date</string>
</resources>
''')

write(R + 'drawable/widget_bg.xml', '''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#F2041B4A"/>
    <stroke android:width="1dp" android:color="#33F8F0E1"/>
    <corners android:radius="26dp"/>
</shape>
''')

# analog dial + hands (vector, 480dp so the clock only ever scales DOWN to the widget size)
ticks = ''
for i in range(60):
    hr = i % 5 == 0
    r1, r2 = (82, 92) if hr else (88, 92)
    a = math.radians(i * 6)
    x1, y1 = 100 + r1 * math.sin(a), 100 - r1 * math.cos(a)
    x2, y2 = 100 + r2 * math.sin(a), 100 - r2 * math.cos(a)
    col, wd = ('#F8F0E1', 3.4) if hr else ('#6F82AE', 1.4)
    ticks += f'    <path android:pathData="M{x1:.2f},{y1:.2f} L{x2:.2f},{y2:.2f}" android:strokeColor="{col}" android:strokeWidth="{wd}" android:strokeLineCap="round"/>\n'
write(R + 'drawable/widget_dial.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="480dp" android:height="480dp" android:viewportWidth="200" android:viewportHeight="200">
    <path android:fillColor="#06235C" android:strokeColor="#2F4A86" android:strokeWidth="2" android:pathData="M100,100 m-96,0 a96,96 0 1,0 192,0 a96,96 0 1,0 -192,0"/>
{ticks}</vector>
''')
def hand(name, length, width):
    write(R + f'drawable/{name}.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="480dp" android:height="480dp" android:viewportWidth="200" android:viewportHeight="200">
    <path android:strokeColor="#F8F0E1" android:strokeWidth="{width}" android:strokeLineCap="round" android:pathData="M100,108 L100,{100 - length}"/>
    <path android:fillColor="#F8F0E1" android:pathData="M100,100 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0"/>
</vector>
''')
hand('widget_hand_hour', 48, 6)
hand('widget_hand_minute', 70, 4)

write(R + 'layout/widget_analog.xml', '''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:padding="10dp">
    <AnalogClock
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:dial="@drawable/widget_dial"
        android:hand_hour="@drawable/widget_hand_hour"
        android:hand_minute="@drawable/widget_hand_minute" />
</FrameLayout>
''')

write(R + 'layout/widget_digital.xml', '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:orientation="vertical"
    android:gravity="center"
    android:paddingLeft="14dp"
    android:paddingRight="14dp"
    android:paddingTop="10dp"
    android:paddingBottom="10dp">
    <TextClock
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:gravity="center"
        android:format12Hour="h:mm"
        android:format24Hour="HH:mm"
        android:includeFontPadding="false"
        android:maxLines="1"
        android:textColor="#F8F0E1"
        android:textStyle="bold"
        android:fontFamily="sans-serif-medium"
        android:textSize="48sp"
        android:autoSizeTextType="uniform"
        android:autoSizeMinTextSize="16sp"
        android:autoSizeMaxTextSize="120sp"
        android:autoSizeStepGranularity="2sp" />
    <TextClock
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center"
        android:format12Hour="EEE, MMM d  |  a"
        android:format24Hour="EEE, MMM d"
        android:maxLines="1"
        android:textColor="#A9B6D6"
        android:textSize="13sp" />
</LinearLayout>
''')

def info(layout, desc, minw, minh, cw, ch):
    return f'''<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="{minw}dp"
    android:minHeight="{minh}dp"
    android:minResizeWidth="60dp"
    android:minResizeHeight="60dp"
    android:targetCellWidth="{cw}"
    android:targetCellHeight="{ch}"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/{layout}"
    android:previewLayout="@layout/{layout}"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/{desc}" />
'''
write(R + 'xml/widget_analog_info.xml', info('widget_analog', 'widget_analog_desc', 110, 110, 2, 2))
write(R + 'xml/widget_digital_info.xml', info('widget_digital', 'widget_digital_desc', 180, 110, 4, 2))

write(JAVA_DIR + 'BaseClockWidget.java', f'''package {APP_ID};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Clock widgets use self-updating AnalogClock / TextClock views; tapping a widget opens the app. */
public abstract class BaseClockWidget extends AppWidgetProvider {{
    protected abstract int layoutId();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {{
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent pi = null;
        if (launch != null) {{
            pi = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }}
        for (int id : appWidgetIds) {{
            RemoteViews views = new RemoteViews(context.getPackageName(), layoutId());
            if (pi != null) {{
                views.setOnClickPendingIntent(R.id.widget_root, pi);
            }}
            manager.updateAppWidget(id, views);
        }}
    }}
}}
''')
for cls, lay in [('AnalogWidget', 'widget_analog'), ('DigitalWidget', 'widget_digital')]:
    write(JAVA_DIR + cls + '.java', f'''package {APP_ID};

public class {cls} extends BaseClockWidget {{
    @Override
    protected int layoutId() {{
        return R.layout.{lay};
    }}
}}
''')

# ================= REAL ALARM CLOCK (AlarmManager.setAlarmClock + looping foreground service) =================
def java(name, body):
    write(JAVA_DIR + name + '.java', body.replace('__PKG__', APP_ID))

java('AlarmScheduler', r"""package __PKG__;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/** Registers alarms + the timer with AlarmManager.setAlarmClock (exact, works in Doze, survives app close). */
public class AlarmScheduler {
    static final String PREFS = "flip_alarm_prefs";
    static final String KEY_SPEC = "spec";
    static final String ACTION_FIRE = "__PKG__.ALARM_FIRE";

    static Intent baseIntent(Context c, int id) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.setAction(ACTION_FIRE);
        i.setData(Uri.parse("flipalarm://item/" + id));
        return i;
    }

    static int piFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    static void cancelAll(Context c, String spec) {
        if (spec == null) return;
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            JSONArray items = new JSONObject(spec).optJSONArray("items");
            if (items == null) return;
            for (int k = 0; k < items.length(); k++) {
                int id = items.getJSONObject(k).getInt("id");
                PendingIntent pi = PendingIntent.getBroadcast(c, id, baseIntent(c, id), piFlags());
                am.cancel(pi);
                pi.cancel();
            }
        } catch (Exception ignored) {
        }
    }

    public static void apply(Context c, String newSpec) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        cancelAll(c, sp.getString(KEY_SPEC, null));
        sp.edit().putString(KEY_SPEC, newSpec).apply();
        scheduleAll(c, newSpec);
    }

    public static void rescheduleFromPrefs(Context c) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String spec = sp.getString(KEY_SPEC, null);
        if (spec == null) return;
        cancelAll(c, spec);
        scheduleAll(c, spec);
    }

    /** Rings once after delayMs (used by the "Test ring" button). Not part of the saved alarm list. */
    public static void scheduleTest(Context c, long delayMs) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        Intent i = baseIntent(c, 3);
        i.putExtra("title", "Test alarm");
        i.putExtra("body", "Your alarm is working!");
        i.putExtra("muted", false);
        PendingIntent pi = PendingIntent.getBroadcast(c, 3, i, piFlags());
        Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent show = PendingIntent.getActivity(c, 0, launch, piFlags());
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(System.currentTimeMillis() + delayMs, show), pi);
    }

    static long nextTrigger(JSONObject item) throws Exception {
        long now = System.currentTimeMillis();
        if ("timer".equals(item.optString("kind"))) {
            long at = item.getLong("at");
            return at > now + 300 ? at : -1;
        }
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, item.getInt("hour"));
        cal.set(Calendar.MINUTE, item.getInt("minute"));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= now + 2000) {
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }
        return cal.getTimeInMillis();
    }

    static void scheduleAll(Context c, String spec) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            JSONObject root = new JSONObject(spec);
            boolean muted = root.optBoolean("muted", false);
            JSONArray items = root.optJSONArray("items");
            if (items == null) return;

            Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            PendingIntent show = PendingIntent.getActivity(c, 0, launch, piFlags());

            for (int k = 0; k < items.length(); k++) {
                JSONObject item = items.getJSONObject(k);
                long trigger = nextTrigger(item);
                if (trigger <= 0) continue;
                int id = item.getInt("id");
                Intent i = baseIntent(c, id);
                i.putExtra("title", item.optString("title", "Alarm"));
                i.putExtra("body", item.optString("body", ""));
                i.putExtra("muted", muted);
                PendingIntent pi = PendingIntent.getBroadcast(c, id, i, piFlags());
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(trigger, show), pi);
            }
        } catch (Exception ignored) {
        }
    }
}
""")

java('AlarmReceiver', r"""package __PKG__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

/** Fires at the alarm time: keeps the CPU awake, starts the ringing service (or a loud notification if that fails), books tomorrow's repeat. */
public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "FlipClockAlarm";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "flipclock:receiver");
            wl.acquire(20000L);
        } catch (Exception e) {
            Log.e(TAG, "wake lock failed", e);
        }

        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        boolean muted = intent.getBooleanExtra("muted", false);
        try {
            Intent svc = new Intent(context, AlarmService.class);
            svc.putExtra("title", title);
            svc.putExtra("body", body);
            svc.putExtra("muted", muted);
            if (Build.VERSION.SDK_INT >= 26) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
        } catch (Exception e) {
            Log.e(TAG, "service start failed, using notification fallback", e);
            AlarmService.postFallback(context, title, body, muted);
        }
        try {
            AlarmScheduler.rescheduleFromPrefs(context);
        } catch (Exception e) {
            Log.e(TAG, "reschedule failed", e);
        }
    }
}
""")

java('BootReceiver', r"""package __PKG__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-registers alarms after a reboot or an app update. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        AlarmScheduler.rescheduleFromPrefs(context);
    }
}
""")

java('AlarmService', r"""package __PKG__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.net.Uri;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/** Rings the alarm (looping sound + vibration + full-screen notification) until dismissed. */
public class AlarmService extends Service {
    static final String ACTION_STOP = "__PKG__.ALARM_STOP";
    static final String CHANNEL_ID = "flip_alarm_ring";
    static final int NOTIF_ID = 4242;
    static final long MAX_RING_MS = 5 * 60 * 1000L;

    private MediaPlayer player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoStop = new Runnable() {
        @Override
        public void run() {
            stopSelf();
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent != null ? intent.getStringExtra("title") : null;
        String body = intent != null ? intent.getStringExtra("body") : null;
        boolean muted = intent != null && intent.getBooleanExtra("muted", false);
        if (title == null || title.length() == 0) title = "Alarm";
        if (body == null) body = "";

        createChannel();
        Notification notification = buildNotification(title, body);
        boolean foreground = false;
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIF_ID, notification);
            }
            foreground = true;
        } catch (Exception e) {
            Log.e("FlipClockAlarm", "startForeground(type) failed", e);
        }
        if (!foreground) {
            try {
                startForeground(NOTIF_ID, notification);
                foreground = true;
            } catch (Exception e) {
                Log.e("FlipClockAlarm", "startForeground failed", e);
            }
        }
        if (!foreground) {
            postFallback(this, title, body, muted);
            stopSelf();
            return START_NOT_STICKY;
        }

        stopRinging();
        startRinging(muted);
        handler.removeCallbacks(autoStop);
        handler.postDelayed(autoStop, MAX_RING_MS);
        return START_NOT_STICKY;
    }

    static final String FALLBACK_CHANNEL = "flip_alarm_alert";

    /** Loud alarm notification used only if the ringing service cannot be started on this phone. */
    static void postFallback(Context c, String title, String body, boolean muted) {
        try {
            if (title == null || title.length() == 0) title = "Alarm";
            if (body == null) body = "";
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            Uri sound = Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.alarm_sound);
            if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(FALLBACK_CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(FALLBACK_CHANNEL, "Alarm alerts", NotificationManager.IMPORTANCE_HIGH);
                AudioAttributes aa = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                ch.setSound(sound, aa);
                ch.enableVibration(true);
                ch.setVibrationPattern(new long[]{0, 600, 400, 600, 400, 600});
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
            }
            Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            PendingIntent pi = PendingIntent.getActivity(c, 5, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, FALLBACK_CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat_alarm)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setFullScreenIntent(pi, true)
                    .setContentIntent(pi);
            if (Build.VERSION.SDK_INT < 26) {
                if (!muted) b.setSound(sound, AudioManager.STREAM_ALARM);
                b.setVibrate(new long[]{0, 600, 400, 600, 400, 600});
            }
            nm.notify(NOTIF_ID + 1, b.build());
        } catch (Exception e) {
            Log.e("FlipClockAlarm", "fallback notification failed", e);
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Ringing alarms", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Shown while an alarm or timer is ringing");
                ch.setSound(null, null);
                ch.enableVibration(false);
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private Notification buildNotification(String title, String body) {
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent fullScreen = PendingIntent.getActivity(this, 2, open, piFlags);

        Intent tap = getPackageManager().getLaunchIntentForPackage(getPackageName());
        tap.putExtra("alarm_stop", true);
        PendingIntent tapPi = PendingIntent.getActivity(this, 3, tap, piFlags);

        Intent stop = new Intent(this, AlarmService.class);
        stop.setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 4, stop, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_alarm)
                .setContentTitle(title)
                .setContentText(body)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setFullScreenIntent(fullScreen, true)
                .setContentIntent(tapPi)
                .addAction(0, "Dismiss", stopPi)
                .build();
    }

    @SuppressWarnings("deprecation")
    private void startRinging(boolean muted) {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "flipclock:alarm");
            wakeLock.acquire(MAX_RING_MS);
        } catch (Exception ignored) {
        }

        if (!muted) {
            try {
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                player = MediaPlayer.create(this, R.raw.alarm_sound, attrs, AudioManager.AUDIO_SESSION_ID_GENERATE);
                if (player != null) {
                    player.setLooping(true);
                    player.start();
                }
            } catch (Exception e) {
                player = null;
            }
        }

        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) {
                long[] pattern = new long[]{0, 600, 400};
                if (Build.VERSION.SDK_INT >= 26) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void stopRinging() {
        try {
            if (player != null) {
                player.stop();
                player.release();
            }
        } catch (Exception ignored) {
        }
        player = null;
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {
        }
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {
        }
        wakeLock = null;
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onDestroy() {
        handler.removeCallbacks(autoStop);
        stopRinging();
        stopForeground(true);
        super.onDestroy();
    }
}
""")

java('AlarmRingerPlugin', r"""package __PKG__;

import android.app.Activity;
import android.app.AlarmManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.Window;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge: AlarmRinger.sync({muted, items}) and AlarmRinger.stop(). */
@CapacitorPlugin(name = "AlarmRinger")
public class AlarmRingerPlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        try {
            JSObject data = call.getData();
            AlarmScheduler.apply(getContext(), data.toString());
            call.resolve();
        } catch (Exception e) {
            call.reject("sync failed: " + e.getMessage());
        }
    }

    /** Recolours the status bar, navigation bar and window background to match the in-app theme. */
    @PluginMethod
    public void setBars(final PluginCall call) {
        final String status = call.getString("status", "#000000");
        final String nav = call.getString("nav", "#000000");
        final String bg = call.getString("bg", "#000000");
        final boolean darkIcons = Boolean.TRUE.equals(call.getBoolean("darkIcons", false));
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Window w = getActivity().getWindow();
                    w.setStatusBarColor(Color.parseColor(status));
                    w.setNavigationBarColor(Color.parseColor(nav));
                    w.setBackgroundDrawable(new ColorDrawable(Color.parseColor(bg)));
                    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
                    c.setAppearanceLightStatusBars(darkIcons);
                    c.setAppearanceLightNavigationBars(darkIcons);
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().setBackgroundColor(Color.parseColor(bg));
                    }
                    call.resolve();
                } catch (Exception e) {
                    call.reject("setBars failed: " + e.getMessage());
                }
            }
        });
    }

    /** Reports what the phone currently allows (shown in the info popup). */
    @PluginMethod
    public void status(PluginCall call) {
        try {
            Context c = getContext();
            JSObject o = new JSObject();
            o.put("notifications", NotificationManagerCompat.from(c).areNotificationsEnabled());
            boolean battery = true;
            if (Build.VERSION.SDK_INT >= 23) {
                PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
                battery = pm.isIgnoringBatteryOptimizations(c.getPackageName());
            }
            o.put("battery", battery);
            boolean exact = true;
            if (Build.VERSION.SDK_INT >= 31) {
                AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
                exact = am.canScheduleExactAlarms();
            }
            o.put("exact", exact);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("status failed: " + e.getMessage());
        }
    }

    /** Rings once after a short delay so the user can lock the phone and verify background ringing. */
    @PluginMethod
    public void testRing(PluginCall call) {
        try {
            int delay = call.getInt("delay", 10);
            AlarmScheduler.scheduleTest(getContext(), delay * 1000L);
            call.resolve();
        } catch (Exception e) {
            call.reject("test failed: " + e.getMessage());
        }
    }

    /** Opens the phone settings page that controls background ringing: notifications, battery, autostart. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        String type = call.getString("type", "app");
        Activity a = getActivity();
        String pkg = getContext().getPackageName();
        boolean done = false;
        try {
            if ("notifications".equals(type)) {
                Intent i;
                if (Build.VERSION.SDK_INT >= 26) {
                    i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    i.putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
                } else {
                    i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    i.setData(Uri.parse("package:" + pkg));
                }
                a.startActivity(i);
                done = true;
            } else if ("battery".equals(type)) {
                if (Build.VERSION.SDK_INT >= 23) {
                    try {
                        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        i.setData(Uri.parse("package:" + pkg));
                        a.startActivity(i);
                        done = true;
                    } catch (Exception e) {
                        a.startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                        done = true;
                    }
                }
            } else if ("autostart".equals(type)) {
                done = openAutostart(a, pkg);
            }
            if (!done) {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + pkg));
                a.startActivity(i);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("open failed: " + e.getMessage());
        }
    }

    private boolean openAutostart(Activity a, String pkg) {
        String[][] targets = new String[][]{
                {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                {"com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                {"com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity"},
                {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                {"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"},
                {"com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity"},
                {"com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"}
        };
        for (String[] t : targets) {
            try {
                Intent i = new Intent();
                i.setComponent(new ComponentName(t[0], t[1]));
                i.putExtra("package_name", pkg);
                i.putExtra("package_label", "My Clock App");
                a.startActivity(i);
                return true;
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Context c = getContext();
            c.stopService(new Intent(c, AlarmService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("stop failed: " + e.getMessage());
        }
    }
}
""")

java('MainActivity', r"""package __PKG__;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmRingerPlugin.class);
        super.onCreate(savedInstanceState);
        stopRingIfRequested(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        stopRingIfRequested(intent);
    }

    /** Tapping the ringing notification opens the app and silences the alarm. */
    private void stopRingIfRequested(Intent intent) {
        if (intent != null && intent.getBooleanExtra("alarm_stop", false)) {
            stopService(new Intent(this, AlarmService.class));
        }
    }
}
""")

print('native.py: done')
