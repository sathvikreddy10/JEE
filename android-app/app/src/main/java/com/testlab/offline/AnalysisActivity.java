package com.testlab.offline;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class AnalysisActivity extends AppCompatActivity {

    private RecyclerView historyRecyclerView;
    private HistoryAdapter historyAdapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_analysis);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        findViewById(R.id.btn_back).setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });

        UserPreferences prefs = new UserPreferences(this);
        List<UserPreferences.TestResult> results = prefs.getTestResults();

        // Update stats
        ((TextView) findViewById(R.id.total_tests_value)).setText(String.valueOf(prefs.getTotalTests()));
        ((TextView) findViewById(R.id.total_questions_value)).setText(String.valueOf(prefs.getTotalQuestions()));
        ((TextView) findViewById(R.id.study_time_value)).setText(prefs.getTotalStudyTime());

        int avg = prefs.getAverageScore();
        ((TextView) findViewById(R.id.avg_score_value)).setText(avg + "%");

        ProgressBar bar = findViewById(R.id.score_progress_bar);
        if (bar != null) bar.setProgress(avg);

        // Setup RecyclerView
        historyRecyclerView = findViewById(R.id.history_recycler_view);
        historyRecyclerView.setLayoutManager(new LinearLayoutManager(this));
        historyAdapter = new HistoryAdapter(results);
        historyRecyclerView.setAdapter(historyAdapter);
    }

    private class HistoryAdapter extends RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder> {
        private final List<UserPreferences.TestResult> items;

        HistoryAdapter(List<UserPreferences.TestResult> items) { this.items = items; }

        @Override
        public HistoryViewHolder onCreateViewHolder(android.view.ViewGroup parent, int viewType) {
            View view = getLayoutInflater().inflate(R.layout.item_history_card, parent, false);
            return new HistoryViewHolder(view);
        }

        @Override
        public void onBindViewHolder(HistoryViewHolder holder, int position) {
            UserPreferences.TestResult item = items.get(position);
            TextView titleText = holder.itemView.findViewById(R.id.title_text);
            TextView subjectText = holder.itemView.findViewById(R.id.subject_text);
            TextView scoreText = holder.itemView.findViewById(R.id.score_text);
            TextView detailText = holder.itemView.findViewById(R.id.detail_text);
            TextView timeText = holder.itemView.findViewById(R.id.time_text);
            TextView dateText = holder.itemView.findViewById(R.id.date_text);
            View scoreBg = holder.itemView.findViewById(R.id.score_bg);

            titleText.setText(item.title);
            subjectText.setText(item.subject);
            scoreText.setText(item.getScorePercent());
            detailText.setText(item.getDetail());
            timeText.setText(item.getTimeTaken());
            dateText.setText(item.date);

            int scoreVal = item.score * 100 / item.total;
            if (scoreVal >= 90) scoreBg.setBackgroundResource(R.drawable.bg_score_excellent);
            else if (scoreVal >= 75) scoreBg.setBackgroundResource(R.drawable.bg_score_good);
            else scoreBg.setBackgroundResource(R.drawable.bg_score_average);
        }

        @Override
        public int getItemCount() { return items.size(); }

        class HistoryViewHolder extends RecyclerView.ViewHolder {
            HistoryViewHolder(View itemView) { super(itemView); }
        }
    }
}
