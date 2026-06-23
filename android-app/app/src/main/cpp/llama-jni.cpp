#include <jni.h>
#include <string>
#include <vector>
#include <android/log.h>
#include "llama.h"
#include "ggml.h"
#include "ggml-cpu.h"
#include "ggml-backend.h"

#define TAG "LlamaJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static llama_model *g_model = nullptr;
static llama_context *g_ctx = nullptr;
static const llama_vocab *g_vocab = nullptr;
static llama_sampler *g_smpl = nullptr;
static bool g_backend_loaded = false;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_testlab_offline_LlamaNative_initBackend(JNIEnv *, jclass) {
    if (g_backend_loaded) return JNI_TRUE;
    ggml_backend_load_all();
    g_backend_loaded = true;
    LOGI("Backend initialized");
    return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL
Java_com_testlab_offline_LlamaNative_loadModel(JNIEnv *env, jclass, jstring modelPath, jint nCtx) {
    const char *path = env->GetStringUTFChars(modelPath, nullptr);

    llama_model_params model_params = llama_model_default_params();
    model_params.n_gpu_layers = 0;

    g_model = llama_model_load_from_file(path, model_params);
    env->ReleaseStringUTFChars(modelPath, path);

    if (!g_model) {
        LOGE("Failed to load model from file");
        return JNI_FALSE;
    }

    g_vocab = llama_model_get_vocab(g_model);

    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = nCtx;

    g_ctx = llama_init_from_model(g_model, ctx_params);
    if (!g_ctx) {
        LOGE("Failed to create context");
        llama_model_free(g_model);
        g_model = nullptr;
        g_vocab = nullptr;
        return JNI_FALSE;
    }

    auto sparams = llama_sampler_chain_default_params();
    sparams.no_perf = true;
    g_smpl = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(g_smpl, llama_sampler_init_greedy());

    LOGI("Model loaded, ctx=%d", nCtx);
    return JNI_TRUE;
}

JNIEXPORT jstring JNICALL
Java_com_testlab_offline_LlamaNative_generate(JNIEnv *env, jclass, jstring prompt, jint maxTokens) {
    if (!g_ctx || !g_vocab || !g_smpl) {
        return env->NewStringUTF("");
    }

    const char *c_prompt = env->GetStringUTFChars(prompt, nullptr);
    std::string input = c_prompt;
    env->ReleaseStringUTFChars(prompt, c_prompt);

    // tokenize
    int n_tokens = -llama_tokenize(g_vocab, input.c_str(), input.size(), NULL, 0, true, true);
    std::vector<llama_token> tokens(n_tokens);
    llama_tokenize(g_vocab, input.c_str(), input.size(), tokens.data(), n_tokens, true, true);

    int n_ctx = llama_n_ctx(g_ctx);
    int discard = n_tokens - (n_ctx - maxTokens);
    if (discard > 0 && tokens.size() > 4 + discard) {
        tokens.erase(tokens.begin() + 4, tokens.begin() + 4 + discard);
    }

    if (tokens.empty()) return env->NewStringUTF("");

    llama_batch batch = llama_batch_get_one(tokens.data(), (int)tokens.size());
    if (llama_decode(g_ctx, batch) != 0) {
        LOGE("Initial decode failed");
        return env->NewStringUTF("");
    }

    std::string result;
    int generated = 0;
    int pos = tokens.size();

    while (generated < maxTokens) {
        llama_token token_id = llama_sampler_sample(g_smpl, g_ctx, -1);
        llama_sampler_accept(g_smpl, token_id);

        if (llama_vocab_is_eog(g_vocab, token_id)) break;

        char buf[256];
        int n = llama_token_to_piece(g_vocab, token_id, buf, sizeof(buf), 0, true);
        if (n > 0) result.append(buf, n);

        batch = llama_batch_get_one(&token_id, 1);
        if (llama_decode(g_ctx, batch) != 0) break;
        generated++;
    }

    return env->NewStringUTF(result.c_str());
}

JNIEXPORT void JNICALL
Java_com_testlab_offline_LlamaNative_release(JNIEnv *, jclass) {
    if (g_smpl) {
        llama_sampler_free(g_smpl);
        g_smpl = nullptr;
    }
    if (g_ctx) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
    g_vocab = nullptr;
    LOGI("Model released");
}

} // extern "C"
