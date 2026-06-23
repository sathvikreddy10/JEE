cmake_minimum_required(VERSION 3.18)
project(llama-jni)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_C_STANDARD 11)

add_library(llama-jni SHARED llama-jni.cpp)

target_include_directories(llama-jni PRIVATE
    ${CMAKE_SOURCE_DIR}/llama.cpp/install/include
)

# Import prebuilt libllama
add_library(llama SHARED IMPORTED)
set_target_properties(llama PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/../jniLibs/arm64-v8a/libllama.so
)

add_library(ggml SHARED IMPORTED)
set_target_properties(ggml PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/../jniLibs/arm64-v8a/libggml.so
)

add_library(ggml-base SHARED IMPORTED)
set_target_properties(ggml-base PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/../jniLibs/arm64-v8a/libggml-base.so
)

add_library(ggml-cpu SHARED IMPORTED)
set_target_properties(ggml-cpu PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/../jniLibs/arm64-v8a/libggml-cpu.so
)

find_library(log-lib log)
target_link_libraries(llama-jni llama ggml ggml-base ggml-cpu ${log-lib})
