import { useEffect, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
} from "three";
import type { EmotionUniverseSong } from "../../shared/visualizations";

type EmotionUniverseSceneProps = {
  songs: EmotionUniverseSong[];
  cameraDistance: number;
  resetKey: number;
  onSelect: (song: EmotionUniverseSong) => void;
};

export default function EmotionUniverseScene({ songs, cameraDistance, resetKey, onSelect }: EmotionUniverseSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stage = container;

    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const scene = new Group();
    const camera = new PerspectiveCamera(50, width / height, 0.1, 800);
    camera.position.set(0, 0, cameraDistance);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.className = "universe-canvas";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "3D 情绪宇宙星图");
    stage.appendChild(renderer.domElement);

    const starGeometry = new BufferGeometry();
    const starPositions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) {
      const angle = index * 2.399963229728653;
      const distance = 42 + (index % 29) * 2.5;
      starPositions[index * 3] = Math.cos(angle) * distance;
      starPositions[index * 3 + 1] = Math.sin(angle) * (28 + (index % 19) * 1.8);
      starPositions[index * 3 + 2] = -96 + (index % 37) * 5.2;
    }
    starGeometry.setAttribute("position", new BufferAttribute(starPositions, 3));
    const starField = new Points(starGeometry, new PointsMaterial({ color: 0xfffdf8, size: 0.7, transparent: true, opacity: 0.24, sizeAttenuation: true }));
    scene.add(starField);

    const planetGroup = new Group();
    const planetMeshes: Mesh[] = [];
    const densityScale = songs.length > 120 ? 0.58 : songs.length > 60 ? 0.68 : songs.length > 30 ? 0.84 : 1;
    songs.forEach((song, index) => {
      const size = Math.max(1.1, Math.min(4.2, (song.radius / 5.4) * densityScale));
      const color = new Color(song.color);
      const planet = new Mesh(
        new SphereGeometry(size, 28, 18),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.82 + song.opacity * 0.18 }),
      );
      planet.position.set((song.x - 50) * 0.92, (50 - song.y) * 0.72, (song.z - 50) * 0.96);
      planet.userData.song = song;
      planetMeshes.push(planet);
      planetGroup.add(planet);

      const ring = new Mesh(
        new TorusGeometry(size * 1.95, Math.max(0.055, size * 0.055), 8, 64),
        new MeshBasicMaterial({ color, transparent: true, opacity: (0.22 + song.ringStrength * 0.42) * Math.max(0.72, densityScale), depthWrite: false }),
      );
      ring.position.copy(planet.position);
      ring.rotation.set(Math.PI / 2 + song.depth * 0.32, index * 0.29, index * 0.17);
      planetGroup.add(ring);
    });
    scene.add(planetGroup);

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const activePointers = new Map<number, { x: number; y: number }>();
    const view = {
      distance: cameraDistance,
      pointerId: null as number | null,
      startX: 0,
      startY: 0,
      moved: false,
      rotationX: -0.1,
      rotationY: 0,
      pinchDistance: 0,
      pinchStartDistance: cameraDistance,
    };

    function clampDistance(distance: number) {
      return Math.max(66, Math.min(178, distance));
    }

    function activePointerDistance() {
      const points = Array.from(activePointers.values());
      if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    function handlePointerDown(event: PointerEvent) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      renderer.domElement.setPointerCapture(event.pointerId);
      if (activePointers.size === 1) {
        view.pointerId = event.pointerId;
        view.startX = event.clientX;
        view.startY = event.clientY;
        view.moved = false;
      } else if (activePointers.size === 2) {
        view.pointerId = null;
        view.pinchDistance = activePointerDistance();
        view.pinchStartDistance = view.distance;
        view.moved = true;
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const activePointer = activePointers.get(event.pointerId);
      if (!activePointer) return;
      activePointer.x = event.clientX;
      activePointer.y = event.clientY;
      if (activePointers.size >= 2) {
        const pinchDistance = activePointerDistance();
        if (pinchDistance > 0 && view.pinchDistance > 0) {
          view.distance = clampDistance(view.pinchStartDistance * (view.pinchDistance / pinchDistance));
        }
        view.moved = true;
        return;
      }
      if (view.pointerId !== event.pointerId) return;
      const dx = event.clientX - view.startX;
      const dy = event.clientY - view.startY;
      if (Math.abs(dx) + Math.abs(dy) > 8) view.moved = true;
      view.startX = event.clientX;
      view.startY = event.clientY;
      view.rotationY += dx * 0.006;
      view.rotationX = Math.max(-0.72, Math.min(0.72, view.rotationX + dy * 0.004));
    }

    function handlePointerUp(event: PointerEvent) {
      const wasPrimaryPointer = view.pointerId === event.pointerId;
      activePointers.delete(event.pointerId);
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      if (activePointers.size === 1) {
        const nextPointerEntry = activePointers.entries().next().value;
        if (nextPointerEntry) {
          const [nextPointerId, nextPointer] = nextPointerEntry;
          view.pointerId = nextPointerId;
          view.startX = nextPointer.x;
          view.startY = nextPointer.y;
        }
      } else {
        view.pointerId = null;
      }
      if (wasPrimaryPointer && activePointers.size === 0 && !view.moved) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(planetMeshes, false)[0];
        const song = hit?.object.userData.song as EmotionUniverseSong | undefined;
        if (song) onSelectRef.current(song);
      }
    }

    function handlePointerCancel(event: PointerEvent) {
      activePointers.delete(event.pointerId);
      if (view.pointerId === event.pointerId) view.pointerId = null;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      view.distance = clampDistance(view.distance + event.deltaY * 0.08);
    }

    function resize() {
      const nextWidth = Math.max(1, stage.clientWidth);
      const nextHeight = Math.max(1, stage.clientHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerCancel);
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("resize", resize);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameId = 0;
    function animate() {
      if (!reduceMotion) view.rotationY += 0.0014;
      planetGroup.rotation.x += (view.rotationX - planetGroup.rotation.x) * 0.14;
      planetGroup.rotation.y += (view.rotationY - planetGroup.rotation.y) * 0.14;
      camera.position.z += (view.distance - camera.position.z) * 0.18;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerCancel);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      disposeThreeObject(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === stage) renderer.domElement.remove();
    };
  }, [cameraDistance, resetKey, songs]);

  return (
    <div className="universe-stage" ref={containerRef}>
      <div className="universe-accessible-list" aria-label="星球列表">
        {songs.map((song) => <button key={song.id} type="button" onClick={() => onSelect(song)}>{song.title}</button>)}
      </div>
    </div>
  );
}

function disposeThreeObject(object: Object3D) {
  object.traverse((child) => {
    const renderable = child as Mesh<BufferGeometry, Material | Material[]> | Points<BufferGeometry, Material | Material[]>;
    renderable.geometry?.dispose();
    const material = renderable.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}
