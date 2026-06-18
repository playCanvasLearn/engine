uniform float uGalleryTime;
uniform float uGalleryMode;

float galleryGetAnim(vec3 center) {
    if (uGalleryMode < 0.5) {
        return smoothstep(0.0, 1.0, uGalleryTime * 2.0 / (abs(center.y) + 1.0));
    }
    return 1.0;
}

void modifySplatCenter(inout vec3 center) {
    if (uGalleryMode < 0.5) {
        float anim = galleryGetAnim(center);
        float PI = 3.14159;
        float mt = fract(anim * 2.0 + fract(center.x * 10000.0) + fract(center.y * 10000.0) + fract(center.z * 10000.0)) * PI * 2.0;
        center += vec3(sin(mt) * sin(mt), cos(mt) * sin(mt), sin(mt)) * smoothstep(0.0, 1.0, 1.0 - anim) * 0.2;
    }
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    if (uGalleryMode < 0.5) {
        float anim = galleryGetAnim(originalCenter);
        float s = 0.05 + smoothstep(0.0, 0.5, anim) * 0.95;
        scale *= s;
    }
}

void modifySplatColor(vec3 center, inout vec4 color) {
    float anim = galleryGetAnim(center);

    if (uGalleryMode < 0.5) {
        color = mix(vec4(color.xyz * 10.0, 1.0), color, smoothstep(0.0, 1.0, anim));
    } else {
        float fade = smoothstep(0.0, 1.0, abs(center.y) - (2.0 - uGalleryTime * 6.0));
        color.a *= (1.0 - fade);
    }
}
