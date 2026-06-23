package com.testlab.offline;

import android.content.Context;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class UserPreferences {
    private static final String PREFS = "aurex_prefs";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_TEST_RESULTS = "test_results";
    private static final String KEY_STREAK_COUNT = "streak_count";
    private static final String KEY_STREAK_DATE = "streak_date";

    private final SharedPreferences prefs;

    public UserPreferences(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public boolean hasUsername() {
        return !getUsername().isEmpty();
    }

    public String getUsername() {
        return prefs.getString(KEY_USERNAME, "");
    }

    public void setUsername(String name) {
        prefs.edit().putString(KEY_USERNAME, name).apply();
    }

    // Streak
    public int getStreak() {
        int streak = prefs.getInt(KEY_STREAK_COUNT, 0);
        String lastDate = prefs.getString(KEY_STREAK_DATE, "");
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        if (!today.equals(lastDate)) {
            // Check if yesterday
            try {
                Date last = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(lastDate);
                Date todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(today);
                long diff = todayDate.getTime() - last.getTime();
                long days = diff / (1000 * 60 * 60 * 24);
                if (days == 1) {
                    streak++;
                } else {
                    streak = 1;
                }
                prefs.edit().putInt(KEY_STREAK_COUNT, streak).putString(KEY_STREAK_DATE, today).apply();
            } catch (Exception e) {
                streak = 1;
                prefs.edit().putInt(KEY_STREAK_COUNT, 1).putString(KEY_STREAK_DATE, today).apply();
            }
        }
        return streak;
    }

    public void recordLogin() {
        getStreak(); // this updates the streak automatically
    }

    // Test results storage
    public void saveTestResult(String title, String subject, int score, int total, int minutes, int seconds) {
        List<TestResult> results = getTestResults();
        JSONObject entry = new JSONObject();
        try {
            entry.put("title", title);
            entry.put("subject", subject);
            entry.put("score", score);
            entry.put("total", total);
            entry.put("minutes", minutes);
            entry.put("seconds", seconds);
            entry.put("date", new SimpleDateFormat("MMM dd, yyyy", Locale.US).format(new Date()));
        } catch (Exception ignored) {}
        TestResult result = new TestResult(title, subject, score, total, minutes, seconds,
                new SimpleDateFormat("MMM dd, yyyy", Locale.US).format(new Date()));
        results.add(0, result);

        JSONArray arr = new JSONArray();
        for (TestResult r : results) {
            JSONObject o = new JSONObject();
            try {
                o.put("title", r.title);
                o.put("subject", r.subject);
                o.put("score", r.score);
                o.put("total", r.total);
                o.put("minutes", r.minutes);
                o.put("seconds", r.seconds);
                o.put("date", r.date);
            } catch (Exception ignored) {}
            arr.put(o);
        }
        prefs.edit().putString(KEY_TEST_RESULTS, arr.toString()).apply();
    }

    public List<TestResult> getTestResults() {
        List<TestResult> list = new ArrayList<>();
        String json = prefs.getString(KEY_TEST_RESULTS, "");
        if (json.isEmpty()) return list;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                list.add(new TestResult(
                        o.optString("title"),
                        o.optString("subject"),
                        o.optInt("score"),
                        o.optInt("total"),
                        o.optInt("minutes"),
                        o.optInt("seconds"),
                        o.optString("date")
                ));
            }
        } catch (Exception ignored) {}
        return list;
    }

    public int getTotalTests() {
        return getTestResults().size();
    }

    public int getTotalQuestions() {
        int q = 0;
        for (TestResult r : getTestResults()) q += r.total;
        return q;
    }

    public int getAverageScore() {
        List<TestResult> results = getTestResults();
        if (results.isEmpty()) return 0;
        int sum = 0;
        for (TestResult r : results) sum += r.score * 100 / r.total;
        return sum / results.size();
    }

    public String getTotalStudyTime() {
        int totalSecs = 0;
        for (TestResult r : getTestResults()) {
            totalSecs += r.minutes * 60 + r.seconds;
        }
        int hrs = totalSecs / 3600;
        int mins = (totalSecs % 3600) / 60;
        return hrs + "h " + mins + "m";
    }

    public static class TestResult {
        public final String title, subject, date;
        public final int score, total, minutes, seconds;

        TestResult(String title, String subject, int score, int total, int minutes, int seconds, String date) {
            this.title = title;
            this.subject = subject;
            this.score = score;
            this.total = total;
            this.minutes = minutes;
            this.seconds = seconds;
            this.date = date;
        }

        public String getScorePercent() { return (score * 100 / total) + "%"; }
        public String getDetail() { return score + "/" + total; }
        public String getTimeTaken() {
            int m = minutes;
            int h = m / 60;
            m = m % 60;
            int s = seconds;
            if (h > 0) return h + "h " + m + "m";
            if (m > 0) return m + "m " + s + "s";
            return s + "s";
        }
    }
}
