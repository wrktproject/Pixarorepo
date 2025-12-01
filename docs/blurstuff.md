1) Depth → blur: exact math (simple, reliable, production-ready)

We need a deterministic mapping from a normalized depth value d ∈ [0,1] (0 = far, 1 = near) to a blur radius r in pixels.

Canonical formula (smooth, controllable):

r(d) = clamp( A * smoothstep(t_near, t_far, 1.0 - d) ^ gamma , 0.0, R_max )


Where:

d = depth (0 far → 1 near). I prefer normalizing MiDaS output so near=1.

A = global aperture scale (user slider). Controls overall strength.

t_near and t_far = thresholds to control where blur starts/ends as normalized depth (0..1).

gamma = controls falloff curve (gamma >1 compresses small radii, gamma <1 expands).

R_max = maximum radius clamp (e.g., 60 px).

A practical mapping you can use by default:

A = 1.0

t_near = 0.05

t_far = 0.9

gamma = 1.2

R_max = 60

Implementation note: smoothstep(edge0, edge1, x) = Hermite interpolation between 0 and 1. Use smoothstep(t_near, t_far, 1.0 - d) so far values (small d) get more blur.

If you’d rather a linear relation:

r(d) = clamp( A * (1 - d), 0, R_max )


But the smoothstep + gamma gives much nicer control.

2) Layering & compositing: formulas & pseudo-algorithm

Goal: avoid per-pixel variable-kernel convolution (too slow). Instead, quantize depths to N layers, blur each with fixed kernel, then composite front→back.

Parameters:

N = number of depth layers (start 6–12; higher = smoother but costlier)

layers[i] = depth range for layer i

kernel_radius[i] = radius for that layer (calculated from representative depth using r(d))

Algorithm (high-level):

Quantize depth:

For i in [0..N-1]: depth_range[i] = [i/N, (i+1)/N)

Create per-layer mask M_i(x) = 1 if depth(x) ∈ depth_range[i] else 0 (use soft mask, see below).

For each layer i:

Extract masked image I_i = I * M_i.

Apply blur with radius kernel_radius[i].

Use separable Gaussian (horizontal + vertical) or circular kernel via FFT/GPU if available.

Composite layers back front-to-back:

C = transparent black
for i = N-1 downto 0:       // nearest to farthest (foreground on top)
    C = C * (1 - alpha_i) + blurred_I_i * alpha_i


Where alpha_i is the soft alpha mask for layer i (0..1). In practice, alpha_i = M_i blurred slightly (edge feathering) or derived from depth confidence.

Soft masks:

Instead of hard masks, compute M_i(x) = smoothstep(range_start - w, range_start + w, depth) to create overlap between adjacent layers (w small). This avoids hard boundaries and reduces haloing.

Edge-aware compositing:

For pixels that belong to a nearer layer, prefer the nearest layer always (z-test). That means when compositing, you should also consider depth at pixel: if depth pixel belongs roughly to layer j (highest layer index = nearest), then don't composite farther layer contributions at full alpha — blend based on depth difference. Implementation in shader: do a depth-weighted blend.

Depth-weighted blend formula for pixel p:

for i descending:
    d_p = depth(p)
    w_i = gaussian( (d_center_i - d_p) / sigma_depth )
    accumulate color += blurred_I_i(p) * w_i
normalize by sum(w_i)


This avoids visible seams: each blurred layer contributes weighted by how close its representative depth is to the actual pixel depth.

Representative depth d_center_i = (range_start + range_end)/2 for layer i. sigma_depth controls overlap (start with 1.0 / N * 1.5).

3) Edge & halo mitigation (must-do, practical techniques)

Depth maps are noisy at boundaries (hair, foliage). Fixes:

Joint bilateral filter on depth (guided by color)

Apply a bilateral filter to depth with the RGB image as guide. This smooths depth while preserving edges aligned with the image.

Implementation: separable bilateral or dual-domain bilateral in the shader.

Depth dilation for foreground

