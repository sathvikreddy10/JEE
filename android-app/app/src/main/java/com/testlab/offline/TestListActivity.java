package com.testlab.offline;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import java.util.ArrayList;
import java.util.List;

public class TestListActivity extends AppCompatActivity {

    private RecyclerView testRecyclerView;
    private TestAdapter testAdapter;
    private List<TestItem> testItems;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_test_list);

        // Make the activity fullscreen
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        // Initialize UI
        ImageView btnBack = findViewById(R.id.btn_back);
        TextView titleText = findViewById(R.id.title_text);
        testRecyclerView = findViewById(R.id.test_recycler_view);

        titleText.setText("Tests");
        btnBack.setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });

        // Setup RecyclerView
        testRecyclerView.setLayoutManager(new LinearLayoutManager(this));
        loadTestData();
        testAdapter = new TestAdapter(testItems);
        testRecyclerView.setAdapter(testAdapter);
    }

    private void loadTestData() {
        testItems = new ArrayList<>();
        testItems.add(new TestItem("Calculus I — Midterm Practice", "Mathematics", "Limits, derivatives, applications", 25, 60, 1234, "calc_midterm"));
        testItems.add(new TestItem("Mechanics — Final Review", "Physics", "Kinematics, forces, energy, momentum", 30, 90, 892, "physics_mechanics"));
        testItems.add(new TestItem("General Chemistry — Chapter 4", "Chemistry", "Stoichiometry, reactions, limiting reagents", 20, 45, 567, "chem_stoich"));
        testItems.add(new TestItem("Cell Biology — Unit Test", "Biology", "Organelles, membranes, transport, division", 35, 75, 1021, "bio_cells"));
        testItems.add(new TestItem("Coordinate Geometry — JEE Advanced", "Mathematics", "Lines, circles, parabola, ellipse, hyperbola", 30, 90, 2156, "coord_geo"));
        testItems.add(new TestItem("Electrostatics & Current Electricity", "Physics", "Coulomb's law, fields, potential, circuits", 25, 75, 1834, "electrostatics"));
        testItems.add(new TestItem("Organic Chemistry — Named Reactions", "Chemistry", "SN1, SN2, E1, E2, rearrangements", 20, 60, 1423, "organic_reactions"));
        testItems.add(new TestItem("Genetics & Evolution", "Biology", "Mendelian genetics, molecular basis, evolution", 30, 75, 987, "genetics"));
    }

    private class TestAdapter extends RecyclerView.Adapter<TestAdapter.TestViewHolder> {

        private List<TestItem> items;

        TestAdapter(List<TestItem> items) {
            this.items = items;
        }

        @Override
        public TestViewHolder onCreateViewHolder(android.view.ViewGroup parent, int viewType) {
            View view = getLayoutInflater().inflate(R.layout.item_test_card, parent, false);
            return new TestViewHolder(view);
        }

        @Override
        public void onBindViewHolder(TestViewHolder holder, int position) {
            TestItem item = items.get(position);
            holder.bind(item);
        }

        @Override
        public int getItemCount() {
            return items.size();
        }

        class TestViewHolder extends RecyclerView.ViewHolder {
            TextView tagText, titleText, descText;
            TextView questionsText, timeText, attemptsText;
            Button btnBegin;

            TestViewHolder(View itemView) {
                super(itemView);
                tagText = itemView.findViewById(R.id.tag_text);
                titleText = itemView.findViewById(R.id.title_text);
                descText = itemView.findViewById(R.id.desc_text);
                questionsText = itemView.findViewById(R.id.questions_text);
                timeText = itemView.findViewById(R.id.time_text);
                attemptsText = itemView.findViewById(R.id.attempts_text);
                btnBegin = itemView.findViewById(R.id.btn_begin);
            }

            void bind(TestItem item) {
                tagText.setText(item.subject);
                switch (item.subject) {
                    case "Physics":
                        tagText.setBackgroundResource(R.drawable.bg_chip_lavender);
                        tagText.setTextColor(0xFF5B4FA8);
                        break;
                    case "Chemistry":
                        tagText.setBackgroundResource(R.drawable.bg_chip_mint);
                        tagText.setTextColor(0xFF2E6B43);
                        break;
                    case "Biology":
                        tagText.setBackgroundResource(R.drawable.bg_chip_blush);
                        tagText.setTextColor(0xFFA8503F);
                        break;
                    default:
                        tagText.setBackgroundResource(R.drawable.bg_chip);
                        tagText.setTextColor(0xFF8A6A10);
                        break;
                }
                titleText.setText(item.title);
                descText.setText(item.description);
                questionsText.setText(item.questions + " Questions");
                timeText.setText(item.time + " Min");
                attemptsText.setText(item.attempts + " Attempts");

                btnBegin.setOnClickListener(v -> {
                    Intent intent = new Intent(TestListActivity.this, TestTakingActivity.class);
                    intent.putExtra("test_id", item.testId);
                    intent.putExtra("test_title", item.title);
                    intent.putExtra("test_subject", item.subject);
                    intent.putExtra("question_count", item.questions);
                    intent.putExtra("time_minutes", item.time);
                    startActivity(intent);
                    overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
                });
            }
        }
    }

    static class TestItem {
        String title, subject, description;
        int questions, time, attempts;
        String testId;

        TestItem(String title, String subject, String description, int questions, int time, int attempts, String testId) {
            this.title = title;
            this.subject = subject;
            this.description = description;
            this.questions = questions;
            this.time = time;
            this.attempts = attempts;
            this.testId = testId;
        }
    }
}