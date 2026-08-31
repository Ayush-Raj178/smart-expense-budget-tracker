import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';

const TiltCard = ({ children, className = '', tiltIntensity = 6 }) => {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasHoverCapability, setHasHoverCapability] = useState(true);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 });

  const backgroundX = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 });
  const backgroundY = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 });

  const background = useMotionTemplate`radial-gradient(circle at ${backgroundX}px ${backgroundY}px, rgb(var(--border-strong) / 0.12) 0%, transparent 50%)`;

  useEffect(() => {
    // Check if device has hover capability
    const mediaQuery = window.matchMedia('(hover: hover)');
    setHasHoverCapability(mediaQuery.matches);

    // Check for reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotionQuery.matches) {
      setHasHoverCapability(false);
    }
  }, []);

  const handleMouseMove = (e) => {
    if (!hasHoverCapability || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseXLocal = e.clientX - rect.left;
    const mouseYLocal = e.clientY - rect.top;

    const xPct = mouseXLocal / width;
    const yPct = mouseYLocal / height;

    const rotateXVal = (yPct - 0.5) * tiltIntensity * -1;
    const rotateYVal = (xPct - 0.5) * tiltIntensity;

    rotateX.set(rotateXVal);
    rotateY.set(rotateYVal);

    mouseX.set(mouseXLocal);
    mouseY.set(mouseYLocal);

    backgroundX.set(mouseXLocal);
    backgroundY.set(mouseYLocal);
  };

  const handleMouseLeave = () => {
    if (!hasHoverCapability) return;

    rotateX.set(0);
    rotateY.set(0);
    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    if (!hasHoverCapability) return;
    setIsHovered(true);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
      className={`relative ${className}`}
    >
      {children}
      {hasHoverCapability && isHovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{ background }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  );
};

export default TiltCard;
