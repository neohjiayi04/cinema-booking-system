/* eslint-disable react/no-unknown-property -- react-three-fiber elements (mesh, args, position...) are not DOM props */
import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SCREEN_W, SCREEN_CENTER, EYE_HEIGHT, floorHeight } from "./seatMath";

const COLORS = { taken: "#2b2f3a", selected: "#5a3bff", recliner: "#b3243a", standard: "#8f1626" };

// Placeholder film still drawn on a canvas. Swap for a real poster with useLoader(THREE.TextureLoader, url).
function makeScreenTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 214;
  const x = c.getContext("2d");
  const sky = x.createLinearGradient(0, 0, 0, 214);
  sky.addColorStop(0, "#f1d2a8");
  sky.addColorStop(0.6, "#d79f6c");
  sky.addColorStop(1, "#a8704a");
  x.fillStyle = sky;
  x.fillRect(0, 0, 512, 214);
  x.fillStyle = "#f8e7c9";
  x.beginPath();
  x.arc(380, 70, 22, 0, 7);
  x.fill();
  x.fillStyle = "#9a6038";
  x.beginPath();
  x.moveTo(0, 214);
  x.lineTo(0, 150);
  x.quadraticCurveTo(150, 110, 300, 160);
  x.quadraticCurveTo(420, 120, 512, 150);
  x.lineTo(512, 214);
  x.fill();
  x.fillStyle = "#6e4529";
  x.beginPath();
  x.moveTo(0, 214);
  x.lineTo(0, 185);
  x.quadraticCurveTo(200, 150, 512, 190);
  x.lineTo(512, 214);
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Hall({ seats, selectedIds }) {
  const baseRef = useRef();
  const backRef = useRef();
  const screenTex = useMemo(() => makeScreenTexture(), []);

  const depth = useMemo(() => Math.max(20, Math.max(...seats.map((s) => s.y)) + 3), [seats]);
  const rows = useMemo(() => {
    const m = new Map();
    seats.forEach((s) => m.set(s.rowIndex, s.y));
    return [...m.entries()];
  }, [seats]);

  // Instanced meshes keep 100+ seats cheap to draw.
  useLayoutEffect(() => {
    const base = baseRef.current;
    const back = backRef.current;
    if (!base || !back) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    seats.forEach((s, i) => {
      const h = floorHeight(s.rowIndex);
      m.makeTranslation(s.x, h + 0.175, s.y);
      base.setMatrixAt(i, m);
      m.makeTranslation(s.x, h + 0.4, s.y + 0.22);
      back.setMatrixAt(i, m);
      c.set(
        s.status !== "AVAILABLE" ? COLORS.taken
          : selectedIds.includes(s.id) ? COLORS.selected
          : s.type === "RECLINER" ? COLORS.recliner
          : COLORS.standard
      );
      base.setColorAt(i, c);
      back.setColorAt(i, c);
    });
    [base, back].forEach((o) => {
      o.instanceMatrix.needsUpdate = true;
      if (o.instanceColor) o.instanceColor.needsUpdate = true;
    });
  }, [seats, selectedIds]);

  return (
    <>
      <mesh position={[0, 4.5, depth / 2]}>
        <boxGeometry args={[20, 9, depth]} />
        <meshLambertMaterial color="#151a2e" side={THREE.BackSide} />
      </mesh>

      {rows.map(([ri, z]) => {
        const h = floorHeight(ri);
        return (
          <group key={ri}>
            <mesh position={[0, h / 2, z]}>
              <boxGeometry args={[20, h, 1.1]} />
              <meshLambertMaterial color="#1b1e2a" />
            </mesh>
            <mesh position={[0, h, z - 0.54]}>
              <boxGeometry args={[20, 0.03, 0.04]} />
              <meshBasicMaterial color="#4318ff" />
            </mesh>
          </group>
        );
      })}

      <mesh position={[0, SCREEN_CENTER[1], 0.02]}>
        <planeGeometry args={[SCREEN_W, 4.8]} />
        <meshBasicMaterial map={screenTex} toneMapped={false} />
      </mesh>

      <instancedMesh key={`base-${seats.length}`} ref={baseRef} args={[null, null, seats.length]}>
        <boxGeometry args={[0.55, 0.35, 0.55]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh key={`back-${seats.length}`} ref={backRef} args={[null, null, seats.length]}>
        <boxGeometry args={[0.55, 0.8, 0.14]} />
        <meshLambertMaterial />
      </instancedMesh>
    </>
  );
}

// Flies the camera to the focused seat and adds the drag-to-look offset.
function Rig({ seat, look }) {
  const camera = useThree((s) => s.camera);
  const want = useRef(new THREE.Vector3(0, 2.6, 16));
  const target = useMemo(() => new THREE.Vector3(...SCREEN_CENTER), []);
  const yaw = useRef(0);
  const pitch = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (seat) want.current.set(seat.x, floorHeight(seat.rowIndex) + EYE_HEIGHT, seat.y + 0.05);
    camera.position.lerp(want.current, 1 - Math.exp(-dt * 5));
    yaw.current += (look.current.yaw - yaw.current) * (1 - Math.exp(-dt * 8));
    pitch.current += (look.current.pitch - pitch.current) * (1 - Math.exp(-dt * 8));
    camera.lookAt(target);
    camera.rotateY(yaw.current);
    camera.rotateX(pitch.current);
  });
  return null;
}

export default function SeatView3D({ seats, selectedIds, focusSeat }) {
  const look = useRef({ yaw: 0, pitch: 0 });
  const drag = useRef(null);

  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const l = look.current;
    l.yaw = Math.max(-0.9, Math.min(0.9, l.yaw + (e.clientX - drag.current.x) * 0.004));
    l.pitch = Math.max(-0.4, Math.min(0.4, l.pitch + (e.clientY - drag.current.y) * 0.003));
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => {
    drag.current = null;
    look.current.yaw = 0; // ease back to the screen
    look.current.pitch = 0;
  };

  return (
    <div className="sp-pov" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 2.6, 16], fov: 60, near: 0.1, far: 60 }}>
        <color attach="background" args={["#05060a"]} />
        {/* Newer three.js versions light more strongly than old ones; lower these if the hall looks washed out. */}
        <ambientLight intensity={1.1} />
        <directionalLight position={[0, 6, 12]} intensity={0.8} />
        <Hall seats={seats} selectedIds={selectedIds} />
        <Rig seat={focusSeat} look={look} />
      </Canvas>
      {focusSeat && <span className="sp-tag">View from {focusSeat.label}</span>}
      <span className="sp-drag">Drag to look around</span>
    </div>
  );
}