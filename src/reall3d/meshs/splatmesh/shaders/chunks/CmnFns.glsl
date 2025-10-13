// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
float fnWave(float minVal, float maxVal, float time) {
    return (sin(time * 0.005) + 1.0) * 0.5 * (maxVal - minVal) + minVal;
}
