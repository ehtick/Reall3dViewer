// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
const float EXP4 = exp(-4.0);
const float INV_EXP4 = 1.0 / (1.0 - EXP4);

float fnWave(float minVal, float maxVal, float time) {
    return (sin(time * 0.005) + 1.0) * 0.5 * (maxVal - minVal) + minVal;
}

float fnExp(float r2) {
    return (exp(r2) - EXP4) * INV_EXP4;
}
