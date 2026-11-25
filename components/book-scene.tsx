'use client';

import { useEffect, useRef, useState } from 'react';
import { Cover } from './covers';
import { coverTexture, paperTexture } from '@/features/library/book-scene/textures';
import type { CoverBook } from '../lib/types';
import type { BoxGeometry, Material } from 'three';

export default function BookScene({ book }: { book: CoverBook }) {
  const host = useRef<HTMLDivElement>(null);
  const [readyId, setReadyId] = useState<string | null>(null);

  useEffect(() => {
    const element = host.current;
    const area = element?.parentElement;
    if (!element || !area) return;
    let disposed = false;
    let clean = () => {};
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0, y: 0 };
    const tilt = (x: number, y: number) => {
      pointer.x = x;
      pointer.y = y;
      area.style.setProperty('--book-yaw', `${-28 + x * 32}deg`);
      area.style.setProperty('--book-pitch', `${10 + y * 14}deg`);
    };
    function move(event: PointerEvent) {
      if (reduced.matches || !area) return;
      const rect = area.getBoundingClientRect();
      tilt((event.clientX - rect.left) / rect.width - .5, (event.clientY - rect.top) / rect.height - .5);
    }
    const reset = () => tilt(0, 0);
    area.addEventListener('pointerdown', move);
    area.addEventListener('pointermove', move);
    area.addEventListener('pointerleave', reset);
    area.addEventListener('pointerup', reset);
    area.addEventListener('pointercancel', reset);

    async function mount(element: HTMLDivElement) {
      const THREE = await import('three');
      if (disposed) return;
      const texture = await coverTexture(THREE, book);
      if (disposed) { texture.dispose(); return; }
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
      if (!context) { texture.dispose(); return; }
      const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      scene.add(new THREE.HemisphereLight(0xf2e4ff, 0x64488d, 2.3));
      const key = new THREE.DirectionalLight(0xffecf8, 2.4);
      key.position.set(-3, 5, 5);
      scene.add(key);
      const object = new THREE.Group();
      const jacket = new THREE.MeshBasicMaterial({ map: texture });
      const edge = new THREE.MeshStandardMaterial({ color: 0x42266b, roughness: 0.72 });
      const leaves = paperTexture(THREE);
      const paper = new THREE.MeshStandardMaterial({ color: 0xf2e2c8, map: leaves, roughness: 0.94 });
      const ribbon = new THREE.MeshStandardMaterial({ color: 0xc4ed65, roughness: 0.86 });
      const binding = new THREE.MeshStandardMaterial({ color: 0x281648, roughness: 0.62 });
      const geometries: BoxGeometry[] = [];
      const box = (width: number, height: number, depth: number, material: Material | Material[], x: number, z: number) => {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 0, z);
        object.add(mesh);
        return mesh;
      };
      box(1.89, 2.54, 0.058, [edge, edge, edge, edge, jacket, edge], 0, 0.141);
      box(1.89, 2.54, 0.058, edge, 0, -0.141);
      box(1.81, 2.46, 0.245, paper, -0.01, 0);
      box(0.12, 2.54, 0.34, binding, -0.895, 0);
      box(0.15, 0.25, 0.015, ribbon, 0.48, 0.07).position.y = -1.25;
      scene.add(object);

      function resize() {
        const width = element.clientWidth;
        const height = element.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = Math.max(6.55, 4.65 / camera.aspect);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      }
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      object.rotation.set(0.14, -0.53, -0.12);
      let visible = true;
      let frame = 0;
      function tick(time = 0) {
        if (!visible || document.hidden || disposed) return;
        const sway = reduced.matches ? 0 : Math.sin(time * 0.00085);
        object.position.y = sway * 0.055;
        object.rotation.x += (0.14 + pointer.y * 0.24 - object.rotation.x) * 0.12;
        object.rotation.y += (-0.53 + sway * 0.085 + pointer.x * 0.62 - object.rotation.y) * 0.12;
        object.rotation.z = -0.12 + sway * 0.015;
        renderer.render(scene, camera);
        if (!reduced.matches) frame = requestAnimationFrame(tick);
      }
      const resume = () => { cancelAnimationFrame(frame); tick(performance.now()); };
      const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); });
      visibility.observe(element);
      document.addEventListener('visibilitychange', resume);
      reduced.addEventListener('change', resume);
      const lost = () => { clean(); clean = () => {}; setReadyId(null); };
      clean = () => {
        cancelAnimationFrame(frame);
        visibility.disconnect();
        document.removeEventListener('visibilitychange', resume);
        reduced.removeEventListener('change', resume);
        canvas.removeEventListener('webglcontextlost', lost);
        observer.disconnect();
        geometries.forEach((geometry) => geometry.dispose());
        [jacket, edge, paper, binding, ribbon].forEach((material) => material.dispose());
        leaves?.dispose();
        texture.dispose();
        renderer.dispose();
        if (!context.isContextLost()) renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      canvas.addEventListener('webglcontextlost', lost, { once: true });
      resize();
      tick();
      setReadyId(book.id);
    }

    setReadyId(null);
    if (typeof WebGL2RenderingContext !== 'undefined') {
      mount(element).catch(() => {});
    }
    return () => {
      disposed = true;
      clean();
      area.removeEventListener('pointerdown', move);
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerleave', reset);
      area.removeEventListener('pointerup', reset);
      area.removeEventListener('pointercancel', reset);
      reset();
    };
  }, [book.id, book.cover, book.format, book.title, book.level]); // Scene assets change only with the featured edition.

  return <div className="scene touch-pan-y select-none" data-renderer={readyId === book.id ? 'webgl' : 'css'} aria-hidden="true">
    <div className="scene-glow" /><div className="orbit orbit-a" /><div className="orbit orbit-b" />
    <i className="star star-a" /><i className="star star-b" /><i className="star star-c" /><i className="star star-d" />
    <div className="scene-shadow" />
    <div className={`book-fallback ${readyId === book.id ? 'scene-hidden' : ''}`}>
      <span className="absolute -bottom-[7%] left-[72%] h-[13%] w-[8%] -rotate-3 bg-lime-300" />
      <Cover book={book} />
    </div>
    <div ref={host} className={`webgl-scene ${readyId === book.id ? 'scene-ready' : ''}`} />
  </div>;
}