Expand (dilate) near-depth values slightly to avoid background bleeding into foreground at edges. Do this on the depth map before quantization using morphological operations in a shader.

Alpha feathering between layers

Smooth layer masks with small gaussian (2-6 px) so transitions are soft.

Clamp blur at depth discontinuities

When sampling blurred layer at a pixel, if the sample’s depth differs from the pixel’s depth by more than threshold_z, reduce contribution — prevents "background ghosting" around foreground edges.

Edge-aware upsample (if depth is lower resolution than image)

Upsample depth using edge-aware upsampling (guided filter / bilateral upsampling) rather than naive nearest / bilinear.

Refinement via small ML (optional)

Use a light mask-refinement net to clean hair/edge masks if you want better quality later. Not required for v1.

4) Bokeh highlights & shape (optional advanced quality)

If you want specular highlight bloom and aperture shape:

Pre-sampling: create a bright-pass image B = clamp(I - threshold, 0, 1) optionally with tone mapping.

Convolve bright-pass with a disk-shaped kernel (or polygon kernel for aperture blades).

Add blurred bright-pass back into final composite with a highlight_strength parameter.

To simulate "cat’s eye" you can distort kernel radius horizontally near image edges or use an anisotropic kernel. Not necessary for MVP.

5) Implementation plan (GPU-first, incremental)

Break into 3 milestones.

Milestone A — MVP (ship fast, single dev):

Run MiDaS server-side or ONNX in-browser to produce depth map. (Prefer server if mobile/older devices.)

Guided bilateral filter on depth (GPU shader).

Quantize into 8 layers, generate soft masks.

Implement separable gaussian blurs per layer in WebGL2.

Depth-weighted compositing front-to-back in a final shader.

UI: a single “Amount” slider + preview.

Milestone B — Quality upgrades:

Add bokeh highlight bright-pass + disk convolution.

Improve masks with dilation + edge-aware upsample.

Add foreground_protect parameter and implement depth-clamp to remove bleeding.

Milestone C — Lightroom-level polish:

Train/refine small mask-cleaning net.

Implement anisotropic/spherical-aberration kernels.

Real-time mobile optimization and fallback CPU path.

6) System architecture for Pixaro (where each part lives)

Option A — Server-side heavy (easier to support wide devices):

Client uploads image (or uses local file).

Server (GPU instance) runs MiDaS → returns depth map (and confidence map).

Server returns a pre-rendered blurred image(s) or depth map → client composites or downloads final result.

Option B — Hybrid (recommended):

Run MiDaS server-side but send depth map back to client. Client does fast GPU compositing + blur in browser (WebGL/WebGPU).

Pros: lower bandwidth than full rendered images, interactive sliders, cheap server compute.

Cons: needs WebGL on client.

Option C — Full client:

Run MiDaS in-browser via ONNX/WebGPU (heavy; only for high-end devices).

For Pixaro, hybrid is best: server for depth; client for interactive previews and final compositing.

Data flows:

Client UI -> upload image -> server: run MiDaS -> returns depth + confidence
Client: load image + depth into WebGL textures -> run blur pipeline -> render to canvas
User tweaks sliders -> re-run GPU layers (no extra server calls)
User -> export final composited image (read pixels from framebuffer)


Security: keep images private, ephemeral server storage, or do depth return and delete.

7) UI sliders & recommended defaults (clean, designer-friendly)

Primary:

Amount (aperture strength) — range 0.0 .. 2.5, default 1.0. (maps to A)

Max Blur — range 8 .. 120 px, default 60 px. (R_max)

Focus Depth — pick a point in the image or slider 0 .. 100% that sets t_near/t_far center (choose value where you want sharpness); default center at depth median.

Transition Width — 0 .. 0.5, default 0.08. Controls soft mask width.

Edge Protect — 0 .. 1, default 0.6. Controls how aggressively foreground is kept sharp (depth-clamp threshold).

Bokeh Highlights — 0 .. 2, default 0.0 (off). Controls bright-pass contribution.

Aperture Shape — dropdown (Circle, Hexagon, Triangle) — affects generated kernel (advanced).

