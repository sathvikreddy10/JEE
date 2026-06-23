package com.testlab.offline;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class NameActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_name);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        EditText nameInput = findViewById(R.id.name_input);
        Button btnContinue = findViewById(R.id.btn_continue);

        btnContinue.setOnClickListener(v -> {
            String name = nameInput.getText().toString().trim();
            if (TextUtils.isEmpty(name)) {
                Toast.makeText(this, "Enter your name to continue", Toast.LENGTH_SHORT).show();
                return;
            }
            new UserPreferences(this).setUsername(name);
            startActivity(new Intent(this, MainActivity.class));
            finish();
        });
    }
}
