package com.testlab.offline;

import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
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
    private TextView questionNumberText;
    private TextView questionText;
    private RadioGroup optionsGroup;
    private RadioButton optionARadio, optionBRadio, optionCRadio, optionDRadio;
    private TextView optionAText, optionBText, optionCText, optionDText;
    private Button btnMarkReview, btnPrevious, btnSkip, btnNextSubmit;
    private TextView questionCounter;
    private TextView questionTypeBadge;
    private View tabWarningBanner;
    private View redFlagBanner;
    private View amberFlagBanner;
    private TextView tabSwitchCounter;
    private TextView pendingSavesIndicator;
    private TextView amberFlagMessage;
    private TextView redFlagTitle;
    private TextView redFlagMessage;
    private View confirmModal;
    private TextView confirmTitle;
    private TextView confirmMessage;
    private Button btnConfirmNo, btnConfirmYes;
    private View tabSwitchModal;
    private TextView tabSwitchMessage;
    private Button btnTabSwitchUnderstood;
    private View toastContainer;

    // Test data
    private List<Question> questions = new ArrayList<>();
    private int currentQuestionIndex = 0;
    private int timeLeftInSeconds = 3600; // 60 minutes default
    private Handler timerHandler = new Handler(Looper.getMainLooper());
    private Runnable timerRunnable;
    private boolean isTimerRunning = false;
    private boolean isExamEnded = false;
    private int tabSwitchCount = 0;
    private boolean isRedFlagged = false;
    private boolean isTabSwitchModalShown = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_test_taking);
        
        // Make the activity fullscreen to hide status bar and navigation
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN |
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
        
        // Initialize UI components
        initializeUI();
        
        // Load test data (offline math test)
        loadTestData();
        
        // Set up timer
        setupTimer();
        
        // Set up tab switch detection (simplified for Android)
        setupTabSwitchDetection();
        
        // Load first question
        loadQuestion(0);
    }

    private void initializeUI() {
        // Timer and header
        timerDisplay = findViewById(R.id.timer_display);
        questionNumberText = findViewById(R.id.question_number);
        questionText = findViewById(R.id.question_text);
        optionsGroup = findViewById(R.id.options_container);
        optionARadio = findViewById(R.id.option_a_radio);
        optionBRadio = findViewById(R.id.option_b_radio);
        optionCRadio = findViewById(R.id.option_c_radio);
        optionDRadio = findViewById(R.id.option_d_radio);
        optionAText = findViewById(R.id.option_a_text);
        optionBText = findViewById(R.id.option_b_text);
        optionCText = findViewById(R.id.option_c_text);
        optionDText = findViewById(R.id.option_d_text);
        btnMarkReview = findViewById(R.id.btn_mark_review);
        btnPrevious = findViewById(R.id.btn_previous);
        btnSkip = findViewById(R.id.btn_skip);
        btnNextSubmit = findViewById(R.id.btn_next_submit);
        questionCounter = findViewById(R.id.question_counter);
        questionTypeBadge = findViewById(R.id.question_type_badge);
        
        // Warning banners
        tabWarningBanner = findViewById(R.id.tab_warning_banner);
        redFlagBanner = findViewById(R.id.red_flag_banner);
        amberFlagBanner = findViewById(R.id.amber_flag_banner);
        tabSwitchCounter = findViewById(R.id.tab_switch_counter);
        pendingSavesIndicator = findViewById(R.id.pending_saves_indicator);
        amberFlagMessage = findViewById(R.id.amber_flag_message);
        redFlagTitle = findViewById(R.id.red_flag_title);
        redFlagMessage = findViewById(R.id.red_flag_message);
        
        // Modals
        confirmModal = findViewById(R.id.confirm_modal);
        confirmTitle = findViewById(R.id.confirm_title);
        confirmMessage = findViewById(R.id.confirm_message);
        btnConfirmNo = findViewById(R.id.btn_confirm_no);
        btnConfirmYes = findViewById(R.id.btn_confirm_yes);
        tabSwitchModal = findViewById(R.id.tab_switch_modal);
        tabSwitchMessage = findViewById(R.id.tab_switch_message);
        btnTabSwitchUnderstood = findViewById(R.id.btn_tab_switch_understood);
        toastContainer = findViewById(R.id.toast_container);
        
        // Set up button click listeners
        btnMarkReview.setOnClickListener(v -> toggleReview());
        btnPrevious.setOnClickListener(v -> previousQuestion());
        btnSkip.setOnClickListener(v -> skipQuestion());
        btnNextSubmit.setOnClickListener(v -> nextOrSubmit());
        
        btnConfirmNo.setOnClickListener(v -> hideConfirmModal());
        btnConfirmYes.setOnClickListener(v -> confirmAction());
        
        btnTabSwitchUnderstood.setOnClickListener(v -> hideTabSwitchModal());
    }

    private void loadTestData() {
        // Create a simple math test for offline use
        questions.add(new Question(
                "What is the derivative of x²?",
                new String[]{"2x", "x", "x²", "2"},
                0, // Correct answer index
                "Calculus",
                false
        ));
        
        questions.add(new Question(
                "What is the integral of 2x dx?",
                new String[]{"x²", "2x", "x² + C", "2"},
                2, // Correct answer index
                "Calculus",
                false
        ));
        
        questions.add(new Question(
                "What is the value of π (pi) approximately?",
                new String[]{"3.14", "3.14159", "22/7", "All of the above"},
                3, // Correct answer index
                "Mathematics",
                false
        ));
        
        questions.add(new Question(
                "What is the quadratic formula?",
                new String[]{"x = -b ± √(b²-4ac)/2a", "x = b ± √(b²-4ac)/2a", "x = -b ± √(b²+4ac)/2a", "x = -b ± √(b²-4ac)/a"},
                0, // Correct answer index
                "Algebra",
                false
        ));
        
        questions.add(new Question(
                "What is the area of a circle with radius r?",
                new String[]{"2πr", "πr²", "πd", "2πr²"},
                1, // Correct answer index
                "Geometry",
                false
        ));
        
        // Add more questions to make it 25 total
        for (int i = 5; i < 25; i++) {
            questions.add(new Question(
                    String.format("Sample Question %d", i + 1),
                    new String[]{"" + (i + 1), "" + (i + 2), "" + (i + 3), "" + (i + 4)},
                    0,
                    "Mathematics",
                    false
            ));
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
        
        // Change color based on time remaining
        if (timeLeftInSeconds < 60) { // Less than 1 minute
            timerDisplay.setTextColor(getResources().getColor(R.color.crimson));
        } else if (timeLeftInSeconds < 300) { // Less than 5 minutes
            timerDisplay.setTextColor(getResources().getColor(R.color.amber));
        } else {
            timerDisplay.setTextColor(getResources().getColor(R.color.fg_black));
        }
    }

    private void timeUp() {
        isTimerRunning = false;
        isExamEnded = true;
        showConfirmModal("Time's Up!", "Your time has expired. Submit your test?");
        btnConfirmYes.setText("Submit");
        btnConfirmNo.setVisibility(View.GONE);
    }

    private void loadQuestion(int index) {
        if (index < 0 || index >= questions.size()) return;
        
        currentQuestionIndex = index;
        Question currentQuestion = questions.get(index);
        
        // Update question number
        questionNumberText.setText(String.valueOf(index + 1));
        
        // Update question text
        questionText.setText(currentQuestion.getText());
        
        // Update options
        String[] options = currentQuestion.getOptions();
        optionAText.setText(options[0]);
        optionBText.setText(options[1]);
        optionCText.setText(options[2]);
        optionDText.setText(options[3]);
        
        // Clear previous selection
        optionsGroup.clearCheck();
        
        // Update UI elements
        questionCounter.setText(String.format(Locale.getDefault(), "%d/%d", index + 1, questions.size()));
        questionTypeBadge.setText("MCQ");
        questionTypeBadge.setBackgroundColor(getResources().getColor(R.color.badge_bg));
        
        // Update topic in header (would need to find the topic text view)
        // For simplicity, we'll skip this for now as it's not critical
    }

    private void nextOrSubmit() {
        if (currentQuestionIndex < questions.size() - 1) {
            // Move to next question
            saveCurrentAnswer();
            loadQuestion(currentQuestionIndex + 1);
        } else {
            // On last question - show submit confirmation
            showConfirmModal(
                    getString(R.string.confirm_submit_title),
                    getString(R.string.confirm_submit_message)
            );
            btnConfirmYes.setText(getString(R.string.yes));
            btnConfirmNo.setText(getString(R.string.no));
            btnConfirmNo.setVisibility(View.VISIBLE);
        }
    }

    private void saveCurrentAnswer() {
        int selectedId = optionsGroup.getCheckedRadioButtonId();
        if (selectedId != -1) {
            // Save the answer (in a real app, this would be saved to local storage)
            RadioButton selectedRadioButton = findViewById(selectedId);
            String answer = selectedRadioButton.getText().toString();
            questions.get(currentQuestionIndex).setSelectedAnswer(answer);
            // In a real app, you would save this to SharedPreferences or a local database
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
            btnMarkReview.setText(getString(R.string.unmark_review));
            showToast("Marked for review");
        } else {
            btnMarkReview.setText(getString(R.string.mark_review));
            showToast("Unmarked from review");
        }
    }

    private void showConfirmModal(String title, String message) {
        confirmTitle.setText(title);
        confirmMessage.setText(message);
        confirmModal.setVisibility(View.VISIBLE);
    }

    private void hideConfirmModal() {
        confirmModal.setVisibility(View.GONE);
    }

    private void confirmAction() {
        hideConfirmModal();
        // In a real app, you would save all answers and show results
        showResults();
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
        
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(getString(R.string.test_submitted))
                .setMessage(String.format(Locale.getDefault(),
                        "%s: %d/%s: %d\n%s: %d",
                        getString(R.string.score),
                        correctAnswers,
                        getString(R.string.out_of),
                        questions.size(),
                        getString(R.string.questions_answered),
                        answeredQuestions))
                .setPositiveButton(getString(R.string.yes), new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        finish(); // Exit the test
                    }
                })
                .setCancelable(false)
                .show();
    }

    private void setupTabSwitchDetection() {
        // On Android, we can detect when the app goes to background
        // This is a simplified version - real tab switching detection is more complex
        // For this demo, we'll simulate the behavior
        
        // In a real app, you would use Activity lifecycle methods
        // onPause() and onResume() to detect when app goes to background/foreground
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Simulate tab switch when app goes to background
        if (!isExamEnded && !isRedFlagged) {
            handleTabSwitch();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // App came back to foreground
    }

    private void handleTabSwitch() {
        tabSwitchCount++;
        
        // Update UI based on tab switch count
        runOnUiThread(() -> {
            tabSwitchCounter.setText(String.format(Locale.getDefault(), "🔄 %d", tabSwitchCount));
            tabSwitchCounter.setVisibility(View.VISIBLE);
            
            if (tabSwitchCount >= 4) {
                // Red flagged
                isRedFlagged = true;
                redFlagBanner.setVisibility(View.VISIBLE);
                amberFlagBanner.setVisibility(View.GONE);
                tabSwitchCounter.setBackgroundColor(getResources().getColor(R.color.crimson));
                tabSwitchCounter.setTextColor(getResources().getColor(R.color.bg_white));
                redFlagTitle.setText(getString(R.string.warning));
                redFlagMessage.setText("RED FLAGGED — suspicious activity detected");
                
                if (tabSwitchCount >= 7) {
                    // Exam terminated
                    showExamTerminated();
                }
            } else if (tabSwitchCount >= 3) {
                // Amber warning
                amberFlagBanner.setVisibility(View.VISIBLE);
                redFlagBanner.setVisibility(View.GONE);
                tabSwitchCounter.setBackgroundColor(getResources().getColor(R.color.amber));
                tabSwitchCounter.setTextColor(getResources().getColor(R.color.fg_black));
                amberFlagMessage.setText("1 more tab switch = RED FLAG");
            } else {
                // Normal state
                tabSwitchCounter.setBackgroundColor(getResources().getColor(R.color.badge_bg));
                tabSwitchCounter.setTextColor(getResources().getColor(R.color.fg_black));
                
                switch (tabSwitchCount) {
                    case 1:
                        amberFlagMessage.setText("Tab switch detected (1) — each switch is logged");
                        break;
                    case 2:
                        amberFlagMessage.setText("Tab switch detected (2) — please don't switch tabs");
                        break;
                }
            }
            
            // Show tab switch modal on first switch only
            if (tabSwitchCount == 1 && !isTabSwitchModalShown) {
                showTabSwitchModal();
                isTabSwitchModalShown = true;
            }
        });
    }

    private void showTabSwitchModal() {
        tabSwitchModal.setVisibility(View.VISIBLE);
        tabSwitchMessage.setText(
                "Each tab switch is logged and monitored. Switching tabs repeatedly will result in a red flag and possible exam termination."
        );
    }

    private void hideTabSwitchModal() {
        tabSwitchModal.setVisibility(View.GONE);
    }

    private void showExamTerminated() {
        isExamEnded = true;
        isTimerRunning = false;
        
        runOnUiThread(() -> {
            redFlagTitle.setText("EXAM TERMINATED");
            redFlagMessage.setText("Your exam was terminated due to excessive tab switching. You have been red-flagged.");
            tabWarningBanner.setVisibility(View.VISIBLE);
            
            // Disable further interaction
            btnMarkReview.setEnabled(false);
            btnPrevious.setEnabled(false);
            btnSkip.setEnabled(false);
            btnNextSubmit.setEnabled(false);
            
            showToast("Exam terminated due to excessive tab switching");
        });
    }

    private void showToast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onBackPressed() {
        // Handle back button press - show exit confirmation
        if (!isExamEnded) {
            showConfirmModal(
                    getString(R.string.confirm_exit_title),
                    getString(R.string.confirm_exit_message)
            );
            btnConfirmYes.setText(getString(R.string.yes));
            btnConfirmNo.setText(getString(R.string.no));
            btnConfirmNo.setVisibility(View.VISIBLE);
            
            // Set confirm action to exit
            btnConfirmYes.setOnClickListener(v -> {
                hideConfirmModal();
                finish();
            });
            btnConfirmNo.setOnClickListener(v -> hideConfirmModal());
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (timerHandler != null && timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
        }
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