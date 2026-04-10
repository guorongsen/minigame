"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EffectSystem = void 0;
let fxId = 1;
/**
 * Lightweight particles and floating text for combat feedback.
 */
class EffectSystem {
    constructor() {
        this.floatingTexts = [];
        this.particles = [];
        this.ringPulses = [];
    }
    addFloatingText(x, y, text, color = "#ffffff") {
        this.floatingTexts.push({
            id: fxId++,
            x,
            y,
            text,
            color,
            life: 0.8
        });
    }
    burst(x, y, color, count = 8) {
        for (let i = 0; i < count; i += 1) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 40 + Math.random() * 140;
            this.particles.push({
                id: fxId++,
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 3,
                color,
                life: 0.4 + Math.random() * 0.35
            });
        }
    }
    pulseRing(x, y, color, startRadius = 12, endRadius = 120, duration = 0.48, lineWidth = 4) {
        this.ringPulses.push({
            id: fxId++,
            x,
            y,
            radius: startRadius,
            endRadius: Math.max(startRadius + 1, endRadius),
            lineWidth: Math.max(1, lineWidth),
            color,
            life: duration,
            maxLife: duration
        });
    }
    update(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i -= 1) {
            const fx = this.floatingTexts[i];
            fx.life -= dt;
            fx.y -= 22 * dt;
            if (fx.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
        for (let i = this.particles.length - 1; i >= 0; i -= 1) {
            const p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        for (let i = this.ringPulses.length - 1; i >= 0; i -= 1) {
            const ring = this.ringPulses[i];
            ring.life -= dt;
            const progress = 1 - Math.max(0, ring.life / Math.max(0.001, ring.maxLife));
            ring.radius += (ring.endRadius - ring.radius) * Math.min(1, progress * 0.45 + 0.18);
            if (ring.life <= 0) {
                this.ringPulses.splice(i, 1);
            }
        }
    }
    render(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life / 0.7);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
        for (const ring of this.ringPulses) {
            ctx.globalAlpha = Math.max(0, ring.life / Math.max(0.001, ring.maxLife));
            ctx.strokeStyle = ring.color;
            ctx.lineWidth = ring.lineWidth;
            ctx.beginPath();
            ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const fx of this.floatingTexts) {
            ctx.globalAlpha = Math.max(0, fx.life / 0.8);
            ctx.fillStyle = fx.color;
            ctx.font = "16px sans-serif";
            ctx.fillText(fx.text, fx.x, fx.y);
        }
        ctx.globalAlpha = 1;
    }
}
exports.EffectSystem = EffectSystem;
