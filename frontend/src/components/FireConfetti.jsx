import { useEffect, useRef } from 'react';

const PARTICLES = 12;
const EMOJIS = ['🔥', '✨', '🔥', '⚡', '🔥', '✨'];

export default function FireConfetti() {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const particlesRef = useRef([]);

    useEffect(() => {
        const container = canvasRef.current;
        if (!container) return;

        function createParticle() {
            const el = document.createElement('span');
            el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            el.style.cssText = `
                position: fixed;
                pointer-events: none;
                z-index: 0;
                font-size: ${8 + Math.random() * 10}px;
                opacity: 0;
                transition: none;
                will-change: transform, opacity;
            `;
            container.appendChild(el);
            return {
                el,
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 20,
                speed: 0.3 + Math.random() * 0.6,
                drift: (Math.random() - 0.5) * 0.4,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.01 + Math.random() * 0.02,
                opacity: 0,
                maxOpacity: 0.15 + Math.random() * 0.2,
                fadeIn: true,
            };
        }

        function resetParticle(p) {
            p.x = Math.random() * window.innerWidth;
            p.y = window.innerHeight + 20;
            p.speed = 0.3 + Math.random() * 0.6;
            p.drift = (Math.random() - 0.5) * 0.4;
            p.opacity = 0;
            p.maxOpacity = 0.15 + Math.random() * 0.2;
            p.fadeIn = true;
            p.el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        }

        // Stagger creation
        for (let i = 0; i < PARTICLES; i++) {
            const p = createParticle();
            p.y = Math.random() * window.innerHeight;
            p.opacity = p.maxOpacity * Math.random();
            p.fadeIn = false;
            particlesRef.current.push(p);
        }

        function animate() {
            particlesRef.current.forEach(p => {
                p.y -= p.speed;
                p.wobble += p.wobbleSpeed;
                p.x += p.drift + Math.sin(p.wobble) * 0.3;

                if (p.fadeIn) {
                    p.opacity = Math.min(p.opacity + 0.003, p.maxOpacity);
                    if (p.opacity >= p.maxOpacity) p.fadeIn = false;
                }

                if (p.y < -30) {
                    resetParticle(p);
                } else if (p.y < window.innerHeight * 0.15) {
                    p.opacity = Math.max(0, p.opacity - 0.004);
                }

                p.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
                p.el.style.opacity = p.opacity;
            });
            animRef.current = requestAnimationFrame(animate);
        }

        animRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animRef.current);
            particlesRef.current.forEach(p => p.el.remove());
            particlesRef.current = [];
        };
    }, []);

    return <div ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
}
