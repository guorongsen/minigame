"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.lerp = lerp;
exports.distance = distance;
exports.length = length;
exports.normalize = normalize;
exports.scale = scale;
exports.add = add;
exports.randomRange = randomRange;
exports.randomInt = randomInt;
exports.pickWeighted = pickWeighted;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
function length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}
function normalize(v) {
    const len = length(v);
    if (len <= 0.0001) {
        return { x: 0, y: 0 };
    }
    return { x: v.x / len, y: v.y / len };
}
function scale(v, s) {
    return { x: v.x * s, y: v.y * s };
}
function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}
function randomRange(min, max) {
    return min + Math.random() * (max - min);
}
function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}
function pickWeighted(items, weightFn) {
    let total = 0;
    for (const item of items) {
        total += Math.max(0, weightFn(item));
    }
    if (total <= 0) {
        return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
    }
    let r = Math.random() * total;
    for (const item of items) {
        r -= Math.max(0, weightFn(item));
        if (r <= 0) {
            return item;
        }
    }
    return items.length > 0 ? items[items.length - 1] : null;
}
