package com.testlab.offline;

import android.util.Log;

public class LlamaNative {
    private static final String TAG = "LlamaNative";
    private static boolean loaded = false;

    static {
        try {
            System.loadLibrary("ggml-base");
            System.loadLibrary("ggml-cpu");
            System.loadLibrary("ggml");
            System.loadLibrary("llama");
            System.loadLibrary("llama-jni");
            loaded = true;
            Log.i(TAG, "All native libraries loaded successfully");
        } catch (UnsatisfiedLinkError e) {
            loaded = false;
            Log.e(TAG, "Failed to load native libraries: " + e.getMessage());
        }
    }

    public static boolean isLoaded() {
        return loaded;
    }

    public static native boolean initBackend();
    public static native boolean loadModel(String modelPath, int nCtx);
    public static native String generate(String prompt, int maxTokens);
    public static native void release();
}
