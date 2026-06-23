package com.testlab.offline;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private UserPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        prefs = new UserPreferences(this);

        // Onboarding: ask name if first time
        if (!prefs.hasUsername()) {
            startActivity(new Intent(this, NameActivity.class));
            finish();
            return;
        }

        // Record today's login for streak
        prefs.recordLogin();

        // Update dynamic content
        updateUI();

        // Click listeners
        findViewById(R.id.btn_start_test).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, TestListActivity.class);
            startActivity(intent);
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });

        findViewById(R.id.btn_tests).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, TestListActivity.class);
            startActivity(intent);
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });

        findViewById(R.id.btn_analysis).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, AnalysisActivity.class);
            startActivity(intent);
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });

        findViewById(R.id.btn_ai_chat).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, ChatActivity.class);
            startActivity(intent);
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateUI();
    }

    private void updateUI() {
        String name = prefs.getUsername();
        String initial = name.isEmpty() ? "N" : name.substring(0, 1).toUpperCase();

        // Update greeting
        int greetingId = getResources().getIdentifier("greeting_text", "id", getPackageName());
        TextView greeting = findViewById(R.id.greeting_text);
        if (greeting != null) {
            greeting.setText("Hi " + name + ",");
        }

        // Update initial in top-left
        int topInitialId = getResources().getIdentifier("top_initial", "id", getPackageName());

        // Update streak
        int streak = prefs.getStreak();
        int streakId = getResources().getIdentifier("streak_text", "id", getPackageName());
        TextView streakText = findViewById(R.id.streak_text);
        if (streakText != null) {
            streakText.setText("🔥 " + streak + "-day streak");
        }

        // Update avg score
        int avgScore = prefs.getAverageScore();
        int totalTests = prefs.getTotalTests();
        int totalQuestions = prefs.getTotalQuestions();

        int avgScoreId = getResources().getIdentifier("avg_score_text", "id", getPackageName());
        TextView avgScoreText = findViewById(R.id.avg_score_text);
        if (avgScoreText != null) {
            avgScoreText.setText(avgScore + "%");
        }

        int statsTextId = getResources().getIdentifier("stats_text", "id", getPackageName());
        TextView statsText = findViewById(R.id.stats_text);
        if (statsText != null) {
            statsText.setText(totalTests + " tests · " + totalQuestions + " questions");
        }

        int scoreProgressId = getResources().getIdentifier("score_progress", "id", getPackageName());
        if (findViewById(R.id.score_progress) instanceof android.widget.ProgressBar) {
            android.widget.ProgressBar bar = findViewById(R.id.score_progress);
            if (bar != null) bar.setProgress(avgScore);
        }
    }

    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }
}
