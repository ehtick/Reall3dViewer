// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
/*
* 代码片段
*/
precision highp float;
precision highp int;

uniform highp usampler2D splatTexture0, splatTexture1, splatShTexture12, splatShTexture3;
uniform vec2 focal, viewport;
uniform int usingIndex, shDegree, particleMode, transitionEffect;
uniform bool pointMode, bigSceneMode, showWaterMark, debugEffect;
uniform float topY, maxRadius, currentVisibleRadius, currentLightRadius, performanceNow, performanceAct;
uniform float minPixelDiameter, maxPixelDiameter, minAlpha;
uniform vec4 markPoint, waterMarkColor;
uniform uint flagValue, activeFlagValue;

attribute uint splatIndex;

varying vec4 vColor;
varying vec3 vPosition;
