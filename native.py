"""
Runs in CI right after `npx cap add android` (from the repo root).

Customises the generated Android project:
  * light launch screen + light-theme launcher icons + notification icon
  * a native ALARM ENGINE (Java): system alarm-clock scheduling, a foreground ringing service,
    a lock-screen alarm screen, reboot re-scheduling  -> alarms/timers ring with the app closed
  * a 90-second alarm tone (res/raw/alarm_sound.wav)
  * 3 resizable home-screen widgets (Analog / Digital / Flip), light + dark variants
  * long-press app-icon shortcuts that add each widget to the home screen
  * MainActivity registers the native plugin and disables Android's over-scroll glow

It does not patch www/app.js - all web code lives in app.js.
"""
import array
import glob
import json
import math
import os
import sys
import wave
import xml.dom.minidom

from PIL import Image, ImageDraw, ImageFilter

PKG = json.load(open('capacitor.config.json', encoding='utf-8'))['appId']      # com.flipclock.app
R = 'android/app/src/main/res/'
MAIN = 'android/app/src/main/'
JAVA = MAIN + 'java/' + PKG.replace('.', '/') + '/'
NS = 'xmlns:android="http://schemas.android.com/apk/res/android"'


def write(path, text, check_xml=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if check_xml:
        xml.dom.minidom.parseString(text.encode('utf-8'))      # fail the build early on malformed XML
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def java(name, source):
    write(JAVA + name + '.java', source.replace('__PKG__', PKG))


# ================================================================ launch screen, bars, icons
for f in glob.glob(R + '**/splash.png', recursive=True):
    os.remove(f)
write(R + 'drawable/splash.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<shape {NS} android:shape="rectangle">
    <gradient android:angle="270" android:startColor="#FFF0E6" android:endColor="#FDA481" />
</shape>
''', True)
write(R + 'values/ic_launcher_background.xml',
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FDA481</color>\n</resources>\n', True)

p = R + 'values/styles.xml'
s = open(p, encoding='utf-8').read()
marker = '<item name="android:background">@null</item>'
if marker in s and 'android:statusBarColor' not in s:
    s = s.replace(marker, marker +
                  '\n        <item name="android:statusBarColor">#FFF0E6</item>'
                  '\n        <item name="android:navigationBarColor">#FDA481</item>'
                  '\n        <item name="android:windowLightStatusBar">true</item>'
                  '\n        <item name="android:windowBackground">#FEC9AE</item>')
# Android 12+ system splash colour
launch_marker = '<item name="android:background">@drawable/splash</item>'
if launch_marker in s and 'windowSplashScreenBackground' not in s:
    s = s.replace(launch_marker, launch_marker + '\n        <item name="windowSplashScreenBackground">#FEC9AE</item>')
open(p, 'w', encoding='utf-8').write(s)

src = Image.open('www/icons/icon-512.png').convert('RGB')
fg = Image.open('www/icons/maskable-512.png').convert('RGB')
for d, legacy, adaptive in [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
    os.makedirs(f'{R}mipmap-{d}', exist_ok=True)
    a = src.resize((legacy, legacy), Image.LANCZOS)
    a.save(f'{R}mipmap-{d}/ic_launcher.png')
    m = Image.new('L', (legacy, legacy), 0)
    ImageDraw.Draw(m).ellipse([0, 0, legacy - 1, legacy - 1], fill=255)
    r = a.copy()
    r.putalpha(m)
    r.save(f'{R}mipmap-{d}/ic_launcher_round.png')
    fg.resize((adaptive, adaptive), Image.LANCZOS).save(f'{R}mipmap-{d}/ic_launcher_foreground.png')

# notification (status bar) icon: white clock silhouette
for d, px in [('mdpi', 24), ('hdpi', 36), ('xhdpi', 48), ('xxhdpi', 72), ('xxxhdpi', 96)]:
    S = px * 8
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    c = S / 2
    dr.ellipse([S * .1, S * .1, S * .9, S * .9], outline='white', width=int(S * .08))
    dr.line([(c, c), (c, S * .27)], fill='white', width=int(S * .08))
    dr.line([(c, c), (S * .66, c + S * .12)], fill='white', width=int(S * .08))
    dr.ellipse([c - S * .045, c - S * .045, c + S * .045, c + S * .045], fill='white')
    os.makedirs(f'{R}drawable-{d}', exist_ok=True)
    im.resize((px, px), Image.LANCZOS).save(f'{R}drawable-{d}/ic_stat_clock.png')


# ================================================================ alarm tone (about 90 s, full loudness)
def make_alarm_wav(path, seconds=90, sr=16000):
    cycle_len = 2.0                       # one cycle: 4 quick beeps, then a pause
    beep, gap, f0 = 0.11, 0.09, 1760.0
    cyc = []
    for i in range(int(sr * cycle_len)):
        t = i / sr
        v = 0.0
        if t < 4 * (beep + gap):
            k = int(t // (beep + gap))
            lt = t - k * (beep + gap)
            if lt < beep:
                env = min(1.0, lt / 0.008, (beep - lt) / 0.015)
                v = env * (0.8 * math.sin(2 * math.pi * f0 * t) + 0.2 * math.sin(4 * math.pi * f0 * t))
        cyc.append(v)
    n = int(seconds * sr)
    buf = array.array('h', [0]) * n
    L = len(cyc)
    for i in range(n):
        buf[i] = int(max(-1.0, min(1.0, cyc[i % L] * 0.95)) * 32767)       # full loudness; the service ramps the volume if 'gradual' is on
    if sys.byteorder == 'big':
        buf.byteswap()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(buf.tobytes())


make_alarm_wav(R + 'raw/alarm_sound.wav')


# ================================================================ widget artwork (analog dial + hands), light + dark
def draw_widget_art(folder, face, edge, tick_hr, tick_min, hand, cap):
    S, OUT = 1600, 800
    c = S / 2
    os.makedirs(R + folder, exist_ok=True)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([c * .02, c * .02, S - c * .02, S - c * .02], fill=face, outline=edge, width=8)
    for i in range(60):
        a = math.radians(i * 6 - 90)
        hour = i % 5 == 0
        r1, r2 = c * .90, c * (.78 if hour else .84)
        d.line([(c + r1 * math.cos(a), c + r1 * math.sin(a)), (c + r2 * math.cos(a), c + r2 * math.sin(a))],
               fill=tick_hr if hour else tick_min, width=16 if hour else 6)
    im.resize((OUT, OUT), Image.LANCZOS).save(R + folder + '/widget_dial.png')

    def hand_img(name, length, width, with_cap):
        h = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        dd = ImageDraw.Draw(h)
        dd.rounded_rectangle([c - width / 2, c - c * length, c + width / 2, c + c * .12], radius=width / 2, fill=hand)
        if with_cap:
            dd.ellipse([c - 34, c - 34, c + 34, c + 34], fill=cap)
        h.resize((OUT, OUT), Image.LANCZOS).save(R + folder + '/' + name + '.png')

    hand_img('widget_hand_hour', .52, 44, False)
    hand_img('widget_hand_minute', .78, 30, True)


draw_widget_art('drawable-nodpi', (255, 240, 230, 232), (24, 26, 47, 90), (24, 26, 47, 255), (55, 65, 92, 170),
                (24, 26, 47, 255), (180, 24, 45, 255))
draw_widget_art('drawable-night-nodpi', (10, 10, 10, 240), (80, 80, 80, 255), (255, 255, 255, 255), (120, 120, 120, 255),
                (255, 255, 255, 255), (253, 164, 129, 255))

# ================================================================ widget resources
write(R + 'values/widget_colors.xml', '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="w_bg">#EBFFF0E6</color>
    <color name="w_stroke">#33181A2F</color>
    <color name="w_text">#181A2F</color>
    <color name="w_sub">#37415C</color>
    <color name="w_card_top">#3A4563</color>
    <color name="w_card_bot">#222B44</color>
    <color name="w_card_text">#FFE8DB</color>
    <color name="w_line">#181A2F</color>
    <color name="w_colon">#80181A2F</color>
</resources>
''', True)
write(R + 'values-night/widget_colors.xml', '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="w_bg">#E6000000</color>
    <color name="w_stroke">#33FFFFFF</color>
    <color name="w_text">#FFFFFF</color>
    <color name="w_sub">#A3A3A3</color>
    <color name="w_card_top">#222222</color>
    <color name="w_card_bot">#111111</color>
    <color name="w_card_text">#FFFFFF</color>
    <color name="w_line">#000000</color>
    <color name="w_colon">#80FFFFFF</color>
</resources>
''', True)

write(R + 'values/widget_strings.xml', '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_analog_name">Flip Clock - Analog</string>
    <string name="widget_digital_name">Flip Clock - Digital</string>
    <string name="widget_flip_name">Flip Clock - Flip</string>
    <string name="widget_analog_desc">Resizable analog clock</string>
    <string name="widget_digital_desc">Resizable digital clock</string>
    <string name="widget_flip_desc">Resizable flip clock</string>
    <string name="shortcut_analog_short">Analog clock</string>
    <string name="shortcut_analog_long">Add analog clock to home screen</string>
    <string name="shortcut_digital_short">Digital clock</string>
    <string name="shortcut_digital_long">Add digital clock to home screen</string>
    <string name="shortcut_flip_short">Flip clock</string>
    <string name="shortcut_flip_long">Add flip clock to home screen</string>
</resources>
''', True)

write(R + 'drawable/widget_bg.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<shape {NS} android:shape="rectangle">
    <solid android:color="@color/w_bg" />
    <corners android:radius="24dp" />
    <stroke android:width="1dp" android:color="@color/w_stroke" />
</shape>
''', True)

write(R + 'drawable/widget_card_bg.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<shape {NS} android:shape="rectangle">
    <gradient android:angle="270" android:startColor="@color/w_card_top" android:endColor="@color/w_card_bot" />
    <corners android:radius="12dp" />
</shape>
''', True)

write(R + 'layout/widget_digital.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout {NS}
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:padding="10dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:orientation="vertical">

        <TextClock
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="3"
            android:autoSizeMaxTextSize="120sp"
            android:autoSizeMinTextSize="12sp"
            android:autoSizeStepGranularity="1sp"
            android:autoSizeTextType="uniform"
            android:format12Hour="hh:mm"
            android:format24Hour="HH:mm"
            android:gravity="center"
            android:includeFontPadding="false"
            android:maxLines="1"
            android:textColor="@color/w_text"
            android:textStyle="bold" />

        <TextClock
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:autoSizeMaxTextSize="28sp"
            android:autoSizeMinTextSize="8sp"
            android:autoSizeStepGranularity="1sp"
            android:autoSizeTextType="uniform"
            android:format12Hour="EEE, MMM d  |  a"
            android:format24Hour="EEE, MMM d"
            android:gravity="center"
            android:includeFontPadding="false"
            android:maxLines="1"
            android:textColor="@color/w_sub" />
    </LinearLayout>
</FrameLayout>
''', True)


def flip_card(clock_attrs):
    return f'''            <FrameLayout
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1"
                android:background="@drawable/widget_card_bg">

                <TextClock
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:autoSizeMaxTextSize="110sp"
                    android:autoSizeMinTextSize="12sp"
                    android:autoSizeStepGranularity="1sp"
                    android:autoSizeTextType="uniform"
                    {clock_attrs}
                    android:gravity="center"
                    android:includeFontPadding="false"
                    android:maxLines="1"
                    android:padding="4dp"
                    android:textColor="@color/w_card_text"
                    android:textStyle="bold" />

                <ImageView
                    android:layout_width="match_parent"
                    android:layout_height="2dp"
                    android:layout_gravity="center_vertical"
                    android:background="@color/w_line" />
            </FrameLayout>'''


write(R + 'layout/widget_flip.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout {NS}
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:padding="10dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:orientation="horizontal">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:orientation="vertical">
{flip_card('android:format12Hour="hh" android:format24Hour="HH"')}

            <TextClock
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:format12Hour="a"
                android:format24Hour="'24H'"
                android:gravity="center"
                android:paddingTop="3dp"
                android:textColor="@color/w_sub"
                android:textSize="11sp"
                android:textStyle="bold" />
        </LinearLayout>

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="match_parent"
            android:gravity="center"
            android:paddingBottom="14dp"
            android:text=":"
            android:textColor="@color/w_colon"
            android:textSize="26sp"
            android:textStyle="bold" />

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:orientation="vertical">
{flip_card('android:format12Hour="mm" android:format24Hour="mm"')}

            <TextView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:gravity="center"
                android:paddingTop="3dp"
                android:text="MIN"
                android:textColor="@color/w_sub"
                android:textSize="11sp"
                android:textStyle="bold" />
        </LinearLayout>
    </LinearLayout>
</FrameLayout>
''', True)

write(R + 'layout/widget_analog.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout {NS}
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="4dp">

    <AnalogClock
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:layout_gravity="center"
        android:dial="@drawable/widget_dial"
        android:hand_hour="@drawable/widget_hand_hour"
        android:hand_minute="@drawable/widget_hand_minute" />
</FrameLayout>
''', True)


def provider(name, w, h, cw, ch, rw, rh):
    write(R + f'xml/widget_{name}_info.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider {NS}
    android:description="@string/widget_{name}_desc"
    android:initialLayout="@layout/widget_{name}"
    android:minHeight="{h}dp"
    android:minResizeHeight="{rh}dp"
    android:minResizeWidth="{rw}dp"
    android:minWidth="{w}dp"
    android:previewLayout="@layout/widget_{name}"
    android:resizeMode="horizontal|vertical"
    android:targetCellHeight="{ch}"
    android:targetCellWidth="{cw}"
    android:updatePeriodMillis="0"
    android:widgetCategory="home_screen" />
''', True)


provider('analog', 110, 110, 2, 2, 60, 60)
provider('digital', 110, 40, 2, 1, 60, 30)
provider('flip', 180, 110, 3, 2, 110, 70)


def shortcut(sid, key):
    return f'''    <shortcut
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutId="{sid}"
        android:shortcutLongLabel="@string/shortcut_{key}_long"
        android:shortcutShortLabel="@string/shortcut_{key}_short">
        <intent
            android:action="{PKG}.PIN_{key.upper()}"
            android:targetClass="{PKG}.PinWidgetActivity"
            android:targetPackage="{PKG}" />
    </shortcut>
'''


write(R + 'xml/shortcuts.xml',
      f'<?xml version="1.0" encoding="utf-8"?>\n<shortcuts {NS}>\n'
      + shortcut('pin_flip', 'flip') + shortcut('pin_digital', 'digital') + shortcut('pin_analog', 'analog')
      + '</shortcuts>\n', True)


# ================================================================ JAVA: widgets
java('ClockWidgetBase', r"""package __PKG__;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Shared code for the three clock widgets: tapping a widget opens the app. */
public abstract class ClockWidgetBase extends AppWidgetProvider {

    protected abstract int layoutId();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent pending = null;
        if (launch != null) {
            pending = PendingIntent.getActivity(context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), layoutId());
            if (pending != null) {
                views.setOnClickPendingIntent(R.id.widget_root, pending);
            }
            manager.updateAppWidget(id, views);
        }
    }
}
""")

for cls, layout in [('AnalogWidget', 'widget_analog'), ('DigitalWidget', 'widget_digital'), ('FlipWidget', 'widget_flip')]:
    java(cls, f"""package __PKG__;

public class {cls} extends ClockWidgetBase {{
    @Override
    protected int layoutId() {{
        return R.layout.{layout};
    }}
}}
""")

java('PinWidgetActivity', r"""package __PKG__;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

/** Invisible activity behind the long-press shortcuts: asks Android to pin a clock widget. */
public class PinWidgetActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            Intent intent = getIntent();
            String action = intent != null ? intent.getAction() : null;
            Class<?> target = DigitalWidget.class;
            if ("__PKG__.PIN_ANALOG".equals(action)) {
                target = AnalogWidget.class;
            } else if ("__PKG__.PIN_FLIP".equals(action)) {
                target = FlipWidget.class;
            }
            boolean pinned = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AppWidgetManager manager = getSystemService(AppWidgetManager.class);
                if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                    manager.requestPinAppWidget(new ComponentName(this, target), null, null);
                    pinned = true;
                }
            }
            if (!pinned) {
                Toast.makeText(this, "Long-press your home screen, then choose Widgets > Flip Clock", Toast.LENGTH_LONG).show();
            }
        } catch (Exception ignored) {
        }
        finish();
    }
}
""")

# ================================================================ JAVA: alarm engine
java('AlarmScheduler', r"""package __PKG__;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Schedules alarms with the system ALARM CLOCK (AlarmManager.setAlarmClock):
 * fires on time in Doze / screen off / app closed, and is re-created after a reboot.
 * Supports repeat days, one-time alarms, "skip next", timer + interval events and snooze.
 */
final class AlarmScheduler {
    static final String ACTION_FIRE = "__PKG__.ALARM_FIRE";
    static final String EXTRA_KIND = "kind";
    static final String EXTRA_LABEL = "label";
    static final String EXTRA_TEXT = "text";
    static final String EXTRA_AT = "at";
    static final String EXTRA_ID = "id";

    private static final String PREFS = "flipclock_alarms";
    private static final int CODE_ONESHOT_BASE = 10;
    private static final int CODE_EVENT_BASE = 100;
    private static final int CODE_ALARM_BASE = 1000;

    private AlarmScheduler() { }

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject settings(Context c) {
        try {
            return new JSONObject(prefs(c).getString("settings", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** Called by the web app every time alarms, timers or settings change. */
    static void save(Context c, String alarmsJson, String eventsJson, String settingsJson) {
        SharedPreferences p = prefs(c);
        String fired = p.getString("firedOnce", "");
        String alarms = fired.isEmpty() ? alarmsJson : disableFired(alarmsJson, fired);
        p.edit().putString("alarms", alarms).putString("events", eventsJson).putString("settings", settingsJson).apply();
        rescheduleAll(c);
    }

    /** One-time alarms that already rang (the web app turns them off the next time it opens). */
    static String takeFired(Context c) {
        SharedPreferences p = prefs(c);
        String s = p.getString("firedOnce", "");
        p.edit().putString("firedOnce", "").apply();
        return s;
    }

    private static String disableFired(String alarmsJson, String fired) {
        try {
            JSONArray arr = new JSONArray(alarmsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (("," + fired + ",").contains("," + o.optLong("id", 0L) + ",")) {
                    o.put("enabled", false);
                }
            }
            return arr.toString();
        } catch (Exception e) {
            return alarmsJson;
        }
    }

    /** Snooze / test alarm: a single alarm at an exact time. */
    static void addOneShot(Context c, long at, String kind, String label, String text) {
        try {
            SharedPreferences p = prefs(c);
            JSONArray old = new JSONArray(p.getString("oneshots", "[]"));
            JSONArray fresh = new JSONArray();
            long now = System.currentTimeMillis();
            for (int i = 0; i < old.length(); i++) {
                JSONObject o = old.getJSONObject(i);
                if (o.optLong("at", 0L) > now && fresh.length() < 40) {
                    fresh.put(o);
                }
            }
            JSONObject n = new JSONObject();
            n.put("at", at);
            n.put("kind", kind);
            n.put("label", label);
            n.put("text", text);
            fresh.put(n);
            p.edit().putString("oneshots", fresh.toString()).apply();
        } catch (Exception ignored) {
        }
        rescheduleAll(c);
    }

    /** Called right when something fired. */
    static void afterFire(Context c, String kind, long id) {
        SharedPreferences p = prefs(c);
        p.edit().putLong("lastFire", System.currentTimeMillis()).apply();
        if ("alarm".equals(kind) && id != 0L) {
            markOnceIfNeeded(c, id);
        }
        rescheduleAll(c);
    }

    /** A one-time alarm (no repeat days) switches itself off after it rang. */
    private static void markOnceIfNeeded(Context c, long id) {
        try {
            SharedPreferences p = prefs(c);
            JSONArray arr = new JSONArray(p.getString("alarms", "[]"));
            boolean changed = false;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (o.optLong("id", 0L) == id) {
                    JSONArray days = o.optJSONArray("days");
                    if (days == null || days.length() == 0) {
                        o.put("enabled", false);
                        changed = true;
                    }
                }
            }
            if (changed) {
                String fired = p.getString("firedOnce", "");
                p.edit().putString("alarms", arr.toString())
                        .putString("firedOnce", fired.isEmpty() ? String.valueOf(id) : fired + "," + id).apply();
            }
        } catch (Exception ignored) {
        }
    }

    static void rescheduleAll(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            return;
        }
        SharedPreferences p = prefs(c);

        String old = p.getString("codes", "");
        if (!old.isEmpty()) {
            for (String s : old.split(",")) {
                try {
                    cancel(c, am, Integer.parseInt(s.trim()));
                } catch (NumberFormatException ignored) {
                }
            }
        }

        StringBuilder codes = new StringBuilder();
        long now = System.currentTimeMillis();
        long earliest = Math.max(now, p.getLong("lastFire", 0L) + 2000L);

        try {
            JSONArray arr = new JSONArray(p.getString("alarms", "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (!o.optBoolean("enabled", true)) {
                    continue;
                }
                int hour = o.getInt("hour");
                int minute = o.getInt("minute");
                long at = nextOccurrence(hour, minute, o.optJSONArray("days"), o.optLong("skip", 0L), earliest);
                if (at < 0) {
                    continue;
                }
                long id = o.optLong("id", i);
                int code = CODE_ALARM_BASE + (int) (Math.abs(id) % 100000000L);
                schedule(c, am, code, at, "alarm", o.optString("label", "Alarm"), two(hour) + ":" + two(minute), id);
                append(codes, code);
            }
        } catch (Exception ignored) {
        }

        try {
            JSONArray ev = new JSONArray(p.getString("events", "[]"));
            for (int i = 0; i < ev.length() && i < 90; i++) {
                JSONObject o = ev.getJSONObject(i);
                long at = o.optLong("at", 0L);
                if (at > now) {
                    boolean last = o.optBoolean("last", true);
                    schedule(c, am, CODE_EVENT_BASE + i, at, last ? "timer" : "interval",
                            o.optString("title", "Timer"), o.optString("text", ""), 0L);
                    append(codes, CODE_EVENT_BASE + i);
                }
            }
        } catch (Exception ignored) {
        }

        try {
            JSONArray old1 = new JSONArray(p.getString("oneshots", "[]"));
            JSONArray keep = new JSONArray();
            for (int i = 0; i < old1.length() && keep.length() < 40; i++) {
                JSONObject o = old1.getJSONObject(i);
                long at = o.optLong("at", 0L);
                if (at > now) {
                    schedule(c, am, CODE_ONESHOT_BASE + keep.length(), at, o.optString("kind", "snooze"),
                            o.optString("label", "Alarm"), o.optString("text", ""), 0L);
                    append(codes, CODE_ONESHOT_BASE + keep.length());
                    keep.put(o);
                }
            }
            p.edit().putString("oneshots", keep.toString()).apply();
        } catch (Exception ignored) {
        }

        p.edit().putString("codes", codes.toString()).apply();
    }

    private static void append(StringBuilder sb, int code) {
        if (sb.length() > 0) {
            sb.append(',');
        }
        sb.append(code);
    }

    private static String two(int n) {
        return n < 10 ? "0" + n : String.valueOf(n);
    }

    private static boolean hasDay(JSONArray days, int day) {
        for (int i = 0; i < days.length(); i++) {
            if (days.optInt(i, -1) == day) {
                return true;
            }
        }
        return false;
    }

    /** Next time hour:minute happens on one of the repeat days (empty = any day), after "after", never the skipped one. */
    static long nextOccurrence(int hour, int minute, JSONArray days, long skip, long after) {
        for (int off = 0; off <= 8; off++) {
            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(after);
            cal.add(Calendar.DAY_OF_YEAR, off);
            cal.set(Calendar.HOUR_OF_DAY, hour);
            cal.set(Calendar.MINUTE, minute);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            long t = cal.getTimeInMillis();
            if (t <= after) {
                continue;
            }
            if (days != null && days.length() > 0 && !hasDay(days, cal.get(Calendar.DAY_OF_WEEK) - 1)) {
                continue;
            }
            if (skip > 0 && Math.abs(t - skip) < 60000L) {
                continue;
            }
            return t;
        }
        return -1L;
    }

    private static void schedule(Context c, AlarmManager am, int code, long at, String kind, String label, String text, long id) {
        Intent fire = new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE)
                .putExtra(EXTRA_KIND, kind).putExtra(EXTRA_LABEL, label)
                .putExtra(EXTRA_TEXT, text).putExtra(EXTRA_AT, at).putExtra(EXTRA_ID, id);
        PendingIntent firePi = PendingIntent.getBroadcast(c, code, fire,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent openPi = PendingIntent.getActivity(c, code, new Intent(c, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, openPi), firePi);
        } catch (Exception e) {
            try {
                if (Build.VERSION.SDK_INT >= 23) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, firePi);
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, at, firePi);
                }
            } catch (Exception ignored) {
            }
        }
    }

    private static void cancel(Context c, AlarmManager am, int code) {
        Intent fire = new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE);
        PendingIntent pi = PendingIntent.getBroadcast(c, code, fire,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }
}
""")

java('AlarmReceiver', r"""package __PKG__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** Receives the exact-time alarm (and the Dismiss / Snooze buttons of the ringing notification). */
public class AlarmReceiver extends BroadcastReceiver {
    static final String ACTION_DISMISS = "__PKG__.ALARM_DISMISS";
    static final String ACTION_SNOOZE = "__PKG__.ALARM_SNOOZE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        if (AlarmScheduler.ACTION_FIRE.equals(action)) {
            String kind = intent.getStringExtra(AlarmScheduler.EXTRA_KIND);
            String label = intent.getStringExtra(AlarmScheduler.EXTRA_LABEL);
            String text = intent.getStringExtra(AlarmScheduler.EXTRA_TEXT);
            long id = intent.getLongExtra(AlarmScheduler.EXTRA_ID, 0L);
            if (kind == null) {
                kind = "alarm";
            }
            if (label == null) {
                label = "Alarm";
            }
            if (text == null) {
                text = "";
            }
            AlarmScheduler.afterFire(context, kind, id);     // tomorrow's alarm is scheduled first, so it can never be lost
            Intent svc = new Intent(context, AlarmService.class)
                    .putExtra(AlarmScheduler.EXTRA_KIND, kind)
                    .putExtra(AlarmScheduler.EXTRA_LABEL, label)
                    .putExtra(AlarmScheduler.EXTRA_TEXT, text);
            try {
                ContextCompat.startForegroundService(context, svc);
            } catch (Exception e) {
                AlarmNotifier.postBackup(context, kind, label, text);
            }
        } else if (ACTION_DISMISS.equals(action)) {
            stopRinging(context);
        } else if (ACTION_SNOOZE.equals(action)) {
            String label = intent.getStringExtra(AlarmScheduler.EXTRA_LABEL);
            int mins = AlarmScheduler.settings(context).optInt("snoozeMin", 10);
            if (mins < 1) {
                mins = 10;
            }
            stopRinging(context);
            AlarmScheduler.addOneShot(context, System.currentTimeMillis() + mins * 60L * 1000L, "snooze",
                    label == null ? "Alarm" : label, "Snoozed " + mins + " min");
        }
    }

    static void stopRinging(Context context) {
        context.stopService(new Intent(context, AlarmService.class));
        AlarmNotifier.cancel(context);
    }
}
""")

java('BootReceiver', r"""package __PKG__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-creates every alarm after a reboot, an app update, or a time / time-zone change. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        AlarmScheduler.rescheduleAll(context);
    }
}
""")

java('AlarmNotifier', r"""package __PKG__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;

/** Builds the ringing notification (full-screen on the lock screen, with Snooze / Dismiss). */
final class AlarmNotifier {
    static final int NOTIF_ID = 4242;
    private static final String CH_RING = "ring_v1";
    private static final String CH_SOUND = "ring_sound_v1";

    private AlarmNotifier() { }

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) {
            return;
        }
        NotificationChannel ring = new NotificationChannel(CH_RING, "Ringing alarm", NotificationManager.IMPORTANCE_HIGH);
        ring.setSound(null, null);
        ring.enableVibration(false);
        ring.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ring);

        NotificationChannel snd = new NotificationChannel(CH_SOUND, "Alarm sound (backup)", NotificationManager.IMPORTANCE_HIGH);
        AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        snd.setSound(Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.alarm_sound), aa);
        snd.enableVibration(true);
        snd.setVibrationPattern(new long[]{0, 600, 400, 600});
        snd.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(snd);
    }

    static Notification build(Context c, String kind, String label, String text, boolean withSound) {
        ensureChannels(c);
        boolean timer = "timer".equals(kind);
        boolean interval = "interval".equals(kind);
        JSONObject st = AlarmScheduler.settings(c);
        boolean challenge = "math".equals(st.optString("challenge", "off"));
        int snoozeMin = st.optInt("snoozeMin", 10);
        String title;
        if (timer) {
            title = (label == null || label.isEmpty()) ? "Timer complete" : label;
        } else {
            title = (label == null || label.isEmpty()) ? "Alarm" : label;
        }

        Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (launch == null) {
            launch = new Intent(c, MainActivity.class);
        }
        PendingIntent open = PendingIntent.getActivity(c, 7, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent fullIntent = new Intent(c, AlarmActivity.class)
                .putExtra(AlarmScheduler.EXTRA_KIND, kind)
                .putExtra(AlarmScheduler.EXTRA_LABEL, title)
                .putExtra(AlarmScheduler.EXTRA_TEXT, text)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent full = PendingIntent.getActivity(c, 8, fullIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, withSound ? CH_SOUND : CH_RING)
                .setSmallIcon(R.drawable.ic_stat_clock)
                .setContentTitle(title)
                .setContentText(text)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false);

        if (interval) {
            b.setPriority(NotificationCompat.PRIORITY_DEFAULT).setOngoing(false).setContentIntent(open);
        } else {
            b.setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setOngoing(true)
                    .setContentIntent(challenge ? full : open)
                    .setFullScreenIntent(full, true);
            if (!challenge) {
                PendingIntent dismiss = PendingIntent.getBroadcast(c, 9,
                        new Intent(c, AlarmReceiver.class).setAction(AlarmReceiver.ACTION_DISMISS),
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                b.addAction(0, "Dismiss", dismiss);
                if (!timer) {
                    PendingIntent snooze = PendingIntent.getBroadcast(c, 10,
                            new Intent(c, AlarmReceiver.class).setAction(AlarmReceiver.ACTION_SNOOZE)
                                    .putExtra(AlarmScheduler.EXTRA_LABEL, title),
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    b.addAction(0, "Snooze " + snoozeMin + " min", snooze);
                }
            }
        }
        Notification n = b.build();
        if (withSound && !interval) {
            n.flags |= Notification.FLAG_INSISTENT;      // keep repeating the sound until dismissed
        }
        return n;
    }

    /** Used only if the ringing service cannot start: a notification that plays the alarm sound by itself. */
    static void postBackup(Context c, String kind, String label, String text) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIF_ID, build(c, kind, label, text, true));
            }
        } catch (Exception ignored) {
        }
    }

    static void cancel(Context c) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIF_ID);
            }
        } catch (Exception ignored) {
        }
    }
}
""")

java('AlarmService', r"""package __PKG__;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;
import org.json.JSONObject;

/** Foreground service that rings (loops the alarm tone + vibrates) until it is dismissed. Interval beeps are short. */
public class AlarmService extends Service {
    static volatile boolean ringing = false;
    static volatile String ringKind = "";
    static volatile String ringTitle = "";
    static volatile String ringText = "";

    private MediaPlayer player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private float volume = 1f;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeout = new Runnable() {
        @Override
        public void run() {
            stopSelf();
        }
    };
    private final Runnable ramp = new Runnable() {
        @Override
        public void run() {
            volume = Math.min(1f, volume + 0.05f);
            try {
                if (player != null) {
                    player.setVolume(volume, volume);
                }
            } catch (Exception ignored) {
            }
            if (volume < 1f) {
                handler.postDelayed(this, 1000);
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String kind = intent != null ? intent.getStringExtra(AlarmScheduler.EXTRA_KIND) : null;
        String label = intent != null ? intent.getStringExtra(AlarmScheduler.EXTRA_LABEL) : null;
        String text = intent != null ? intent.getStringExtra(AlarmScheduler.EXTRA_TEXT) : null;
        if (kind == null) {
            kind = "alarm";
        }
        if (label == null) {
            label = "Alarm";
        }
        if (text == null) {
            text = "";
        }
        boolean interval = "interval".equals(kind);

        // a short interval beep must never cut off an alarm / timer that is already ringing
        if (interval && ringing) {
            try {
                startForeground(AlarmNotifier.NOTIF_ID, AlarmNotifier.build(this, ringKind, ringTitle, ringText, false));
            } catch (Exception ignored) {
            }
            return START_NOT_STICKY;
        }

        JSONObject st = AlarmScheduler.settings(this);
        boolean gradual = st.optBoolean("gradual", true);
        boolean vibrate = st.optBoolean("vibrate", true);

        if (!interval) {
            ringKind = kind;
            ringTitle = label;
            ringText = text;
            ringing = true;
        }

        Notification n = AlarmNotifier.build(this, kind, label, text, false);
        try {
            startForeground(AlarmNotifier.NOTIF_ID, n);
        } catch (Exception e) {
            AlarmNotifier.postBackup(this, kind, label, text);
        }

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                if (wakeLock != null && wakeLock.isHeld()) {
                    wakeLock.release();
                }
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "flipclock:alarm");
                wakeLock.acquire(10L * 60L * 1000L);
            }
        } catch (Exception ignored) {
        }

        handler.removeCallbacks(ramp);
        volume = (gradual && !interval) ? 0.15f : 1f;
        startSound(kind, label, text);
        if (gradual && !interval) {
            handler.postDelayed(ramp, 1000);
        }
        startVibration(vibrate, interval);
        handler.removeCallbacks(timeout);
        handler.postDelayed(timeout, interval ? 4000L : 10L * 60L * 1000L);
        return START_NOT_STICKY;
    }

    private void startSound(String kind, String label, String text) {
        stopSound();
        if (!"interval".equals(kind)) {
            try {
                AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                    int cur = am.getStreamVolume(AudioManager.STREAM_ALARM);
                    if (cur < Math.max(1, max / 2)) {
                        am.setStreamVolume(AudioManager.STREAM_ALARM, Math.max(1, (int) (max * 0.7)), 0);
                    }
                }
            } catch (Exception ignored) {
            }
        }
        try {
            MediaPlayer mp = new MediaPlayer();
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            mp.setAudioAttributes(aa);
            mp.setDataSource(this, Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.alarm_sound));
            mp.setLooping(true);
            mp.setVolume(volume, volume);
            mp.prepare();
            mp.start();
            player = mp;
        } catch (Exception e) {
            AlarmNotifier.postBackup(this, kind, label, text);     // sound plays through the notification instead
        }
    }

    private void startVibration(boolean enabled, boolean interval) {
        if (!enabled) {
            return;
        }
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                AudioAttributes aa = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                if (interval) {
                    v.vibrate(new long[]{0, 350}, -1, aa);
                } else {
                    v.vibrate(new long[]{0, 600, 400, 600, 1200}, 0, aa);
                }
                vibrator = v;
            }
        } catch (Exception ignored) {
        }
    }

    private void stopSound() {
        try {
            if (player != null) {
                player.stop();
                player.release();
            }
        } catch (Exception ignored) {
        }
        player = null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(timeout);
        handler.removeCallbacks(ramp);
        stopSound();
        try {
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception ignored) {
        }
        vibrator = null;
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {
        }
        ringing = false;
        ringKind = "";
        AlarmNotifier.cancel(this);
        super.onDestroy();
    }
}
""")

java('AlarmActivity', r"""package __PKG__;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Random;
import org.json.JSONObject;

/** Full-screen alarm screen shown over the lock screen (Snooze / Dismiss, or a maths question to dismiss). */
public class AlarmActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Random random = new Random();
    private TextView question;
    private final Button[] answers = new Button[3];
    private int correctIndex = 0;

    private final Runnable check = new Runnable() {
        @Override
        public void run() {
            if (!AlarmService.ringing) {
                finish();
            } else {
                handler.postDelayed(this, 700);
            }
        }
    };

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    private Button button(String label, String bg, String fg) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(true);
        b.setTextSize(15);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(Color.parseColor(fg));
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(Color.parseColor(bg));
        shape.setCornerRadius(dp(30));
        b.setBackground(shape);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(58));
        lp.topMargin = dp(12);
        b.setLayoutParams(lp);
        return b;
    }

    private void newProblem() {
        int a;
        int b;
        int ans;
        String text;
        if (random.nextBoolean()) {
            a = 12 + random.nextInt(78);
            b = 12 + random.nextInt(78);
            ans = a + b;
            text = a + " + " + b + " = ?";
        } else {
            a = 3 + random.nextInt(10);
            b = 3 + random.nextInt(7);
            ans = a * b;
            text = a + " \u00D7 " + b + " = ?";
        }
        question.setText(text);
        correctIndex = random.nextInt(3);
        int[] vals = new int[3];
        for (int i = 0; i < 3; i++) {
            if (i == correctIndex) {
                vals[i] = ans;
            } else {
                int v;
                boolean clash;
                do {
                    v = ans + (random.nextBoolean() ? 1 : -1) * (1 + random.nextInt(9));
                    clash = v == ans || v < 0;
                    for (int j = 0; j < i; j++) {
                        if (vals[j] == v) {
                            clash = true;
                        }
                    }
                } while (clash);
                vals[i] = v;
            }
            answers[i].setText(String.valueOf(vals[i]));
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        Intent in = getIntent();
        String kind = in != null ? in.getStringExtra(AlarmScheduler.EXTRA_KIND) : null;
        final String label = in != null ? in.getStringExtra(AlarmScheduler.EXTRA_LABEL) : null;
        String text = in != null ? in.getStringExtra(AlarmScheduler.EXTRA_TEXT) : null;
        boolean timer = "timer".equals(kind);
        JSONObject st = AlarmScheduler.settings(this);
        boolean challenge = "math".equals(st.optString("challenge", "off"));
        int snoozeMin = st.optInt("snoozeMin", 10);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(32), dp(32), dp(32), dp(32));
        root.setBackgroundColor(Color.parseColor("#181A2F"));

        TextView title = new TextView(this);
        title.setText(label == null || label.isEmpty() ? (timer ? "Timer complete" : "Alarm") : label);
        title.setTextColor(Color.parseColor("#FFE8DB"));
        title.setTextSize(26);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView time = new TextView(this);
        time.setText(text == null ? "" : text);
        time.setTextColor(Color.parseColor("#FDA481"));
        time.setTextSize(52);
        time.setTypeface(Typeface.DEFAULT_BOLD);
        time.setGravity(Gravity.CENTER);
        time.setPadding(0, dp(10), 0, dp(26));
        root.addView(time);

        if (challenge) {
            question = new TextView(this);
            question.setTextColor(Color.parseColor("#FFE8DB"));
            question.setTextSize(34);
            question.setTypeface(Typeface.DEFAULT_BOLD);
            question.setGravity(Gravity.CENTER);
            question.setPadding(0, 0, 0, dp(8));
            root.addView(question);
            for (int i = 0; i < 3; i++) {
                final int index = i;
                answers[i] = button("0", "#37415C", "#FFE8DB");
                answers[i].setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        if (index == correctIndex) {
                            sendBroadcast(new Intent(AlarmActivity.this, AlarmReceiver.class).setAction(AlarmReceiver.ACTION_DISMISS));
                            finish();
                        } else {
                            question.setTextColor(Color.parseColor("#FF6B6B"));
                            handler.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    question.setTextColor(Color.parseColor("#FFE8DB"));
                                }
                            }, 600);
                            newProblem();
                        }
                    }
                });
                root.addView(answers[i]);
            }
            newProblem();
        } else {
            Button dismiss = button("Dismiss", "#FDA481", "#181A2F");
            dismiss.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    sendBroadcast(new Intent(AlarmActivity.this, AlarmReceiver.class).setAction(AlarmReceiver.ACTION_DISMISS));
                    finish();
                }
            });
            root.addView(dismiss);
        }

        if (!timer) {
            Button snooze = button("Snooze " + snoozeMin + " min", "#242E49", "#FFE8DB");
            snooze.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    sendBroadcast(new Intent(AlarmActivity.this, AlarmReceiver.class)
                            .setAction(AlarmReceiver.ACTION_SNOOZE)
                            .putExtra(AlarmScheduler.EXTRA_LABEL, label));
                    finish();
                }
            });
            root.addView(snooze);
        }

        setContentView(root);
        handler.postDelayed(check, 1500);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(check);
        super.onDestroy();
    }
}
""")

java('ClockAlarmPlugin', r"""package __PKG__;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridge between the web app and the native alarm engine. */
@CapacitorPlugin(name = "ClockAlarm")
public class ClockAlarmPlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        String alarms = call.getString("alarms", "[]");
        String events = call.getString("events", "[]");
        String settings = call.getString("settings", "{}");
        AlarmScheduler.save(getContext(), alarms, events, settings);
        call.resolve();
    }

    @PluginMethod
    public void dismiss(PluginCall call) {
        AlarmReceiver.stopRinging(getContext());
        call.resolve();
    }

    @PluginMethod
    public void snooze(PluginCall call) {
        Context ctx = getContext();
        ctx.sendBroadcast(new Intent(ctx, AlarmReceiver.class).setAction(AlarmReceiver.ACTION_SNOOZE)
                .putExtra(AlarmScheduler.EXTRA_LABEL, AlarmService.ringTitle));
        call.resolve();
    }

    /** ids of one-time alarms that already rang (comma separated); the web app switches them off. */
    @PluginMethod
    public void getFired(PluginCall call) {
        JSObject o = new JSObject();
        try {
            o.put("ids", AlarmScheduler.takeFired(getContext()));
        } catch (Exception ignored) {
        }
        call.resolve(o);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject o = new JSObject();
        try {
            o.put("ringing", AlarmService.ringing);
            o.put("kind", AlarmService.ringKind);
            o.put("title", AlarmService.ringTitle);
            o.put("text", AlarmService.ringText);
        } catch (Exception ignored) {
        }
        call.resolve(o);
    }

    @PluginMethod
    public void test(PluginCall call) {
        int seconds = 10;
        try {
            seconds = Integer.parseInt(call.getString("seconds", "10"));
        } catch (NumberFormatException ignored) {
        }
        AlarmScheduler.addOneShot(getContext(), System.currentTimeMillis() + seconds * 1000L, "test", "Test alarm", "It works!");
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        JSObject o = new JSObject();
        try {
            o.put("notifications", NotificationManagerCompat.from(ctx).areNotificationsEnabled());
            boolean battery = true;
            if (Build.VERSION.SDK_INT >= 23) {
                PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
                battery = pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
            }
            o.put("battery", battery);
            o.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
            o.put("sdk", Build.VERSION.SDK_INT);
        } catch (Exception ignored) {
        }
        call.resolve(o);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String page = call.getString("page", "app");
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        try {
            Intent i;
            if ("notifications".equals(page)) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
            } else if ("battery".equals(page)) {
                i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg));
            } else if ("fullscreen".equals(page)) {
                i = new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT", Uri.parse("package:" + pkg));
            } else if ("autostart".equals(page)) {
                String[][] targets = {
                        {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                        {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                        {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                        {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                        {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                        {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                        {"com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"}
                };
                for (String[] t : targets) {
                    try {
                        Intent a = new Intent();
                        a.setComponent(new ComponentName(t[0], t[1]));
                        activity.startActivity(a);
                        call.resolve();
                        return;
                    } catch (Exception ignored) {
                    }
                }
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            }
            activity.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            try {
                activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
                call.resolve();
            } catch (Exception e2) {
                call.reject("could not open settings");
            }
        }
    }

    /** Colours the status bar / navigation bar to match the app theme. */
    @PluginMethod
    public void setBars(final PluginCall call) {
        final String status = call.getString("status", "#000000");
        final String nav = call.getString("nav", "#000000");
        final boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Window w = activity.getWindow();
                    w.setStatusBarColor(Color.parseColor(status));
                    w.setNavigationBarColor(Color.parseColor(nav));
                    View decor = w.getDecorView();
                    int flags = decor.getSystemUiVisibility();
                    int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    decor.setSystemUiVisibility(light ? (flags | mask) : (flags & ~mask));
                } catch (Exception ignored) {
                }
                call.resolve();
            }
        });
    }
}
""")

java('MainActivity', r"""package __PKG__;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ClockAlarmPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        } catch (Exception ignored) {
        }
    }
}
""")

# ================================================================ AndroidManifest.xml
mp = MAIN + 'AndroidManifest.xml'
m = open(mp, encoding='utf-8').read()
assert '<application' in m and '</application>' in m and '</activity>' in m, 'unexpected AndroidManifest.xml layout'

if 'POST_NOTIFICATIONS' not in m:
    perms = '''    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

    '''
    m = m.replace('<application', perms + '<application', 1)

if 'PinWidgetActivity' not in m:
    # long-press shortcuts live on the launcher activity (the first <activity>)
    m = m.replace('</activity>', '    <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />\n        </activity>', 1)
    extra = f'''
        <activity
            android:name="{PKG}.PinWidgetActivity"
            android:excludeFromRecents="true"
            android:exported="true"
            android:theme="@android:style/Theme.Translucent.NoTitleBar" />

        <activity
            android:name="{PKG}.AlarmActivity"
            android:excludeFromRecents="true"
            android:exported="false"
            android:launchMode="singleInstance"
            android:showWhenLocked="true"
            android:turnScreenOn="true"
            android:theme="@android:style/Theme.DeviceDefault.NoActionBar" />

        <service
            android:name="{PKG}.AlarmService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />

        <receiver
            android:name="{PKG}.AlarmReceiver"
            android:exported="false" />

        <receiver
            android:name="{PKG}.BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
            </intent-filter>
        </receiver>
'''
    for cls, key in [('AnalogWidget', 'analog'), ('DigitalWidget', 'digital'), ('FlipWidget', 'flip')]:
        extra += f'''
        <receiver
            android:name="{PKG}.{cls}"
            android:exported="true"
            android:label="@string/widget_{key}_name">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_{key}_info" />
        </receiver>
'''
    m = m.replace('</application>', extra + '    </application>', 1)

xml.dom.minidom.parseString(m.encode('utf-8'))       # manifest must still be valid XML
open(mp, 'w', encoding='utf-8').write(m)
print('native.py finished OK')