Preview Mode — toggle: Depth map / Layer masks / Final result.

UX notes:

Click-to-focus: let user click on pixel to set focus depth instantly (map pixel depth to t_near/t_far).

Instant feedback: when user moves sliders, only re-run GPU steps (no server call).

Show “depth confidence” overlay to flag low-quality depth.

8) Performance & implementation tips

Use separable gaussian blur (two passes: horizontal then vertical). Complexity O(k * texels) but small kernel sizes are cheap on GPU.

For large blur radii, implement mipmapped blur (downsample → blur → upscale) to reduce cost.

Technique: For layer with radius > 20 px, downsample image (1/2, 1/4) before blurring. Upscale with bilateral-guided upsample.

Reuse blur results: layers with identical/similar radii can reuse the same blurred texture.

Use float16 textures where supported.

Render to multiple framebuffers (FBOs) for pipeline stages to avoid copy overhead.

Use linear sampling for intermediate steps; avoid unnecessary readPixels calls.

For mobile: throttle preview resolution and provide full-res only on export.

9) Testing checklist (visual & automated)

Visual:

Strong foreground edges (hair, spokes) — check for halos.

Fine detail (leaf edges) — ensure no background leaking.

Bright highlights — check bokeh bright-pass artifacts.

Extreme depths (close face + far background) — ensure smooth falloff.

Automated:

Perceptual SSIM between expected base image and composite in foreground regions (should be high).

Depth consistency asserts: confirm no pixel in final is coming from layer with depth further away than allowed except for blurred background.

Performance: measure FPS for slider changes at typical device resolutions.

10) Minimal WebGL2 + GLSL example (core shader pieces)

Below is a concise example plan and key GLSL fragments. This is not a full app, but a ready-to-adapt core that shows how to:

take image + depth

quantize into layers

blur per-layer via separable gaussian

composite depth-weighted

You’ll want to structure code to generate layer textures in JS (framebuffers), run horizontal/vertical passes, then final composite.

Key pieces:

Quantize depth to get layer mask (fragment shader)

// layer_mask.fs
precision highp float;
uniform sampler2D uDepth; // depth normalized 0..1
uniform float uN;         // number of layers (e.g., 8)
uniform float uLayerIdx;  // 0..N-1
uniform float uTransition; // transition width in normalized depth (e.g., 0.04)
varying vec2 vUv;

float softMask(float d, float start, float end, float t) {
  // create triangular soft mask centered in the range
  float left = smoothstep(start - t, start + t, d);
  float right = 1.0 - smoothstep(end - t, end + t, d);
  return clamp(min(left, right), 0.0, 1.0);
}

void main() {
  float d = texture2D(uDepth, vUv).r; // 0..1
  float idx = uLayerIdx;
  float size = 1.0 / uN;
  float start = idx * size;
  float end = start + size;
  float alpha = softMask(d, start, end, uTransition);
  gl_FragColor = vec4(alpha, alpha, alpha, 1.0);
}


Separable Gaussian blur (horizontal pass)

// blur_h.fs
precision highp float;
uniform sampler2D uImage;
uniform float uTexelSizeX; // 1.0/width
uniform float uRadius;     // in px (map to offsets)
varying vec2 vUv;

// gaussian weights precomputed in JS for specific kernel size, or computed on the fly
// For performance, do a fixed small kernel (e.g., 11 taps) and approximate larger blur using mip
void main() {
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  // Example 11-tap kernel (offsets -5..5)
  for (int i = -5; i <= 5; i++) {
    float offset = float(i) * uTexelSizeX * (uRadius / 10.0); // scale offsets relatively
    float w = exp(-0.5 * (float(i) * float(i)) / (2.0*2.0)); // sigma=2 (example)
    vec4 sample = texture2D(uImage, vUv + vec2(offset, 0.0));
    sum += sample * w;
    wsum += w;
  }
  gl_FragColor = sum / wsum;
}


Vertical pass is the same but sample Y offsets.

Composite shader (depth-weighted)

