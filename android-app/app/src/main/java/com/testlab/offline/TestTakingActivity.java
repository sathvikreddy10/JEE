package com.testlab.offline;

import android.app.ActivityManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class TestTakingActivity extends AppCompatActivity {

    // UI Elements
    private TextView timerDisplay;
    private TextView questionText;
    private RadioGroup optionsGroup;
    private RadioButton optionARadio, optionBRadio, optionCRadio, optionDRadio;
    private Button btnMarkReview, btnPrevious, btnSkip, btnNextSubmit;
    private TextView questionCounter;
    private TextView testTitleDisplay, testSubtitleDisplay;
    private ProgressBar questionProgress;
    
    // Anti-cheat variables
    private boolean isInForeground = true;
    private Handler foregroundCheckHandler;
    private Runnable foregroundCheckRunnable;
    private static final long FOREGROUND_CHECK_INTERVAL = 500;

    // Test data
    private List<Question> questions = new ArrayList<>();
    private int currentQuestionIndex = 0;
    private int timeLeftInSeconds = 3600;
    private int totalQuestions = 25;
    private String testTitle = "Calculus I";
    private String testSubject = "Mathematics";
    private Handler timerHandler = new Handler(Looper.getMainLooper());
    private Runnable timerRunnable;
    private boolean isTimerRunning = false;
    private boolean isExamEnded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_test_taking);
        
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN |
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        // Load extras from intent
        Intent intent = getIntent();
        if (intent.hasExtra("test_title")) {
            testTitle = intent.getStringExtra("test_title");
        }
        if (intent.hasExtra("test_subject")) {
            testSubject = intent.getStringExtra("test_subject");
        }
        if (intent.hasExtra("question_count")) {
            totalQuestions = intent.getIntExtra("question_count", 25);
        }
        if (intent.hasExtra("time_minutes")) {
            timeLeftInSeconds = intent.getIntExtra("time_minutes", 60) * 60;
        }
        
        initializeUI();
        loadTestData();
        setupTimer();
        setupAntiCheatDetection();
        loadQuestion(0);
    }

    private void initializeUI() {
        timerDisplay = findViewById(R.id.timer_display);
        questionText = findViewById(R.id.question_text);
        optionsGroup = findViewById(R.id.options_container);
        optionARadio = findViewById(R.id.option_a_radio);
        optionBRadio = findViewById(R.id.option_b_radio);
        optionCRadio = findViewById(R.id.option_c_radio);
        optionDRadio = findViewById(R.id.option_d_radio);
        btnMarkReview = findViewById(R.id.btn_mark_review);
        btnPrevious = findViewById(R.id.btn_previous);
        btnSkip = findViewById(R.id.btn_skip);
        btnNextSubmit = findViewById(R.id.btn_next_submit);
        questionCounter = findViewById(R.id.question_counter);
        testTitleDisplay = findViewById(R.id.test_title_display);
        testSubtitleDisplay = findViewById(R.id.test_subtitle_display);
        questionProgress = findViewById(R.id.question_progress);
        
        testTitleDisplay.setText(testTitle);
        testSubtitleDisplay.setText(testSubject);
        
        btnMarkReview.setOnClickListener(v -> toggleReview());
        btnPrevious.setOnClickListener(v -> previousQuestion());
        btnSkip.setOnClickListener(v -> skipQuestion());
        btnNextSubmit.setOnClickListener(v -> nextOrSubmit());
    }

    private void setupAntiCheatDetection() {
        // Check if app is in foreground periodically
        foregroundCheckHandler = new Handler(Looper.getMainLooper());
        foregroundCheckRunnable = new Runnable() {
            @Override
            public void run() {
                boolean currentlyInForeground = isAppInForeground(TestTakingActivity.this);
                if (!currentlyInForeground && isInForeground) {
                    // App just went to background
                    handleAppBackground();
                }
                isInForeground = currentlyInForeground;
                foregroundCheckHandler.postDelayed(this, FOREGROUND_CHECK_INTERVAL);
            }
        };
        // Start checking
        foregroundCheckHandler.postDelayed(foregroundCheckRunnable, FOREGROUND_CHECK_INTERVAL);
    }

    private boolean isAppInForeground(Context context) {
        ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        List<ActivityManager.RunningAppProcessInfo> appProcesses = activityManager.getRunningAppProcesses();
        if (appProcesses == null) {
            return false;
        }
        for (ActivityManager.RunningAppProcessInfo appProcess : appProcesses) {
            if (appProcess.processName.equals(context.getPackageName())) {
                return appProcess.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND;
            }
        }
        return false;
    }

    private void handleAppBackground() {
        if (!isExamEnded) {
            // Show warning and terminate exam if user tries to cheat
            runOnUiThread(() -> {
                showConfirmModal(
                        "Exam Terminated",
                        "Exam has been terminated due to attempting to leave the test window.\n" +
                                "This action has been logged and reported."
                );
                // Create a custom dialog that forces the user to acknowledge
                new AlertDialog.Builder(this)
                        .setTitle("Exam Terminated")
                        .setMessage("Exam has been terminated due to attempting to leave the test window.\n" +
                                "This action has been logged and reported.")
                        .setPositiveButton("OK", (dialog, which) -> {
                            // Force finish the activity
                            finishAndRemoveTask();
                        })
                        .setCancelable(false)
                        .show();
                
                // Disable all interaction
                btnMarkReview.setEnabled(false);
                btnPrevious.setEnabled(false);
                btnSkip.setEnabled(false);
                btnNextSubmit.setEnabled(false);
                optionARadio.setEnabled(false);
                optionBRadio.setEnabled(false);
                optionCRadio.setEnabled(false);
                optionDRadio.setEnabled(false);
                
                isExamEnded = true;
                isTimerRunning = false;
                
                // Stop timers
                if (timerHandler != null && timerRunnable != null) {
                    timerHandler.removeCallbacks(timerRunnable);
                }
                if (foregroundCheckHandler != null && foregroundCheckRunnable != null) {
                    foregroundCheckHandler.removeCallbacks(foregroundCheckRunnable);
                }
                
                showToast("Exam terminated for security reasons");
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // App came back to foreground - restart checking
        if (foregroundCheckHandler != null && foregroundCheckRunnable != null) {
            foregroundCheckHandler.postDelayed(foregroundCheckRunnable, FOREGROUND_CHECK_INTERVAL);
        }
        isInForeground = true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        // App going to background - handled by our checker
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // Clean up handlers
        if (timerHandler != null && timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
        }
        if (foregroundCheckHandler != null && foregroundCheckRunnable != null) {
            foregroundCheckHandler.removeCallbacks(foregroundCheckRunnable);
        }
    }

    private void loadTestData() {
        questions.add(new Question(
                "What is the derivative of x²?",
                new String[]{"2x", "x", "x²", "2"},
                0, "Calculus", false));

        questions.add(new Question(
                "What is the integral of 2x dx?",
                new String[]{"x²", "2x", "x² + C", "2"},
                2, "Calculus", false));

        questions.add(new Question(
                "What is the value of π (pi) approximately?",
                new String[]{"3.14", "3.14159", "22/7", "All of the above"},
                3, "Mathematics", false));

        questions.add(new Question(
                "What is the quadratic formula?",
                new String[]{"x = -b ± √(b²-4ac)/2a", "x = b ± √(b²-4ac)/2a", "x = -b ± √(b²+4ac)/2a", "x = -b ± √(b²-4ac)/a"},
                0, "Algebra", false));

        questions.add(new Question(
                "What is the area of a circle with radius r?",
                new String[]{"2πr", "πr²", "πd", "2πr²"},
                1, "Geometry", false));

        for (int i = 5; i < totalQuestions; i++) {
            questions.add(new Question(
                    String.format("Sample Question %d", i + 1),
                    new String[]{"" + (i + 1), "" + (i + 2), "" + (i + 3), "" + (i + 4)},
                    0, testSubject, false));
        }
    }

    private void setupTimer() {
        timerRunnable = new Runnable() {
            @Override
            public void run() {
                if (timeLeftInSeconds > 0 && !isExamEnded) {
                    timeLeftInSeconds--;
                    updateTimerDisplay();
                    timerHandler.postDelayed(this, 1000);
                } else if (timeLeftInSeconds <= 0 && !isExamEnded) {
                    timeUp();
                }
            }
        };
        
        // Start the timer
        isTimerRunning = true;
        timerHandler.postDelayed(timerRunnable, 1000);
        updateTimerDisplay();
    }

    private void updateTimerDisplay() {
        int minutes = timeLeftInSeconds / 60;
        int seconds = timeLeftInSeconds % 60;
        timerDisplay.setText(String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds));
    }

    private void timeUp() {
        isTimerRunning = false;
        isExamEnded = true;
        showConfirmModal("Time's Up!", "Your time has expired. Submit your test?");
    }

    private void loadQuestion(int index) {
        if (index < 0 || index >= questions.size()) return;
        
        currentQuestionIndex = index;
        Question currentQuestion = questions.get(index);
        
        questionText.setText(currentQuestion.getText());
        
        String[] options = currentQuestion.getOptions();
        optionARadio.setText(options[0]);
        optionBRadio.setText(options[1]);
        optionCRadio.setText(options[2]);
        optionDRadio.setText(options[3]);
        
        optionsGroup.clearCheck();
        
        questionCounter.setText(String.format(Locale.getDefault(), "%d/%d", index + 1, questions.size()));

        if (questionProgress != null) {
            questionProgress.setMax(questions.size());
            if (android.os.Build.VERSION.SDK_INT >= 24) {
                questionProgress.setProgress(index + 1, true);
            } else {
                questionProgress.setProgress(index + 1);
            }
        }
        
        // Update button text for last question
        if (index == questions.size() - 1) {
            btnNextSubmit.setText("Submit");
        } else {
            btnNextSubmit.setText("Next");
        }
    }

    private void nextOrSubmit() {
        if (currentQuestionIndex < questions.size() - 1) {
            // Move to next question
            saveCurrentAnswer();
            loadQuestion(currentQuestionIndex + 1);
        } else {
            // On last question - show submit confirmation
            showConfirmModal(
                    "Submit Test",
                    "Are you sure you want to submit your test?"
            );
        }
    }

    private void saveCurrentAnswer() {
        int selectedId = optionsGroup.getCheckedRadioButtonId();
        if (selectedId != -1) {
            // Save the answer (in a real app, this would be saved to local storage)
            RadioButton selectedRadioButton = findViewById(selectedId);
            String answer = selectedRadioButton.getText().toString();
            questions.get(currentQuestionIndex).setSelectedAnswer(answer);
            showToast("Answer saved");
        }
    }

    private void previousQuestion() {
        if (currentQuestionIndex > 0) {
            saveCurrentAnswer();
            loadQuestion(currentQuestionIndex - 1);
        }
    }

    private void skipQuestion() {
        saveCurrentAnswer();
        questions.get(currentQuestionIndex).setSkipped(true);
        if (currentQuestionIndex < questions.size() - 1) {
            loadQuestion(currentQuestionIndex + 1);
        } else {
            // On last question, try to submit
            nextOrSubmit();
        }
    }

    private void toggleReview() {
        boolean isMarked = !questions.get(currentQuestionIndex).isMarkedForReview();
        questions.get(currentQuestionIndex).setMarkedForReview(isMarked);
        if (isMarked) {
            btnMarkReview.setText("UNMARK");
            showToast("Marked for review");
        } else {
            btnMarkReview.setText("MARK");
            showToast("Unmarked from review");
        }
    }

    private void showConfirmModal(String title, String message) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(title)
                .setMessage(message)
                .setPositiveButton("Yes", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (title.equals("Time's Up!") || title.equals("Submit Test")) {
                            showResults();
                        } else {
                            finish(); // Exit the test
                        }
                    }
                })
                .setNegativeButton("No", null)
                .setCancelable(false)
                .show();
    }

    private void confirmAction() {
        // This method is no longer used with AlertDialog approach
    }

    private void hideConfirmModal() {
        // This method is no longer needed with AlertDialog
    }

    private void showResults() {
        isExamEnded = true;
        isTimerRunning = false;
        
        int correctAnswers = 0;
        int answeredQuestions = 0;
        
        for (Question q : questions) {
            if (q.getSelectedAnswer() != null && !q.getSelectedAnswer().isEmpty()) {
                answeredQuestions++;
                // In a real app, you would check against correct answer
                // For demo, we'll just count answered questions
            }
        }
        
        // Simple scoring for demo
        correctAnswers = answeredQuestions; // Assume all answered are correct for demo
        
        final int finalCorrect = correctAnswers;
        final int finalAnswered = answeredQuestions;
        final String testTitleLocal = testTitle;
        final String testSubjectLocal = testSubject;
        final int totalQuestionsLocal = totalQuestions;
        final int timeLeftSec = timeLeftInSeconds;
        final int totalMinutes = timeLeftInSeconds > 0 ? 
            (getIntent().getIntExtra("time_minutes", 60)) : 60;
        final int totalSecs = (totalMinutes * 60) - timeLeftSec;

        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Test Submitted")
                .setMessage(String.format(java.util.Locale.getDefault(),
                        "Score: %d/%d\nQuestions Answered: %d\n\nView your full analysis?",
                        finalCorrect,
                        questions.size(),
                        finalAnswered))
                .setPositiveButton("View Analysis", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        // Save result
                        int minutesTaken = totalSecs / 60;
                        int secondsTaken = totalSecs % 60;
                        new UserPreferences(TestTakingActivity.this)
                                .saveTestResult(testTitleLocal, testSubjectLocal, finalCorrect, totalQuestionsLocal, minutesTaken, secondsTaken);

                        Intent intent = new Intent(TestTakingActivity.this, AnalysisActivity.class);
                        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        startActivity(intent);
                        finish();
                    }
                })
                .setNegativeButton("Close", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        finish();
                    }
                })
                .setCancelable(false)
                .show();
    }

    @Override
    public void onBackPressed() {
        // Handle back button press - show exit confirmation
        if (!isExamEnded) {
            showConfirmModal(
                    "Exit Test",
                    "Are you sure you want to exit the test? Your progress will be lost."
            );
        } else {
            super.onBackPressed();
        }
    }

    private void showToast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    // Simple Question class for demo
    private static class Question {
        private String text;
        private String[] options;
        private int correctAnswerIndex;
        private String topic;
        private boolean isMarkedForReview;
        private boolean isSkipped;
        private String selectedAnswer;
        
        public Question(String text, String[] options, int correctAnswerIndex, String topic, boolean isMarkedForReview) {
            this.text = text;
            this.options = options;
            this.correctAnswerIndex = correctAnswerIndex;
            this.topic = topic;
            this.isMarkedForReview = isMarkedForReview;
            this.isSkipped = false;
            this.selectedAnswer = null;
        }
        
        public String getText() { return text; }
        public String[] getOptions() { return options; }
        public int getCorrectAnswerIndex() { return correctAnswerIndex; }
        public String getTopic() { return topic; }
        public boolean isMarkedForReview() { return isMarkedForReview; }
        public void setMarkedForReview(boolean markedForReview) { isMarkedForReview = markedForReview; }
        public boolean isSkipped() { return isSkipped; }
        public void setSkipped(boolean skipped) { isSkipped = skipped; }
        public String getSelectedAnswer() { return selectedAnswer; }
        public void setSelectedAnswer(String selectedAnswer) { this.selectedAnswer = selectedAnswer; }
    }
}