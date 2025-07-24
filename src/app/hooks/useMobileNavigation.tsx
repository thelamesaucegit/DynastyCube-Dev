// src/app/hooks/useMobileNavigation.ts
import { useState, useEffect, useRef } from 'react';

interface UseMobileNavigationReturn {
  isMenuOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
  menuRef: React.RefObject<HTMLUListElement | null>;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
}

export const useMobileNavigation = (): UseMobileNavigationReturn => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLUListElement | null>(null); 
  const toggleRef = useRef<HTMLButtonElement | null>(null);  
  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (menuRef.current && toggleRef.current &&
          !menuRef.current.contains(target) &&
          !toggleRef.current.contains(target)) {
        closeMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  return {
    isMenuOpen,
    toggleMenu,
    closeMenu,
    menuRef,
    toggleRef
  };
};