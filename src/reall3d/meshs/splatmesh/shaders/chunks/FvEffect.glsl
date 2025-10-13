// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
void FvEffect(uvec4 cen, out vec4 oColor, uint fvActive, float time) {
    uint fv = cen.w & 65535u;
    if (fv > 0u && fv == fvActive) {
        oColor.rgb *= fnWave(1.0, 1.6, time);
    }
}
