// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
bool IsWatermark(uvec4 cen) {
    return (cen.w & 65536u) > 0u;
}
