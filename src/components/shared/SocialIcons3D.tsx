"use client";

import { useRef } from "react";

interface SocialIcon3DProps {
  href: string;
  label: string;
  bgColor: string;
  hoverBgColor: string;
  shadowColor: string;
  icon: React.ReactNode;
  newTab?: boolean;
}

function SocialIcon3D({
  href,
  label,
  bgColor,
  hoverBgColor,
  shadowColor,
  icon,
  newTab = true,
}: SocialIcon3DProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const iconWrapperRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const card = cardRef.current;
    const iconWrapper = iconWrapperRef.current;
    if (!card || !iconWrapper) return;
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Tilt settings
    const rotateX = ((y - centerY) / centerY) * -25;
    const rotateY = ((x - centerX) / centerX) * 25;
    
    card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.1, 1.1, 1.1)`;
    card.style.boxShadow = `0 15px 35px ${shadowColor}70, 0 5px 15px rgba(0,0,0,0.3)`;
    
    // Move the layers slightly for parallax look
    const layers = iconWrapper.querySelectorAll('.icon-layer');
    layers.forEach((layer, idx) => {
      const el = layer as HTMLElement;
      const offset = (idx + 1) * 3;
      const moveX = ((x - centerX) / centerX) * offset;
      const moveY = ((y - centerY) / centerY) * offset;
      el.style.transform = `translate(${moveX}px, ${moveY}px)`;
      el.style.opacity = '0.7';
    });
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    const iconWrapper = iconWrapperRef.current;
    if (!card || !iconWrapper) return;
    
    card.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    card.style.boxShadow = `0 4px 12px ${shadowColor}30`;
    
    const layers = iconWrapper.querySelectorAll('.icon-layer');
    layers.forEach((layer) => {
      const el = layer as HTMLElement;
      el.style.transform = `translate(0px, 0px)`;
      el.style.opacity = '0';
    });
  };

  return (
    <a
      ref={cardRef}
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      aria-label={label}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "56px",
        height: "56px",
        borderRadius: "16px", // Changed to rounded-xl style for more surface area
        background: bgColor,
        color: "#fff",
        transition: "transform 0.1s ease-out, box-shadow 0.2s ease, background 0.3s ease",
        boxShadow: `0 4px 12px ${shadowColor}30`,
        cursor: "pointer",
        textDecoration: "none",
        willChange: "transform",
        transformStyle: "preserve-3d",
        position: "relative",
        overflow: "visible",
      }}
      className={`social-icon-3d`}
    >
      <div 
        ref={iconWrapperRef}
        style={{
          position: "relative",
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Layer 1 - Cyan Glitch (Reflects ::before in screenshot) */}
        <div 
          className="icon-layer"
          style={{
            position: "absolute",
            color: "#00f2ea",
            transition: "transform 0.1s ease-out, opacity 0.2s",
            opacity: 0,
            zIndex: -1,
            pointerEvents: "none",
          }}
        >
          {icon}
        </div>

        {/* Layer 2 - Magenta Glitch (Reflects ::after in screenshot) */}
        <div 
          className="icon-layer"
          style={{
            position: "absolute",
            color: "#ff0050",
            transition: "transform 0.1s ease-out, opacity 0.2s",
            opacity: 0,
            zIndex: -1,
            pointerEvents: "none",
          }}
        >
          {icon}
        </div>

        {/* Primary Icon */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {icon}
        </div>
      </div>
    </a>
  );
}

export function SocialIcons3D() {
  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {/* Facebook */}
      <SocialIcon3D
        href="https://www.facebook.com/qareeblak"
        label="Facebook"
        bgColor="#1877F2"
        hoverBgColor="#0d65d9"
        shadowColor="#1877F2"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        }
      />

      {/* Instagram */}
      <SocialIcon3D
        href="https://www.instagram.com/qareeblak"
        label="Instagram"
        bgColor="linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)"
        hoverBgColor="#cc2366"
        shadowColor="#dc2743"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        }
      />

      {/* X (Twitter) */}
      <SocialIcon3D
        href="https://x.com/qareeblak"
        label="X (Twitter)"
        bgColor="#000000"
        hoverBgColor="#1a1a1a"
        shadowColor="#555555"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
          </svg>
        }
      />

      {/* TikTok */}
      <SocialIcon3D
        href="https://www.tiktok.com/@qareeblak"
        label="TikTok"
        bgColor="#010101"
        hoverBgColor="#1a1a1a"
        shadowColor="#69C9D0"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.73a4.85 4.85 0 0 1-1.01-.04z"/>
          </svg>
        }
      />

      {/* Email */}
      <SocialIcon3D
        href="mailto:qareeblak@qareeblak.com"
        label="Email"
        bgColor="#EA4335"
        hoverBgColor="#d93025"
        shadowColor="#EA4335"
        newTab={false}
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
        }
      />
    </div>
  );
}