// composite.fs
precision highp float;
uniform sampler2D uBlurredLayers[8];  // up to N layers, or use texture atlas
uniform sampler2D uDepth;
uniform float uLayerDepthCenters[8];  // normalized centers
uniform float uSigmaDepth;           // e.g. 1.0/N * 1.5
uniform int uN;
varying vec2 vUv;

void main() {
  float d = texture2D(uDepth, vUv).r;
  vec3 accum = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uN) break;
    vec3 col = texture2D(uBlurredLayers[i], vUv).rgb;
    float center = uLayerDepthCenters[i];
    float w = exp(-0.5 * pow((center - d)/uSigmaDepth, 2.0));
    accum += col * w;
    wsum += w;
  }
  accum /= max(wsum, 1e-6);
  gl_FragColor = vec4(accum, 1.0);
}


Notes:

JS code prepares uLayerDepthCenters and blurred textures.

Use N up to 12. If N dynamic, use array texture or bindless textures where supported.

11) Export / finalization

After user finalizes sliders, render at full resolution:

If you used downsampling/mip tricks for preview, re-render full-res layer blurs for final export.

If server-side depth was used, do a final server-side full-res render if client device is low-end.

Provide single-click “Save” that reads framebuffer via gl.readPixels, converts to blob, and downloads or uploads.

12) Quick implementation checklist (what to code in what order)

Integrate MiDaS server and return normalized depth map (0..1).

Display depth overlay in UI for debugging.

Implement guided bilateral filter on depth (shader).

Implement quantization into N soft masks (shader).

Implement separable gaussian blur passes per mask (FBO pipeline).

Implement depth-weighted composite shader.

Add UI sliders (Amount, Max Blur, Transition, Edge Protect).

Add preview modes (depth/layers/final).

Performance optimize (mipmaps, reuse blurs).

Bright-pass + bokeh highlights (optional).

Final polish and mobile testing.

13) Pitfalls you will run into (and how to avoid them)

Haloing around hair — fix: joint bilateral depth filtering + depth dilation + clamp sampling by depth.

GPU memory blowout for many layers at large resolution — fix: reuse blurred textures, downsample big-blur layers.

Depth inversion (model outputs near=0 vs near=1) — normalize on ingestion; provide UI toggle to flip if needed.

Slow preview — render preview at 720p or lower, final export at full-res.

14) Example JS wiring sketch (pseudo, help you implement quickly)
// high-level
const N = 8;
const depthTex = uploadTexture(depthImage); // from MiDaS
const imgTex = uploadTexture(photo);

const masks = [];
for (let i=0;i<N;i++){
  masks[i] = renderToFBO(shaderLayerMask, {uDepth: depthTex, uLayerIdx:i, uN:N, uTransition});
}

// create masked images
const maskedImgs = [];
for (let i=0;i<N;i++){
  maskedImgs[i] = renderToFBO(shaderApplyMask, {uImage: imgTex, uMask: masks[i]});
}

// blur masked images (horizontal + vertical)
const blurred = [];
for (let i=0;i<N;i++){
  const h = renderToFBO(blurH, {uImage: maskedImgs[i], uRadius: radiusForLayer(i)});
  const v = renderToFBO(blurV, {uImage: h, uRadius: radiusForLayer(i)});
  blurred[i] = v;
}

// composite
const final = renderToFBO(compositeShader, {
  uBlurredLayers: blurred,
  uDepth: depthTex,
  uLayerDepthCenters: centers,
  uSigmaDepth
});

// draw final to screen
drawTexture(final);


Use an existing WebGL helper library or write a small wrapper around FBO management.

15) Final words — scope, expectations, and next steps (be brutal, because it helps)

You can build a polished, interactive depth-based lens blur feature in a single developer sprint if you:

reuse MiDaS (server-side),

do GPU layer-based blurs,

implement edge-aware filtering and alpha feathering.

What you should not do initially:

try to reinvent the depth estimator,

try to do full, per-pixel variable-kernel convolution,

attempt complex aperture simulation (cat’s eye, spherical aberration) before the pipeline is stable.