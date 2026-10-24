import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from '../lib/hooks';

/**
 * A small WebGL viewer for a real equirectangular (360°) photograph. Each pixel casts a ray from
 * the camera and samples the panorama, so the photograph is shown undistorted at any angle.
 * Overlays are drawn in a 2D canvas using the same camera, so they stay registered to the photo.
 */

export interface Camera {
  yaw: number; // radians, 0 = panorama centre
  pitch: number; // radians, + looks up
  fov: number; // vertical field of view, radians
}

export interface ProjectFn {
  /** world direction or point (x right, y up, z forward) → screen px, or null when behind the camera */
  (p: [number, number, number]): [number, number] | null;
}

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D pano;
uniform float yaw, pitch, tanHalf, aspect;
const float PI = 3.14159265359;
void main(){
  vec3 d = normalize(vec3(v.x * tanHalf * aspect, v.y * tanHalf, 1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp + d.z * sp, -d.y * sp + d.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
  float u = atan(d.x, d.z) / (2.0 * PI) + 0.5;
  float w = acos(clamp(d.y, -1.0, 1.0)) / PI;
  gl_FragColor = texture2D(pano, vec2(u, w));
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

export function makeProject(cam: Camera, w: number, h: number): ProjectFn {
  const tanHalf = Math.tan(cam.fov / 2);
  const aspect = w / h;
  const cy = Math.cos(-cam.yaw);
  const sy = Math.sin(-cam.yaw);
  const cp = Math.cos(-cam.pitch);
  const sp = Math.sin(-cam.pitch);
  return ([x, y, z]) => {
    // inverse of the shader's rotation: undo yaw, then undo pitch
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp + z1 * sp;
    const z2 = -y * sp + z1 * cp;
    if (z2 <= 0.05) return null;
    const sxN = x1 / z2 / (tanHalf * aspect);
    const syN = y2 / z2 / tanHalf;
    return [((sxN + 1) / 2) * w, ((1 - syN) / 2) * h];
  };
}

interface Props {
  src: string;
  srcSmall: string;
  lqip: string;
  label: string;
  initial?: Camera;
  /** draw overlays for the current camera; called on every camera change */
  overlay?: (ctx: CanvasRenderingContext2D, project: ProjectFn, w: number, h: number, cam: Camera) => void;
  children?: (cam: Camera, project: ProjectFn | null, size: { w: number; h: number }) => ReactNode;
  fallback: ReactNode;
}

const DEFAULT: Camera = { yaw: 0, pitch: -0.18, fov: (75 * Math.PI) / 180 };
const clampPitch = (p: number) => Math.max(-1.35, Math.min(1.2, p));
const clampFov = (f: number) => Math.max((35 * Math.PI) / 180, Math.min((100 * Math.PI) / 180, f));

export function PanoViewer({ src, srcSmall, lqip, label, initial = DEFAULT, overlay, children, fallback }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const gl3 = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<Camera>(initial);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported' | 'error'>('loading');
  const camRef = useRef(cam);
  camRef.current = cam;
  const reduced = useReducedMotion();
  const glState = useRef<{ gl: WebGLRenderingContext; loc: Record<string, WebGLUniformLocation | null> } | null>(null);

  // set up WebGL and load the panorama
  useEffect(() => {
    const canvas = gl3.current!;
    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      setState('unsupported');
      return;
    }
    let cancelled = false;
    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const p = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(p);
      gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
      const loc = Object.fromEntries(['yaw', 'pitch', 'tanHalf', 'aspect', 'pano'].map((n) => [n, gl.getUniformLocation(prog, n)]));
      glState.current = { gl, loc };
    } catch {
      setState('error');
      return;
    }
    // Texels the view needs across 360° at the default zoom: a narrow, dense phone screen sees a
    // smaller slice of the panorama per device pixel than a wide desktop one, so it can need more.
    const el = wrap.current!;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    const hFov = 2 * Math.atan(Math.tan(DEFAULT.fov / 2) * aspect);
    const needed = (el.clientWidth * Math.min(2, window.devicePixelRatio || 1) * 2 * Math.PI) / hFov;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const small = saveData || needed <= 2048 * 1.25;
    // Fetch and upload the panorama only when the viewer is about to be seen: decoding and
    // uploading a 4096 px texture is the heaviest work on the page, and it needn't block load.
    const img = new Image();
    img.decoding = 'async';
    const upload = () => {
      if (cancelled || !glState.current) return;
      const { gl: g } = glState.current;
      const tex = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, tex);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, img);
      g.generateMipmap(g.TEXTURE_2D);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      setState('ready');
    };
    img.onerror = () => !cancelled && setState('error');
    // decode() keeps image decoding off the main thread; onload is the fallback where it rejects
    img.onload = () => {
      img.decode().then(upload, upload);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        img.src = small ? srcSmall : src;
      },
      { rootMargin: '100px 0px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [src, srcSmall]);

  // keep canvases sized to the element
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [gl3.current!, over.current!]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // draw
  useEffect(() => {
    if (state !== 'ready' || !glState.current || !size.w) return;
    const { gl, loc } = glState.current;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(loc.yaw, cam.yaw);
    gl.uniform1f(loc.pitch, cam.pitch);
    gl.uniform1f(loc.tanHalf, Math.tan(cam.fov / 2));
    gl.uniform1f(loc.aspect, size.w / size.h);
    gl.uniform1i(loc.pano, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const o = over.current!;
    const ctx = o.getContext('2d')!;
    const dpr = o.width / size.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    overlay?.(ctx, makeProject(cam, size.w, size.h), size.w, size.h, cam);
  }, [cam, size, state, overlay]);

  // pointer: drag to look, wheel/pinch to zoom, with a little inertia
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; t: number } | null>(null);
  const pinch = useRef<{ d: number; fov: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const inertia = useRef(0);

  const look = useCallback((dx: number, dy: number) => {
    const c = camRef.current;
    const k = c.fov / (wrap.current?.clientHeight || 600);
    setCam({ ...c, yaw: c.yaw - dx * k, pitch: clampPitch(c.pitch + dy * k) });
  }, []);

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    cancelAnimationFrame(inertia.current);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: camRef.current.fov };
      drag.current = null;
    } else drag.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now() };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setCam({ ...camRef.current, fov: clampFov(pinch.current.fov * (pinch.current.d / d)) });
      return;
    }
    const g = drag.current;
    if (!g) return;
    const now = performance.now();
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const dt = Math.max(1, now - g.t);
    drag.current = { x: e.clientX, y: e.clientY, vx: dx / dt, vy: dy / dt, t: now };
    look(dx, dy);
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const g = drag.current;
    drag.current = null;
    if (!g || reduced) return;
    let vx = g.vx * 16;
    let vy = g.vy * 16;
    const step = () => {
      vx *= 0.92;
      vy *= 0.92;
      if (Math.abs(vx) + Math.abs(vy) < 0.2) return;
      look(vx, vy);
      inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  };
  // Ctrl/Cmd + wheel zooms; a plain wheel keeps scrolling the page (no scroll trap).
  // React wheel listeners are passive, so attach a native one that may preventDefault.
  useEffect(() => {
    const el = wrap.current!;
    const h = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setCam((c) => ({ ...c, fov: clampFov(c.fov * Math.exp(e.deltaY * 0.0025)) }));
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    const step = 0.08;
    const c = camRef.current;
    const map: Record<string, Camera> = {
      ArrowLeft: { ...c, yaw: c.yaw - step },
      ArrowRight: { ...c, yaw: c.yaw + step },
      ArrowUp: { ...c, pitch: clampPitch(c.pitch + step) },
      ArrowDown: { ...c, pitch: clampPitch(c.pitch - step) },
      '+': { ...c, fov: clampFov(c.fov * 0.9) },
      '=': { ...c, fov: clampFov(c.fov * 0.9) },
      '-': { ...c, fov: clampFov(c.fov / 0.9) },
    };
    if (map[e.key]) {
      e.preventDefault();
      setCam(map[e.key]);
    }
  };

  const project = size.w && state === 'ready' ? makeProject(cam, size.w, size.h) : null;
  const heading = ((((cam.yaw * 180) / Math.PI) % 360) + 360) % 360;

  if (state === 'unsupported' || state === 'error') return <>{fallback}</>;

  return (
    <div className="pano">
      <div
        ref={wrap}
        className={`pano__stage ${state === 'ready' ? 'is-ready' : ''}`}
        style={{ backgroundImage: `url(${lqip})` }}
        tabIndex={0}
        role="application"
        aria-roledescription="360-degree photograph"
        aria-label={`${label}. Drag or use the arrow keys to look around; plus and minus to zoom.`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <canvas ref={gl3} className="pano__gl" aria-hidden />
        <canvas ref={over} className="pano__over" aria-hidden />
        {state === 'loading' && <p className="pano__loading mono">Loading the 360° photograph…</p>}
        {children?.(cam, project, size)}
      </div>
      <div className="pano__controls" role="group" aria-label="View controls">
        <button className="chip" onClick={() => setCam((c) => ({ ...c, fov: clampFov(c.fov * 0.85) }))} aria-label="Zoom in">
          +
        </button>
        <button className="chip" onClick={() => setCam((c) => ({ ...c, fov: clampFov(c.fov / 0.85) }))} aria-label="Zoom out">
          −
        </button>
        <button className="chip" onClick={() => setCam(initial)}>
          Reset view
        </button>
        <span className="mono pano__heading" aria-live="off">
          Heading {Math.round(heading)}° · {Math.round((cam.fov * 180) / Math.PI)}° view · drag to look, Ctrl + scroll to zoom
        </span>
      </div>
    </div>
  );
}
