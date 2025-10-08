// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
/*
* 取fv透明度
*/
float getFvAlpha(uvec4 cen) {
    uint fvSplat = cen.w & 65535u;
    uint fvHide = flagValue >> 16u;
    uint fvShow = flagValue & 65535u;
    float fvAlpha = 1.0;
    if (fvSplat > 0u) {
        if (fvSplat == fvShow) {
            fvAlpha = clamp((performanceNow - performanceAct) / 2000.0, 0.0, 1.0);
        } else if (fvSplat == fvHide) {
            fvAlpha = 1.0 - clamp((performanceNow - performanceAct) / 2000.0, 0.0, 1.0);
        } else {
            fvAlpha = 0.0;
        }
    }
    return fvAlpha;
}
