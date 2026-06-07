package com.testlab.offline;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // Make the activity fullscreen to hide status bar
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        // Initialize UI components
        Button btnStartTest = findViewById(R.id.btn_start_test);
        Button btnBeginMathTest = findViewById(R.id.btn_begin_math_test);
        Button btnSignIn = findViewById(R.id.btn_sign_in);
        Button btnGetStarted = findViewById(R.id.btn_get_started);
        Button btnAnnounceClose = findViewById(R.id.announce_close);
        Button btnMinimize = findViewById(R.id.btn_minimize);
        Button btnMaximize = findViewById(R.id.btn_maximize);
        Button btnClose = findViewById(R.id.btn_close);

        // Set click listeners
        btnStartTest.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, TestTakingActivity.class);
            startActivity(intent);
        });

        btnBeginMathTest.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, TestTakingActivity.class);
            startActivity(intent);
        });

        btnSignIn.setOnClickListener(v -> {
            // Placeholder for sign in functionality
        });

        btnGetStarted.setOnClickListener(v -> {
            // Placeholder for get started functionality
        });

        btnAnnounceClose.setOnClickListener(v -> {
            View announcement = findViewById(R.id.announcement);
            announcement.setVisibility(View.GONE);
        });

        // Window control buttons (minimize, maximize, close)
        btnMinimize.setOnClickListener(v -> {
            // Minimize functionality (placeholder)
        });

        btnMaximize.setOnClickListener(v -> {
            // Maximize/restore functionality (placeholder)
        });

        btnClose.setOnClickListener(v -> {
            // Exit app confirmation
            finish();
        });
    }

    @Override
    public void onBackPressed() {
        // Override back button to prevent accidental exit
        // In a real app, you might want to show a confirmation dialog
        moveTaskToBack(true);
    }
}