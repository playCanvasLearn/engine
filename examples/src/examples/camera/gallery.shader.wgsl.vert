uniform uGalleryTime: f32;
uniform uGalleryMode: f32;

fn galleryGetAnim(center: vec3f) -> f32 {
    if (uniform.uGalleryMode < 0.5) {
        return smoothstep(0.0, 1.0, uniform.uGalleryTime * 2.0 / (abs(center.y) + 1.0));
    }
    return 1.0;
}

fn modifySplatCenter(center: ptr<function, vec3f>) {
    if (uniform.uGalleryMode < 0.5) {
        let anim = galleryGetAnim(*center);
        let PI = 3.14159;
        let mt = fract(anim * 2.0 + fract((*center).x * 10000.0) + fract((*center).y * 10000.0) + fract((*center).z * 10000.0)) * PI * 2.0;
        (*center) += vec3f(sin(mt) * sin(mt), cos(mt) * sin(mt), sin(mt)) * smoothstep(0.0, 1.0, 1.0 - anim) * 0.2;
    }
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    if (uniform.uGalleryMode < 0.5) {
        let anim = galleryGetAnim(originalCenter);
        let s = 0.05 + smoothstep(0.0, 0.5, anim) * 0.95;
        (*scale) *= s;
    }
}

fn modifySplatColor(center: vec3f, clr: ptr<function, vec4f>) {
    let anim = galleryGetAnim(center);

    if (uniform.uGalleryMode < 0.5) {
        (*clr) = mix(vec4f((*clr).xyz * 10.0, 1.0), (*clr), smoothstep(0.0, 1.0, anim));
    } else {
        let fade = smoothstep(0.0, 1.0, abs(center.y) - (2.0 - uniform.uGalleryTime * 6.0));
        (*clr).a *= (1.0 - fade);
    }
}
