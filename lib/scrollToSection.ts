'use client';

import type React from 'react';

export function scrollToSectionById(sectionId: string): boolean {
  if (typeof window === 'undefined' || !sectionId) return false;
  const cleanId = sectionId.replace(/^#/, '').trim();
  if (!cleanId) return false;
  const target = document.getElementById(cleanId);
  if (!target) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

export function handleSectionHrefClick(
  e: React.MouseEvent<HTMLAnchorElement>,
  href?: string | null
): void {
  if (!href) return;
  const trimmed = href.trim();

  if (trimmed.startsWith('#') && trimmed.length > 1) {
    e.preventDefault();
    const id = trimmed.slice(1);
    const scrolled = scrollToSectionById(id);
    if (!scrolled && typeof window !== 'undefined') {
      window.location.assign(`/?section=${encodeURIComponent(id)}`);
    }
    return;
  }

  if (trimmed.startsWith('/#') && trimmed.length > 2) {
    const id = trimmed.slice(2);
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      e.preventDefault();
      scrollToSectionById(id);
    }
  }
}
