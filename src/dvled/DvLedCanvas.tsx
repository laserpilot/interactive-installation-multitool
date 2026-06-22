import { useEffect, useRef } from 'react';
import type { LedShape } from '../store/useConfigStore';

export interface DvLedCanvasProps {
  /** Content to drive onto the wall (image or test-pattern canvas). */
  source: TexImageSource | null;
  /** Native LED cells across / down the WHOLE wall. */
  cols: number;
  rows: number;
  /**
   * Wall width ÷ visible span. ≥1 ⇒ zoomed into a sub-window of the wall;
   * <1 ⇒ whole wall sits inside the frame with dark surround.
   */
  wallFillFraction: number;
  fillFactor: number; // 0–1 emitter coverage of the cell
  shape: LedShape;
  /** Wall aspect (w/h) — the canvas is letterboxed to this. */
  aspect: number;
}

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// One pass. We map each fragment to a point on the wall, quantise it to an LED
// cell, light that cell with the content colour, and carve the inter-LED gap
// with an emitter mask.
//
// The LED grid is a high-frequency periodic pattern. Drawn with one sample per
// display pixel it beats against the canvas pixel grid and throws off moiré /
// phantom squares — a *rendering* artifact, not something the eye sees. So we
// supersample the pattern across each pixel's footprint (estimated from the
// screen-space derivative of the cell coordinate) and average. This area-filters
// the emitter mask, which also makes distance drive sharpness correctly: when a
// cell is much larger than a pixel the dots stay crisp; when many cells fall
// inside one pixel (far away) the mask and gaps average into a smooth image.
const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_content;
uniform vec2 u_cells;        // native LED cells across the whole wall
uniform float u_invFill;     // wall span / wall  (= 1 / wallFillFraction)
uniform float u_fill;        // emitter coverage 0–1
uniform int u_shape;         // 0 = square, 1 = circle

const vec3 GAP = vec3(0.012);      // unlit substrate between LEDs
const vec3 SURROUND = vec3(0.04);  // off-wall area when zoomed out
const int N = 4;                   // N×N supersamples per pixel

// Emitter coverage (0 or 1) for a point 'local' in [-0.5, 0.5] within its cell.
float mask(vec2 local) {
  if (u_shape == 1) {
    float radius = sqrt(u_fill / 3.14159265);
    return length(local) <= radius ? 1.0 : 0.0;
  }
  float hw = 0.5 * sqrt(u_fill);
  return (abs(local.x) <= hw && abs(local.y) <= hw) ? 1.0 : 0.0;
}

void main() {
  // Frame UV -> wall UV. The wall is centred; u_invFill scales the window.
  vec2 wallUv = 0.5 + (v_uv - 0.5) * u_invFill;

  if (any(lessThan(wallUv, vec2(0.0))) || any(greaterThan(wallUv, vec2(1.0)))) {
    outColor = vec4(SURROUND, 1.0);
    return;
  }

  vec2 cell = wallUv * u_cells;     // continuous cell coordinate
  vec2 dCx = dFdx(cell);            // pixel footprint in cell space
  vec2 dCy = dFdy(cell);

  vec3 acc = vec3(0.0);
  for (int i = 0; i < N; i++) {
    for (int j = 0; j < N; j++) {
      vec2 o = (vec2(float(i), float(j)) + 0.5) / float(N) - 0.5;
      vec2 c = cell + o.x * dCx + o.y * dCy;
      vec3 led = textureLod(u_content, (floor(c) + 0.5) / u_cells, 0.0).rgb;
      acc += mix(GAP, led, mask(fract(c) - 0.5));
    }
  }

  outColor = vec4(acc / float(N * N), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}

export function DvLedCanvas(props: DvLedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const texRef = useRef<WebGLTexture | null>(null);
  const uniRef = useRef<Record<string, WebGLUniformLocation | null>>({});

  // One-time GL setup.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) return;
    glRef.current = gl;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    progRef.current = prog;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // Fullscreen triangle.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    uniRef.current = {
      content: gl.getUniformLocation(prog, 'u_content'),
      cells: gl.getUniformLocation(prog, 'u_cells'),
      invFill: gl.getUniformLocation(prog, 'u_invFill'),
      fill: gl.getUniformLocation(prog, 'u_fill'),
      shape: gl.getUniformLocation(prog, 'u_shape'),
    };

    const tex = gl.createTexture();
    texRef.current = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(uniRef.current.content, 0);

    return () => {
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      if (tex) gl.deleteTexture(tex);
    };
  }, []);

  // Upload content whenever the source changes.
  useEffect(() => {
    const gl = glRef.current;
    const tex = texRef.current;
    if (!gl || !tex || !props.source) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      props.source,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  }, [props.source]);

  // Render on every prop / size change.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = glRef.current;
    const prog = progRef.current;
    if (!gl || !prog) return;

    function render() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Letterbox a wall-aspect rectangle inside the container.
      const parent = canvas.parentElement!;
      const availW = parent.clientWidth;
      const availH = parent.clientHeight;
      let cssW = availW;
      let cssH = cssW / props.aspect;
      if (cssH > availH) {
        cssH = availH;
        cssW = cssH * props.aspect;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const pxW = Math.max(1, Math.round(cssW * dpr));
      const pxH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      gl!.viewport(0, 0, pxW, pxH);
      gl!.useProgram(prog);
      const u = uniRef.current;
      gl!.uniform2f(u.cells, Math.max(1, props.cols), Math.max(1, props.rows));
      gl!.uniform1f(
        u.invFill,
        props.wallFillFraction > 0 ? 1 / props.wallFillFraction : 1,
      );
      gl!.uniform1f(u.fill, Math.min(0.999, Math.max(0.05, props.fillFactor)));
      gl!.uniform1i(u.shape, props.shape === 'circle' ? 1 : 0);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [
    props.cols,
    props.rows,
    props.wallFillFraction,
    props.fillFactor,
    props.shape,
    props.aspect,
    props.source,
  ]);

  return <canvas ref={canvasRef} className="dvled-canvas" />;
}
