// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
precision highp float;

uniform float lightFactor;
uniform float minAlpha;
uniform bool useSimilarExp;
varying vec4 vColor;
varying vec3 vPosition;

void main() {
    float alpha = vColor.a;
    if (alpha < minAlpha) {
        gl_FragColor = vec4(0.0);
        return;
    }

    if (vPosition.z >= 1.0) {
        alpha = 1.0;
    } else {
        float r2 = dot(vPosition.xy, vPosition.xy);
        if (r2 > 4.0) {
            gl_FragColor = vec4(0.0);
            return;
        }
        alpha *= useSimilarExp ? (1.0 / (1.0 + r2 * (1.0 + 0.5 * r2))) : exp(-r2);
        if (alpha <= minAlpha) {
            gl_FragColor = vec4(0.0);
            return;
        }
    }

    gl_FragColor = vec4(lightFactor * vColor.rgb, alpha);
}
