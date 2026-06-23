package com.testlab.offline;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class HomeActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_home);

        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        UserPreferences prefs = new UserPreferences(this);
        String name = prefs.getUsername();

        TextView greetingText = findViewById(R.id.greeting_text);
        greetingText.setText("Hi, " + name + " 👋");

        findViewById(R.id.btn_tests).setOnClickListener(v -> {
            startActivity(new Intent(HomeActivity.this, TestListActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });

        findViewById(R.id.btn_analysis).setOnClickListener(v -> {
            startActivity(new Intent(HomeActivity.this, AnalysisActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });

        findViewById(R.id.btn_settings).setOnClickListener(v -> {
            startActivity(new Intent(HomeActivity.this, SettingsActivity.class));
            overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
        });
    }

    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }
}
