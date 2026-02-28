"use client";

import React, { useEffect, useRef } from "react";

export function InteractiveBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let width = window.innerWidth;
        let height = window.innerHeight;

        // Mouse state
        let mouseX = width / 2;
        let mouseY = height / 2;

        const handleResize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                width = parent.clientWidth;
                height = parent.clientHeight;
                canvas.width = width;
                canvas.height = height;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                const rect = canvas.getBoundingClientRect();
                mouseX = e.touches[0].clientX - rect.left;
                mouseY = e.touches[0].clientY - rect.top;
            }
        };

        window.addEventListener("resize", handleResize);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("touchmove", handleTouchMove, { passive: true });

        handleResize();

        // ─── Animation Logic ──────────────────────────────────────────────

        class PaperPlane {
            x: number;
            y: number;
            vx: number;
            vy: number;
            angle: number;
            turnSpeed: number;
            speed: number;
            trail: { x: number; y: number }[];
            color: string;

            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.angle = Math.random() * Math.PI * 2;
                this.turnSpeed = 0.02 + Math.random() * 0.03;
                this.speed = 1.5 + Math.random() * 1.5;
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
                this.trail = [];
                this.color = Math.random() > 0.5 ? "#FF385C" : "#444444";
            }

            update() {
                // Calculate vector to mouse
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Only steer if relatively close or just wander
                const targetAngle = Math.atan2(dy, dx);

                // Smooth rotation towards target
                let diff = targetAngle - this.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;

                if (dist < 100) {
                    // scatter
                    this.angle -= diff * this.turnSpeed * 2;
                } else {
                    this.angle += diff * this.turnSpeed;
                }

                // Add some random noise to flight path
                this.angle += (Math.random() - 0.5) * 0.05;

                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;

                this.x += this.vx;
                this.y += this.vy;

                // Wrap around screen
                if (this.x < -50) this.x = width + 50;
                if (this.x > width + 50) this.x = -50;
                if (this.y < -50) this.y = height + 50;
                if (this.y > height + 50) this.y = -50;

                // Trail logic
                this.trail.push({ x: this.x, y: this.y });
                if (this.trail.length > 25) this.trail.shift();
            }

            draw(ctx: CanvasRenderingContext2D) {
                // Draw Trail (Dashed flight path style)
                ctx.beginPath();
                ctx.strokeStyle = this.color === "#FF385C" ? "rgba(255, 56, 92, 0.15)" : "rgba(0, 0, 0, 0.08)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 6]);
                if (this.trail.length > 0) {
                    ctx.moveTo(this.trail[0].x, this.trail[0].y);
                    for (let i = 1; i < this.trail.length; i++) {
                        ctx.lineTo(this.trail[i].x, this.trail[i].y);
                    }
                }
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw Plane
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);

                // Sketchy style plane
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";

                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(-8, 6);
                ctx.lineTo(-4, 0);
                ctx.lineTo(-8, -6);
                ctx.closePath();
                ctx.stroke();

                ctx.fillStyle = "rgba(255,255,255,0.6)";
                ctx.fill();

                ctx.restore();
            }
        }

        class MapDot {
            x: number;
            y: number;
            r: number;

            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.r = 1 + Math.random() * 2;
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.fillStyle = "rgba(0,0,0,0.05)";
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const planes = Array.from({ length: 6 }, () => new PaperPlane());
        const mapDots = Array.from({ length: 40 }, () => new MapDot());

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            mapDots.forEach((d) => d.draw(ctx));

            planes.forEach((p) => {
                p.update();
                p.draw(ctx);
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("touchmove", handleTouchMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 0, // Behind the chat bubbles
                opacity: 0.25, // Slightly transparent
            }}
        />
    );
}
