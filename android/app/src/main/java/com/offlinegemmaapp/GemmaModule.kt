package com.offlinegemmaapp

import com.facebook.react.bridge.*
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import java.io.File
import kotlin.concurrent.thread

class GemmaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var llmInference: LlmInference? = null

    override fun getName() = "GemmaModule"

    @ReactMethod
    fun initModel(modelPath: String, promise: Promise) {
        try {
            val file = File(modelPath)
            if (!file.exists()) throw Exception("Model tidak ditemukan di $modelPath")

            val options = LlmInference.LlmInferenceOptions.builder()
                .setModelPath(modelPath)
                .setMaxTokens(1024)
                .build()

            llmInference = LlmInference.createFromOptions(reactApplicationContext, options)
            promise.resolve("Model berhasil dimuat!")
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun generateResponse(prompt: String, promise: Promise) {
        if (llmInference == null) {
            promise.reject("ERROR", "Model belum siap!")
            return
        }
        // Dijalankan di background agar UI tidak freeze
        thread {
            try {
                val response = llmInference?.generateResponse(prompt)
                promise.resolve(response)
            } catch (e: Exception) {
                promise.reject("INFERENCE_ERROR", e.message)
            }
        }
    }
}