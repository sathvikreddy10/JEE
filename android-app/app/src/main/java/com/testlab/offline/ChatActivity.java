package com.testlab.offline;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.testlab.offline.R;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ChatActivity extends AppCompatActivity {

    private static final String MODEL_URL = "https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf";
    private static final String MODEL_FILENAME = "qwen2.5-0.5b-q4_k_m.gguf";
    private static final int MODEL_SIZE_MB = 408;

    private RecyclerView chatRecycler;
    private EditText chatInput;
    private Button btnSend, btnDownload;
    private ProgressBar downloadProgress;
    private TextView downloadStatus, modelStatus, modelSizeText;
    private View downloadPrompt, inputBar, loadingIndicator;

    private ChatAdapter adapter;
    private final List<ChatMessage> messages = new ArrayList<>();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());

    private boolean modelLoaded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        chatRecycler = findViewById(R.id.chat_recycler);
        chatInput = findViewById(R.id.chat_input);
        btnSend = findViewById(R.id.btn_send);
        btnDownload = findViewById(R.id.btn_download);
        downloadProgress = findViewById(R.id.download_progress);
        downloadStatus = findViewById(R.id.download_status);
        modelStatus = findViewById(R.id.model_status);
        modelSizeText = findViewById(R.id.model_size_text);
        downloadPrompt = findViewById(R.id.download_prompt);
        inputBar = findViewById(R.id.input_bar);
        loadingIndicator = findViewById(R.id.loading_indicator);

        modelSizeText.setText("Model: Qwen 2.5 0.5B (" + MODEL_SIZE_MB + " MB)\n💾 Uses storage · 100% offline after download");

        adapter = new ChatAdapter(messages);
        chatRecycler.setLayoutManager(new LinearLayoutManager(this));
        chatRecycler.setAdapter(adapter);

        findViewById(R.id.btn_back).setOnClickListener(v -> {
            finish();
            overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
        });

        btnDownload.setOnClickListener(v -> startDownload());

        btnSend.setOnClickListener(v -> sendMessage());
        chatInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendMessage();
                return true;
            }
            return false;
        });

        // check if model already downloaded
        checkModelExists();
    }

    private void checkModelExists() {
        if (!LlamaNative.isLoaded()) {
            modelStatus.setText("Native lib failed");
            btnDownload.setEnabled(false);
            btnDownload.setText("Requires ARM64 device");
            Toast.makeText(this, "AI requires 64-bit ARM device", Toast.LENGTH_LONG).show();
            return;
        }
        File modelFile = new File(getFilesDir(), MODEL_FILENAME);
        if (modelFile.exists() && modelFile.length() > MODEL_SIZE_MB * 1000000L * 0.8) {
            loadModel();
        } else {
            modelStatus.setText("No model");
        }
    }

    private void loadModel() {
        modelStatus.setText("Loading...");
        executor.execute(() -> {
            if (!LlamaNative.initBackend()) {
                handler.post(() -> {
                    modelStatus.setText("Init failed");
                    Toast.makeText(this, "Failed to initialize AI engine", Toast.LENGTH_SHORT).show();
                });
                return;
            }
            String path = new File(getFilesDir(), MODEL_FILENAME).getAbsolutePath();
            boolean loaded = LlamaNative.loadModel(path, 2048);
            handler.post(() -> {
                modelLoaded = loaded;
                if (loaded) {
                    modelStatus.setText("Ready 🤖");
                    downloadPrompt.setVisibility(View.GONE);
                    chatRecycler.setVisibility(View.VISIBLE);
                    inputBar.setVisibility(View.VISIBLE);
                    addAIMessage("Hey " + new UserPreferences(ChatActivity.this).getUsername() + "! I'm your AI Study Buddy. Ask me anything about JEE — concepts, problem-solving, explanations. What are you studying today?");
                } else {
                    modelStatus.setText("Failed");
                    Toast.makeText(this, "Failed to load model", Toast.LENGTH_SHORT).show();
                }
            });
        });
    }

    private void startDownload() {
        btnDownload.setEnabled(false);
        downloadProgress.setVisibility(View.VISIBLE);
        downloadStatus.setVisibility(View.VISIBLE);
        downloadStatus.setText("Starting download...");
        modelStatus.setText("Downloading...");

        executor.execute(() -> {
            try {
                File modelFile = new File(getFilesDir(), MODEL_FILENAME);
                URL url = new URL(MODEL_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("User-Agent", "AurexEdge/2.0");
                conn.connect();

                long total = conn.getContentLengthLong();
                if (total <= 0) total = MODEL_SIZE_MB * 1048576L;

                InputStream in = conn.getInputStream();
                FileOutputStream out = new FileOutputStream(modelFile);
                byte[] buf = new byte[65536];
                long downloaded = 0;
                int n;
                long lastUpdate = System.currentTimeMillis();

                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    downloaded += n;
                    long now = System.currentTimeMillis();
                    if (now - lastUpdate > 200) {
                        int pct = (int) (downloaded * 100 / total);
                        long mbDown = downloaded / 1048576;
                        long mbTotal = total / 1048576;
                        handler.post(() -> {
                            downloadProgress.setProgress(pct);
                            downloadStatus.setText(mbDown + " / " + mbTotal + " MB (" + pct + "%)");
                        });
                        lastUpdate = now;
                    }
                }
                out.close();
                in.close();
                conn.disconnect();

                handler.post(() -> {
                    downloadProgress.setProgress(100);
                    downloadStatus.setText("Download complete ✅");
                    loadModel();
                });
            } catch (IOException e) {
                handler.post(() -> {
                    downloadStatus.setText("Download failed: " + e.getMessage());
                    modelStatus.setText("No model");
                    btnDownload.setEnabled(true);
                    Toast.makeText(this, "Download failed. Check your internet.", Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void sendMessage() {
        String text = chatInput.getText().toString().trim();
        if (TextUtils.isEmpty(text) || !modelLoaded) return;

        chatInput.setText("");
        addUserMessage(text);
        loadingIndicator.setVisibility(View.VISIBLE);
        chatRecycler.scrollToPosition(messages.size() - 1);

        executor.execute(() -> {
            String systemPrompt = "You are an AI Study Buddy for JEE (Joint Entrance Examination) in India. "
                + "You help students with Physics, Chemistry, and Mathematics. "
                + "Be helpful, clear, and concise. Explain concepts step by step. "
                + "Answer in English or Hinglish. "
                + "Format math using plain text (e.g., x^2 for squared, sqrt(x) for square root). "
                + "Keep responses under 500 words unless asked for detail.\n\n"
                + "User: " + text + "\n\nAssistant:";

            String response = LlamaNative.generate(systemPrompt, 512);

            handler.post(() -> {
                loadingIndicator.setVisibility(View.GONE);
                addAIMessage(response.isEmpty() ? "Sorry, I couldn't generate a response. Try asking differently." : response.trim());
            });
        });
    }

    private void addUserMessage(String text) {
        messages.add(new ChatMessage(text, true));
        adapter.notifyItemInserted(messages.size() - 1);
        chatRecycler.scrollToPosition(messages.size() - 1);
    }

    private void addAIMessage(String text) {
        messages.add(new ChatMessage(text, false));
        adapter.notifyItemInserted(messages.size() - 1);
        chatRecycler.scrollToPosition(messages.size() - 1);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdownNow();
        if (modelLoaded) {
            LlamaNative.release();
        }
    }

    static class ChatMessage {
        String text;
        boolean isUser;

        ChatMessage(String text, boolean isUser) {
            this.text = text;
            this.isUser = isUser;
        }
    }

    class ChatAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
        private static final int TYPE_USER = 0;
        private static final int TYPE_AI = 1;
        private final List<ChatMessage> messages;

        ChatAdapter(List<ChatMessage> messages) {
            this.messages = messages;
        }

        @Override
        public int getItemViewType(int position) {
            return messages.get(position).isUser ? TYPE_USER : TYPE_AI;
        }

        @Override
        public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
            if (viewType == TYPE_USER) {
                View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_chat_user, parent, false);
                return new ChatHolder(v);
            } else {
                View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_chat_ai, parent, false);
                return new ChatHolder(v);
            }
        }

        @Override
        public void onBindViewHolder(RecyclerView.ViewHolder holder, int position) {
            ((ChatHolder) holder).textView.setText(messages.get(position).text);
        }

        @Override
        public int getItemCount() {
            return messages.size();
        }
    }

    static class ChatHolder extends RecyclerView.ViewHolder {
        TextView textView;

        ChatHolder(View itemView) {
            super(itemView);
            textView = itemView.findViewById(R.id.msg_text);
        }
    }
}
